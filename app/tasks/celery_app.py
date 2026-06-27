"""Celery application + beat schedule.

Worker:  celery -A app.tasks.celery_app worker --loglevel=info
Beat:    celery -A app.tasks.celery_app beat --loglevel=info
"""
from celery import Celery

from app.config import settings

celery_app = Celery(
    "stanley_crm",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

# Make sure task modules are imported so they register with the app.
celery_app.autodiscover_tasks(["app.tasks"])
import app.tasks.jobs  # noqa: E402,F401

# Periodic jobs — pull fresh Meta data on a schedule.
celery_app.conf.beat_schedule = {
    "sync-campaigns-hourly": {
        "task": "app.tasks.jobs.sync_campaigns_task",
        "schedule": 3600.0,
    },
    "sync-leadforms-15min": {
        "task": "app.tasks.jobs.sync_lead_forms_task",
        "schedule": 900.0,
    },
}
