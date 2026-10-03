from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAmin
from django.utils.translation import gettext_lazy as _

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAmin):
    fieldsets = BaseUserAmin.fieldsets + (
        (
            _('RepairDesk information'),
            {
                'fields': (
                    'repair_shop',
                    'role',
                )
            },
        ),
    )

    add_fieldsets = BaseUserAmin.add_fieldsets + (
        (
            _('Personal info'),
            {
                'fields': (
                    'first_name',
                    'last_name',
                )
            },
        ),
        (
            _('RepairDesk information'),
            {
                'fields': (
                    'repair_shop',
                    'role',
                )
            },
        ),
    )

    list_display = (
        'id',
        'username',
        'first_name',
        'last_name',
        'role',
        'repair_shop',
        'is_active',
        'is_staff',
        'date_joined',
    )

    list_filter = (
        'role',
        'repair_shop',
        'is_active',
        'is_staff',
        'is_superuser',
    )

    search_fields = (
        'username',
        'first_name',
        'last_name',
        'email',
    )

    ordering = ('username',)
    list_select_related = ('repair_shop',)
    autocomplete_fields = ('repair_shop',)