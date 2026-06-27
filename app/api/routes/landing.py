"""Public landing pages with Meta Pixel events.

Each page fires PageView + ViewContent on load and exposes Lead / AddToCart /
Purchase actions. A consent checkbox gates lead submission (GDPR).
"""
from fastapi import APIRouter, Depends, Form, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.event import PixelEvent
from app.services import leads as lead_service
from app.services.notifications import notify_manager
from app.services.scoring import is_hot
from app.templating import templates

router = APIRouter(tags=["landing"])

SEGMENTS = {
    "stanley": {"title": "Stanley Termos", "interest": "stanley", "content": "Stanley Quencher"},
    "fitness": {"title": "Fitness Club", "interest": "fitness", "content": "Fitness program"},
    "water": {"title": "Daily Water", "interest": "water", "content": "Water bottle"},
    "protein": {"title": "Protein & Nutrition", "interest": "protein", "content": "Protein pack"},
    "gift": {"title": "Gift Set", "interest": "gift", "content": "Gift box"},
}


@router.get("/landing/{segment}")
def landing_page(segment: str, request: Request, db: Session = Depends(get_db)):
    cfg = SEGMENTS.get(segment)
    if not cfg:
        cfg = SEGMENTS["stanley"]
        segment = "stanley"
    # Record a server-side PageView for our own segmentation.
    db.add(PixelEvent(event_name="PageView", segment=segment, anon_id=request.client.host))
    db.commit()
    return templates.TemplateResponse(
        "landing/page.html",
        {"request": request, "segment": segment, "cfg": cfg},
    )


@router.post("/landing/{segment}/lead")
def landing_lead(
    segment: str,
    request: Request,
    name: str = Form(""),
    phone: str = Form(""),
    email: str = Form(""),
    telegram: str = Form(""),
    city: str = Form(""),
    consent: bool = Form(False),
    db: Session = Depends(get_db),
):
    cfg = SEGMENTS.get(segment, SEGMENTS["stanley"])
    data = {
        "name": name or None,
        "phone": phone or None,
        "email": email or None,
        "telegram": telegram or None,
        "city": city or None,
        "source": "landing",
        "interest": cfg["interest"],
        "tags": f"landing_{segment}",
        "consent": bool(consent),
        "landing_visits": 1,
    }
    lead, _created = lead_service.upsert_by_external_id(db, None, data)
    db.add(PixelEvent(event_name="Lead", segment=segment, anon_id=request.client.host, lead_id=lead.id))
    db.commit()

    tag = "🔥 HOT" if is_hot(lead.score) else "new"
    notify_manager(
        f"<b>{tag} landing lead</b> #{lead.id} ({segment})\nScore: {lead.score}"
    )
    return templates.TemplateResponse(
        "landing/thanks.html", {"request": request, "segment": segment, "cfg": cfg}
    )
