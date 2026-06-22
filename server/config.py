"""Configuration loaded from the .env file."""
import os

from dotenv import load_dotenv

# Load .env sitting next to this file regardless of the cwd we run from.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "vibe_coding")

USERS_COLLECTION = os.getenv("USERS_COLLECTION", "users")
LOGS_COLLECTION = os.getenv("LOGS_COLLECTION", "logs")
SESSIONS_COLLECTION = os.getenv("SESSIONS_COLLECTION", "sessions")

SESSION_TTL_MINUTES = int(os.getenv("SESSION_TTL_MINUTES", "15"))

# Server-side cache for /api/chats (authenticated users), in seconds.
CHATS_CACHE_TTL = int(os.getenv("CHATS_CACHE_TTL", "900"))
# Flask-Caching backend. "SimpleCache" (in-process) by default; set to
# "RedisCache" + CACHE_REDIS_URL for a shared cache across workers.
CACHE_TYPE = os.getenv("CACHE_TYPE", "SimpleCache")
CACHE_REDIS_URL = os.getenv("CACHE_REDIS_URL", "")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
PORT = int(os.getenv("PORT", "5050"))

CORS_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]
