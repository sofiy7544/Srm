"""Meta webhooks (Lead Ads) and first-party Pixel event ingestion.

Lead Ads webhook flow (official):
  GET  /webhooks/meta  — verification handshake (hub.challenge / VERIFY_TOKEN)
  POST /webhooks/meta  — leadgen notifications; we pull full lead via Graph API
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.core.logging import get_logger
from app.database import get_db
from app.models.event import PixelEvent
from app.services import leads as lead_service
from app.services import meta_client
from app.services.messaging import auto_reply
from app.services.notifications import lead_action_keyboard, notify_manager
from app.services.scoring import is_hot

router = APIRouter(tags=["webhooks"])
logger = get_logger("webhook")


@router.get("/webhooks/meta")
def verify_webhook(request: Request):
    """Meta verification handshake. Echo hub.challenge if the token matches."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    if mode == "subscribe" and token == settings.verify_token:
        return PlainTextResponse(challenge or "")
    return PlainTextResponse("verification failed", status_code=403)


@router.post("/webhooks/meta")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle leadgen change notifications.

    For each leadgen entry we fetch the full lead from the Graph API (we never
    receive raw PII in the webhook body itself) and upsert it.
    """
    body = await request.json()
    obj = body.get("object")  # 'page' (leadgen + messenger) or 'instagram'
    processed = 0
    for entry in body.get("entry", []):
        # 1) Lead Ads change notifications
        for change in entry.get("changes", []):
            if change.get("field") != "leadgen":
                continue
            value = change.get("value", {})
            leadgen_id = value.get("leadgen_id")
            if not leadgen_id:
                continue
            data = _fetch_and_map_lead(leadgen_id, value)
            lead, created = lead_service.upsert_by_external_id(db, f"meta:{leadgen_id}", data)
            db.commit()
            processed += 1
            if created:
                _notify_new_lead(lead)

        # 2) Inbound messages (Messenger / Instagram) -> auto-reply + capture lead
        for event in entry.get("messaging", []):
            processed += _handle_inbound_message(db, event, obj)

    return JSONResponse({"received": True, "processed": processed})


def _notify_new_lead(lead) -> None:
    """Telegram alert with inline action buttons for a freshly captured lead."""
    tag = "🔥 HOT" if is_hot(lead.score) else "new"
    notify_manager(
        f"<b>{tag} lead</b> #{lead.id}\n"
        f"Score: {lead.score}\nInterest: {lead.interest or '—'}\n"
        f"Source: {lead.source}",
        buttons=lead_action_keyboard(lead.id),
    )


def _handle_inbound_message(db: Session, event: dict, obj: str | None) -> int:
    """Reply to a person who messaged us first and record them as a lead.

    Compliant: only responds to inbound conversations the user initiated.
    """
    sender = (event.get("sender") or {}).get("id")
    message = event.get("message") or {}
    text = message.get("text")
    # Ignore echoes of our own outbound messages.
    if not sender or message.get("is_echo"):
        return 0

    platform = "instagram" if obj == "instagram" else "messenger"
    field = "instagram" if platform == "instagram" else "telegram"
    data = {
        field: sender,
        "source": f"{platform}_dm",
        "tags": f"{platform}_inbound",
        # The person contacted us directly => they consented to be replied to.
        "consent": True,
    }
    lead, created = lead_service.upsert_by_external_id(db, f"{platform}:{sender}", data)
    if text:
        lead_service.log(db, "message", f"Inbound {platform} msg for lead #{lead.id}")
    db.commit()

    if created:
        # First message in a new conversation -> greet & qualify automatically.
        auto_reply(sender, platform)
        _notify_new_lead(lead)
    return 1


def _fetch_and_map_lead(leadgen_id: str, value: dict) -> dict:
    """Pull lead detail from Graph API and map to our schema. Degrades safely."""
    name = phone = email = city = None
    try:
        # We fetch the single lead object directly via Graph for accuracy.
        import httpx

        url = f"{meta_client.GRAPH_BASE}/{settings.meta_api_version}/{leadgen_id}"
        params = {
            "access_token": settings.meta_access_token,
            "fields": "field_data,campaign_id,adset_id,ad_id",
        }
        with httpx.Client(timeout=20) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            detail = resp.json()
        fields = meta_client.parse_lead_field_data(detail.get("field_data", []))
        name = fields.get("full_name") or fields.get("name")
        phone = fields.get("phone_number") or fields.get("phone")
        email = fields.get("email")
        city = fields.get("city")
        value = {**value, **{k: detail.get(k) for k in ("campaign_id", "adset_id", "ad_id")}}
    except Exception as exc:  # pragma: no cover - network/credential dependent
        logger.warning("Could not fetch full lead detail: %s", exc)

    return {
        "name": name,
        "phone": phone,
        "email": email,
        "city": city,
        "source": "lead_ads",
        "campaign_id": value.get("campaign_id"),
        "adset_id": value.get("adset_id"),
        "ad_id": value.get("ad_id"),
        # Lead Ads consent is captured in the form itself.
        "consent": True,
    }


@router.post("/webhooks/pixel-event")
async def ingest_pixel_event(request: Request, db: Session = Depends(get_db)):
    """First-party endpoint our landing JS calls alongside the Meta Pixel.

    Stores the event for our own segmentation and (optionally) mirrors it to the
    Conversions API server-side. No PII is required — anon_id is a cookie value.
    """
    payload = await request.json()
    event = PixelEvent(
        event_name=payload.get("event_name", "PageView"),
        segment=payload.get("segment"),
        anon_id=payload.get("anon_id"),
        value=payload.get("value"),
        currency=payload.get("currency"),
    )
    db.add(event)
    db.commit()

    # Mirror server-side (Conversions API) when configured — best effort.
    meta_client.send_conversion_event(
        event_name=event.event_name,
        event_source_url=payload.get("source_url"),
        value=event.value,
        currency=event.currency or "USD",
    )
    return {"ok": True}
