"""Messenger & Instagram messaging — official Send API only.

Sends replies via POST /{page-id}/messages (or me/messages) using the Page
access token. This is the official, policy-compliant way to reply to people who
have messaged your Page/IG first (within Meta's messaging window).

Compliance: we only reply to inbound conversations the user initiated. There is
NO unsolicited outreach and NO messaging of strangers.
"""
from __future__ import annotations

import httpx

from app.config import settings
from app.core.logging import get_logger
from app.services.meta_client import GRAPH_BASE

logger = get_logger("messaging")

# Default greeting + qualification used for new inbound conversations.
DEFAULT_GREETING = (
    "Привет! 👋 Спасибо за сообщение. Это магазин Stanley & Sport. "
    "Подскажите, что вас интересует — термос, фитнес-аксессуары, вода или питание? "
    "Оставьте, пожалуйста, ваш телефон, и менеджер подберёт лучшее предложение."
)


def send_message(recipient_id: str, text: str, platform: str = "messenger") -> bool:
    """Send a text reply to a user who messaged us first.

    `platform` is 'messenger' or 'instagram'; both use the same Graph endpoint
    with the Page access token.
    """
    if not (settings.meta_access_token and settings.meta_page_id):
        logger.info("Send API skipped: page not configured")
        return False
    url = f"{GRAPH_BASE}/{settings.meta_api_version}/{settings.meta_page_id}/messages"
    payload = {
        "recipient": {"id": recipient_id},
        "messaging_type": "RESPONSE",
        "message": {"text": text},
        "access_token": settings.meta_access_token,
    }
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
        return True
    except httpx.HTTPError as exc:  # pragma: no cover - network dependent
        logger.warning("Send API error (%s): %s", platform, exc)
        return False


def auto_reply(recipient_id: str, platform: str = "messenger") -> bool:
    """Send the default greeting/qualification to a new inbound conversation."""
    return send_message(recipient_id, DEFAULT_GREETING, platform)
