"""Request-scoped units of work; startup never creates database tables."""

import os

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker


def make_database(settings):
    url = make_url(settings.database_url.get_secret_value())
    options = {"pool_pre_ping": True, "pool_size": 5, "max_overflow": 5}
    if os.getenv("VERCEL") == "1" or "-pooler." in (url.host or ""):
        # Serverless instances are many and short lived: keep few connections,
        # recycle them before the pooler/idle-suspend closes them, and disable
        # server-side prepared statements, which transaction poolers cannot pin.
        options = {
            "pool_pre_ping": True,
            "pool_size": 1,
            "max_overflow": 2,
            "pool_recycle": 240,
            "connect_args": {"prepare_threshold": None, "connect_timeout": 10},
        }
    engine = create_engine(url, **options)
    return engine, sessionmaker(engine, expire_on_commit=False)
