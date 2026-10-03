import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("customers", "0003_alter_device_options_alter_device_table"),
        ("repairs", "0006_remove_repairorder_assigned_at_and_more"),
        ("shops", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "event_type",
                    models.CharField(db_index=True, max_length=64, verbose_name="event type"),
                ),
                (
                    "channel",
                    models.CharField(
                        choices=[("sms", "SMS"), ("whatsapp", "WhatsApp")],
                        default="sms",
                        max_length=16,
                        verbose_name="channel",
                    ),
                ),
                (
                    "provider",
                    models.CharField(
                        choices=[
                            ("fake", "Fake"),
                            ("smsir", "SMS.ir"),
                            ("kavenegar", "Kavenegar"),
                        ],
                        default="fake",
                        max_length=16,
                        verbose_name="provider",
                    ),
                ),
                ("recipient", models.CharField(max_length=32, verbose_name="recipient")),
                (
                    "template_key",
                    models.CharField(max_length=64, verbose_name="template key"),
                ),
                (
                    "provider_template_id",
                    models.CharField(blank=True, max_length=128, verbose_name="provider template id"),
                ),
                ("context", models.JSONField(blank=True, default=dict, verbose_name="context")),
                (
                    "rendered_message",
                    models.TextField(blank=True, verbose_name="rendered message"),
                ),
                (
                    "idempotency_key",
                    models.CharField(max_length=255, unique=True, verbose_name="idempotency key"),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("processing", "Processing"),
                            ("simulated", "Simulated"),
                            ("sent", "Sent"),
                            ("delivered", "Delivered"),
                            ("failed", "Failed"),
                            ("cancelled", "Cancelled"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=16,
                        verbose_name="status",
                    ),
                ),
                (
                    "provider_message_id",
                    models.CharField(blank=True, max_length=255, verbose_name="provider message id"),
                ),
                (
                    "attempt_count",
                    models.PositiveSmallIntegerField(default=0, verbose_name="attempt count"),
                ),
                ("last_error", models.TextField(blank=True, verbose_name="last error")),
                (
                    "provider_response",
                    models.JSONField(blank=True, default=dict, verbose_name="provider response"),
                ),
                (
                    "scheduled_at",
                    models.DateTimeField(
                        db_index=True,
                        default=django.utils.timezone.now,
                        verbose_name="scheduled at",
                    ),
                ),
                (
                    "sent_at",
                    models.DateTimeField(blank=True, null=True, verbose_name="sent at"),
                ),
                (
                    "delivered_at",
                    models.DateTimeField(blank=True, null=True, verbose_name="delivered at"),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="created at")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="updated at")),
                (
                    "customer",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="notifications",
                        to="customers.customer",
                        verbose_name="customer",
                    ),
                ),
                (
                    "repair_order",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="notifications",
                        to="repairs.repairorder",
                        verbose_name="repair order",
                    ),
                ),
                (
                    "repair_shop",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="notifications",
                        to="shops.repairshop",
                        verbose_name="repair shop",
                    ),
                ),
            ],
            options={
                "verbose_name": "notification",
                "verbose_name_plural": "notifications",
                "db_table": "notifications",
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(
                fields=["repair_shop", "status", "scheduled_at"],
                name="notif_shop_status_sched_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(
                fields=["repair_order", "created_at"],
                name="notif_order_created_idx",
            ),
        ),
    ]
