"""Migration URL comes from environment; never checked into Git or printed."""

import os

from alembic import context
from sqlalchemy import create_engine, pool

from db.models import Base

url = os.environ["V2_DATABASE_URL"]
if not url.startswith("postgresql+psycopg://"):
    raise ValueError("Migrations require PostgreSQL/PostGIS")


def include_object(obj, name, kind, reflected, compare_to):
    # Only this application's namespace belongs to these migrations. PostGIS
    # images may expose topology/TIGER extension tables through search_path;
    # neither extension objects nor unrelated tables may become drop operations.
    return kind != "table" or name.startswith("v2_")


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
