from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from utils.permissions import IsManagerOrReceptionist

from .models import Notification
from .pagination import NotificationPagination
from .serializers import NotificationSerializer
from .services import normalize_recipient, schedule_notification_dispatch
from .exceptions import NotificationConfigurationError


class NotificationListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManagerOrReceptionist]

    def get(self, request):
        notifications = (
            Notification.objects
            .filter(repair_shop_id=request.user.repair_shop_id)
            .select_related("customer", "repair_order")
        )

        notification_status = request.query_params.get("status", "").strip()
        if notification_status:
            valid_statuses = {value for value, _ in Notification.Status.choices}
            if notification_status not in valid_statuses:
                return Response(
                    {"detail": "وضعیت اعلان نامعتبر است."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            notifications = notifications.filter(status=notification_status)

        provider = request.query_params.get("provider", "").strip()
        if provider:
            valid_providers = {value for value, _ in Notification.Provider.choices}
            if provider not in valid_providers:
                return Response(
                    {"detail": "سرویس ارسال اعلان نامعتبر است."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            notifications = notifications.filter(provider=provider)

        event_type = request.query_params.get("event_type", "").strip()
        if event_type:
            notifications = notifications.filter(event_type=event_type)

        repair_order_id = request.query_params.get(
            "repair_order_id",
            "",
        ).strip()
        if repair_order_id:
            try:
                repair_order_id = int(repair_order_id)
                if repair_order_id <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                return Response(
                    {"detail": "شناسه سفارش نامعتبر است."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            notifications = notifications.filter(
                repair_order_id=repair_order_id,
            )

        search = request.query_params.get("search", "").strip()
        if search:
            search_query = (
                Q(recipient__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(customer__phone_number__icontains=search)
                | Q(repair_order__tracking_code__icontains=search)
            )
            try:
                normalized_recipient = normalize_recipient(search)
            except NotificationConfigurationError:
                pass
            else:
                search_query |= Q(recipient=normalized_recipient)

            notifications = notifications.filter(search_query)

        paginator = NotificationPagination()
        page = paginator.paginate_queryset(
            notifications.order_by("-created_at"),
            request,
            view=self,
        )
        serializer = NotificationSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class NotificationRetryView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManagerOrReceptionist]

    def post(self, request, notification_id):
        with transaction.atomic():
            notification = get_object_or_404(
                Notification.objects.select_for_update(),
                pk=notification_id,
                repair_shop_id=request.user.repair_shop_id,
            )

            if notification.status != Notification.Status.FAILED:
                return Response(
                    {
                        "detail": (
                            "فقط اعلان ناموفق را می‌توان دوباره ارسال کرد."
                        ),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            notification.status = Notification.Status.PENDING
            notification.is_retryable = False
            notification.error_code = ""
            notification.last_error = ""
            notification.provider_response = {}
            notification.scheduled_at = timezone.now()
            notification.save(
                update_fields=(
                    "status",
                    "is_retryable",
                    "error_code",
                    "last_error",
                    "provider_response",
                    "scheduled_at",
                    "updated_at",
                )
            )
            send_mode = schedule_notification_dispatch(notification)

        notification.refresh_from_db()
        serializer = NotificationSerializer(notification)
        response_status = (
            status.HTTP_202_ACCEPTED
            if send_mode == "worker"
            else status.HTTP_200_OK
        )
        return Response(serializer.data, status=response_status)
