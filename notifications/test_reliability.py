import io
import socket
from datetime import timedelta
from io import StringIO
from threading import Event
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from django.core.management import call_command
from django.db import OperationalError
from django.db.models.query import QuerySet
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from repairs.models import RepairOrder
from .exceptions import NotificationConfigurationError
from .models import Notification
from .providers import ProviderSendResult, ProviderSendStatus, SmsIrProvider
from .services import (
    DispatchOutcome, create_repair_notification,
    dispatch_notification_with_outcome, get_due_notification_ids,
)
from .templates import REPAIR_CREATED, REPAIR_READY, REPAIR_WAITING_FOR_PARTS
from .tests import NotificationTestDataMixin, StubHttpResponse


@override_settings(NOTIFICATION_PROVIDER="smsir", NOTIFICATION_SEND_MODE="worker")
class NotificationReliabilityTests(NotificationTestDataMixin, TestCase):
    def setUp(self):
        self.shop, self.manager, self.customer, self.order = self.create_shop_data()

    def create_notification(self, key, event=REPAIR_CREATED):
        return create_repair_notification(
            repair_order=self.order, event_type=event, template_key=event,
            idempotency_key=key,
        )[0]

    def provider(self, opener):
        return SmsIrProvider(
            api_key="test-key", template_ids={REPAIR_CREATED: 123}, opener=opener,
        )

    def test_ambiguous_network_or_response_is_not_automatically_resent(self):
        for scenario in ("timeout", "reset", "json", "missing-status", "missing-id", "bool-status", "bool-id", "http-503"):
            with self.subTest(scenario=scenario):
                notification = self.create_notification(f"ambiguous-{scenario}")
                calls = []

                def opener(request, timeout):
                    calls.append(request)
                    if scenario == "timeout":
                        raise TimeoutError("read timed out after accepting request")
                    if scenario == "reset":
                        raise URLError(ConnectionResetError("connection reset"))
                    if scenario == "http-503":
                        raise HTTPError(request.full_url, 503, "unavailable", None, io.BytesIO(b"down"))
                    payload = {
                        "missing-status": {"data": {"messageId": 1}},
                        "missing-id": {"status": 1, "data": {}},
                        "bool-status": {"status": True, "data": {"messageId": 1}},
                        "bool-id": {"status": 1, "data": {"messageId": True}},
                    }.get(scenario, {})
                    response = StubHttpResponse(payload)
                    if scenario == "json":
                        response.body = b"incomplete json"
                    return response

                with patch("notifications.services.get_provider", return_value=self.provider(opener)):
                    dispatch_notification_with_outcome(notification.pk)
                    call_command("process_notifications", stdout=StringIO())
                notification.refresh_from_db()
                self.assertEqual(notification.status, Notification.Status.FAILED)
                self.assertEqual(notification.error_code, "delivery_unknown")
                self.assertFalse(notification.is_retryable)
                self.assertEqual(notification.attempt_count, 1)
                self.assertEqual(len(calls), 1)
                self.assertNotIn(notification.pk, get_due_notification_ids())

    def test_explicit_rate_limit_or_failed_connection_can_retry_safely(self):
        for scenario in ("rate-limit", "dns", "refused"):
            with self.subTest(scenario=scenario):
                notification = self.create_notification(f"safe-retry-{scenario}")
                calls = []

                def opener(request, timeout):
                    calls.append(request)
                    if len(calls) == 1:
                        if scenario == "rate-limit":
                            raise HTTPError(request.full_url, 429, "rate limit", None, io.BytesIO(b"busy"))
                        if scenario == "dns":
                            raise URLError(socket.gaierror("DNS unavailable"))
                        raise URLError(ConnectionRefusedError("not connected"))
                    return StubHttpResponse({"status": 1, "data": {"messageId": 123}})

                with patch("notifications.services.get_provider", return_value=self.provider(opener)):
                    dispatch_notification_with_outcome(notification.pk)
                    notification.refresh_from_db()
                    self.assertTrue(notification.is_retryable)
                    self.assertGreater(notification.scheduled_at, timezone.now())
                    result = dispatch_notification_with_outcome(notification.pk)
                    self.assertEqual(result.outcome, DispatchOutcome.SKIPPED_SCHEDULED)
                    Notification.objects.filter(pk=notification.pk).update(scheduled_at=timezone.now())
                    dispatch_notification_with_outcome(notification.pk)
                notification.refresh_from_db()
                self.assertEqual(notification.status, Notification.Status.SENT)
                self.assertEqual(notification.attempt_count, 2)
                self.assertEqual(len(calls), 2)

    @patch("notifications.services.get_provider")
    def test_expired_real_claim_requires_review_even_when_forced(self, get_provider):
        for provider in (Notification.Provider.SMS_IR, Notification.Provider.KAVENEGAR):
            for force in (False, True):
                notification = self.create_notification(f"expired-{provider}-{force}")
                Notification.objects.filter(pk=notification.pk).update(
                    provider=provider, status=Notification.Status.PROCESSING, attempt_count=1,
                    updated_at=timezone.now() - timedelta(minutes=10),
                )
                result = dispatch_notification_with_outcome(notification.pk, force=force)
                self.assertEqual(result.outcome, DispatchOutcome.SKIPPED_INELIGIBLE)
                notification.refresh_from_db()
                self.assertEqual(notification.error_code, "delivery_unknown")
                self.assertEqual(notification.attempt_count, 1)
                self.assertFalse(notification.is_retryable)
        get_provider.assert_not_called()

    def test_late_success_resolves_unknown_claim_without_second_send(self):
        notification = self.create_notification("late-success")

        def opener(request, timeout):
            Notification.objects.filter(pk=notification.pk).update(
                updated_at=timezone.now() - timedelta(minutes=10),
            )
            other_worker = dispatch_notification_with_outcome(notification.pk)
            self.assertEqual(other_worker.outcome, DispatchOutcome.SKIPPED_INELIGIBLE)
            return StubHttpResponse({"status": 1, "data": {"messageId": 123}})

        with patch("notifications.services.get_provider", return_value=self.provider(opener)) as get_provider:
            result = dispatch_notification_with_outcome(notification.pk)
        get_provider.assert_called_once()
        self.assertEqual(result.outcome, DispatchOutcome.DISPATCHED)
        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.SENT)
        self.assertEqual(notification.provider_message_id, "123")
        self.assertEqual(notification.error_code, "")
        self.assertEqual(notification.attempt_count, 1)

    def test_database_failure_after_acceptance_does_not_trigger_resend(self):
        notification = self.create_notification("persist-failed")
        real_update = QuerySet.update

        def broken_update(query, **kwargs):
            if kwargs.get("status") == Notification.Status.SENT:
                raise OperationalError("database connection lost after provider accepted SMS")
            return real_update(query, **kwargs)

        provider = self.provider(lambda *args, **kwargs: StubHttpResponse({"status": 1, "data": {"messageId": 123}}))
        with patch("notifications.services.get_provider", return_value=provider) as get_provider:
            with patch.object(QuerySet, "update", new=broken_update):
                with self.assertRaises(OperationalError):
                    dispatch_notification_with_outcome(notification.pk)
            notification.refresh_from_db()
            self.assertEqual(notification.status, Notification.Status.PROCESSING)
            Notification.objects.filter(pk=notification.pk).update(updated_at=timezone.now() - timedelta(minutes=10))
            dispatch_notification_with_outcome(notification.pk)
        get_provider.assert_called_once()
        notification.refresh_from_db()
        self.assertEqual(notification.error_code, "delivery_unknown")
        self.assertEqual(notification.attempt_count, 1)

    @patch("notifications.services.get_provider")
    def test_deleted_cancelled_and_outdated_orders_do_not_send(self, get_provider):
        for event, new_status in (
            (REPAIR_CREATED, RepairOrder.CANCELLED),
            (REPAIR_WAITING_FOR_PARTS, RepairOrder.REPAIRING),
            (REPAIR_READY, RepairOrder.DELIVERED),
        ):
            notification = self.create_notification(f"obsolete-{event}", event)
            RepairOrder.objects.filter(pk=self.order.pk).update(repair_status=new_status)
            dispatch_notification_with_outcome(notification.pk)
            notification.refresh_from_db()
            self.assertEqual(notification.status, Notification.Status.CANCELLED)
            self.assertEqual(notification.error_code, "obsolete_notification")
            self.assertEqual(notification.attempt_count, 0)
        notification = self.create_notification("deleted-order")
        self.order.delete()
        dispatch_notification_with_outcome(notification.pk)
        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.CANCELLED)
        get_provider.assert_not_called()

    def test_repeated_waiting_status_sends_only_the_latest_transition(self):
        self.order.change_status(RepairOrder.INSPECTING, self.manager)
        first_history = self.order.change_status(RepairOrder.WAITING_FOR_PARTS, self.manager)
        first = self.create_notification(f"repair-status-history:{first_history.pk}", REPAIR_WAITING_FOR_PARTS)
        self.order.change_status(RepairOrder.REPAIRING, self.manager)
        latest_history = self.order.change_status(RepairOrder.WAITING_FOR_PARTS, self.manager)
        latest = self.create_notification(f"repair-status-history:{latest_history.pk}", REPAIR_WAITING_FOR_PARTS)
        provider_result = ProviderSendResult(status=ProviderSendStatus.SENT, provider_message_id="1")
        with patch("notifications.services.get_provider") as get_provider:
            get_provider.return_value.send.return_value = provider_result
            dispatch_notification_with_outcome(first.pk)
            dispatch_notification_with_outcome(latest.pk)
        get_provider.return_value.send.assert_called_once()
        first.refresh_from_db()
        latest.refresh_from_db()
        self.assertEqual(first.status, Notification.Status.CANCELLED)
        self.assertEqual(latest.status, Notification.Status.SENT)

    @patch("notifications.services.get_provider")
    def test_stop_request_finishes_current_message_and_leaves_rest_pending(self, get_provider):
        notifications = [self.create_notification(f"stop-{i}") for i in range(3)]
        stopped = Event()

        def send(**kwargs):
            stopped.set()
            return ProviderSendResult(status=ProviderSendStatus.SENT, provider_message_id="1")

        get_provider.return_value.send.side_effect = send
        call_command("process_notifications", stop_event=stopped, stdout=StringIO())
        self.assertEqual(list(Notification.objects.order_by("pk").values_list("status", flat=True)), ["sent", "pending", "pending"])
        get_provider.return_value.send.assert_called_once()
        self.assertEqual(len(get_due_notification_ids()), len(notifications) - 1)

    @patch("notifications.services.get_provider")
    def test_unknown_delivery_retry_requires_explicit_acknowledgement(self, get_provider):
        notification = self.create_notification("manual-unknown")
        Notification.objects.filter(pk=notification.pk).update(status="failed", error_code="delivery_unknown", attempt_count=1)
        client = APIClient()
        client.force_authenticate(self.manager)
        url = reverse("notification-retry", kwargs={"notification_id": notification.pk})
        self.assertEqual(client.post(url, [], format="json").status_code, 400)
        for payload in ({}, {"confirm_unknown_delivery": "true"}):
            self.assertEqual(client.post(url, payload, format="json").status_code, 409)
        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.FAILED)
        self.assertEqual(notification.error_code, "delivery_unknown")
        response = client.post(url, {"confirm_unknown_delivery": True}, format="json")
        self.assertEqual(response.status_code, 202)
        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.PENDING)
        get_provider.assert_not_called()

    def test_incomplete_template_context_is_rejected_before_network(self):
        provider = self.provider(lambda *args, **kwargs: self.fail("network must not be called"))
        with self.assertRaises(NotificationConfigurationError):
            provider.send(recipient="+989120000000", template_key=REPAIR_CREATED, context={}, rendered_message="", idempotency_key="missing-context")
