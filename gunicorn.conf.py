"""PaaS app config: gunicorn.conf.py (relative to the repository root)."""

import os

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
