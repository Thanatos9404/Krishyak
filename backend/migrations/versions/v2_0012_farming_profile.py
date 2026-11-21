"""What kind of farming the farmer does, asked once at registration."""

import sqlalchemy as sa
from alembic import op

revision = "v2_0012"
down_revision = "v2_0011"
branch_labels = depends_on = None


def upgrade():
    op.add_column("v2_farmers", sa.Column("farming_kind", sa.String(30), nullable=True))
    op.add_column("v2_farmers", sa.Column("farming_method", sa.String(30), nullable=True))


def downgrade():
    op.drop_column("v2_farmers", "farming_method")
    op.drop_column("v2_farmers", "farming_kind")
