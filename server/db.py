"""MongoDB client and helpers."""
from pymongo import MongoClient

import config

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        # tz_aware so datetimes come back as timezone-aware UTC.
        _client = MongoClient(
            config.MONGO_URI,
            maxPoolSize=50,
            minPoolSize=5,
            tz_aware=True,
            serverSelectionTimeoutMS=5000
        )
    return _client

    
def get_db():
    return get_client()[config.DB_NAME]


def users_collection():
    return get_db()[config.USERS_COLLECTION]


def logs_collection():
    return get_db()[config.LOGS_COLLECTION]


def sessions_collection():
    return get_db()[config.SESSIONS_COLLECTION]


def ping() -> None:
    """Raise if MongoDB is unreachable; succeed silently otherwise."""
    get_client().admin.command("ping")


def init_indexes() -> None:
    """Create indexes. TTL index lets MongoDB auto-expire sessions."""
    sessions = sessions_collection()
    sessions.create_index("token", unique=True)
    # expireAfterSeconds=0 -> document is removed once `expires_at` is in the past.
    sessions.create_index("expires_at", expireAfterSeconds=0)
