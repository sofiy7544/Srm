"""Lead persistence helpers: create/upsert with automatic scoring + logging."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.lead import Lead, LeadStatus
from app.models.log import ActivityLog
from app.services.scoring import score_for_lead


def log(db: Session, category: str, message: str, level: str = "info") -> None:
    db.add(ActivityLog(category=category, message=message, level=level))


def recompute_score(lead: Lead) -> None:
    lead.score = score_for_lead(lead)


def create_lead(db: Session, data: dict) -> Lead:
    lead = Lead(**data)
    recompute_score(lead)
    db.add(lead)
    db.flush()
    log(db, "lead", f"Lead #{lead.id} created (source={lead.source}, score={lead.score})")
    return lead


def upsert_by_external_id(db: Session, external_id: str | None, data: dict) -> tuple[Lead, bool]:
    """Insert or update a lead keyed by external_id (e.g. Meta leadgen_id).

    Returns (lead, created). De-duplication prevents double inserts from webhook
    retries — only one active record per external id.
    """
    if external_id:
        existing = db.scalar(select(Lead).where(Lead.external_id == external_id))
        if existing:
            for key, value in data.items():
                if value is not None and hasattr(existing, key):
                    setattr(existing, key, value)
            recompute_score(existing)
            db.flush()
            return existing, False

    payload = {**data, "external_id": external_id}
    lead = create_lead(db, payload)
    return lead, True


def set_status(db: Session, lead: Lead, status: LeadStatus, comment: str | None = None) -> Lead:
    lead.status = status
    if comment is not None:
        lead.manager_comment = comment
    db.flush()
    log(db, "lead", f"Lead #{lead.id} status -> {status.value}")
    return lead


def hot_leads(db: Session, limit: int = 20) -> list[Lead]:
    stmt = (
        select(Lead)
        .where(Lead.status.notin_([LeadStatus.archived, LeadStatus.rejected]))
        .order_by(Lead.score.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))
