from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class Notification(models.Model):
    class Channel(models.TextChoices):
        SMS = "sms", _("SMS")
        WHATSAPP = "whatsapp", _("WhatsApp")

    class Provider(models.TextChoices):
        FAKE = "fake", _("Fake")
        SMS_IR = "smsir", _("SMS.ir")
        KAVENEGAR = "kavenegar", _("Kavenegar")

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        PROCESSING = "processing", _("Processing")
        SIMULATED = "simulated", _("Simulated")
        SENT = "sent", _("Sent")
        DELIVERED = "delivered", _("Delivered")
        FAILED = "failed", _("Failed")
        CANCELLED = "cancelled", _("Cancelled")

    repair_shop = models.ForeignKey(
        "shops.RepairShop",
        verbose_name=_("repair shop"),
        on_delete=models.PROTECT,
        related_name="notifications",
    )
    repair_order = models.ForeignKey(
        "repairs.RepairOrder",
        verbose_name=_("repair order"),
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    customer = models.ForeignKey(
        "customers.Customer",
        verbose_name=_("customer"),
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    event_type = models.CharField(_("event type"), max_length=64, db_index=True)
    channel = models.CharField(
        _("channel"),
        max_length=16,
        choices=Channel.choices,
        default=Channel.SMS,
    )
    provider = models.CharField(
        _("provider"),
        max_length=16,
        choices=Provider.choices,
        default=Provider.FAKE,
    )
    recipient = models.CharField(_("recipient"), max_length=32)
    template_key = models.CharField(_("template key"), max_length=64)
    provider_template_id = models.CharField(
        _("provider template id"),
        max_length=128,
        blank=True,
    )
    context = models.JSONField(_("context"), default=dict, blank=True)
    rendered_message = models.TextField(_("rendered message"), blank=True)
    idempotency_key = models.CharField(
        _("idempotency key"),
        max_length=255,
        unique=True,
    )
    status = models.CharField(
        _("status"),
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    provider_message_id = models.CharField(
        _("provider message id"),
        max_length=255,
        blank=True,
    )
    attempt_count = models.PositiveSmallIntegerField(
        _("attempt count"),
        default=0,
    )
    is_retryable = models.BooleanField(
        _("is retryable"),
        default=False,
    )
    error_code = models.CharField(
        _("error code"),
        max_length=128,
        blank=True,
    )
    last_error = models.TextField(_("last error"), blank=True)
    provider_response = models.JSONField(
        _("provider response"),
        default=dict,
        blank=True,
    )
    scheduled_at = models.DateTimeField(
        _("scheduled at"),
        default=timezone.now,
        db_index=True,
    )
    sent_at = models.DateTimeField(_("sent at"), null=True, blank=True)
    delivered_at = models.DateTimeField(
        _("delivered at"),
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        db_table = "notifications"
        ordering = ("-created_at",)
        indexes = [
            models.Index(
                fields=("repair_shop", "status", "scheduled_at"),
                name="notif_shop_status_sched_idx",
            ),
            models.Index(
                fields=("repair_order", "created_at"),
                name="notif_order_created_idx",
            ),
        ]
        verbose_name = _("notification")
        verbose_name_plural = _("notifications")

    def __str__(self):
        return f"{self.event_type} -> {self.recipient} ({self.status})"
