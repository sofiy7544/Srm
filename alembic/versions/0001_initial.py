"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255)),
        sa.Column("phone", sa.String(64), index=True),
        sa.Column("email", sa.String(255), index=True),
        sa.Column("telegram", sa.String(128)),
        sa.Column("instagram", sa.String(128)),
        sa.Column("city", sa.String(128)),
        sa.Column("source", sa.String(64), index=True),
        sa.Column("campaign_id", sa.String(64), index=True),
        sa.Column("adset_id", sa.String(64)),
        sa.Column("ad_id", sa.String(64)),
        sa.Column("interest", sa.String(64), index=True),
        sa.Column("tags", sa.String(512)),
        sa.Column("score", sa.Integer(), server_default="0", index=True),
        sa.Column("status", sa.String(32), server_default="new", index=True),
        sa.Column("manager_comment", sa.Text()),
        sa.Column("consent", sa.Boolean(), server_default=sa.false()),
        sa.Column("landing_visits", sa.Integer(), server_default="0"),
        sa.Column("clicked_price", sa.Boolean(), server_default=sa.false()),
        sa.Column("added_to_cart", sa.Boolean(), server_default=sa.false()),
        sa.Column("clicked_telegram", sa.Boolean(), server_default=sa.false()),
        sa.Column("external_id", sa.String(128), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "pixel_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("event_name", sa.String(64), index=True),
        sa.Column("segment", sa.String(64), index=True),
        sa.Column("anon_id", sa.String(128), index=True),
        sa.Column("lead_id", sa.Integer(), index=True),
        sa.Column("value", sa.Float()),
        sa.Column("currency", sa.String(8)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "audiences",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), index=True),
        sa.Column("subtype", sa.String(64), server_default="CUSTOM"),
        sa.Column("description", sa.Text()),
        sa.Column("meta_audience_id", sa.String(64), index=True),
        sa.Column("approx_count", sa.Integer(), server_default="0"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("meta_campaign_id", sa.String(64), unique=True, index=True),
        sa.Column("name", sa.String(255)),
        sa.Column("status", sa.String(32)),
        sa.Column("objective", sa.String(64)),
        sa.Column("impressions", sa.Integer(), server_default="0"),
        sa.Column("clicks", sa.Integer(), server_default="0"),
        sa.Column("spend", sa.Float(), server_default="0"),
        sa.Column("leads", sa.Integer(), server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("level", sa.String(16), server_default="info", index=True),
        sa.Column("category", sa.String(48), index=True),
        sa.Column("message", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("activity_logs")
    op.drop_table("campaigns")
    op.drop_table("audiences")
    op.drop_table("pixel_events")
    op.drop_table("leads")
