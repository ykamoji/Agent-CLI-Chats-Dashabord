# CLI Dashboard — Flask API

Backend for the CLI Dashboard. Reads chat logs from MongoDB (`vibe_coding`) and
serves the Next.js UI.

## Setup

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # then edit MONGO_URI / DB_NAME
python app.py             # http://localhost:5050
```

Config (URL, DB name, TTL, CORS) is read from `.env`. See `.env.example`.

Optional local data: `python seed_demo.py` creates a `demo` / `password123`
user with a few chat logs.

## Auth model

`authenticate` issues an opaque session token stored in a `sessions` collection
with a **5-minute** expiry (configurable via `SESSION_TTL_MINUTES`). A MongoDB
TTL index auto-removes expired sessions. The UI stores the token in
`sessionStorage` and sends it as `Authorization: Bearer <token>`.

## Endpoints

| Method | Route | Auth | Description |
| ------ | ----- | ---- | ----------- |
| `POST` | `/api/authenticate` | — | Body `{username, password}` → `{token, expires_at, ttl_seconds, user}` |
| `GET` | `/api/session` | Bearer | `{active: true, user_id, expires_at}` or `401` |
| `DELETE` | `/api/session` | Bearer | Revoke token (logout) |
| `GET` | `/api/chats` | Bearer | The user's logs from the `logs` collection (by `user_id`) |
| `GET` | `/api/profile` | Bearer | Current user's `{user_id, username, email}` |
| `PUT` | `/api/profile/password` | Bearer | Body `{new_password, confirm_password}` → updates password |
| `GET` | `/api/health` | — | Liveness check |

Passwords are verified against Werkzeug hashes, with a plaintext fallback for
pre-existing seed data; updates are always written as hashes.

## Expected collections (`vibe_coding`)

- **users** — `{ _id | user_id, username | name, email, password }`
- **logs** — `{ user_id, input, tool, output, ... }`
- **sessions** — managed by the server (created automatically).

`user_id` is matched whether stored as a string or an `ObjectId`.

## Production

```bash
gunicorn -w 4 -b 0.0.0.0:5050 app:app
```
