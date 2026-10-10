"""Optional opaque government identity links. No provider tokens or documents."""

import sqlalchemy as sa
from alembic import op

revision = "v2_0007"
down_revision = "v2_0006"
branch_labels = depends_on = None


def upgrade():
    op.create_table(
        "v2_government_identities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("farmer_id", sa.Uuid(), sa.ForeignKey("v2_farmers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("issuer", sa.String(200), nullable=False),
        sa.Column("subject_hash", sa.String(64), nullable=False),
        sa.UniqueConstraint("issuer", "subject_hash"),
        sa.UniqueConstraint("farmer_id", "issuer"),
    )
    op.create_index("ix_v2_government_identities_farmer_id", "v2_government_identities", ["farmer_id"])


def downgrade():
    op.drop_table("v2_government_identities")
