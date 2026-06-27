"""Lead model — the core CRM entity."""
import enum
from datetime import datetime

from sqlalchemy import String, Integer, Boolean, DateTime, Enum, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    interested = "interested"
    price_sent = "price_sent"
    ordered = "ordered"
    paid = "paid"
    rejected = "rejected"
    archived = "archived"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(64), index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    telegram: Mapped[str | None] = mapped_column(String(128))
    instagram: Mapped[str | None] = mapped_column(String(128))
    city: Mapped[str | None] = mapped_column(String(128))

    source: Mapped[str | None] = mapped_column(String(64), index=True)
    campaign_id: Mapped[str | None] = mapped_column(String(64), index=True)
    adset_id: Mapped[str | None] = mapped_column(String(64))
    ad_id: Mapped[str | None] = mapped_column(String(64))

    interest: Mapped[str | None] = mapped_column(String(64), index=True)
    # Comma-separated tags; kept simple and DB-portable.
    tags: Mapped[str | None] = mapped_column(String(512), default="")
    score: Mapped[int] = mapped_column(Integer, default=0, index=True)

    status: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus, native_enum=False, length=32),
        default=LeadStatus.new,
        index=True,
    )
    manager_comment: Mapped[str | None] = mapped_column(Text)

    # GDPR: explicit consent is required before any audience upload.
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    landing_visits: Mapped[int] = mapped_column(Integer, default=0)
    clicked_price: Mapped[bool] = mapped_column(Boolean, default=False)
    added_to_cart: Mapped[bool] = mapped_column(Boolean, default=False)
    clicked_telegram: Mapped[bool] = mapped_column(Boolean, default=False)

    # External de-dup key (e.g. Meta leadgen_id) to avoid duplicate webhook inserts.
    external_id: Mapped[str | None] = mapped_column(String(128), unique=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def tag_list(self) -> list[str]:
        return [t for t in (self.tags or "").split(",") if t]
