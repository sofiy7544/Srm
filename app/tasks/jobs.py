"""Celery task definitions. Thin wrappers around services for retries/scheduling."""
from app.core.logging import get_logger
from app.database import SessionLocal
from app.models.campaign import Campaign
from app.services import leads as lead_service
from app.services import meta_client
from app.tasks.celery_app import celery_app

logger = get_logger("jobs")


@celery_app.task(name="app.tasks.jobs.sync_campaigns_task", bind=True, max_retries=3)
def sync_campaigns_task(self):
    try:
        items = meta_client.fetch_campaigns()
    except meta_client.MetaNotConfigured:
        logger.info("sync_campaigns skipped: Meta not configured")
        return {"skipped": True}
    from sqlalchemy import select

    with SessionLocal() as db:
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
        db.commit()
    return {"synced": len(items)}


@celery_app.task(name="app.tasks.jobs.sync_lead_forms_task", bind=True, max_retries=3)
def sync_lead_forms_task(self):
    try:
        forms = meta_client.fetch_leadgen_forms()
    except meta_client.MetaNotConfigured:
        logger.info("sync_lead_forms skipped: Meta not configured")
        return {"skipped": True}
    created = 0
    with SessionLocal() as db:
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
                created += int(was_created)
        db.commit()
    return {"created": created}
