"""PaaS app config: gunicorn.conf.py (relative to the repository root)."""

import os
from pathlib import Path
import subprocess
import sys

wsgi_app = "repair_desk.wsgi:application"
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
workers = int(os.getenv("WEB_CONCURRENCY", "2"))
worker_class = "gthread"
threads = int(os.getenv("GUNICORN_THREADS", "2"))
timeout = 60
graceful_timeout = 30
keepalive = 5
accesslog = "-"
errorlog = "-"
# Avoid logging public tracking codes or other sensitive query parameters.
access_log_format = '%(h)s %(m)s %(U)s %(s)s %(L)s'
capture_output = True
max_requests = 1000
max_requests_jitter = 100
raw_env = ["DJANGO_SETTINGS_MODULE=repair_desk.production_settings"]


def on_starting(server):
    """Prepare static assets before workers load the manifest and WhiteNoise."""
    project_root = Path(__file__).resolve().parent
    server.log.info("Collecting static files before starting application workers")
    subprocess.run(
        [sys.executable, str(project_root / "manage.py"), "collectstatic", "--noinput"],
        cwd=project_root,
        env={**os.environ, **server.cfg.env},
        check=True,
    )
