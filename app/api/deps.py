"""Shared FastAPI dependencies."""
from fastapi import Request
from fastapi.responses import RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class RedirectToLogin(StarletteHTTPException):
    """Raised to bounce unauthenticated browser users to the login page."""

    def __init__(self) -> None:
        super().__init__(status_code=307, detail="login required")


def current_user(request: Request) -> str | None:
    return request.session.get("user")


def require_admin(request: Request) -> str:
    """Page guard for the admin panel — redirects to /login when not signed in."""
    user = request.session.get("user")
    if not user:
        raise RedirectToLogin()
    return user


def require_admin_api(request: Request) -> str:
    """API guard — returns 401 JSON instead of redirecting."""
    user = request.session.get("user")
    if not user:
        raise StarletteHTTPException(status_code=401, detail="Unauthorized")
    return user


def login_redirect_response() -> RedirectResponse:
    return RedirectResponse(url="/login", status_code=307)
