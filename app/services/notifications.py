"""Outbound notifications (Telegram). Best-effort, never blocks the request."""
from __future__ import annotations

import httpx

from app.config import settings
from app.core.logging import get_logger

logger = get_logger("notifications")


def notify_manager(text: str) -> bool:
    """Send a plain message to the configured manager chat via Telegram Bot API."""
    if not (settings.telegram_bot_token and settings.telegram_manager_chat_id):
        logger.info("Telegram notify skipped: bot not configured")
        return False
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                url,
                json={
                    "chat_id": settings.telegram_manager_chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                },
            )
            resp.raise_for_status()
        return True
    except httpx.HTTPError as exc:  # pragma: no cover - network dependent
        logger.warning("Telegram notify failed: %s", exc)
        return False
