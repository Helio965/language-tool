"""Production WSGI entry point; migrations run explicitly before startup."""

import os

from app import create_app

if os.environ.get("APP_ENV") != "production":
    raise ValueError(
        "O entrypoint WSGI exige APP_ENV=production no ambiente do processo."
    )

application = create_app()
