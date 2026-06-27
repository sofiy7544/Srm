"""Manager Telegram bot (python-telegram-bot v21, async).

Run standalone:  python -m app.telegram.bot

Features:
  /start                 — help
  /stats                 — pipeline counts
  /today                 — leads created today
  /hot                   — top hot leads
  /lead <id>             — show lead card
  /status <id> <status>  — change status
  /comment <id> <text>   — add manager comment
  /remind <id> <minutes> <text> — set a reminder

The bot reads/writes through the same DB/services as the API.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.config import settings
from app.core.logging import get_logger
from app.database import SessionLocal
from app.models.lead import Lead, LeadStatus
from app.services import leads as lead_service

logger = get_logger("bot")

HELP = (
    "🥤 <b>Stanley CRM bot</b>\n\n"
    "/stats — pipeline counts\n"
    "/today — today's leads\n"
    "/hot — hottest leads\n"
    "/lead &lt;id&gt; — lead card\n"
    "/status &lt;id&gt; &lt;status&gt; — change status\n"
    "/comment &lt;id&gt; &lt;text&gt; — add comment\n"
    "/remind &lt;id&gt; &lt;min&gt; &lt;text&gt; — reminder"
)


def _card(lead: Lead) -> str:
    return (
        f"<b>Lead #{lead.id}</b>  (score {lead.score})\n"
        f"Name: {lead.name or '—'}\n"
        f"Phone: {lead.phone or '—'}\n"
        f"Telegram: {lead.telegram or '—'}\n"
        f"Interest: {lead.interest or '—'}\n"
        f"Source: {lead.source or '—'}\n"
        f"Status: {lead.status.value}\n"
        f"Consent: {'yes' if lead.consent else 'no'}\n"
        f"Comment: {lead.manager_comment or '—'}"
    )


async def cmd_start(update, context):
    await update.message.reply_html(HELP)


async def cmd_stats(update, context):
    with SessionLocal() as db:
        total = db.scalar(select(func.count(Lead.id))) or 0
        lines = [f"<b>Total:</b> {total}"]
        for s in LeadStatus:
            n = db.scalar(select(func.count(Lead.id)).where(Lead.status == s)) or 0
            lines.append(f"{s.value}: {n}")
    await update.message.reply_html("\n".join(lines))


async def cmd_today(update, context):
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    with SessionLocal() as db:
        rows = list(
            db.scalars(select(Lead).where(Lead.created_at >= start).order_by(Lead.score.desc()))
        )
    if not rows:
        await update.message.reply_html("No leads today yet.")
        return
    text = "<b>Today's leads</b>\n" + "\n".join(
        f"#{l.id} · {l.name or '—'} · {l.score} · {l.status.value}" for l in rows[:30]
    )
    await update.message.reply_html(text)


async def cmd_hot(update, context):
    with SessionLocal() as db:
        rows = lead_service.hot_leads(db, limit=10)
    text = "<b>🔥 Hot leads</b>\n" + "\n".join(
        f"#{l.id} · {l.name or '—'} · {l.score}" for l in rows
    )
    await update.message.reply_html(text or "None")


async def cmd_lead(update, context):
    if not context.args:
        await update.message.reply_text("Usage: /lead <id>")
        return
    with SessionLocal() as db:
        lead = db.get(Lead, int(context.args[0]))
        if not lead:
            await update.message.reply_text("Not found")
            return
        await update.message.reply_html(_card(lead))


async def cmd_status(update, context):
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /status <id> <status>")
        return
    lead_id, status = int(context.args[0]), context.args[1]
    try:
        new_status = LeadStatus(status)
    except ValueError:
        await update.message.reply_text(
            "Invalid status. One of: " + ", ".join(s.value for s in LeadStatus)
        )
        return
    with SessionLocal() as db:
        lead = db.get(Lead, lead_id)
        if not lead:
            await update.message.reply_text("Not found")
            return
        lead_service.set_status(db, lead, new_status)
        db.commit()
    await update.message.reply_html(f"Lead #{lead_id} → <b>{status}</b> ✅")


async def cmd_comment(update, context):
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /comment <id> <text>")
        return
    lead_id = int(context.args[0])
    comment = " ".join(context.args[1:])
    with SessionLocal() as db:
        lead = db.get(Lead, lead_id)
        if not lead:
            await update.message.reply_text("Not found")
            return
        lead.manager_comment = comment
        lead_service.log(db, "lead", f"Lead #{lead_id} comment updated")
        db.commit()
    await update.message.reply_text("Comment saved ✅")


async def on_callback(update, context):
    """Handle inline-button presses on lead notifications.

    callback_data formats: lead_reply:<id> | lead_work:<id> | lead_close:<id>
    """
    query = update.callback_query
    await query.answer()
    action, _, raw_id = query.data.partition(":")
    try:
        lead_id = int(raw_id)
    except ValueError:
        return

    with SessionLocal() as db:
        lead = db.get(Lead, lead_id)
        if not lead:
            await query.edit_message_text("Lead not found.")
            return

        if action == "lead_reply":
            # Show contact details so the manager can respond.
            await query.message.reply_html(
                f"✉️ <b>Contact lead #{lead.id}</b>\n"
                f"Name: {lead.name or '—'}\n"
                f"Phone: {lead.phone or '—'}\n"
                f"Telegram: {lead.telegram or '—'}\n"
                f"Instagram: {lead.instagram or '—'}"
            )
            return

        if action == "lead_work":
            lead_service.set_status(db, lead, LeadStatus.contacted)
            db.commit()
            await query.edit_message_text(f"🛠 Lead #{lead.id} → <b>в работе</b>", parse_mode="HTML")
        elif action == "lead_close":
            lead_service.set_status(db, lead, LeadStatus.archived)
            db.commit()
            await query.edit_message_text(f"✅ Lead #{lead.id} → <b>закрыт</b>", parse_mode="HTML")


async def cmd_remind(update, context):
    if len(context.args) < 3:
        await update.message.reply_text("Usage: /remind <id> <minutes> <text>")
        return
    lead_id, minutes = int(context.args[0]), int(context.args[1])
    text = " ".join(context.args[2:])
    chat_id = update.effective_chat.id

    async def _fire(ctx):
        await ctx.bot.send_message(chat_id, f"⏰ Reminder · lead #{lead_id}: {text}")

    when = timedelta(minutes=minutes)
    if context.job_queue:
        context.job_queue.run_once(_fire, when)
        await update.message.reply_text(f"Reminder set in {minutes} min ✅")
    else:
        await update.message.reply_text("Job queue unavailable.")


def build_application():
    """Construct the PTB application with all handlers registered."""
    from telegram.ext import Application, CallbackQueryHandler, CommandHandler

    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set")

    app = Application.builder().token(settings.telegram_bot_token).build()
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_start))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(CommandHandler("today", cmd_today))
    app.add_handler(CommandHandler("hot", cmd_hot))
    app.add_handler(CommandHandler("lead", cmd_lead))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("comment", cmd_comment))
    app.add_handler(CommandHandler("remind", cmd_remind))
    return app


def main() -> None:
    logger.info("Starting Telegram bot…")
    app = build_application()
    app.run_polling()


if __name__ == "__main__":
    main()
