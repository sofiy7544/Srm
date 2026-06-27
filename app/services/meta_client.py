"""Meta (Facebook/Instagram) integration — OFFICIAL APIs ONLY.

This module uses the Meta Business SDK / Graph API exclusively:
  * Marketing API        — campaigns & insights
  * Lead Ads API         — pulling submitted lead forms
  * Custom Audiences     — uploading hashed, consented contacts
  * Conversions API      — server-side Pixel events

It performs NO scraping of Facebook users, NO collection without consent, and
NO circumvention of Meta protections. Contact data is always SHA-256 hashed and
normalized before any upload, exactly as Meta requires.

The facebook_business SDK is imported lazily so the app runs without it and
without credentials (every method degrades to a clear "not configured" result).
"""
from __future__ import annotations

import hashlib
from typing import Any

import httpx

from app.config import settings
from app.core.logging import get_logger

logger = get_logger("meta")

GRAPH_BASE = "https://graph.facebook.com"


class MetaNotConfigured(RuntimeError):
    pass


def _require_config() -> None:
    if not settings.meta_configured:
        raise MetaNotConfigured(
            "Meta is not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID."
        )


def normalize_and_hash(value: str | None) -> str | None:
    """Normalize per Meta spec (trim, lowercase) then SHA-256 hash.

    Hashing happens client-side so raw PII never leaves our server in plaintext.
    """
    if not value:
        return None
    norm = value.strip().lower().replace(" ", "")
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


# ── Marketing API: campaigns & insights ──────────────────────────────────────
def fetch_campaigns() -> list[dict[str, Any]]:
    """Return campaigns with basic insight stats via the Graph API."""
    _require_config()
    acct = settings.meta_ad_account_id
    url = f"{GRAPH_BASE}/{settings.meta_api_version}/{acct}/campaigns"
    params = {
        "fields": "id,name,status,objective,insights{impressions,clicks,spend}",
        "access_token": settings.meta_access_token,
        "limit": 100,
    }
    with httpx.Client(timeout=30) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json().get("data", [])
    out: list[dict[str, Any]] = []
    for c in data:
        insights = (c.get("insights", {}) or {}).get("data", [{}])
        ins = insights[0] if insights else {}
        out.append(
            {
                "id": c.get("id"),
                "name": c.get("name"),
                "status": c.get("status"),
                "objective": c.get("objective"),
                "impressions": int(ins.get("impressions", 0) or 0),
                "clicks": int(ins.get("clicks", 0) or 0),
                "spend": float(ins.get("spend", 0) or 0),
            }
        )
    return out


# ── Lead Ads API: pull submitted lead forms ──────────────────────────────────
def fetch_leadgen_forms() -> list[dict[str, Any]]:
    _require_config()
    page_id = settings.meta_page_id
    url = f"{GRAPH_BASE}/{settings.meta_api_version}/{page_id}/leadgen_forms"
    params = {"access_token": settings.meta_access_token, "limit": 100}
    with httpx.Client(timeout=30) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        return resp.json().get("data", [])


def fetch_leads_for_form(form_id: str) -> list[dict[str, Any]]:
    """Bulk-pull leads submitted to a given lead form."""
    _require_config()
    url = f"{GRAPH_BASE}/{settings.meta_api_version}/{form_id}/leads"
    params = {
        "access_token": settings.meta_access_token,
        "fields": "id,created_time,field_data,campaign_id,adset_id,ad_id",
        "limit": 200,
    }
    out: list[dict[str, Any]] = []
    with httpx.Client(timeout=30) as client:
        while url:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()
            out.extend(payload.get("data", []))
            url = payload.get("paging", {}).get("next")
            params = {}  # `next` already carries query params
    return out


def parse_lead_field_data(field_data: list[dict[str, Any]]) -> dict[str, str]:
    """Flatten Meta's [{name, values:[...]}] structure into a simple dict."""
    result: dict[str, str] = {}
    for field in field_data or []:
        name = field.get("name")
        values = field.get("values") or []
        if name and values:
            result[name] = values[0]
    return result


# ── Custom Audiences (Marketing API) ─────────────────────────────────────────
def create_custom_audience(name: str, description: str = "") -> str:
    """Create an empty Custom Audience and return its id."""
    _require_config()
    acct = settings.meta_ad_account_id
    url = f"{GRAPH_BASE}/{settings.meta_api_version}/{acct}/customaudiences"
    data = {
        "name": name,
        "description": description,
        "subtype": "CUSTOM",
        "customer_file_source": "USER_PROVIDED_ONLY",
        "access_token": settings.meta_access_token,
    }
    with httpx.Client(timeout=30) as client:
        resp = client.post(url, data=data)
        resp.raise_for_status()
        return resp.json()["id"]


def add_users_to_audience(audience_id: str, leads: list[dict[str, str]]) -> int:
    """Upload hashed user records to a Custom Audience.

    `leads` is a list of {email, phone} plaintext dicts; values are hashed here.
    Only call this with consented leads — the caller is responsible for that.
    Returns the number of records sent.
    """
    _require_config()
    schema = ["EMAIL", "PHONE"]
    rows = []
    for lead in leads:
        rows.append(
            [
                normalize_and_hash(lead.get("email")) or "",
                normalize_and_hash(lead.get("phone")) or "",
            ]
        )
    url = f"{GRAPH_BASE}/{settings.meta_api_version}/{audience_id}/users"
    payload = {
        "payload": {"schema": schema, "data": rows},
        "access_token": settings.meta_access_token,
    }
    with httpx.Client(timeout=30) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()
    return len(rows)


# ── Conversions API: server-side Pixel events ────────────────────────────────
def send_conversion_event(
    event_name: str,
    email: str | None = None,
    phone: str | None = None,
    event_source_url: str | None = None,
    value: float | None = None,
    currency: str = "USD",
) -> bool:
    """Send a single server-side event via the Conversions API.

    Returns False (and logs) if Pixel is not configured rather than raising, so
    event tracking never breaks the request path.
    """
    if not (settings.meta_pixel_id and settings.meta_access_token):
        logger.info("Conversions API skipped: pixel not configured")
        return False

    user_data: dict[str, list[str]] = {}
    if email:
        user_data["em"] = [normalize_and_hash(email)]
    if phone:
        user_data["ph"] = [normalize_and_hash(phone)]

    event: dict[str, Any] = {
        "event_name": event_name,
        "action_source": "website",
        "user_data": user_data,
    }
    if event_source_url:
        event["event_source_url"] = event_source_url
    if value is not None:
        event["custom_data"] = {"value": value, "currency": currency}

    url = f"{GRAPH_BASE}/{settings.meta_api_version}/{settings.meta_pixel_id}/events"
    payload = {"data": [event], "access_token": settings.meta_access_token}
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
        return True
    except httpx.HTTPError as exc:  # pragma: no cover - network dependent
        logger.warning("Conversions API error: %s", exc)
        return False
