"""Admin panel pages (server-rendered Jinja2). All routes require login."""
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.database import get_db
from app.models.audience import Audience
from app.models.campaign import Campaign
from app.models.lead import Lead, LeadStatus
from app.models.log import ActivityLog
from app.services import leads as lead_service
from app.services.csv_io import export_csv, import_csv, template_csv
from app.services.scoring import is_hot
from app.templating import templates

router = APIRouter()


@router.get("/")
def dashboard(request: Request, db: Session = Depends(get_db), user: str = Depends(require_admin)):
    total = db.scalar(select(func.count(Lead.id))) or 0
    by_status = {
        s.value: db.scalar(select(func.count(Lead.id)).where(Lead.status == s)) or 0
        for s in LeadStatus
    }
    hot = lead_service.hot_leads(db, limit=10)
    hot = [l for l in hot if is_hot(l.score)]
    consented = db.scalar(select(func.count(Lead.id)).where(Lead.consent.is_(True))) or 0
    recent_logs = list(
        db.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(8))
    )
    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "user": user,
            "active": "dashboard",
            "total": total,
            "by_status": by_status,
            "hot": hot,
            "consented": consented,
            "recent_logs": recent_logs,
        },
    )


@router.get("/leads")
def leads_page(
    request: Request,
    status: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    user: str = Depends(require_admin),
):
    stmt = select(Lead).order_by(Lead.score.desc(), Lead.created_at.desc())
    if status:
        stmt = stmt.where(Lead.status == LeadStatus(status))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (Lead.name.ilike(like)) | (Lead.phone.ilike(like)) | (Lead.email.ilike(like))
        )
    rows = list(db.scalars(stmt.limit(500)))
    return templates.TemplateResponse(
        "leads.html",
        {
            "request": request,
            "user": user,
            "active": "leads",
            "leads": rows,
            "statuses": list(LeadStatus),
            "filter_status": status,
            "q": q or "",
        },
    )


@router.post("/leads/{lead_id}/update")
def update_lead(
    lead_id: int,
    status: str = Form(...),
    manager_comment: str = Form(""),
    db: Session = Depends(get_db),
    user: str = Depends(require_admin),
):
    lead = db.get(Lead, lead_id)
    if lead:
        lead_service.set_status(db, lead, LeadStatus(status), manager_comment)
        db.commit()
    return RedirectResponse(url="/leads", status_code=303)


@router.get("/leads.csv")
def leads_export(db: Session = Depends(get_db), user: str = Depends(require_admin)):
    rows = list(db.scalars(select(Lead).order_by(Lead.id)))
    return Response(
        content=export_csv(rows),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_export.csv"},
    )


@router.get("/leads/template.csv")
def leads_template(user: str = Depends(require_admin)):
    return Response(
        content=template_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_template.csv"},
    )


@router.post("/leads/import")
async def leads_import(
    request: Request,
    db: Session = Depends(get_db),
    user: str = Depends(require_admin),
):
    form = await request.form()
    upload = form.get("file")
    if upload is not None:
        content = (await upload.read()).decode("utf-8", errors="ignore")
        import_csv(db, content)
    return RedirectResponse(url="/leads", status_code=303)


@router.get("/audiences")
def audiences_page(
    request: Request, db: Session = Depends(get_db), user: str = Depends(require_admin)
):
    rows = list(db.scalars(select(Audience).order_by(Audience.created_at.desc())))
    return templates.TemplateResponse(
        "audiences.html",
        {"request": request, "user": user, "active": "audiences", "audiences": rows},
    )


@router.get("/campaigns")
def campaigns_page(
    request: Request, db: Session = Depends(get_db), user: str = Depends(require_admin)
):
    rows = list(db.scalars(select(Campaign).order_by(Campaign.updated_at.desc())))
    return templates.TemplateResponse(
        "campaigns.html",
        {"request": request, "user": user, "active": "campaigns", "campaigns": rows},
    )


@router.get("/settings")
def settings_page(request: Request, user: str = Depends(require_admin)):
    from app.config import settings as cfg

    masked = {
        "META_APP_ID": cfg.meta_app_id or "—",
        "META_AD_ACCOUNT_ID": cfg.meta_ad_account_id or "—",
        "META_PAGE_ID": cfg.meta_page_id or "—",
        "META_PIXEL_ID": cfg.meta_pixel_id or "—",
        "META_ACCESS_TOKEN": "set ✓" if cfg.meta_access_token else "— (not set)",
        "META_APP_SECRET": "set ✓" if cfg.meta_app_secret else "— (not set)",
        "VERIFY_TOKEN": "set ✓" if cfg.verify_token else "— (not set)",
        "TELEGRAM_BOT_TOKEN": "set ✓" if cfg.telegram_bot_token else "— (not set)",
    }
    return templates.TemplateResponse(
        "settings.html",
        {
            "request": request,
            "user": user,
            "active": "settings",
            "config": masked,
            "meta_configured": cfg.meta_configured,
        },
    )


@router.get("/logs")
def logs_page(request: Request, db: Session = Depends(get_db), user: str = Depends(require_admin)):
    rows = list(
        db.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(300))
    )
    return templates.TemplateResponse(
        "logs.html",
        {"request": request, "user": user, "active": "logs", "logs": rows},
    )
