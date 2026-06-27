"""scheduled posts

Revision ID: 0002_scheduled_posts
Revises: 0001_initial
Create Date: 2026-06-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_scheduled_posts"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scheduled_posts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("target", sa.String(16), server_default="facebook"),
        sa.Column("message", sa.Text()),
        sa.Column("image_url", sa.String(1024)),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), index=True),
        sa.Column("status", sa.String(16), server_default="scheduled", index=True),
        sa.Column("meta_post_ids", sa.String(255)),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("scheduled_posts")
