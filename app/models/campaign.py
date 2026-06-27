"""Cached Meta campaign data + basic stats."""
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, Float, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    meta_campaign_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str | None] = mapped_column(String(32))
    objective: Mapped[str | None] = mapped_column(String(64))
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    spend: Mapped[float] = mapped_column(Float, default=0.0)
    leads: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
