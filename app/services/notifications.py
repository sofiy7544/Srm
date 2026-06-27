"""Outbound notifications (Telegram). Best-effort, never blocks the request."""
from __future__ import annotations

import httpx

from app.config import settings
from app.core.logging import get_logger

logger = get_logger("notifications")


def lead_action_keyboard(lead_id: int) -> dict:
    """Inline keyboard for a lead notification: Reply / In-progress / Closed.

    callback_data is handled by the running Telegram bot (app/telegram/bot.py).
    """
    return {
        "inline_keyboard": [
            [
                {"text": "✉️ Ответить", "callback_data": f"lead_reply:{lead_id}"},
                {"text": "🛠 В работу", "callback_data": f"lead_work:{lead_id}"},
                {"text": "✅ Закрыт", "callback_data": f"lead_close:{lead_id}"},
            ]
        ]
    }


def notify_manager(text: str, buttons: dict | None = None) -> bool:
    """Send a message to the configured manager chat via Telegram Bot API.

    Optionally attaches an inline keyboard (`buttons` = reply_markup dict).
    """
    if not (settings.telegram_bot_token and settings.telegram_manager_chat_id):
        logger.info("Telegram notify skipped: bot not configured")
        return False
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": settings.telegram_manager_chat_id,
        "text": text,
        "parse_mode": "HTML",
    }
    if buttons:
        payload["reply_markup"] = buttons
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
        return True
    except httpx.HTTPError as exc:  # pragma: no cover - network dependent
        logger.warning("Telegram notify failed: %s", exc)
        return False
