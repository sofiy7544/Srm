"""Pixel / landing events used for segmentation and scoring."""
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PixelEvent(Base):
    __tablename__ = "pixel_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Standard Meta event names: PageView, ViewContent, Lead, AddToCart, Purchase
    event_name: Mapped[str] = mapped_column(String(64), index=True)
    # Landing segment: stanley | fitness | water | protein | gift
    segment: Mapped[str | None] = mapped_column(String(64), index=True)
    # Anonymous browser id (first-party cookie) — not PII.
    anon_id: Mapped[str | None] = mapped_column(String(128), index=True)
    lead_id: Mapped[int | None] = mapped_column(Integer, index=True)
    value: Mapped[float | None] = mapped_column()
    currency: Mapped[str | None] = mapped_column(String(8))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
