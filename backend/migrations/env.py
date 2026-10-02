"""Migration URL comes from environment; never checked into Git or printed."""

import os

from alembic import context
from sqlalchemy import create_engine, pool

from db.models import Base

url = os.environ["V2_DATABASE_URL"]
if not url.startswith("postgresql+psycopg://"):
    raise ValueError("Migrations require PostgreSQL/PostGIS")


def include_object(obj, name, kind, reflected, compare_to):
    # PostGIS owns this extension table; it must never be dropped as ORM drift.
    return not (kind == "table" and name == "spatial_ref_sys")


if context.is_offline_mode():
    context.configure(url=url, target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata, include_object=include_object)
        with context.begin_transaction():
            context.run_migrations()
