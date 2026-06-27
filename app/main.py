"""FastAPI application entrypoint."""
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.config import settings
from app.core.logging import configure_logging
from app.core.rate_limit import limiter
from app.api.deps import RedirectToLogin
from app.api.routes import admin, api_leads, auth, landing, meta, webhooks

configure_logging("DEBUG" if settings.debug else "INFO")

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Legal warm-audience collection & CRM via official Meta APIs only.",
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Signed session cookie for admin auth
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key, max_age=60 * 60 * 8)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static assets (pixel helper JS, etc.)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.exception_handler(RedirectToLogin)
async def _redirect_to_login(request: Request, exc: RedirectToLogin):
    return RedirectResponse(url="/login", status_code=307)


@app.on_event("startup")
def on_startup() -> None:
    # For local/dev (e.g. SQLite) create tables if migrations haven't run.
    # In production, Alembic owns the schema and this is a harmless no-op.
    if settings.database_url.startswith("sqlite"):
        from app.database import Base, engine
        import app.models  # noqa: F401  (register models)

        Base.metadata.create_all(bind=engine)


@app.get("/health", tags=["system"])
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "meta_configured": settings.meta_configured,
    }


# Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(api_leads.router)
app.include_router(meta.router)
app.include_router(webhooks.router)
app.include_router(landing.router)
