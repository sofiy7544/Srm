"""Load the JSON audience templates in /audiences into the DB.

Usage: python -m scripts.seed_audiences
"""
import json
import pathlib

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models.audience import Audience

AUDIENCES_DIR = pathlib.Path(__file__).resolve().parent.parent / "audiences"


def run() -> None:
    Base.metadata.create_all(bind=engine)
    created = 0
    with SessionLocal() as db:
        for path in sorted(AUDIENCES_DIR.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            name = data.get("name", path.stem)
            if db.scalar(select(Audience).where(Audience.name == name)):
                continue
            db.add(
                Audience(
                    name=name,
                    subtype=data.get("subtype", data.get("type", "CUSTOM")).upper(),
                    description=data.get("description", ""),
                )
            )
            created += 1
        db.commit()
    print(f"Seeded {created} audience templates.")


if __name__ == "__main__":
    run()
