"""Shared Jinja2 templates instance with common globals."""
from fastapi.templating import Jinja2Templates

from app.config import settings

templates = Jinja2Templates(directory="app/templates")
templates.env.globals["app_name"] = settings.app_name
templates.env.globals["meta_pixel_id"] = settings.meta_pixel_id
