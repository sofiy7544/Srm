"""JSON REST API for leads (used by integrations and the bot)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin_api
from app.database import get_db
from app.models.lead import Lead, LeadStatus
from app.schemas.lead import LeadCreate, LeadOut, LeadUpdate
from app.services import leads as lead_service

router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.get("", response_model=list[LeadOut])
def list_leads(
    status: LeadStatus | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin_api),
):
    stmt = select(Lead).order_by(Lead.score.desc()).limit(min(limit, 500))
    if status:
        stmt = stmt.where(Lead.status == status)
    return list(db.scalars(stmt))


@router.post("", response_model=LeadOut, status_code=201)
def create_lead(
    payload: LeadCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin_api),
):
    data = payload.model_dump()
    external_id = data.pop("external_id", None)
    lead, _created = lead_service.upsert_by_external_id(db, external_id, data)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin_api)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin_api),
):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, key, value)
    lead_service.recompute_score(lead)
    db.commit()
    db.refresh(lead)
    return lead
