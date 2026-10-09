"""Optional rounded field location so unmapped fields still get local weather."""

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

revision = "v2_0010"
down_revision = "v2_0009"
branch_labels = depends_on = None


def upgrade():
    op.add_column(
        "v2_plots",
        sa.Column("approximate_location", Geometry("POINT", srid=4326, spatial_index=False), nullable=True),
    )
    op.create_check_constraint(
        "ck_v2_plots_location_in_india",
        "v2_plots",
        "approximate_location IS NULL OR (ST_Y(approximate_location) BETWEEN 6 AND 37.5 "
        "AND ST_X(approximate_location) BETWEEN 68 AND 97.5)",
    )


def downgrade():
    op.drop_constraint("ck_v2_plots_location_in_india", "v2_plots", type_="check")
    op.drop_column("v2_plots", "approximate_location")
