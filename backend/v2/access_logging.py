"""Prevent one-time OAuth codes and state appearing in Uvicorn access logs."""

import logging


class OAuthAccessRedactor(logging.Filter):
    def filter(self, record):
        if isinstance(record.args, tuple) and len(record.args) == 5:
            client, method, target, version, status = record.args
            if isinstance(target, str) and target.split("?", 1)[0] == "/api/v2/government/auth/callback":
                record.args = (client, method, target.split("?", 1)[0], version, status)
        return True


def install():
    logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(filter_, OAuthAccessRedactor) for filter_ in logger.filters):
        logger.addFilter(OAuthAccessRedactor())
