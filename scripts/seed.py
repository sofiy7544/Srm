"""Seed demo data (leads + audiences) for local development.

Usage: python -m scripts.seed
"""
from app.database import Base, SessionLocal, engine
from app.models.lead import LeadStatus
from app.services import leads as lead_service
from scripts import seed_audiences

DEMO_LEADS = [
    {"name": "Anna Fit", "phone": "+380501110011", "telegram": "@anna", "interest": "stanley",
     "source": "lead_ads", "city": "Kyiv", "consent": True, "landing_visits": 2, "clicked_price": True},
    {"name": "Bohdan Gym", "phone": "+380502220022", "interest": "fitness",
     "source": "landing", "city": "Lviv", "consent": True, "added_to_cart": True},
    {"name": "Cathy Water", "email": "cathy@example.com", "interest": "water",
     "source": "csv_import", "city": "Odesa", "consent": False},
    {"name": "Dmytro Protein", "phone": "+380503330033", "telegram": "@dmytro",
     "interest": "protein", "source": "lead_ads", "city": "Kharkiv", "consent": True},
    {"name": "Eva Gift", "phone": "+380504440044", "interest": "gift",
     "source": "landing", "city": "Dnipro", "consent": True, "landing_visits": 3},
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    seed_audiences.run()
    with SessionLocal() as db:
        for data in DEMO_LEADS:
            lead = lead_service.create_lead(db, dict(data))
            if lead.name == "Bohdan Gym":
                lead_service.set_status(db, lead, LeadStatus.interested)
        db.commit()
    print(f"Seeded {len(DEMO_LEADS)} demo leads.")


if __name__ == "__main__":
    run()
