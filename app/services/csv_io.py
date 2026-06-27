"""CSV import/export for leads."""
from __future__ import annotations

import csv
import io
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.lead import Lead
from app.services.leads import upsert_by_external_id

# Canonical column order for template / export.
CSV_COLUMNS = [
    "name",
    "phone",
    "email",
    "telegram",
    "instagram",
    "city",
    "source",
    "campaign_id",
    "adset_id",
    "ad_id",
    "interest",
    "tags",
    "consent",
]


def template_csv() -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_COLUMNS)
    writer.writerow(
        [
            "Jane Doe",
            "+380501234567",
            "jane@example.com",
            "@jane",
            "@jane.fit",
            "Kyiv",
            "csv_import",
            "",
            "",
            "",
            "stanley",
            "stanley,vip",
            "true",
        ]
    )
    return buf.getvalue()


def _parse_bool(value: str | None) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y", "да"}


def import_csv(db: Session, content: str) -> dict[str, int]:
    """Import leads from CSV text. Upserts by email+phone composite external id."""
    reader = csv.DictReader(io.StringIO(content))
    created = updated = skipped = 0
    for row in reader:
        email = (row.get("email") or "").strip() or None
        phone = (row.get("phone") or "").strip() or None
        if not (email or phone):
            skipped += 1
            continue
        data = {
            "name": (row.get("name") or "").strip() or None,
            "phone": phone,
            "email": email,
            "telegram": (row.get("telegram") or "").strip() or None,
            "instagram": (row.get("instagram") or "").strip() or None,
            "city": (row.get("city") or "").strip() or None,
            "source": (row.get("source") or "csv_import").strip(),
            "campaign_id": (row.get("campaign_id") or "").strip() or None,
            "adset_id": (row.get("adset_id") or "").strip() or None,
            "ad_id": (row.get("ad_id") or "").strip() or None,
            "interest": (row.get("interest") or "").strip().lower() or None,
            "tags": (row.get("tags") or "").strip(),
            "consent": _parse_bool(row.get("consent")),
        }
        ext = f"csv:{email or ''}:{phone or ''}"
        _, was_created = upsert_by_external_id(db, ext, data)
        if was_created:
            created += 1
        else:
            updated += 1
    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped}


def export_csv(leads: Iterable[Lead]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", *CSV_COLUMNS, "score", "status", "created_at"])
    for lead in leads:
        writer.writerow(
            [
                lead.id,
                lead.name or "",
                lead.phone or "",
                lead.email or "",
                lead.telegram or "",
                lead.instagram or "",
                lead.city or "",
                lead.source or "",
                lead.campaign_id or "",
                lead.adset_id or "",
                lead.ad_id or "",
                lead.interest or "",
                lead.tags or "",
                lead.consent,
                lead.score,
                lead.status.value,
                lead.created_at.isoformat() if lead.created_at else "",
            ]
        )
    return buf.getvalue()
