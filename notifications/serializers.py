from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    provider_display = serializers.CharField(
        source="get_provider_display",
        read_only=True,
    )
    channel_display = serializers.CharField(
        source="get_channel_display",
        read_only=True,
    )
    customer_name = serializers.CharField(
        source="customer.name",
        read_only=True,
        allow_null=True,
    )
    tracking_code = serializers.CharField(
        source="repair_order.tracking_code",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Notification
        fields = (
            "id",
            "repair_order_id",
            "customer_id",
            "customer_name",
            "tracking_code",
            "event_type",
            "channel",
            "channel_display",
            "provider",
            "provider_display",
            "recipient",
            "template_key",
            "rendered_message",
            "status",
            "status_display",
            "attempt_count",
            "is_retryable",
            "error_code",
            "last_error",
            "scheduled_at",
            "sent_at",
            "delivered_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields
