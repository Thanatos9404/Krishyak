"""Preserve authentication age and bind retryable evidence to operation IDs."""

from alembic import op

revision = "v2_0002"
down_revision = "v2_0001"
branch_labels = depends_on = None


def upgrade():
    op.execute("ALTER TABLE v2_sessions ADD COLUMN authenticated_at timestamptz")
    op.execute("UPDATE v2_sessions SET authenticated_at = created_at")
    op.execute("ALTER TABLE v2_sessions ALTER COLUMN authenticated_at SET NOT NULL")
    for table, owner in [("v2_crop_cycles", "plot_id"), ("v2_images", "farmer_id"), ("v2_feedback", "farmer_id")]:
        op.execute(f"ALTER TABLE {table} ADD COLUMN operation_id uuid NOT NULL DEFAULT gen_random_uuid()")
        op.execute(f"ALTER TABLE {table} ADD CONSTRAINT uq_{table}_operation UNIQUE ({owner}, operation_id)")
        op.execute(f"ALTER TABLE {table} ALTER COLUMN operation_id DROP DEFAULT")
    op.execute("ALTER TABLE v2_crop_cycles ADD COLUMN revision integer NOT NULL DEFAULT 1")
    op.execute(
        "ALTER TABLE v2_plots ADD CONSTRAINT plot_evidence_consistent CHECK ((boundary IS NULL AND centroid IS NULL AND area_hectares IS NULL AND entered_area_hectares > 0 AND boundary_quality = 'manual') OR (boundary IS NOT NULL AND centroid IS NOT NULL AND area_hectares IS NOT NULL AND boundary_quality IN ('approximate', 'farmer_drawn')))"
    )
    op.execute(
        "ALTER TABLE v2_plots ADD CONSTRAINT plot_manual_area_bounds CHECK (entered_area_hectares IS NULL OR entered_area_hectares > 0 AND entered_area_hectares <= 500)"
    )


def downgrade():
    op.execute("ALTER TABLE v2_plots DROP CONSTRAINT plot_manual_area_bounds, DROP CONSTRAINT plot_evidence_consistent")
    op.execute("ALTER TABLE v2_crop_cycles DROP COLUMN revision")
    for table in ["v2_crop_cycles", "v2_images", "v2_feedback"]:
        op.execute(f"ALTER TABLE {table} DROP COLUMN operation_id")
    op.execute("ALTER TABLE v2_sessions DROP COLUMN authenticated_at")
