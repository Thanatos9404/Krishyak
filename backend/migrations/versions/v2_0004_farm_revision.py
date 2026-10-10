"""Optimistic farm updates."""

from alembic import op

revision = "v2_0004"
down_revision = "v2_0003"
branch_labels = depends_on = None


def upgrade():
    op.execute("ALTER TABLE v2_farms ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1)")
    op.execute("ALTER TABLE v2_farms ALTER COLUMN revision DROP DEFAULT")


def downgrade():
    op.execute("ALTER TABLE v2_farms DROP COLUMN revision")
