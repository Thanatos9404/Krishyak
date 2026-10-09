"""Public mandi quotes retained for dated, source-attributed price trends."""

import sqlalchemy as sa
from alembic import op

revision = "v2_0009"
down_revision = "v2_0008"
branch_labels = depends_on = None


def upgrade():
    op.create_table(
        "v2_market_prices",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("arrival_date", sa.Date(), nullable=False),
        sa.Column("state", sa.String(150), nullable=False),
        sa.Column("district", sa.String(150), nullable=False),
        sa.Column("market", sa.String(150), nullable=False),
        sa.Column("commodity", sa.String(100), nullable=False),
        sa.Column("variety", sa.String(100), nullable=False),
        sa.Column("grade", sa.String(50), nullable=False),
        sa.Column("min_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("max_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("modal_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("source_resource", sa.String(64), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("arrival_date", "state", "district", "market", "commodity", "variety", "grade"),
        sa.CheckConstraint("modal_price > 0", name="ck_v2_market_prices_modal"),
        sa.CheckConstraint(
            "min_price IS NULL OR max_price IS NULL OR min_price <= max_price", name="ck_v2_market_prices_range"
        ),
    )
    op.create_index(
        "ix_v2_market_prices_lookup", "v2_market_prices", ["commodity", "state", "district", "arrival_date"]
    )
    op.create_table(
        "v2_market_fetches",
        sa.Column("scope", sa.String(64), primary_key=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
    )


def downgrade():
    op.drop_table("v2_market_fetches")
    op.drop_table("v2_market_prices")
