from datetime import datetime, timedelta, timezone as datetime_timezone
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from customers.models import Customer, Device
from repairs.models import RepairOrder
from shops.models import RepairShop


class WorkspaceBoundaryTests(TestCase):
    def setUp(self):
        self.shop = RepairShop.objects.create(title="Test workshop")
        self.other_shop = RepairShop.objects.create(title="Other workshop")
        self.manager = User.objects.create_user(username="manager", role=User.MANAGER_ROLE, repair_shop=self.shop)
        self.technician = User.objects.create_user(username="technician", role=User.TECHNICIAN_ROLE, repair_shop=self.shop)
        self.reception = User.objects.create_user(username="reception", role=User.RECEPTIONIST_ROLE, repair_shop=self.shop)
        self.order = self.create_order(self.shop)
        self.other_order = self.create_order(self.other_shop)
        self.client = APIClient()

    def create_order(self, shop, **fields):
        customer = Customer.objects.create(name="Fixture customer", phone_number="09120000001", repair_shop=shop)
        device = Device.objects.create(customer=customer, custom_model_name="Fixture phone")
        return RepairOrder.objects.create(customer=customer, device=device, repair_shop=shop, **fields)

    def test_inactive_shop_blocks_staff_api_even_with_staff_session(self):
        self.shop.is_active = False
        self.shop.save(update_fields=["is_active"])
        self.manager.refresh_from_db()
        self.client.force_authenticate(self.manager)
        for name, args in (
            ("accounts-list-create", []), ("customers-list-create", []),
            ("dashboard-summary", []), ("notification-list", []),
            ("device-models-list", []), ("repair-orders-list-create", []),
            ("repair-order-detail", [self.order.pk]), ("repair-order-history", [self.order.pk]),
            ("unassigned-repairs", []),
        ):
            with self.subTest(endpoint=name):
                self.assertEqual(self.client.get(reverse(name, args=args)).status_code, 403)
        response = self.client.patch(
            reverse("repair-order-detail", args=[self.order.pk]),
            {"repair_status": RepairOrder.INSPECTING}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.post(reverse("claim-repair", args=[self.order.pk])).status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.repair_status, RepairOrder.INITIAL)

    def test_unassigned_manager_cannot_list_unassigned_accounts(self):
        self.manager.repair_shop = None
        self.manager.save(update_fields=["repair_shop"])
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.get(reverse("accounts-list-create")).status_code, 403)

    def test_workshop_manager_cannot_edit_platform_admin_account(self):
        for permissions in ({"is_staff": True}, {"is_superuser": True}):
            admin = User.objects.create_user(
                username="platform" + next(iter(permissions)), repair_shop=self.shop,
                role=User.MANAGER_ROLE, password="test-platform-password", **permissions,
            )
            self.client.force_authenticate(self.manager)
            response = self.client.patch(reverse("accounts-detail", args=[admin.pk]), {
                "new_password": "another-test-password", "is_active": False,
            }, format="json")
            self.assertEqual(response.status_code, 404)
            admin.refresh_from_db()
            self.assertTrue(admin.is_active)
            self.assertTrue(admin.check_password("test-platform-password"))
        response = self.client.patch(reverse("accounts-detail", args=[self.technician.pk]), {
            "first_name": "Updated", "is_staff": True, "is_superuser": True,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.technician.refresh_from_db()
        self.assertEqual(self.technician.first_name, "Updated")
        self.assertFalse(self.technician.is_staff or self.technician.is_superuser)

    def test_cross_shop_and_unassigned_order_are_inaccessible(self):
        def url(order):
            return reverse("repair-order-detail", args=[order.pk])

        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.get(url(self.other_order)).status_code, 404)
        self.client.force_authenticate(self.technician)
        self.assertEqual(self.client.get(url(self.order)).status_code, 403)
        self.assertEqual(self.client.head(url(self.order)).status_code, 403)
        self.assertEqual(self.client.get(reverse("notification-list")).status_code, 403)
        self.client.force_authenticate(self.reception)
        response = self.client.patch(reverse("accounts-detail", args=[self.technician.pk]), {
            "role": User.MANAGER_ROLE,
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_public_tracking_does_not_expose_customer_or_staff(self):
        response = self.client.get(reverse("repair-orders-list-create"), {"tracking_code": self.order.tracking_code})
        self.assertEqual(response.status_code, 200)
        private_fields = {"customer", "device", "assigned_technician", "issue_description"}
        self.assertTrue(private_fields.isdisjoint(response.data))

    def test_public_tracking_answers_are_not_cached_and_validate_input(self):
        url = reverse("repair-orders-list-create")
        for code, expected in (
            (f" {self.order.tracking_code.lower()} ", 200),
            ("RDNOTFOUND1234", 404),
            ("INVALID-CODE", 400),
            ("R" * 60, 400),
        ):
            with self.subTest(expected=expected):
                response = self.client.get(url, {"tracking_code": code})
                self.assertEqual(response.status_code, expected)
                self.assertIn("no-store", response.headers["Cache-Control"])
                self.assertIn("private", response.headers["Cache-Control"])

    def test_manager_and_reception_can_assign_orders_to_themselves(self):
        for staff in (self.manager, self.reception):
            with self.subTest(role=staff.role):
                self.client.force_authenticate(staff)
                created = self.client.post(reverse("repair-orders-list-create"), {
                    "customer_id": self.order.customer_id, "device_id": self.order.device_id,
                    "assigned_technician_id": staff.pk,
                }, format="json")
                self.assertEqual(created.status_code, 201, created.data)
                self.assertEqual(created.data["assigned_technician"]["id"], staff.pk)

                updated = self.client.patch(reverse("repair-order-detail", args=[self.order.pk]), {
                    "assigned_technician_id": staff.pk,
                }, format="json")
                self.assertEqual(updated.status_code, 200, updated.data)
                self.assertEqual(updated.data["assigned_technician"]["id"], staff.pk)

    def test_assignee_must_be_active_staff_of_the_same_shop(self):
        other = User.objects.create_user(username="other-shop", role=User.MANAGER_ROLE, repair_shop=self.other_shop)
        inactive = User.objects.create_user(username="disabled", role=User.TECHNICIAN_ROLE, repair_shop=self.shop, is_active=False)
        no_role = User.objects.create_user(username="no-role", repair_shop=self.shop)
        self.client.force_authenticate(self.manager)
        for staff in (other, inactive, no_role):
            with self.subTest(staff=staff.username):
                create = self.client.post(reverse("repair-orders-list-create"), {
                    "customer_id": self.order.customer_id, "device_id": self.order.device_id,
                    "assigned_technician_id": staff.pk,
                }, format="json")
                update = self.client.patch(reverse("repair-order-detail", args=[self.order.pk]), {
                    "assigned_technician_id": staff.pk,
                }, format="json")
                self.assertEqual(create.status_code, 400)
                self.assertEqual(update.status_code, 400)

    def test_unassigned_queue_shares_only_active_local_order_summaries(self):
        closed = self.create_order(self.shop, repair_status=RepairOrder.DELIVERED)
        self.create_order(self.shop, repair_status=RepairOrder.CANCELLED)
        self.create_order(self.shop, assigned_technician=self.reception)
        self.client.force_authenticate(self.technician)
        response = self.client.get(reverse("unassigned-repairs"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        (summary,) = response.data["results"]
        self.assertEqual(summary["id"], self.order.pk)
        self.assertEqual(set(summary), {"id", "device_name", "repair_status", "created_at"})
        self.assertEqual(self.client.post(reverse("claim-repair", args=[closed.pk])).status_code, 409)
        self.assertEqual(self.client.post(reverse("claim-repair", args=[self.other_order.pk])).status_code, 404)

    def test_claim_grants_detail_access_and_is_safe_to_repeat(self):
        self.client.force_authenticate(self.technician)
        detail_url = reverse("repair-order-detail", args=[self.order.pk])
        claim_url = reverse("claim-repair", args=[self.order.pk])
        self.assertEqual(self.client.get(detail_url).status_code, 403)
        response = self.client.post(claim_url, {"assigned_technician_id": self.manager.pk}, format="json")
        self.assertEqual(response.status_code, 204)
        self.order.refresh_from_db()
        self.assertEqual(self.order.assigned_technician_id, self.technician.pk)
        self.assertEqual(self.order.repair_status, RepairOrder.INITIAL)
        self.assertEqual(self.client.get(detail_url).status_code, 200)
        self.assertEqual(self.client.post(claim_url).status_code, 204)
        self.client.force_authenticate(self.reception)
        self.assertEqual(self.client.post(claim_url).status_code, 409)
        self.order.refresh_from_db()
        self.assertEqual(self.order.assigned_technician_id, self.technician.pk)

    def test_dashboard_scopes_match_tenant_filtered_counts(self):
        self.create_order(self.shop, repair_status=RepairOrder.DELIVERED, final_amount=1200)
        self.create_order(self.shop, repair_status=RepairOrder.CANCELLED, final_amount=1200)
        yesterday = self.create_order(self.shop, final_amount=2000)
        RepairOrder.objects.filter(pk=yesterday.pk).update(created_at=timezone.now() - timedelta(days=2))
        self.client.force_authenticate(self.manager)
        orders = self.client.get(reverse("dashboard-summary")).data["orders"]
        for scope, expected in (("active", 2), ("today", 3), ("unpaid", 2)):
            with self.subTest(scope=scope):
                response = self.client.get(reverse("repair-orders-list-create"), {"scope": scope})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["count"], expected)
                self.assertEqual(response.data["count"], orders[scope])
        self.assertEqual(self.client.get(reverse("repair-orders-list-create"), {"scope": "invalid"}).status_code, 400)

    def test_today_uses_tehran_midnight_for_orders_and_revenue(self):
        midnight = datetime(2026, 11, 22, 20, 30, tzinfo=datetime_timezone.utc)
        instants = (
            midnight - timedelta(seconds=1),
            midnight,
            midnight + timedelta(days=1, seconds=-1),
            midnight + timedelta(days=1),
        )
        for instant in instants:
            order = self.create_order(self.shop, final_amount=1000, is_paid=True)
            RepairOrder.objects.filter(pk=order.pk).update(created_at=instant, paid_at=instant)
        RepairOrder.objects.filter(pk=self.order.pk).update(created_at=instants[0])

        self.client.force_authenticate(self.manager)
        with timezone.override("Asia/Tehran"), patch("repairs.scopes.timezone.now", return_value=midnight):
            summary = self.client.get(reverse("dashboard-summary"))
            today = self.client.get(reverse("repair-orders-list-create"), {"scope": "today"})

        self.assertEqual(summary.status_code, 200)
        self.assertEqual(today.status_code, 200)
        self.assertEqual(summary.data["orders"]["today"], 2)
        self.assertEqual(today.data["count"], 2)
        self.assertEqual(summary.data["revenue"]["today_paid_amount"], 2000)

    def test_order_api_enforces_payment_amount_and_initial_status(self):
        self.client.force_authenticate(self.manager)
        detail = reverse("repair-order-detail", args=[self.order.pk])
        create = reverse("repair-orders-list-create")
        data = {"customer_id": self.order.customer_id, "device_id": self.order.device_id, "is_paid": True}
        rejected = self.client.post(create, data, format="json")
        self.assertEqual(rejected.status_code, 400)
        self.assertIn("final_amount", rejected.data)

        accepted = self.client.post(create, {
            **data, "final_amount": 0, "repair_status": RepairOrder.READY_FOR_DELIVERY,
        }, format="json")
        self.assertEqual(accepted.status_code, 201)
        self.assertEqual(accepted.data["final_amount"], 0)
        self.assertEqual(accepted.data["repair_status"], RepairOrder.INITIAL)

        self.assertEqual(self.client.patch(detail, {"is_paid": True}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(detail, {"is_paid": True, "final_amount": 0}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(detail, {"final_amount": None}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(detail, {"is_paid": False, "final_amount": None}, format="json").status_code, 200)
