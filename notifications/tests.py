import io
import json
from datetime import timedelta
from io import StringIO
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs

from django.urls import reverse
from django.test import TestCase
from django.core.management import call_command
from django.core.management.base import CommandError
from django.core.checks import run_checks
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from customers.models import Customer, Device
from repairs.models import RepairOrder, RepairStatusHistory
from shops.models import RepairShop

from .exceptions import (
    NotificationConfigurationError,
    PermanentNotificationProviderError,
    TransientNotificationProviderError,
)
from .models import Notification
from .providers import (
    FakeSmsProvider,
    KavenegarProvider,
    ProviderSendResult,
    ProviderSendStatus,
    SmsIrProvider,
)
from .services import (
    DispatchOutcome,
    create_repair_notification,
    dispatch_notification,
    dispatch_notification_with_outcome,
    get_due_notification_ids,
    get_notification_send_mode,
    get_notification_provider_name,
    get_provider,
    get_retry_policy,
)
from .templates import (
    REPAIR_CANCELLED,
    REPAIR_CREATED,
    REPAIR_READY,
    REPAIR_WAITING_FOR_PARTS,
)


class NotificationTestDataMixin:
    def create_shop_data(self, suffix=""):
        shop = RepairShop.objects.create(title=f"تعمیرگاه {suffix or 'اصلی'}")
        manager = User.objects.create_user(
            username=f"manager{suffix}",
            password="test-password",
            role=User.MANAGER_ROLE,
            repair_shop=shop,
        )
        customer = Customer.objects.create(
            repair_shop=shop,
            name=f"مشتری {suffix or 'اول'}",
            phone_number=f"0912000000{len(suffix)}",
        )
        device = Device.objects.create(
            customer=customer,
            custom_model_name="گوشی تست",
        )
        order = RepairOrder.objects.create(
            repair_shop=shop,
            customer=customer,
            device=device,
            issue_description="تست اعلان",
        )
        return shop, manager, customer, order


class NotificationIdempotencyTests(NotificationTestDataMixin, TestCase):
    def setUp(self):
        self.shop, self.manager, self.customer, self.order = (
            self.create_shop_data()
        )

    def test_same_idempotency_key_reuses_the_existing_outbox_record(self):
        first, first_created = create_repair_notification(
            repair_order=self.order,
            event_type=REPAIR_CREATED,
            template_key=REPAIR_CREATED,
            idempotency_key=f"repair-created:{self.order.pk}",
        )
        second, second_created = create_repair_notification(
            repair_order=self.order,
            event_type=REPAIR_CREATED,
            template_key=REPAIR_CREATED,
            idempotency_key=f"repair-created:{self.order.pk}",
        )

        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(Notification.objects.count(), 1)

    def test_same_key_cannot_be_reused_for_another_order(self):
        other_order = RepairOrder.objects.create(
            repair_shop=self.shop,
            customer=self.customer,
            device=self.order.device,
            issue_description="سفارش دوم همان مشتری",
        )
        key = "shared-key"
        create_repair_notification(
            repair_order=self.order,
            event_type=REPAIR_CREATED,
            template_key=REPAIR_CREATED,
            idempotency_key=key,
        )

        with self.assertRaises(NotificationConfigurationError):
            create_repair_notification(
                repair_order=other_order,
                event_type=REPAIR_CREATED,
                template_key=REPAIR_CREATED,
                idempotency_key=key,
            )

        self.assertEqual(Notification.objects.count(), 1)

    def test_dispatching_a_terminal_notification_does_not_send_twice(self):
        notification, _ = create_repair_notification(
            repair_order=self.order,
            event_type=REPAIR_CREATED,
            template_key=REPAIR_CREATED,
            idempotency_key="dispatch-once",
        )

        first = dispatch_notification(notification.pk)
        second = dispatch_notification(notification.pk)

        self.assertEqual(first.status, Notification.Status.SIMULATED)
        self.assertEqual(second.status, Notification.Status.SIMULATED)
        self.assertEqual(second.attempt_count, 1)
        self.assertEqual(
            first.provider_message_id,
            second.provider_message_id,
        )

    def test_fake_provider_is_deterministic_for_an_idempotency_key(self):
        provider = FakeSmsProvider()
        arguments = {
            "recipient": "+989120000000",
            "template_key": REPAIR_CREATED,
            "context": {"tracking_code": "RDTEST"},
            "rendered_message": "پیام آزمایشی",
            "idempotency_key": "stable-key",
        }

        first = provider.send(**arguments)
        second = provider.send(**arguments)

        self.assertEqual(first.provider_message_id, second.provider_message_id)
        self.assertEqual(first.status.value, "simulated")


class NotificationApiTests(NotificationTestDataMixin, TestCase):
    def setUp(self):
        self.shop, self.manager, self.customer, self.order = (
            self.create_shop_data()
        )
        self.client = APIClient()
        self.client.force_authenticate(self.manager)

    def test_retry_changes_a_failed_notification_to_simulated(self):
        notification, _ = create_repair_notification(
            repair_order=self.order,
            event_type=REPAIR_CREATED,
            template_key=REPAIR_CREATED,
            idempotency_key="retry-failed",
        )

        with patch(
            "notifications.services.get_provider",
            side_effect=TransientNotificationProviderError("خطای موقت"),
        ):
            failed = dispatch_notification(notification.pk)

        self.assertEqual(failed.status, Notification.Status.FAILED)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse(
                    "notification-retry",
                    kwargs={"notification_id": notification.pk},
                ),
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.SIMULATED)
        self.assertEqual(notification.attempt_count, 2)

    def test_only_failed_notifications_can_be_retried(self):
        for notification_status, initial_attempts in (
            (Notification.Status.PENDING, 0),
            (Notification.Status.SIMULATED, 1),
        ):
            with self.subTest(notification_status=notification_status):
                notification, _ = create_repair_notification(
                    repair_order=self.order,
                    event_type=REPAIR_CREATED,
                    template_key=REPAIR_CREATED,
                    idempotency_key=f"no-retry:{notification_status}",
                )
                notification.status = notification_status
                notification.attempt_count = initial_attempts
                notification.save(
                    update_fields=("status", "attempt_count", "updated_at")
                )

                response = self.client.post(
                    reverse(
                        "notification-retry",
                        kwargs={"notification_id": notification.pk},
                    ),
                )

                self.assertEqual(
                    response.status_code,
                    status.HTTP_409_CONFLICT,
                )
                notification.refresh_from_db()
                self.assertEqual(notification.status, notification_status)
                self.assertEqual(notification.attempt_count, initial_attempts)

    def test_other_shop_cannot_list_or_retry_this_shop_notifications(self):
        notification, _ = create_repair_notification(
            repair_order=self.order,
            event_type=REPAIR_CREATED,
            template_key=REPAIR_CREATED,
            idempotency_key="tenant-isolation",
        )
        notification.status = Notification.Status.FAILED
        notification.save(update_fields=("status", "updated_at"))
        _, other_manager, _, _ = self.create_shop_data("other")
        self.client.force_authenticate(other_manager)

        list_response = self.client.get(reverse("notification-list"))
        retry_response = self.client.post(
            reverse(
                "notification-retry",
                kwargs={"notification_id": notification.pk},
            ),
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 0)
        self.assertEqual(retry_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_status_change_creates_one_history_and_one_notification(self):
        url = reverse(
            "repair-order-detail",
            kwargs={"repair_order_id": self.order.pk},
        )

        with self.captureOnCommitCallbacks(execute=True):
            first_response = self.client.patch(
                url,
                {"repair_status": RepairOrder.CANCELLED},
                format="json",
            )
        second_response = self.client.patch(
            url,
            {"repair_status": RepairOrder.CANCELLED},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            RepairStatusHistory.objects.filter(repair_order=self.order).count(),
            1,
        )
        status_notifications = Notification.objects.filter(
            repair_order=self.order,
            event_type=REPAIR_CANCELLED,
        )
        self.assertEqual(status_notifications.count(), 1)
        self.assertEqual(
            status_notifications.get().status,
            Notification.Status.SIMULATED,
        )

    def test_order_creation_creates_and_dispatches_one_notification(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("repair-orders-list-create"),
                {
                    "customer_id": self.customer.pk,
                    "device_id": self.order.device_id,
                    "issue_description": "سفارش ساخته‌شده از API",
                    "final_amount": None,
                    "is_paid": False,
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_order_id = response.data["id"]
        created_notifications = Notification.objects.filter(
            repair_order_id=created_order_id,
            event_type=REPAIR_CREATED,
        )
        self.assertEqual(created_notifications.count(), 1)
        notification = created_notifications.get()
        self.assertEqual(notification.status, Notification.Status.SIMULATED)
        self.assertEqual(notification.attempt_count, 1)
        self.assertEqual(
            notification.idempotency_key,
            f"repair-created:{created_order_id}",
        )

    def test_status_without_a_message_creates_history_but_no_notification(self):
        url = reverse(
            "repair-order-detail",
            kwargs={"repair_order_id": self.order.pk},
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                url,
                {"repair_status": RepairOrder.INSPECTING},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            RepairStatusHistory.objects.filter(repair_order=self.order).count(),
            1,
        )
        self.assertEqual(
            Notification.objects.filter(repair_order=self.order).count(),
            0,
        )

    def test_list_permissions_and_sensitive_fields(self):
        notification, _ = create_repair_notification(
            repair_order=self.order,
            event_type=REPAIR_CREATED,
            template_key=REPAIR_CREATED,
            idempotency_key="permission-matrix",
        )
        receptionist = User.objects.create_user(
            username="receptionist",
            password="test-password",
            role=User.RECEPTIONIST_ROLE,
            repair_shop=self.shop,
        )
        technician = User.objects.create_user(
            username="technician",
            password="test-password",
            role=User.TECHNICIAN_ROLE,
            repair_shop=self.shop,
        )

        self.client.force_authenticate(receptionist)
        receptionist_response = self.client.get(reverse("notification-list"))

        self.assertEqual(receptionist_response.status_code, status.HTTP_200_OK)
        self.assertEqual(receptionist_response.data["count"], 1)
        result = receptionist_response.data["results"][0]
        self.assertEqual(result["id"], notification.pk)
        for sensitive_field in (
            "context",
            "provider_response",
            "idempotency_key",
        ):
            self.assertNotIn(sensitive_field, result)

        self.client.force_authenticate(technician)
        technician_response = self.client.get(reverse("notification-list"))
        self.assertEqual(
            technician_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )


class NotificationProcessorTests(NotificationTestDataMixin, TestCase):
    def setUp(self):
        self.shop, self.manager, self.customer, self.order = (
            self.create_shop_data()
        )

    def create_notification(self, key):
        notification, _ = create_repair_notification(
            repair_order=self.order,
            event_type=REPAIR_CREATED,
            template_key=REPAIR_CREATED,
            idempotency_key=key,
        )
        return notification

    def run_processor(self, **options):
        output = StringIO()
        call_command("process_notifications", stdout=output, **options)
        return output.getvalue()

    def test_processor_dispatches_a_due_pending_notification(self):
        notification = self.create_notification("processor-pending")

        output = self.run_processor()

        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.SIMULATED)
        self.assertEqual(notification.attempt_count, 1)
        self.assertIn("selected=1", output)
        self.assertIn("succeeded=1", output)

    def test_processor_does_not_dispatch_a_future_notification(self):
        notification = self.create_notification("processor-future")
        notification.scheduled_at = timezone.now() + timedelta(minutes=5)
        notification.save(update_fields=("scheduled_at", "updated_at"))

        output = self.run_processor()

        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.PENDING)
        self.assertEqual(notification.attempt_count, 0)
        self.assertIn("selected=0", output)

    def test_processor_recovers_stale_processing_notification(self):
        notification = self.create_notification("processor-stale")
        stale_at = timezone.now() - timedelta(minutes=10)
        Notification.objects.filter(pk=notification.pk).update(
            status=Notification.Status.PROCESSING,
            attempt_count=1,
            updated_at=stale_at,
        )

        self.run_processor()

        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.SIMULATED)
        self.assertEqual(notification.attempt_count, 2)

    def test_processor_does_not_reclaim_fresh_processing_notification(self):
        notification = self.create_notification("processor-fresh")
        Notification.objects.filter(pk=notification.pk).update(
            status=Notification.Status.PROCESSING,
            updated_at=timezone.now(),
        )

        self.run_processor()

        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.PROCESSING)
        self.assertEqual(notification.attempt_count, 0)

    def test_processor_respects_limit(self):
        first = self.create_notification("processor-limit-1")
        second = self.create_notification("processor-limit-2")
        now = timezone.now()
        Notification.objects.filter(pk=first.pk).update(
            scheduled_at=now - timedelta(minutes=1),
        )
        Notification.objects.filter(pk=second.pk).update(
            scheduled_at=now - timedelta(minutes=2),
        )

        self.run_processor(limit=1)

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.status, Notification.Status.PENDING)
        self.assertEqual(second.status, Notification.Status.SIMULATED)

    def test_due_selector_uses_primary_key_for_equal_schedule(self):
        first = self.create_notification("processor-order-1")
        second = self.create_notification("processor-order-2")
        same_time = timezone.now() - timedelta(minutes=1)
        Notification.objects.filter(pk__in=(first.pk, second.pk)).update(
            scheduled_at=same_time,
        )

        selected_ids = get_due_notification_ids(limit=2)

        self.assertEqual(selected_ids, [first.pk, second.pk])

    def test_stale_processing_with_future_schedule_is_not_selected(self):
        notification = self.create_notification("processor-stale-future")
        Notification.objects.filter(pk=notification.pk).update(
            status=Notification.Status.PROCESSING,
            attempt_count=1,
            scheduled_at=timezone.now() + timedelta(minutes=5),
            updated_at=timezone.now() - timedelta(minutes=10),
        )

        self.run_processor()

        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.PROCESSING)
        self.assertEqual(notification.attempt_count, 1)

    def test_invalid_processing_timeout_is_rejected(self):
        for invalid_timeout in (0, -1, "invalid"):
            with self.subTest(timeout=invalid_timeout):
                with self.settings(
                    NOTIFICATION_PROCESSING_TIMEOUT_SECONDS=invalid_timeout
                ):
                    with self.assertRaises(NotificationConfigurationError):
                        get_due_notification_ids()

    def test_unexpected_error_continues_batch_then_fails_command(self):
        first = self.create_notification("processor-error-1")
        second = self.create_notification("processor-error-2")
        real_dispatch = dispatch_notification_with_outcome

        def dispatch_side_effect(notification_id):
            if notification_id == first.pk:
                raise RuntimeError("unexpected database-like failure")
            return real_dispatch(notification_id)

        output = StringIO()
        errors = StringIO()
        with patch(
            "notifications.management.commands.process_notifications."
            "dispatch_notification_with_outcome",
            side_effect=dispatch_side_effect,
        ), patch(
            "notifications.management.commands.process_notifications."
            "logger.exception"
        ):
            with self.assertRaises(CommandError):
                call_command(
                    "process_notifications",
                    stdout=output,
                    stderr=errors,
                )

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.status, Notification.Status.PENDING)
        self.assertEqual(second.status, Notification.Status.SIMULATED)
        self.assertIn("unexpected_errors=1", errors.getvalue())

    def test_repeated_selection_is_reported_as_skipped_without_resend(self):
        notification = self.create_notification("processor-duplicate-claim")

        first = dispatch_notification_with_outcome(notification.pk)
        second = dispatch_notification_with_outcome(notification.pk)

        self.assertEqual(first.outcome, DispatchOutcome.DISPATCHED)
        self.assertEqual(second.outcome, DispatchOutcome.SKIPPED_TERMINAL)
        notification.refresh_from_db()
        self.assertEqual(notification.attempt_count, 1)

    def test_due_selector_and_command_reject_invalid_limits(self):
        with self.assertRaises(ValueError):
            get_due_notification_ids(limit=0)
        with self.assertRaises(CommandError):
            self.run_processor(limit=0)


class NotificationRetryPolicyTests(NotificationTestDataMixin, TestCase):
    def setUp(self):
        self.shop, self.manager, self.customer, self.order = (
            self.create_shop_data()
        )
        self.client = APIClient()
        self.client.force_authenticate(self.manager)

    def create_notification(self, key):
        notification, _ = create_repair_notification(
            repair_order=self.order,
            event_type=REPAIR_CREATED,
            template_key=REPAIR_CREATED,
            idempotency_key=key,
        )
        return notification

    def test_transient_failure_is_scheduled_with_backoff(self):
        notification = self.create_notification("retry-transient")
        before_dispatch = timezone.now()

        with patch(
            "notifications.services.get_provider",
            side_effect=TransientNotificationProviderError(
                "temporary outage",
                code="temporary_outage",
            ),
        ):
            failed = dispatch_notification(notification.pk)

        self.assertEqual(failed.status, Notification.Status.FAILED)
        self.assertTrue(failed.is_retryable)
        self.assertEqual(failed.error_code, "temporary_outage")
        self.assertEqual(failed.attempt_count, 1)
        self.assertGreaterEqual(
            failed.scheduled_at,
            before_dispatch + timedelta(seconds=59),
        )
        self.assertLessEqual(
            failed.scheduled_at,
            timezone.now() + timedelta(seconds=61),
        )

    def test_full_backoff_sequence_and_final_stop(self):
        notification = self.create_notification("retry-full-backoff")
        expected_delays = (60, 300, 900)

        for attempt_number in range(1, 5):
            if attempt_number > 1:
                Notification.objects.filter(pk=notification.pk).update(
                    scheduled_at=timezone.now() - timedelta(seconds=1),
                )
            before_dispatch = timezone.now()
            with patch(
                "notifications.services.get_provider",
                side_effect=TransientNotificationProviderError(
                    "temporary outage"
                ),
            ):
                failed = dispatch_notification(notification.pk)

            self.assertEqual(failed.attempt_count, attempt_number)
            self.assertEqual(failed.status, Notification.Status.FAILED)
            if attempt_number <= len(expected_delays):
                expected_delay = expected_delays[attempt_number - 1]
                self.assertTrue(failed.is_retryable)
                self.assertGreaterEqual(
                    failed.scheduled_at,
                    before_dispatch
                    + timedelta(seconds=expected_delay - 1),
                )
                self.assertLessEqual(
                    failed.scheduled_at,
                    timezone.now()
                    + timedelta(seconds=expected_delay + 1),
                )
            else:
                self.assertFalse(failed.is_retryable)
                self.assertNotIn(failed.pk, get_due_notification_ids())

    def test_permanent_failure_is_not_selected_for_automatic_retry(self):
        notification = self.create_notification("retry-permanent")

        with patch(
            "notifications.services.get_provider",
            side_effect=PermanentNotificationProviderError(
                "invalid template",
                code="invalid_template",
            ),
        ):
            failed = dispatch_notification(notification.pk)

        self.assertEqual(failed.status, Notification.Status.FAILED)
        self.assertFalse(failed.is_retryable)
        self.assertEqual(failed.error_code, "invalid_template")
        self.assertNotIn(failed.pk, get_due_notification_ids())

    def test_due_transient_failure_is_retried_by_processor(self):
        notification = self.create_notification("retry-processor")
        with patch(
            "notifications.services.get_provider",
            side_effect=TransientNotificationProviderError("temporary"),
        ):
            dispatch_notification(notification.pk)
        Notification.objects.filter(pk=notification.pk).update(
            scheduled_at=timezone.now() - timedelta(seconds=1),
        )

        call_command("process_notifications", stdout=StringIO())

        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.SIMULATED)
        self.assertFalse(notification.is_retryable)
        self.assertEqual(notification.error_code, "")
        self.assertEqual(notification.attempt_count, 2)

    def test_automatic_retry_stops_at_max_attempts(self):
        notification = self.create_notification("retry-max-attempts")
        Notification.objects.filter(pk=notification.pk).update(
            attempt_count=3,
        )

        with patch(
            "notifications.services.get_provider",
            side_effect=TransientNotificationProviderError("still down"),
        ):
            failed = dispatch_notification(notification.pk)

        self.assertEqual(failed.attempt_count, 4)
        self.assertEqual(failed.status, Notification.Status.FAILED)
        self.assertFalse(failed.is_retryable)
        self.assertNotIn(failed.pk, get_due_notification_ids())

    def test_manual_retry_bypasses_automatic_retry_schedule(self):
        notification = self.create_notification("retry-manual-force")
        future_schedule = timezone.now() + timedelta(minutes=5)
        Notification.objects.filter(pk=notification.pk).update(
            status=Notification.Status.FAILED,
            is_retryable=True,
            attempt_count=1,
            scheduled_at=future_schedule,
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse(
                    "notification-retry",
                    kwargs={"notification_id": notification.pk},
                )
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.SIMULATED)
        self.assertEqual(notification.attempt_count, 2)
        self.assertLess(notification.scheduled_at, future_schedule)

    def test_late_attempt_cannot_overwrite_a_newer_attempt(self):
        notification = self.create_notification("retry-fencing")
        nested_results = []

        class SlowFirstProvider:
            def send(inner_self, **kwargs):
                del inner_self, kwargs
                Notification.objects.filter(pk=notification.pk).update(
                    updated_at=timezone.now() - timedelta(minutes=10),
                )
                nested_results.append(
                    dispatch_notification_with_outcome(notification.pk)
                )
                return ProviderSendResult(
                    status=ProviderSendStatus.SENT,
                    provider_message_id="late-first-attempt",
                )

        providers = iter((SlowFirstProvider(), FakeSmsProvider()))
        with patch(
            "notifications.services.get_provider",
            side_effect=lambda provider_name: next(providers),
        ):
            first_result = dispatch_notification_with_outcome(notification.pk)

        notification.refresh_from_db()
        self.assertEqual(first_result.outcome, DispatchOutcome.SUPERSEDED)
        self.assertEqual(
            nested_results[0].outcome,
            DispatchOutcome.DISPATCHED,
        )
        self.assertEqual(notification.attempt_count, 2)
        self.assertEqual(notification.status, Notification.Status.SIMULATED)
        self.assertNotEqual(
            notification.provider_message_id,
            "late-first-attempt",
        )

    def test_failed_eligibility_is_rechecked_inside_claim_lock(self):
        notification = self.create_notification("retry-eligibility-race")
        Notification.objects.filter(pk=notification.pk).update(
            status=Notification.Status.FAILED,
            is_retryable=True,
            attempt_count=1,
            scheduled_at=timezone.now() - timedelta(seconds=1),
        )
        self.assertIn(notification.pk, get_due_notification_ids())

        Notification.objects.filter(pk=notification.pk).update(
            is_retryable=False,
            error_code="permanent_after_selection",
        )
        with patch("notifications.services.get_provider") as get_provider:
            result = dispatch_notification_with_outcome(notification.pk)

        self.assertEqual(result.outcome, DispatchOutcome.SKIPPED_INELIGIBLE)
        get_provider.assert_not_called()
        notification.refresh_from_db()
        self.assertEqual(notification.attempt_count, 1)
        self.assertEqual(notification.status, Notification.Status.FAILED)

    def test_stale_processing_at_max_attempts_is_finalized_without_send(self):
        notification = self.create_notification("retry-stale-at-max")
        Notification.objects.filter(pk=notification.pk).update(
            status=Notification.Status.PROCESSING,
            is_retryable=False,
            attempt_count=4,
            updated_at=timezone.now() - timedelta(minutes=10),
        )

        with patch("notifications.services.get_provider") as get_provider:
            result = dispatch_notification_with_outcome(notification.pk)

        self.assertEqual(result.outcome, DispatchOutcome.SKIPPED_INELIGIBLE)
        get_provider.assert_not_called()
        notification.refresh_from_db()
        self.assertEqual(notification.attempt_count, 4)
        self.assertEqual(notification.status, Notification.Status.FAILED)
        self.assertFalse(notification.is_retryable)
        self.assertEqual(notification.error_code, "max_attempts_exceeded")

    def test_failed_at_max_attempts_is_not_claimed(self):
        notification = self.create_notification("retry-failed-at-max")
        Notification.objects.filter(pk=notification.pk).update(
            status=Notification.Status.FAILED,
            is_retryable=True,
            attempt_count=4,
            scheduled_at=timezone.now() - timedelta(seconds=1),
        )

        with patch("notifications.services.get_provider") as get_provider:
            result = dispatch_notification_with_outcome(notification.pk)

        self.assertEqual(result.outcome, DispatchOutcome.SKIPPED_INELIGIBLE)
        get_provider.assert_not_called()
        notification.refresh_from_db()
        self.assertEqual(notification.attempt_count, 4)
        self.assertFalse(notification.is_retryable)

    def test_retry_policy_configuration_is_validated(self):
        invalid_settings = (
            {"NOTIFICATION_MAX_ATTEMPTS": 0},
            {"NOTIFICATION_MAX_ATTEMPTS": "invalid"},
            {
                "NOTIFICATION_MAX_ATTEMPTS": 4,
                "NOTIFICATION_RETRY_DELAYS_SECONDS": "60,300",
            },
            {
                "NOTIFICATION_MAX_ATTEMPTS": 2,
                "NOTIFICATION_RETRY_DELAYS_SECONDS": "0",
            },
            {
                "NOTIFICATION_MAX_ATTEMPTS": 2,
                "NOTIFICATION_RETRY_DELAYS_SECONDS": str(10**100),
            },
        )

        for overrides in invalid_settings:
            with self.subTest(overrides=overrides):
                with self.settings(**overrides):
                    with self.assertRaises(NotificationConfigurationError):
                        get_retry_policy()


class NotificationSendModeTests(NotificationTestDataMixin, TestCase):
    def setUp(self):
        self.shop, self.manager, self.customer, self.order = (
            self.create_shop_data()
        )
        self.client = APIClient()
        self.client.force_authenticate(self.manager)

    def create_order_through_api(self):
        return self.client.post(
            reverse("repair-orders-list-create"),
            {
                "customer_id": self.customer.pk,
                "device_id": self.order.device_id,
                "issue_description": "تست حالت ارسال",
                "final_amount": None,
                "is_paid": False,
            },
            format="json",
        )

    def test_auto_mode_keeps_real_provider_out_of_request(self):
        with self.settings(
            NOTIFICATION_PROVIDER=Notification.Provider.SMS_IR,
            NOTIFICATION_SEND_MODE="auto",
        ):
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                response = self.create_order_through_api()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        notification = Notification.objects.get(
            repair_order_id=response.data["id"],
        )
        self.assertEqual(callbacks, [])
        self.assertEqual(notification.status, Notification.Status.PENDING)
        self.assertEqual(notification.attempt_count, 0)

    def test_explicit_worker_mode_keeps_fake_notification_pending(self):
        with self.settings(
            NOTIFICATION_PROVIDER=Notification.Provider.FAKE,
            NOTIFICATION_SEND_MODE="worker",
        ):
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                response = self.create_order_through_api()

        notification = Notification.objects.get(
            repair_order_id=response.data["id"],
        )
        self.assertEqual(callbacks, [])
        self.assertEqual(notification.status, Notification.Status.PENDING)
        self.assertEqual(notification.attempt_count, 0)

    def test_explicit_sync_mode_dispatches_real_provider_in_callback(self):
        with self.settings(
            NOTIFICATION_PROVIDER=Notification.Provider.SMS_IR,
            NOTIFICATION_SEND_MODE="sync",
            SMSIR_API_KEY="",
        ):
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                response = self.create_order_through_api()

        notification = Notification.objects.get(
            repair_order_id=response.data["id"],
        )
        self.assertEqual(len(callbacks), 1)
        self.assertEqual(notification.status, Notification.Status.FAILED)
        self.assertEqual(notification.error_code, "configuration_error")
        self.assertEqual(notification.attempt_count, 1)

    def test_send_mode_configuration_is_validated(self):
        for invalid_mode in ("invalid", "", 123):
            with self.subTest(mode=invalid_mode):
                with self.settings(NOTIFICATION_SEND_MODE=invalid_mode):
                    with self.assertRaises(NotificationConfigurationError):
                        get_notification_send_mode(Notification.Provider.FAKE)

    def test_auto_real_provider_manual_retry_is_queued_without_network(self):
        with self.settings(
            NOTIFICATION_PROVIDER=Notification.Provider.SMS_IR,
        ):
            notification, _ = create_repair_notification(
                repair_order=self.order,
                event_type=REPAIR_CREATED,
                template_key=REPAIR_CREATED,
                idempotency_key="send-mode-manual-worker",
            )
        Notification.objects.filter(pk=notification.pk).update(
            status=Notification.Status.FAILED,
            attempt_count=1,
            error_code="old_error",
            last_error="old error",
        )

        with self.settings(NOTIFICATION_SEND_MODE="auto"), patch(
            "notifications.services.get_provider"
        ) as get_provider:
            response = self.client.post(
                reverse(
                    "notification-retry",
                    kwargs={"notification_id": notification.pk},
                )
            )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        get_provider.assert_not_called()
        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.PENDING)
        self.assertEqual(notification.attempt_count, 1)
        self.assertEqual(notification.error_code, "")
        self.assertEqual(notification.last_error, "")

    def test_invalid_mode_reports_check_error_without_rolling_back_order(self):
        with self.settings(NOTIFICATION_SEND_MODE="invalid"), patch(
            "notifications.services.logger.exception"
        ):
            check_ids = {error.id for error in run_checks()}
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                response = self.create_order_through_api()

        self.assertIn("notifications.E001", check_ids)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        notification = Notification.objects.get(
            repair_order_id=response.data["id"],
        )
        self.assertEqual(callbacks, [])
        self.assertEqual(notification.status, Notification.Status.PENDING)


class NotificationEventCoverageTests(NotificationTestDataMixin, TestCase):
    def setUp(self):
        self.shop, self.manager, self.customer, self.order = (
            self.create_shop_data()
        )
        self.client = APIClient()
        self.client.force_authenticate(self.manager)
        self.url = reverse(
            "repair-order-detail",
            kwargs={"repair_order_id": self.order.pk},
        )

    def change_status(self, repair_status):
        return self.client.patch(
            self.url,
            {"repair_status": repair_status},
            format="json",
        )

    def test_all_configured_status_events_create_exactly_one_notification(self):
        transitions = (
            (RepairOrder.INSPECTING, None),
            (RepairOrder.WAITING_FOR_PARTS, REPAIR_WAITING_FOR_PARTS),
            (RepairOrder.REPAIRING, None),
            (RepairOrder.READY_FOR_DELIVERY, REPAIR_READY),
            (RepairOrder.CANCELLED, REPAIR_CANCELLED),
        )

        for repair_status, expected_event in transitions:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.change_status(repair_status)

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            history = RepairStatusHistory.objects.filter(
                repair_order=self.order,
                repair_new_status=repair_status,
            ).latest("pk")
            history_notifications = Notification.objects.filter(
                idempotency_key=f"repair-status-history:{history.pk}",
            )

            if expected_event is None:
                self.assertFalse(history_notifications.exists())
            else:
                notification = history_notifications.get()
                self.assertEqual(notification.event_type, expected_event)
                self.assertEqual(notification.template_key, expected_event)
                self.assertEqual(
                    notification.status,
                    Notification.Status.SIMULATED,
                )

        self.assertEqual(
            RepairStatusHistory.objects.filter(
                repair_order=self.order
            ).count(),
            len(transitions),
        )
        notifications = Notification.objects.filter(
            repair_order=self.order,
        ).order_by("pk")
        self.assertEqual(notifications.count(), 3)
        self.assertEqual(
            notifications.values("idempotency_key").distinct().count(),
            3,
        )

    def test_provider_registry_resolves_smsir_and_rejects_unknown_name(self):
        self.assertIsInstance(
            get_provider(Notification.Provider.SMS_IR),
            SmsIrProvider,
        )
        self.assertIsInstance(
            get_provider(Notification.Provider.KAVENEGAR),
            KavenegarProvider,
        )
        with self.assertRaises(NotificationConfigurationError):
            get_provider("unknown-provider")

    def test_canonical_provider_name_is_stored_in_outbox(self):
        with self.settings(NOTIFICATION_PROVIDER="  FaKe  "):
            notification, created = create_repair_notification(
                repair_order=self.order,
                event_type=REPAIR_CREATED,
                template_key=REPAIR_CREATED,
                idempotency_key="canonical-provider-name",
            )

        self.assertTrue(created)
        self.assertEqual(notification.provider, Notification.Provider.FAKE)


class StubHttpResponse:
    def __init__(self, payload, status_code=200):
        self.status = status_code
        self.body = json.dumps(payload).encode("utf-8")

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False


class KavenegarProviderTests(TestCase):
    context = {
        "customer_name": "علی رضایی",
        "tracking_code": "RDTEST123456",
        "tracking_url": "https://example.test/track?code=RDTEST123456",
    }
    templates = {
        REPAIR_CREATED: "RepairCreated",
        REPAIR_WAITING_FOR_PARTS: "RepairWaiting",
        REPAIR_READY: "RepairReady",
        REPAIR_CANCELLED: "RepairCancelled",
    }

    def make_provider(self, *, opener, **overrides):
        options = {
            "api_key": "secret/key",
            "templates": self.templates,
            "token_mappings": {
                "tracking_code": "token",
                "customer_name": "token10",
            },
            "opener": opener,
        }
        options.update(overrides)
        return KavenegarProvider(**options)

    def test_successful_lookup_uses_expected_form_and_returns_message_id(self):
        captured = {}

        def opener(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return StubHttpResponse({
                "return": {"status": 200, "message": "تایید شد"},
                "entries": [{
                    "messageid": 8792343,
                    "status": 5,
                    "statustext": "ارسال به مخابرات",
                }],
            })

        result = self.make_provider(opener=opener).send(
            recipient="+989120000000",
            template_key=REPAIR_CREATED,
            context=self.context,
            rendered_message="متن نهایی",
            idempotency_key="kavenegar-success",
        )

        request = captured["request"]
        payload = parse_qs(request.data.decode("utf-8"))
        self.assertIn("secret%2Fkey", request.full_url)
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(payload["receptor"], ["+989120000000"])
        self.assertEqual(payload["template"], ["RepairCreated"])
        self.assertEqual(payload["token"], ["RDTEST123456"])
        self.assertEqual(payload["token10"], ["علی رضایی"])
        self.assertNotIn("tracking_url", payload)
        self.assertEqual(result.status, ProviderSendStatus.SENT)
        self.assertEqual(result.provider_message_id, "8792343")
        self.assertEqual(result.provider_template_id, "RepairCreated")

    def test_delivered_entry_maps_to_delivered(self):
        provider = self.make_provider(
            opener=lambda *args, **kwargs: StubHttpResponse({
                "return": {"status": 200, "message": "ok"},
                "entries": [{"messageid": 1, "status": 10}],
            }),
        )

        result = provider.send(
            recipient="+989120000000",
            template_key=REPAIR_READY,
            context=self.context,
            rendered_message="ignored",
            idempotency_key="kavenegar-delivered",
        )

        self.assertEqual(result.status, ProviderSendStatus.DELIVERED)

    def test_missing_configuration_is_rejected_before_network(self):
        provider = KavenegarProvider(
            api_key="",
            templates={},
            opener=lambda *args, **kwargs: self.fail("network was called"),
        )

        with self.assertRaises(NotificationConfigurationError):
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="ignored",
                idempotency_key="kavenegar-config",
            )

    def test_invalid_token_mapping_and_value_are_rejected(self):
        for token_mappings, context in (
            ({"tracking_code": "token99"}, self.context),
            ({"customer_name": "token"}, self.context),
            ({
                "tracking_code": "token",
                "customer_name": "token10",
                "tracking_url": "token20",
            }, self.context),
            ({
                "tracking_code": "token",
                "customer_name": "token10",
            }, {
                **self.context,
                "tracking_code": "HAS SPACE",
            }),
        ):
            with self.subTest(mapping=token_mappings, context=context):
                provider = self.make_provider(
                    opener=lambda *args, **kwargs: self.fail(
                        "network was called"
                    ),
                    token_mappings=token_mappings,
                )
                with self.assertRaises(NotificationConfigurationError):
                    provider.send(
                        recipient="+989120000000",
                        template_key=REPAIR_CREATED,
                        context=context,
                        rendered_message="ignored",
                        idempotency_key="kavenegar-token",
                    )

    def test_missing_api_or_message_status_is_a_transient_malformed_response(self):
        responses = (
            {
                "return": {"message": "missing status"},
                "entries": [{"messageid": 1, "status": 5}],
            },
            {
                "return": {"status": 200, "message": "ok"},
                "entries": [{"messageid": 1}],
            },
        )
        for response_payload in responses:
            with self.subTest(response=response_payload):
                provider = self.make_provider(
                    opener=lambda *args, payload=response_payload, **kwargs: (
                        StubHttpResponse(payload)
                    ),
                )
                with self.assertRaises(TransientNotificationProviderError):
                    provider.send(
                        recipient="+989120000000",
                        template_key=REPAIR_CREATED,
                        context=self.context,
                        rendered_message="ignored",
                        idempotency_key="kavenegar-missing-status",
                    )

    def test_http_5xx_remains_transient_despite_permanent_api_status(self):
        error_body = json.dumps({
            "return": {"status": 424, "message": "template missing"},
            "entries": None,
        }).encode("utf-8")

        def opener(*args, **kwargs):
            raise HTTPError(
                url="https://api.kavenegar.test",
                code=503,
                msg="service unavailable",
                hdrs=None,
                fp=io.BytesIO(error_body),
            )

        provider = self.make_provider(opener=opener)
        with self.assertRaises(TransientNotificationProviderError):
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="ignored",
                idempotency_key="kavenegar-http-503",
            )

    def test_http_409_and_451_are_transient_with_invalid_body(self):
        for http_status in (409, 451):
            with self.subTest(status=http_status):
                def opener(*args, **kwargs):
                    raise HTTPError(
                        url="https://api.kavenegar.test",
                        code=http_status,
                        msg="temporary failure",
                        hdrs=None,
                        fp=io.BytesIO(b"not-json"),
                    )

                provider = self.make_provider(opener=opener)
                with self.assertRaises(TransientNotificationProviderError):
                    provider.send(
                        recipient="+989120000000",
                        template_key=REPAIR_CREATED,
                        context=self.context,
                        rendered_message="ignored",
                        idempotency_key=f"kavenegar-http-{http_status}",
                    )

    def test_temporary_api_failure_is_retryable(self):
        provider = self.make_provider(
            opener=lambda *args, **kwargs: StubHttpResponse({
                "return": {"status": 409, "message": "try later"},
                "entries": None,
            }),
        )

        with self.assertRaises(TransientNotificationProviderError):
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="ignored",
                idempotency_key="kavenegar-transient",
            )

    def test_invalid_template_api_failure_is_permanent(self):
        provider = self.make_provider(
            opener=lambda *args, **kwargs: StubHttpResponse({
                "return": {"status": 424, "message": "template missing"},
                "entries": None,
            }),
        )

        with self.assertRaises(PermanentNotificationProviderError):
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="ignored",
                idempotency_key="kavenegar-permanent",
            )

    def test_network_and_malformed_response_are_retryable(self):
        malformed = StubHttpResponse({})
        malformed.body = b"not-json"
        for opener in (
            lambda *args, **kwargs: (_ for _ in ()).throw(URLError("down")),
            lambda *args, **kwargs: malformed,
        ):
            with self.subTest(opener=opener):
                provider = self.make_provider(opener=opener)
                with self.assertRaises(TransientNotificationProviderError):
                    provider.send(
                        recipient="+989120000000",
                        template_key=REPAIR_CREATED,
                        context=self.context,
                        rendered_message="ignored",
                        idempotency_key="kavenegar-transient-response",
                    )


class SmsIrProviderTests(TestCase):
    context = {
        "customer_name": "علی",
        "tracking_code": "RDTEST123456",
        "tracking_url": "https://example.test/track?code=RDTEST123456",
    }

    def test_successful_send_uses_verify_payload_and_returns_message_id(self):
        captured = {}

        def opener(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return StubHttpResponse(
                {
                    "status": 1,
                    "message": "موفق",
                    "data": {"messageId": 123456, "cost": 1200},
                }
            )

        provider = SmsIrProvider(
            api_key="secret-key",
            template_ids={REPAIR_CREATED: 98765},
            timeout=4,
            opener=opener,
        )
        result = provider.send(
            recipient="+989120000000",
            template_key=REPAIR_CREATED,
            context=self.context,
            rendered_message="متن نهایی",
            idempotency_key="smsir-success",
        )

        request = captured["request"]
        payload = json.loads(request.data.decode("utf-8"))
        headers = {key.lower(): value for key, value in request.header_items()}
        self.assertEqual(request.full_url, SmsIrProvider.endpoint)
        self.assertEqual(captured["timeout"], 4)
        self.assertEqual(headers["x-api-key"], "secret-key")
        self.assertEqual(payload["mobile"], "9120000000")
        self.assertEqual(payload["templateId"], 98765)
        self.assertEqual(
            {
                item["name"]: item["value"]
                for item in payload["parameters"]
            },
            {
                "NAME": self.context["customer_name"],
                "CODE": self.context["tracking_code"],
                "LINK": self.context["tracking_url"],
            },
        )
        self.assertEqual(result.status.value, "sent")
        self.assertEqual(result.provider_message_id, "123456")
        self.assertEqual(result.provider_template_id, "98765")

    def test_rate_limit_is_a_transient_provider_error(self):
        error_body = io.BytesIO(
            json.dumps({"status": 429, "message": "rate limited"}).encode()
        )

        def opener(request, timeout):
            raise HTTPError(
                request.full_url,
                429,
                "Too Many Requests",
                hdrs=None,
                fp=error_body,
            )

        provider = SmsIrProvider(
            api_key="secret-key",
            template_ids={REPAIR_CREATED: 98765},
            opener=opener,
        )

        with self.assertRaises(TransientNotificationProviderError):
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="متن نهایی",
                idempotency_key="smsir-rate-limit",
            )

    def test_missing_template_configuration_fails_before_network_call(self):
        provider = SmsIrProvider(
            api_key="secret-key",
            template_ids={},
            opener=lambda *args, **kwargs: self.fail("network was called"),
        )

        with self.assertRaises(NotificationConfigurationError):
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="متن نهایی",
                idempotency_key="smsir-missing-template",
            )

    def test_invalid_same_length_mobile_is_rejected_before_network(self):
        provider = SmsIrProvider(
            api_key="secret-key",
            template_ids={REPAIR_CREATED: 98765},
            opener=lambda *args, **kwargs: self.fail("network was called"),
        )

        for recipient in ("+98abcdefghij", "+980123456789"):
            with self.subTest(recipient=recipient):
                with self.assertRaises(NotificationConfigurationError):
                    provider.send(
                        recipient=recipient,
                        template_key=REPAIR_CREATED,
                        context=self.context,
                        rendered_message="متن نهایی",
                        idempotency_key="smsir-invalid-mobile",
                    )

    def test_non_json_unauthorized_response_is_permanent(self):
        def opener(request, timeout):
            raise HTTPError(
                request.full_url,
                401,
                "Unauthorized",
                hdrs=None,
                fp=io.BytesIO(b"<html>unauthorized</html>"),
            )

        provider = SmsIrProvider(
            api_key="secret-key",
            template_ids={REPAIR_CREATED: 98765},
            opener=opener,
        )

        with self.assertRaises(PermanentNotificationProviderError) as caught:
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="متن نهایی",
                idempotency_key="smsir-unauthorized",
            )
        self.assertEqual(caught.exception.response["http_status"], 401)

    def test_network_error_is_transient(self):
        def opener(request, timeout):
            raise URLError("network unavailable")

        provider = SmsIrProvider(
            api_key="secret-key",
            template_ids={REPAIR_CREATED: 98765},
            opener=opener,
        )

        with self.assertRaises(TransientNotificationProviderError):
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="متن نهایی",
                idempotency_key="smsir-network-error",
            )

    def test_api_failure_is_permanent(self):
        provider = SmsIrProvider(
            api_key="secret-key",
            template_ids={REPAIR_CREATED: 98765},
            opener=lambda request, timeout: StubHttpResponse(
                {"status": 12, "message": "invalid parameters"}
            ),
        )

        with self.assertRaises(PermanentNotificationProviderError):
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="متن نهایی",
                idempotency_key="smsir-api-failure",
            )

    def test_success_without_message_id_is_transient(self):
        provider = SmsIrProvider(
            api_key="secret-key",
            template_ids={REPAIR_CREATED: 98765},
            opener=lambda request, timeout: StubHttpResponse(
                {"status": 1, "data": {}}
            ),
        )

        with self.assertRaises(TransientNotificationProviderError):
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="متن نهایی",
                idempotency_key="smsir-no-message-id",
            )

    def test_malformed_success_response_is_transient(self):
        response = StubHttpResponse({})
        response.body = b"not-json"
        provider = SmsIrProvider(
            api_key="secret-key",
            template_ids={REPAIR_CREATED: 98765},
            opener=lambda request, timeout: response,
        )

        with self.assertRaises(TransientNotificationProviderError):
            provider.send(
                recipient="+989120000000",
                template_key=REPAIR_CREATED,
                context=self.context,
                rendered_message="متن نهایی",
                idempotency_key="smsir-malformed",
            )

    def test_parameter_names_and_timeout_must_be_valid(self):
        for invalid_timeout in (float("nan"), float("inf")):
            with self.subTest(timeout=invalid_timeout):
                with self.assertRaises(NotificationConfigurationError):
                    SmsIrProvider(api_key="secret", timeout=invalid_timeout)

        for invalid_names in (
            {
                "customer_name": "NAME",
                "tracking_code": " ",
                "tracking_url": "LINK",
            },
            {
                "customer_name": "VALUE",
                "tracking_code": "VALUE",
                "tracking_url": "LINK",
            },
        ):
            with self.subTest(parameter_names=invalid_names):
                provider = SmsIrProvider(
                    api_key="secret-key",
                    template_ids={REPAIR_CREATED: 98765},
                    parameter_names=invalid_names,
                    opener=lambda *args, **kwargs: self.fail(
                        "network was called"
                    ),
                )
                with self.assertRaises(NotificationConfigurationError):
                    provider.send(
                        recipient="+989120000000",
                        template_key=REPAIR_CREATED,
                        context=self.context,
                        rendered_message="متن نهایی",
                        idempotency_key="smsir-invalid-settings",
                    )


class NotificationConfigurationCheckTests(TestCase):
    @staticmethod
    def notification_check_ids():
        return {
            error.id
            for error in run_checks()
            if error.id.startswith("notifications.")
        }

    def test_default_fake_configuration_is_valid(self):
        self.assertEqual(self.notification_check_ids(), set())

    def test_numeric_configuration_errors_are_reported_by_system_checks(self):
        with self.settings(
            NOTIFICATION_PROCESSING_TIMEOUT_SECONDS="invalid",
            NOTIFICATION_MAX_ATTEMPTS="invalid",
        ):
            check_ids = self.notification_check_ids()

        self.assertIn("notifications.E003", check_ids)
        self.assertIn("notifications.E004", check_ids)

    def test_processing_timeout_overflow_is_reported_by_system_check(self):
        with self.settings(
            NOTIFICATION_PROCESSING_TIMEOUT_SECONDS=str(10**100),
        ):
            check_ids = self.notification_check_ids()

        self.assertIn("notifications.E003", check_ids)

    def test_provider_name_is_canonicalized_for_checks_and_runtime(self):
        with self.settings(NOTIFICATION_PROVIDER="  FaKe  "):
            check_ids = self.notification_check_ids()
            provider_name = get_notification_provider_name()

        self.assertEqual(check_ids, set())
        self.assertEqual(provider_name, Notification.Provider.FAKE)

    def test_real_provider_requires_public_https_url_and_credentials(self):
        with self.settings(
            NOTIFICATION_PROVIDER=Notification.Provider.SMS_IR,
            PUBLIC_TRACKING_BASE_URL="http://localhost:5173/track",
            SMSIR_API_KEY="",
            SMSIR_TEMPLATE_IDS={},
        ):
            check_ids = self.notification_check_ids()

        self.assertIn("notifications.E005", check_ids)
        self.assertIn("notifications.E006", check_ids)

    def test_complete_smsir_configuration_passes_notification_checks(self):
        with self.settings(
            NOTIFICATION_PROVIDER=Notification.Provider.SMS_IR,
            PUBLIC_TRACKING_BASE_URL="https://repairs.example.com/track",
            SMSIR_API_KEY="secret-for-test",
            SMSIR_TEMPLATE_IDS={key: index + 1 for index, key in enumerate((
                REPAIR_CREATED,
                REPAIR_WAITING_FOR_PARTS,
                REPAIR_READY,
                REPAIR_CANCELLED,
            ))},
        ):
            check_ids = self.notification_check_ids()

        self.assertEqual(check_ids, set())

    def test_complete_kavenegar_configuration_passes_checks(self):
        templates = {
            key: f"Template{index}"
            for index, key in enumerate((
                REPAIR_CREATED,
                REPAIR_WAITING_FOR_PARTS,
                REPAIR_READY,
                REPAIR_CANCELLED,
            ), start=1)
        }
        with self.settings(
            NOTIFICATION_PROVIDER=Notification.Provider.KAVENEGAR,
            PUBLIC_TRACKING_BASE_URL="https://repairs.example.com/track",
            KAVENEGAR_API_KEY="secret-for-test",
            KAVENEGAR_TEMPLATES=templates,
            KAVENEGAR_TOKEN_MAPPINGS={
                "tracking_code": "token",
                "customer_name": "token10",
            },
        ):
            check_ids = self.notification_check_ids()

        self.assertEqual(check_ids, set())

    def test_invalid_kavenegar_mapping_type_is_reported_not_crashed(self):
        templates = {
            key: f"Template{index}"
            for index, key in enumerate((
                REPAIR_CREATED,
                REPAIR_WAITING_FOR_PARTS,
                REPAIR_READY,
                REPAIR_CANCELLED,
            ), start=1)
        }
        with self.settings(
            NOTIFICATION_PROVIDER=Notification.Provider.KAVENEGAR,
            PUBLIC_TRACKING_BASE_URL="https://repairs.example.com/track",
            KAVENEGAR_API_KEY="secret-for-test",
            KAVENEGAR_TEMPLATES=templates,
            KAVENEGAR_TOKEN_MAPPINGS={"tracking_code": []},
        ):
            check_ids = self.notification_check_ids()

        self.assertIn("notifications.E006", check_ids)

    def test_tracking_url_must_be_absolute_and_without_query(self):
        for invalid_url in ("track", "https://example.com/track?code=old"):
            with self.subTest(url=invalid_url):
                with self.settings(PUBLIC_TRACKING_BASE_URL=invalid_url):
                    check_ids = self.notification_check_ids()
                self.assertIn("notifications.E005", check_ids)
