"""Scheduled publishing to Facebook Page & Instagram Business — official Graph API.

Facebook Page: POST /{page-id}/feed (text) or /{page-id}/photos (image).
Instagram:     two-step — create media container then publish it.

Uses the Page access token (META_ACCESS_TOKEN). No password login, no automation
of the UI — these are the official content-publishing endpoints, the same ones
tools like Mixpost/Postiz use via OAuth.
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.logging import get_logger
from app.models.post import PostStatus, PostTarget, ScheduledPost
from app.services.leads import log
from app.services.meta_client import GRAPH_BASE, MetaNotConfigured

logger = get_logger("publisher")


def _require_page() -> None:
    if not (settings.meta_access_token and settings.meta_page_id):
        raise MetaNotConfigured(
            "Publishing needs META_ACCESS_TOKEN and META_PAGE_ID."
        )


def publish_to_facebook(message: str, image_url: str | None = None) -> str:
    """Publish to the Facebook Page feed. Returns the new post id."""
    _require_page()
    base = f"{GRAPH_BASE}/{settings.meta_api_version}/{settings.meta_page_id}"
    if image_url:
        url = f"{base}/photos"
        data = {"url": image_url, "caption": message, "access_token": settings.meta_access_token}
    else:
        url = f"{base}/feed"
        data = {"message": message, "access_token": settings.meta_access_token}
    with httpx.Client(timeout=30) as client:
        resp = client.post(url, data=data)
        resp.raise_for_status()
        body = resp.json()
    return body.get("post_id") or body.get("id", "")


def publish_to_instagram(caption: str, image_url: str) -> str:
    """Publish an image to Instagram Business (2-step container + publish)."""
    if not settings.meta_ig_user_id:
        raise MetaNotConfigured("Instagram needs META_IG_USER_ID.")
    if not image_url:
        raise ValueError("Instagram requires an image_url.")
    base = f"{GRAPH_BASE}/{settings.meta_api_version}/{settings.meta_ig_user_id}"
    with httpx.Client(timeout=60) as client:
        # 1) create media container
        c = client.post(
            f"{base}/media",
            data={"image_url": image_url, "caption": caption, "access_token": settings.meta_access_token},
        )
        c.raise_for_status()
        creation_id = c.json()["id"]
        # 2) publish it
        p = client.post(
            f"{base}/media_publish",
            data={"creation_id": creation_id, "access_token": settings.meta_access_token},
        )
        p.raise_for_status()
        return p.json().get("id", "")


def publish_post(db: Session, post: ScheduledPost) -> ScheduledPost:
    """Publish a single ScheduledPost to its target(s) and record the result."""
    ids: list[str] = []
    try:
        if post.target in (PostTarget.facebook, PostTarget.both):
            ids.append("fb:" + publish_to_facebook(post.message, post.image_url))
        if post.target in (PostTarget.instagram, PostTarget.both):
            ids.append("ig:" + publish_to_instagram(post.message, post.image_url or ""))
        post.status = PostStatus.published
        post.meta_post_ids = ",".join(ids)
        post.error = None
        log(db, "post", f"Published post #{post.id} → {post.target.value}")
    except Exception as exc:  # noqa: BLE001 - record failure, keep scheduler alive
        post.status = PostStatus.failed
        post.error = str(exc)[:500]
        log(db, "post", f"Post #{post.id} failed: {exc}", level="error")
        logger.warning("Publish failed for post %s: %s", post.id, exc)
    db.flush()
    return post


def publish_due_posts(db: Session) -> dict[str, int]:
    """Find scheduled posts whose time has come and publish them."""
    now = datetime.now(timezone.utc)
    due = list(
        db.scalars(
            select(ScheduledPost).where(
                ScheduledPost.status == PostStatus.scheduled,
                ScheduledPost.scheduled_at <= now,
            )
        )
    )
    published = failed = 0
    for post in due:
        publish_post(db, post)
        published += int(post.status == PostStatus.published)
        failed += int(post.status == PostStatus.failed)
    db.commit()
    return {"due": len(due), "published": published, "failed": failed}
