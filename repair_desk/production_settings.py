"""Production settings; select explicitly in the PaaS runtime environment."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403


def required(name):
    value = os.environ.get(name, "")
    if not value.strip() or value.startswith("REPLACE_"):
        raise ImproperlyConfigured(f"Set {name} in the runtime environment.")
    return value


def env_list(name):
    return [value.strip() for value in os.getenv(name, "").split(",") if value.strip()]


def env_bool(name, default=False):
    value = os.getenv(name, str(default)).strip().lower()
    if value not in {"true", "false", "1", "0", "yes", "no"}:
        raise ImproperlyConfigured(f"{name} must be true or false.")
    return value in {"true", "1", "yes"}


DEBUG = False
SECRET_KEY = required("DJANGO_SECRET_KEY")
if len(SECRET_KEY) < 50 or SECRET_KEY.startswith("django-insecure-"):
    raise ImproperlyConfigured("Use a new random DJANGO_SECRET_KEY of at least 50 characters.")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS")
if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("Set explicit DJANGO_ALLOWED_HOSTS, without a wildcard.")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": required("DB_NAME"),
        "USER": required("DB_USER"),
        "PASSWORD": required("DB_PASSWORD"),
        "HOST": required("DB_HOST"),
        "PORT": os.getenv("DB_PORT", "3306"),
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    },
}

MIDDLEWARE = [*MIDDLEWARE]  # noqa: F405
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
MEDIA_ROOT = Path(os.getenv("DJANGO_MEDIA_ROOT", "/data/media"))
CORS_ALLOWED_ORIGINS = env_list("DJANGO_CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
# Probes must work on the internal HTTP port and must not depend on TLS ingress.
SECURE_REDIRECT_EXEMPT = [r"^healthz/$", r"^readyz/$"]
SECURE_HSTS_SECONDS = 3600
# Do not opt the whole domain/subdomains into preload without verifying their TLS.
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
if env_bool("DJANGO_TRUST_PROXY", False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
