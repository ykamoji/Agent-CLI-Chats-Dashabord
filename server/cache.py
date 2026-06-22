"""Flask-Caching extension instance.

Initialized in the app factory (see app.py). Defaults to an in-process
SimpleCache; configure CACHE_TYPE=RedisCache + CACHE_REDIS_URL in .env for a
cache shared across multiple workers.
"""
from flask_caching import Cache

import config

cache = Cache()


def init_cache(app) -> None:
    cache_config = {
        "CACHE_TYPE": config.CACHE_TYPE,
        "CACHE_DEFAULT_TIMEOUT": config.CHATS_CACHE_TTL,
    }
    if config.CACHE_REDIS_URL:
        cache_config["CACHE_REDIS_URL"] = config.CACHE_REDIS_URL
    cache.init_app(app, config=cache_config)
