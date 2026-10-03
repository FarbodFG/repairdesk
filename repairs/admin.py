from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from .models import RepairOrder, RepairStatusHistory


@admin.register(RepairOrder)
class RepairOrderAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'customer',
        'device',
        'repair_status',
        'final_amount',
        'is_paid',
        'repair_shop',
        'assigned_technician',
        'tracking_code',
        'received_at',
    )
    
    list_filter = (
        'repair_status',
        'repair_shop',
        'assigned_technician',
        'received_at',
    )

    search_fields = (
        'tracking_code',
        'customer__name',
    )
    

@admin.register(RepairStatusHistory)
class RepairStatusHistoryAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'repair_order',
        'repair_previous_status',
        'repair_new_status',
        'modifier',
        'modified_at',
    )
    
    list_filter = (
        'repair_order',
        'modifier',
        'modified_at',
    )
    
    search_fields = (
        'repair_order__tracking_code',
        'modifier__name',
    )
    
