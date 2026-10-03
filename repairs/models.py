from django.db import models
from django.utils.translation import gettext_lazy as _

import secrets


TRACKING_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_tracking_code():
    random_part = ''.join(
        secrets.choice(TRACKING_CHARACTERS)
        for _ in range(12)
    )

    return f'RD{random_part}'


class RepairOrder(models.Model):
    INITIAL = 1
    INSPECTING = 2
    WAITING_FOR_PARTS = 3
    REPAIRING = 4
    READY_FOR_DELIVERY = 5
    DELIVERED = 6
    CANCELLED = 7
    REPAIR_STATUS_CHOICES = (
        (INITIAL, _('initial')),
        (INSPECTING, _('inspecting')),
        (WAITING_FOR_PARTS, _('waiting for parts')),
        (REPAIRING, _('repairing')),
        (READY_FOR_DELIVERY, _('ready for delivery')),
        (DELIVERED, _('delivered')),
        (CANCELLED, _('cancelled'))
    )

    ALLOWED_TRANSITIONS = {
        INITIAL: {INSPECTING, CANCELLED},
        INSPECTING: {WAITING_FOR_PARTS, REPAIRING, CANCELLED},
        WAITING_FOR_PARTS: {REPAIRING, CANCELLED},
        REPAIRING: {WAITING_FOR_PARTS, READY_FOR_DELIVERY, CANCELLED},
        READY_FOR_DELIVERY: {DELIVERED, CANCELLED},
        DELIVERED: set(),
        CANCELLED: set(),
    }

    def can_change_status_to(self, new_status):
        return new_status in self.ALLOWED_TRANSITIONS.get(
            self.repair_status,
            set(),
        )

    def change_status(self, new_status, modified_by):
        if not self.can_change_status_to(new_status):
            raise ValueError("تغییر وضعیت مجاز نیست.")

        old_status = self.repair_status
        self.repair_status = new_status
        self.save(update_fields=["repair_status", "updated_at"])

        return RepairStatusHistory.objects.create(
            repair_order=self,
            repair_previous_status=old_status,
            repair_new_status=new_status,
            modifier=modified_by,
        )

    repair_shop = models.ForeignKey(
        'shops.RepairShop', verbose_name=_('repair shop'), on_delete=models.PROTECT, related_name='repair_orders')
    customer = models.ForeignKey(
        'customers.Customer', verbose_name=_('customer'), on_delete=models.PROTECT, related_name='repair_orders')
    device = models.ForeignKey(
        'customers.Device', verbose_name=_('device'), on_delete=models.PROTECT, related_name='repair_orders')
    assigned_technician = models.ForeignKey(
        'accounts.User', verbose_name=_('assigned technician'), on_delete=models.PROTECT, related_name='assigned_repair_orders', null=True, blank=True)
    tracking_code = models.CharField(
        _('tracking code'), max_length=14, unique=True, editable=False, default=generate_tracking_code)
    repair_status = models.PositiveSmallIntegerField(
        _('repair status'), choices=REPAIR_STATUS_CHOICES, default=INITIAL)
    issue_description = models.TextField(_('issue description'), blank=True)
    final_amount = models.PositiveBigIntegerField(
        null=True, blank=True, verbose_name="final amount")
    is_paid = models.BooleanField(default=False, verbose_name="is paid",)
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان پرداخت",)
    received_at  = models.DateTimeField(_('received at'), null=True, blank=True)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)

    class Meta:
        db_table = 'repair_orders'
        verbose_name = _('repair order')
        verbose_name_plural = _('repair orders')

    def __str__(self):
        return self.tracking_code


class RepairStatusHistory(models.Model):
    repair_order = models.ForeignKey(RepairOrder, verbose_name=_(
        'repair order'), on_delete=models.PROTECT)
    repair_previous_status = models.PositiveSmallIntegerField(
        _('repair previous status'), choices=RepairOrder.REPAIR_STATUS_CHOICES)
    repair_new_status = models.PositiveSmallIntegerField(
        _('repair previous status'), choices=RepairOrder.REPAIR_STATUS_CHOICES)
    modifier = models.ForeignKey(
        'accounts.User', verbose_name=_('modifier status'), on_delete=models.PROTECT)
    modified_at = models.DateTimeField(_('modified at'), auto_now_add=True)

    class Meta:
        db_table = 'repair_status_history'
        verbose_name = _('repair status history')
        verbose_name_plural = _('repair statuses history')

    def __str__(self):
        return str(self.repair_previous_status)
