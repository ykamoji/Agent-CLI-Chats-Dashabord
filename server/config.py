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
INSIGHTS_COLLECTION = os.getenv("INSIGHTS_COLLECTION", "insights")

# Gemini (google-genai) — AI-generated insights. When GOOGLE_API_KEY is unset
# the feature degrades to deterministic-only metrics.
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_MODEL_NAME = os.getenv("GOOGLE_MODEL_NAME", "gemini-2.0-flash")
# How many recent Conversations to feed the model, and how far to truncate each Input.
INSIGHTS_MAX_TURNS = int(os.getenv("INSIGHTS_MAX_TURNS", "1000"))
INSIGHTS_INPUT_TRUNC = int(os.getenv("INSIGHTS_INPUT_TRUNC", "1000"))
# Don't regenerate if a completed insight is newer than this (seconds) unless forced.
INSIGHTS_MIN_REGEN_SECONDS = int(os.getenv("INSIGHTS_MIN_REGEN_SECONDS", "60"))

SESSION_TTL_MINUTES = int(os.getenv("SESSION_TTL_MINUTES", "15"))

# Server-side cache for /api/chats (authenticated users), in seconds.
CHATS_CACHE_TTL = int(os.getenv("CHATS_CACHE_TTL", "900"))
# Max characters of Input/Output kept in the /api/search index, to bound the
# payload and the client's sessionStorage cache.
SEARCH_FIELD_TRUNC = int(os.getenv("SEARCH_FIELD_TRUNC", "4000"))
# Flask-Caching backend. "SimpleCache" (in-process) by default; set to
# "RedisCache" + CACHE_REDIS_URL for a shared cache across workers.
CACHE_TYPE = os.getenv("CACHE_TYPE", "SimpleCache")
CACHE_REDIS_URL = os.getenv("CACHE_REDIS_URL", "")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
PORT = int(os.getenv("PORT", "5050"))

CORS_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]
