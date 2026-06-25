"""Flask application factory and entrypoint for the CLI Dashboard API."""
from flask import Flask, jsonify
from flask_cors import CORS

import config
from blueprints.authenticate import bp as authenticate_bp
from blueprints.chats import bp as chats_bp
from blueprints.insights import bp as insights_bp
from blueprints.profile import bp as profile_bp
from blueprints.session import bp as session_bp
from cache import init_cache
from db import init_indexes, ping


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = config.SECRET_KEY

    CORS(app, origins=config.CORS_ORIGINS, supports_credentials=True)
    init_cache(app)

    app.register_blueprint(authenticate_bp)
    app.register_blueprint(session_bp)
    app.register_blueprint(chats_bp)
    app.register_blueprint(insights_bp)
    app.register_blueprint(profile_bp)

    @app.get("/api/health")
    def health():
        try:
            ping()
            return jsonify(
                {"status": "ok", "db": config.DB_NAME, "db_connected": True}
            )
        except Exception as exc:
            return (
                jsonify(
                    {
                        "status": "degraded",
                        "db": config.DB_NAME,
                        "db_connected": False,
                        "error": str(exc),
                    }
                ),
                503,
            )

    # Best-effort: create indexes if MongoDB is reachable at startup.
    try:
        init_indexes()
    except Exception as exc:  # pragma: no cover - depends on live DB
        app.logger.warning("Could not initialize indexes (is MongoDB running?): %s", exc)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=config.PORT, debug=True)
