from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from .models import RepairShop

@admin.register(RepairShop)
class ShopAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'is_active',
        'created_at',
    )
    
    list_filter = ('is_active',)
    search_fields = ('title',)
    ordering = ('title',)