"""Meta sync actions, triggered from the admin panel or API.

All actions go through official Marketing/Lead Ads APIs. When Meta is not
configured these endpoints return a clear message instead of failing hard.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin_api
from app.database import get_db
from app.models.audience import Audience
from app.models.campaign import Campaign
from app.models.lead import Lead, LeadStatus
from app.services import meta_client
from app.services.leads import log

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.post("/sync/campaigns")
def sync_campaigns(db: Session = Depends(get_db), _: str = Depends(require_admin_api)):
    try:
        items = meta_client.fetch_campaigns()
    except meta_client.MetaNotConfigured as exc:
        raise HTTPException(400, str(exc))
    count = 0
    for item in items:
        existing = db.scalar(
            select(Campaign).where(Campaign.meta_campaign_id == item["id"])
        )
        if not existing:
            existing = Campaign(meta_campaign_id=item["id"])
            db.add(existing)
        existing.name = item["name"]
        existing.status = item["status"]
        existing.objective = item["objective"]
        existing.impressions = item["impressions"]
        existing.clicks = item["clicks"]
        existing.spend = item["spend"]
        count += 1
    log(db, "meta", f"Synced {count} campaigns")
    db.commit()
    return {"synced": count}


@router.post("/sync/leads")
def sync_lead_forms(db: Session = Depends(get_db), _: str = Depends(require_admin_api)):
    """Bulk-pull leads from all lead forms on the configured page."""
    from app.services import leads as lead_service

    try:
        forms = meta_client.fetch_leadgen_forms()
    except meta_client.MetaNotConfigured as exc:
        raise HTTPException(400, str(exc))
    created = 0
    for form in forms:
        for raw in meta_client.fetch_leads_for_form(form["id"]):
            fields = meta_client.parse_lead_field_data(raw.get("field_data", []))
            data = {
                "name": fields.get("full_name") or fields.get("name"),
                "phone": fields.get("phone_number") or fields.get("phone"),
                "email": fields.get("email"),
                "city": fields.get("city"),
                "source": "lead_ads",
                "campaign_id": raw.get("campaign_id"),
                "adset_id": raw.get("adset_id"),
                "ad_id": raw.get("ad_id"),
                "consent": True,
            }
            _, was_created = lead_service.upsert_by_external_id(
                db, f"meta:{raw['id']}", data
            )
            if was_created:
                created += 1
    log(db, "meta", f"Bulk lead sync: {created} new")
    db.commit()
    return {"created": created}


@router.post("/audiences/{audience_id}/push")
def push_audience(
    audience_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin_api)
):
    """Create/refresh a Meta Custom Audience from CONSENTED leads only."""
    audience = db.get(Audience, audience_id)
    if not audience:
        raise HTTPException(404, "Audience not found")

    # GDPR gate: never upload a lead without explicit consent.
    leads = list(
        db.scalars(
            select(Lead).where(
                Lead.consent.is_(True),
                Lead.status.notin_([LeadStatus.archived, LeadStatus.rejected]),
            )
        )
    )
    records = [{"email": l.email, "phone": l.phone} for l in leads if (l.email or l.phone)]

    try:
        if not audience.meta_audience_id:
            audience.meta_audience_id = meta_client.create_custom_audience(
                audience.name, audience.description or ""
            )
        sent = meta_client.add_users_to_audience(audience.meta_audience_id, records)
    except meta_client.MetaNotConfigured as exc:
        raise HTTPException(400, str(exc))

    audience.approx_count = sent
    audience.last_synced_at = datetime.now(timezone.utc)
    log(db, "meta", f"Pushed {sent} consented users to audience '{audience.name}'")
    db.commit()
    return {"audience_id": audience.meta_audience_id, "pushed": sent}
