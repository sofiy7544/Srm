"""Custom Audience records synced to Meta."""
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Audience(Base):
    __tablename__ = "audiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    subtype: Mapped[str] = mapped_column(String(64), default="CUSTOM")
    description: Mapped[str | None] = mapped_column(Text)
    # Meta-side id once created via Marketing API.
    meta_audience_id: Mapped[str | None] = mapped_column(String(64), index=True)
    approx_count: Mapped[int] = mapped_column(Integer, default=0)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
