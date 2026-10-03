import logging
import ipaddress
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta
from enum import Enum
from typing import Any
from urllib.parse import urlencode, urlsplit

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .exceptions import (
    NotificationConfigurationError,
    NotificationProviderError,
)
from .models import Notification
from .providers import (
    FakeSmsProvider,
    KavenegarProvider,
    ProviderSendStatus,
    SmsIrProvider,
    SmsProvider,
)
from .templates import render_template


logger = logging.getLogger(__name__)

IRANIAN_MOBILE_PATTERN = re.compile(r"^(?:\+98|0098|98|0)?(9[0-9]{9})$")


class DispatchOutcome(str, Enum):
    DISPATCHED = "dispatched"
    SUPERSEDED = "superseded"
    SKIPPED_INELIGIBLE = "skipped_ineligible"
    SKIPPED_TERMINAL = "skipped_terminal"
    SKIPPED_SCHEDULED = "skipped_scheduled"
    SKIPPED_PROCESSING = "skipped_processing"


@dataclass(frozen=True, slots=True)
class NotificationDispatchResult:
    notification: Notification
    outcome: DispatchOutcome


def get_processing_timeout() -> timedelta:
    configured_seconds = getattr(
        settings,
        "NOTIFICATION_PROCESSING_TIMEOUT_SECONDS",
        300,
    )
    try:
        seconds = int(configured_seconds)
    except (TypeError, ValueError) as error:
        raise NotificationConfigurationError(
            "Notification processing timeout must be an integer."
        ) from error
    if seconds <= 0:
        raise NotificationConfigurationError(
            "Notification processing timeout must be greater than zero."
        )
    try:
        return timedelta(seconds=seconds)
    except OverflowError as error:
        raise NotificationConfigurationError(
            "Notification processing timeout is too large."
        ) from error


def get_retry_policy() -> tuple[int, tuple[int, ...]]:
    configured_max_attempts = getattr(
        settings,
        "NOTIFICATION_MAX_ATTEMPTS",
        4,
    )
    try:
        max_attempts = int(configured_max_attempts)
    except (TypeError, ValueError) as error:
        raise NotificationConfigurationError(
            "Notification max attempts must be an integer."
        ) from error
    if max_attempts <= 0:
        raise NotificationConfigurationError(
            "Notification max attempts must be greater than zero."
        )

    configured_delays = getattr(
        settings,
        "NOTIFICATION_RETRY_DELAYS_SECONDS",
        (60, 300, 900),
    )
    if isinstance(configured_delays, str):
        delay_values = [
            value.strip()
            for value in configured_delays.split(",")
            if value.strip()
        ]
    else:
        try:
            delay_values = list(configured_delays)
        except TypeError as error:
            raise NotificationConfigurationError(
                "Notification retry delays must be a sequence."
            ) from error

    try:
        retry_delays = tuple(int(value) for value in delay_values)
    except (TypeError, ValueError) as error:
        raise NotificationConfigurationError(
            "Notification retry delays must contain integers."
        ) from error
    if any(delay <= 0 for delay in retry_delays):
        raise NotificationConfigurationError(
            "Notification retry delays must be greater than zero."
        )
    try:
        for delay in retry_delays:
            timedelta(seconds=delay)
    except OverflowError as error:
        raise NotificationConfigurationError(
            "Notification retry delays are too large."
        ) from error
    if len(retry_delays) < max_attempts - 1:
        raise NotificationConfigurationError(
            "Notification retry delays must cover every automatic retry."
        )

    return max_attempts, retry_delays


def get_notification_send_mode(provider_name: str) -> str:
    configured_mode = getattr(
        settings,
        "NOTIFICATION_SEND_MODE",
        "auto",
    )
    if not isinstance(configured_mode, str):
        raise NotificationConfigurationError(
            "Notification send mode must be a string."
        )

    mode = configured_mode.strip().lower()
    if mode not in {"auto", "sync", "worker"}:
        raise NotificationConfigurationError(
            "Notification send mode must be auto, sync, or worker."
        )
    if mode == "auto":
        return (
            "sync"
            if provider_name == Notification.Provider.FAKE
            else "worker"
        )
    return mode


def get_notification_provider_name() -> str:
    configured_provider = getattr(
        settings,
        "NOTIFICATION_PROVIDER",
        Notification.Provider.FAKE,
    )
    if not isinstance(configured_provider, str):
        raise NotificationConfigurationError(
            "Notification provider must be a string."
        )

    provider_name = configured_provider.strip().lower()
    if not provider_name:
        raise NotificationConfigurationError(
            "Notification provider cannot be empty."
        )
    return provider_name


def normalize_recipient(phone_number: str) -> str:
    normalized = re.sub(r"[\s\-()]", "", phone_number)
    match = IRANIAN_MOBILE_PATTERN.fullmatch(normalized)

    if not match:
        raise NotificationConfigurationError("شماره موبایل گیرنده نامعتبر است.")

    return f"+98{match.group(1)}"


def get_public_tracking_base_url(*, require_public: bool = False) -> str:
    configured_url = getattr(
        settings,
        "PUBLIC_TRACKING_BASE_URL",
        "http://localhost:5173/track",
    )
    if not isinstance(configured_url, str) or not configured_url.strip():
        raise NotificationConfigurationError(
            "Public tracking base URL must be a non-empty string."
        )

    base_url = configured_url.strip().rstrip("/")
    parsed_url = urlsplit(base_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.hostname:
        raise NotificationConfigurationError(
            "Public tracking base URL must be an absolute HTTP(S) URL."
        )
    if parsed_url.query or parsed_url.fragment:
        raise NotificationConfigurationError(
            "Public tracking base URL cannot contain a query or fragment."
        )

    if require_public:
        hostname = parsed_url.hostname.lower()
        is_local = hostname == "localhost" or hostname.endswith(".localhost")
        try:
            is_local = is_local or ipaddress.ip_address(hostname).is_private
        except ValueError:
            pass
        if is_local:
            raise NotificationConfigurationError(
                "A real SMS provider requires a publicly accessible tracking URL."
            )
        if parsed_url.scheme != "https":
            raise NotificationConfigurationError(
                "A real SMS provider requires an HTTPS tracking URL."
            )

    return base_url


def build_tracking_url(tracking_code: str) -> str:
    base_url = get_public_tracking_base_url()
    return f"{base_url}?{urlencode({'code': tracking_code})}"


def build_repair_context(repair_order) -> dict[str, str]:
    return {
        "customer_name": repair_order.customer.name.strip(),
        "tracking_code": repair_order.tracking_code,
        "tracking_url": build_tracking_url(repair_order.tracking_code),
    }


def get_provider(provider_name: str) -> SmsProvider:
    providers: dict[str, type[SmsProvider]] = {
        Notification.Provider.FAKE: FakeSmsProvider,
        Notification.Provider.SMS_IR: SmsIrProvider,
        Notification.Provider.KAVENEGAR: KavenegarProvider,
    }

    try:
        provider_class = providers[provider_name]
    except KeyError as error:
        raise NotificationConfigurationError(
            f"Notification provider {provider_name!r} is not configured."
        ) from error

    return provider_class()


def create_repair_notification(
    *,
    repair_order,
    event_type: str,
    template_key: str,
    idempotency_key: str,
    context: Mapping[str, Any] | None = None,
) -> tuple[Notification, bool]:
    notification_context = dict(context or build_repair_context(repair_order))
    rendered_message = render_template(template_key, notification_context)
    provider_name = get_notification_provider_name()

    notification, created = Notification.objects.get_or_create(
        idempotency_key=idempotency_key,
        defaults={
            "repair_shop": repair_order.repair_shop,
            "repair_order": repair_order,
            "customer": repair_order.customer,
            "event_type": event_type,
            "channel": Notification.Channel.SMS,
            "provider": provider_name,
            "recipient": normalize_recipient(
                repair_order.customer.phone_number
            ),
            "template_key": template_key,
            "context": notification_context,
            "rendered_message": rendered_message,
        },
    )

    if not created:
        expected_identity = {
            "repair_shop_id": repair_order.repair_shop_id,
            "repair_order_id": repair_order.pk,
            "customer_id": repair_order.customer_id,
            "event_type": event_type,
            "template_key": template_key,
        }
        conflicts = {
            field_name: {
                "existing": getattr(notification, field_name),
                "expected": expected_value,
            }
            for field_name, expected_value in expected_identity.items()
            if getattr(notification, field_name) != expected_value
        }

        if conflicts:
            raise NotificationConfigurationError(
                "The idempotency key belongs to a different notification."
            )

    return notification, created


def schedule_notification_dispatch(notification: Notification) -> str:
    if notification.pk is None:
        raise NotificationConfigurationError(
            "Notification must be saved before dispatch is scheduled."
        )
    try:
        send_mode = get_notification_send_mode(notification.provider)
    except NotificationConfigurationError:
        logger.exception(
            "Invalid notification send mode; falling back to worker",
            extra={"notification_id": notification.pk},
        )
        return "worker"
    if send_mode == "worker":
        return send_mode

    notification_id = notification.pk
    transaction.on_commit(
        lambda: dispatch_notification(notification_id),
        robust=True,
    )
    return send_mode


def get_due_notification_ids(*, limit: int = 100) -> list[int]:
    if limit <= 0:
        raise ValueError("limit must be greater than zero.")

    now = timezone.now()
    stale_before = now - get_processing_timeout()
    max_attempts, _ = get_retry_policy()

    return list(
        Notification.objects.filter(
            Q(
                status=Notification.Status.PENDING,
                scheduled_at__lte=now,
            )
            | Q(
                status=Notification.Status.PROCESSING,
                scheduled_at__lte=now,
                updated_at__lte=stale_before,
            )
            | Q(
                status=Notification.Status.FAILED,
                is_retryable=True,
                attempt_count__lt=max_attempts,
                scheduled_at__lte=now,
            )
        )
        .order_by("scheduled_at", "pk")
        .values_list("pk", flat=True)[:limit]
    )


def dispatch_notification_with_outcome(
    notification_id: int,
    *,
    force: bool = False,
) -> NotificationDispatchResult:
    max_attempts, retry_delays = get_retry_policy()

    with transaction.atomic():
        notification = (
            Notification.objects
            .select_for_update()
            .get(pk=notification_id)
        )

        terminal_statuses = {
            Notification.Status.SIMULATED,
            Notification.Status.SENT,
            Notification.Status.DELIVERED,
            Notification.Status.CANCELLED,
        }

        if notification.status in terminal_statuses:
            return NotificationDispatchResult(
                notification=notification,
                outcome=DispatchOutcome.SKIPPED_TERMINAL,
            )

        now = timezone.now()
        if notification.scheduled_at > now and not force:
            return NotificationDispatchResult(
                notification=notification,
                outcome=DispatchOutcome.SKIPPED_SCHEDULED,
            )

        if notification.status == Notification.Status.FAILED and not force:
            if (
                not notification.is_retryable
                or notification.attempt_count >= max_attempts
            ):
                if notification.is_retryable:
                    notification.is_retryable = False
                    notification.save(
                        update_fields=("is_retryable", "updated_at")
                    )
                return NotificationDispatchResult(
                    notification=notification,
                    outcome=DispatchOutcome.SKIPPED_INELIGIBLE,
                )

        if notification.status == Notification.Status.PROCESSING:
            processing_timeout = get_processing_timeout()
            if notification.updated_at > timezone.now() - processing_timeout:
                return NotificationDispatchResult(
                    notification=notification,
                    outcome=DispatchOutcome.SKIPPED_PROCESSING,
                )
            if notification.attempt_count >= max_attempts and not force:
                notification.status = Notification.Status.FAILED
                notification.is_retryable = False
                notification.error_code = "max_attempts_exceeded"
                notification.last_error = (
                    "حداکثر تعداد تلاش برای ارسال اعلان انجام شده است."
                )
                notification.save(
                    update_fields=(
                        "status",
                        "is_retryable",
                        "error_code",
                        "last_error",
                        "updated_at",
                    )
                )
                return NotificationDispatchResult(
                    notification=notification,
                    outcome=DispatchOutcome.SKIPPED_INELIGIBLE,
                )

        notification.status = Notification.Status.PROCESSING
        notification.attempt_count += 1
        notification.is_retryable = False
        notification.error_code = ""
        notification.last_error = ""
        if force and notification.scheduled_at > now:
            notification.scheduled_at = now
        notification.save(
            update_fields=(
                "status",
                "attempt_count",
                "is_retryable",
                "error_code",
                "last_error",
                "scheduled_at",
                "updated_at",
            )
        )

    claimed_attempt_count = notification.attempt_count

    try:
        provider = get_provider(notification.provider)
        result = provider.send(
            recipient=notification.recipient,
            template_key=notification.template_key,
            context=notification.context,
            rendered_message=notification.rendered_message,
            idempotency_key=notification.idempotency_key,
        )

        sent_at = timezone.now()
        status_map = {
            ProviderSendStatus.SIMULATED: Notification.Status.SIMULATED,
            ProviderSendStatus.SENT: Notification.Status.SENT,
            ProviderSendStatus.DELIVERED: Notification.Status.DELIVERED,
        }
        final_status = status_map[result.status]
        delivered_at = (
            sent_at
            if result.status == ProviderSendStatus.DELIVERED
            else None
        )
        updated_count = Notification.objects.filter(
            pk=notification.pk,
            status=Notification.Status.PROCESSING,
            attempt_count=claimed_attempt_count,
        ).update(
            status=final_status,
            provider_message_id=result.provider_message_id or "",
            provider_template_id=result.provider_template_id,
            provider_response=dict(result.raw_response),
            is_retryable=False,
            error_code="",
            last_error="",
            sent_at=sent_at,
            delivered_at=delivered_at,
            updated_at=sent_at,
        )
        notification.refresh_from_db()
        return NotificationDispatchResult(
            notification=notification,
            outcome=(
                DispatchOutcome.DISPATCHED
                if updated_count
                else DispatchOutcome.SUPERSEDED
            ),
        )
    except NotificationProviderError as error:
        failure_message = str(error)
        provider_response = error.response
        failure_retryable = error.retryable
        error_code = error.code
    except NotificationConfigurationError as error:
        failure_message = str(error)
        provider_response = {}
        failure_retryable = False
        error_code = "configuration_error"
    except Exception as error:
        logger.exception(
            "Unexpected notification provider failure",
            extra={"notification_id": notification.pk},
        )
        failure_message = str(error)
        provider_response = {}
        failure_retryable = True
        error_code = "unexpected_provider_error"

    is_retryable = (
        failure_retryable
        and claimed_attempt_count < max_attempts
    )
    failure_time = timezone.now()
    next_scheduled_at = notification.scheduled_at
    if is_retryable:
        retry_delay = retry_delays[claimed_attempt_count - 1]
        next_scheduled_at = failure_time + timedelta(
            seconds=retry_delay
        )
    updated_count = Notification.objects.filter(
        pk=notification.pk,
        status=Notification.Status.PROCESSING,
        attempt_count=claimed_attempt_count,
    ).update(
        status=Notification.Status.FAILED,
        is_retryable=is_retryable,
        error_code=error_code,
        last_error=failure_message,
        provider_response=provider_response,
        scheduled_at=next_scheduled_at,
        updated_at=failure_time,
    )
    notification.refresh_from_db()
    return NotificationDispatchResult(
        notification=notification,
        outcome=(
            DispatchOutcome.DISPATCHED
            if updated_count
            else DispatchOutcome.SUPERSEDED
        ),
    )


def dispatch_notification(
    notification_id: int,
    *,
    force: bool = False,
) -> Notification:
    return dispatch_notification_with_outcome(
        notification_id,
        force=force,
    ).notification
