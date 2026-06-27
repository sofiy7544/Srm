"""Scheduled social posts (Facebook Page / Instagram Business)."""
import enum
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, Text, Enum, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PostTarget(str, enum.Enum):
    facebook = "facebook"
    instagram = "instagram"
    both = "both"


class PostStatus(str, enum.Enum):
    scheduled = "scheduled"
    published = "published"
    failed = "failed"
    canceled = "canceled"


class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target: Mapped[PostTarget] = mapped_column(
        Enum(PostTarget, native_enum=False, length=16), default=PostTarget.facebook
    )
    message: Mapped[str] = mapped_column(Text)
    # Optional public image URL (Instagram requires an image).
    image_url: Mapped[str | None] = mapped_column(String(1024))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[PostStatus] = mapped_column(
        Enum(PostStatus, native_enum=False, length=16),
        default=PostStatus.scheduled,
        index=True,
    )
    # Comma-separated Meta post ids once published (fb and/or ig).
    meta_post_ids: Mapped[str | None] = mapped_column(String(255))
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
