from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from .models import Brand, DeviceModel


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('id', 'name',)
    search_fields = ('name',)


@admin.register(DeviceModel)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('id', 'brand', 'name', 'search_aliases', 'is_active',)
    list_filter = ('brand__name',) 
    search_fields = ('brand__name', 'name', 'search_aliases',)