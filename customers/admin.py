from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from .models import Customer, Device


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'name',
        'phone_number',
        'available_phone_number',
        'repair_shop',
        'created_at',
    )

    list_filter = (
        'repair_shop',
        'created_at',
    )

    search_fields = (
        'name',
        'phone_number',
        'available_phone_number',
    )


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'customer',
        'device_model',
        'custom_model_name',
        'created_at',
    )

    list_filter = (
        'device_model',
        'custom_model_name',
        'created_at',
    )

    search_fields = (
        'customer__name',
        'customer__phone_number',
        'custom_model_name',
        'device_model__name',
        # 'device_model__brand__name',
    )
