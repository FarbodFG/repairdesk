from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notifications"
    verbose_name = "اعلان‌ها"

    def ready(self):
        from . import checks  # noqa: F401
