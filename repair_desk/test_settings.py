from .settings import *  # noqa: F403


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    },
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

ALLOWED_HOSTS = ["testserver"]
NOTIFICATION_PROVIDER = "fake"
PUBLIC_TRACKING_BASE_URL = "https://repairs.example.test/track"
