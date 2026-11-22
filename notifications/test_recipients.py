from unittest.mock import patch

from django.db import transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from .exceptions import TransientNotificationProviderError
from .models import Notification
from .providers import FakeSmsProvider
from .services import create_repair_notification, dispatch_notification, schedule_notification_dispatch
from .templates import REPAIR_CREATED
from .tests import NotificationTestDataMixin


@override_settings(NOTIFICATION_PROVIDER="fake", NOTIFICATION_SEND_MODE="worker")
class RecipientSelectionTests(NotificationTestDataMixin, TestCase):
    def setUp(self):
        self.shop, self.manager, self.customer, self.order = self.create_shop_data()

    def create_notification(self, key):
        return create_repair_notification(
            repair_order=self.order, event_type=REPAIR_CREATED,
            template_key=REPAIR_CREATED, idempotency_key=key,
        )[0]

    def test_secondary_primary_fallback_and_equal_numbers_send_only_once(self):
        for secondary in ("", self.customer.phone_number, "09121112233"):
            with self.subTest(secondary=secondary):
                self.customer.available_phone_number = secondary
                self.customer.save()
                notification = self.create_notification(f"recipient-{secondary}")
                expected = "+98" + (secondary or self.customer.phone_number)[1:]
                self.assertEqual(notification.recipient, expected)
                with patch("notifications.services.get_provider") as get_provider:
                    get_provider.return_value.send.side_effect = FakeSmsProvider().send
                    dispatch_notification(notification.pk)
                    dispatch_notification(notification.pk)
                get_provider.return_value.send.assert_called_once()
                self.assertEqual(get_provider.return_value.send.call_args.kwargs["recipient"], expected)

    def test_quick_order_api_accepts_secondary_blank_and_equal_numbers(self):
        client = APIClient()
        client.force_authenticate(self.manager)
        for secondary in ("", "09120000001", "09121112233"):
            with self.subTest(secondary=secondary):
                response = client.post(reverse("repair-orders-list-create"), {
                    "new_customer": {
                        "name": "مشتری تست شماره پیامک", "phone_number": "09120000001",
                        "available_phone_number": secondary,
                    },
                    "new_device": {"custom_model_name": "Test phone"},
                    "issue_description": "Phone in repair",
                }, format="json")
                self.assertEqual(response.status_code, 201, response.data)
                notification = Notification.objects.get(repair_order_id=response.data["id"])
                self.assertEqual(notification.recipient, "+98" + (secondary or "09120000001")[1:])

    def test_legacy_phone_digits_are_normalized_for_delivery(self):
        for digits in ("۰۹۱۲۱۱۱۲۲۳۳", "٠٩١٢١١١٢٢٣٣"):
            with self.subTest(digits=digits):
                self.customer.available_phone_number = digits
                self.customer.save(update_fields=["available_phone_number"])
                self.assertEqual(self.create_notification(f"digits-{digits}").recipient, "+989121112233")

    @patch("notifications.services.get_provider")
    def test_invalid_legacy_secondary_records_failed_sms_without_blocking_order(self, get_provider):
        self.customer.available_phone_number = "invalid"
        self.customer.save(update_fields=["available_phone_number"])
        client = APIClient()
        client.force_authenticate(self.manager)
        response = client.post(reverse("repair-orders-list-create"), {
            "customer_id": self.customer.pk,
            "device_id": self.order.device_id,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        notification = Notification.objects.get(repair_order_id=response.data["id"])
        dispatch_notification(notification.pk)
        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.FAILED)
        self.assertEqual(notification.attempt_count, 0)
        self.assertEqual(notification.error_code, "configuration_error")
        get_provider.assert_not_called()

    def test_previously_queued_unattempted_message_uses_current_reachable_number(self):
        notification = self.create_notification("pending-before-phone-fix")
        old_number = notification.recipient
        self.customer.available_phone_number = "09121112233"
        self.customer.save()
        with patch("notifications.services.get_provider") as get_provider:
            get_provider.return_value.send.side_effect = FakeSmsProvider().send
            dispatch_notification(notification.pk)
        notification.refresh_from_db()
        self.assertNotEqual(notification.recipient, old_number)
        self.assertEqual(notification.recipient, "+989121112233")
        self.assertEqual(get_provider.return_value.send.call_args.kwargs["recipient"], notification.recipient)

    def test_retry_keeps_first_attempt_recipient_even_if_contact_changes(self):
        notification = self.create_notification("retry-stable-recipient")
        first_recipient = notification.recipient
        with patch("notifications.services.get_provider") as get_provider:
            get_provider.return_value.send.side_effect = TransientNotificationProviderError("temporarily unavailable")
            dispatch_notification(notification.pk)
        self.customer.available_phone_number = "09121112233"
        self.customer.save()
        with patch("notifications.services.get_provider") as get_provider:
            get_provider.return_value.send.side_effect = FakeSmsProvider().send
            dispatch_notification(notification.pk, force=True)
        self.assertEqual(get_provider.return_value.send.call_args.kwargs["recipient"], first_recipient)

    @patch("notifications.services.get_provider")
    def test_invalid_updated_secondary_does_not_silently_send_to_primary(self, get_provider):
        notification = self.create_notification("invalid-updated-number")
        self.customer.available_phone_number = "invalid"
        self.customer.save()
        dispatch_notification(notification.pk)
        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Status.FAILED)
        self.assertEqual(notification.error_code, "configuration_error")
        self.assertEqual(notification.attempt_count, 0)
        get_provider.assert_not_called()

    @patch("notifications.services.notify_worker")
    def test_worker_is_woken_only_after_commit_callback(self, notify):
        with self.captureOnCommitCallbacks(execute=True):
            with transaction.atomic():
                notification = self.create_notification("wake-after-commit")
                schedule_notification_dispatch(notification)
                notify.assert_not_called()
        notify.assert_called_once()

    @patch("notifications.services.notify_worker")
    def test_rolled_back_order_does_not_wake_the_worker(self, notify):
        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(ValueError):
                with transaction.atomic():
                    notification = self.create_notification("rollback-no-wakeup")
                    schedule_notification_dispatch(notification)
                    raise ValueError("rollback")
        self.assertFalse(Notification.objects.filter(idempotency_key="rollback-no-wakeup").exists())
        notify.assert_not_called()
