"""Farmer groups with join codes and consented farm verification requests."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "v2_0011"
down_revision = "v2_0010"
branch_labels = depends_on = None


def upgrade():
    op.add_column("v2_pilot_cohorts", sa.Column("kind", sa.String(20), nullable=False, server_default="pilot"))
    op.add_column("v2_pilot_cohorts", sa.Column("join_code", sa.String(12), nullable=True))
    op.create_unique_constraint("uq_v2_pilot_cohorts_join_code", "v2_pilot_cohorts", ["join_code"])
    op.create_table(
        "v2_verifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requester_id", sa.Uuid(), sa.ForeignKey("v2_farmers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference", sa.String(60), nullable=False),
        sa.Column("purpose", sa.String(30), nullable=False),
        sa.Column("code", sa.String(12), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="awaiting_farmer"),
        sa.Column("farmer_id", sa.Uuid(), sa.ForeignKey("v2_farmers.id", ondelete="CASCADE"), nullable=True),
        sa.Column("plot_id", sa.Uuid(), sa.ForeignKey("v2_plots.id", ondelete="CASCADE"), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("declared", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("result", postgresql.JSONB(), nullable=False, server_default="{}"),
    )
    op.create_index("ix_v2_verifications_requester_id", "v2_verifications", ["requester_id"])
    op.create_index("ix_v2_verifications_farmer_id", "v2_verifications", ["farmer_id"])


def downgrade():
    op.drop_table("v2_verifications")
    op.drop_constraint("uq_v2_pilot_cohorts_join_code", "v2_pilot_cohorts", type_="unique")
    op.drop_column("v2_pilot_cohorts", "join_code")
    op.drop_column("v2_pilot_cohorts", "kind")
