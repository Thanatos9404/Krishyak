"""Request-scoped units of work; startup never creates database tables."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def make_database(settings):
    engine = create_engine(settings.database_url.get_secret_value(), pool_pre_ping=True, pool_size=5, max_overflow=5)
    return engine, sessionmaker(engine, expire_on_commit=False)
