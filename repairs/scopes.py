from datetime import datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone

from .models import RepairOrder


ACTIVE_REPAIRS = ~Q(repair_status__in=[RepairOrder.DELIVERED, RepairOrder.CANCELLED])
UNASSIGNED_ACTIVE_REPAIRS = ACTIVE_REPAIRS & Q(assigned_technician__isnull=True)


def local_day_bounds():
    today = timezone.localdate()
    zone = timezone.get_current_timezone()
    return (
        datetime.combine(today, time.min, tzinfo=zone),
        datetime.combine(today + timedelta(days=1), time.min, tzinfo=zone),
    )


def repair_scopes(day_bounds=None):
    start, end = day_bounds or local_day_bounds()
    return {
        'active': ACTIVE_REPAIRS,
        'unpaid': Q(is_paid=False, final_amount__isnull=False)
        & ~Q(repair_status=RepairOrder.CANCELLED),
        'today': Q(created_at__gte=start, created_at__lt=end),
    }
