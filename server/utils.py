"""Small shared helpers for id handling and JSON serialization."""
from datetime import datetime

from bson import ObjectId


def id_variants(user_id):
    """Return possible representations of an id (string + ObjectId) so we match
    documents whether the id was stored as a string or as an ObjectId."""
    variants = [user_id]
    if isinstance(user_id, str):
        try:
            variants.append(ObjectId(user_id))
        except Exception:
            pass
    return variants


def json_safe(value):
    """Recursively convert a Mongo document into JSON-serializable values."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    return value
