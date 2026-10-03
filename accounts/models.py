from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

# from shops.models import RepairShop


class User(AbstractUser):
    MANAGER_ROLE = 1
    RECEPTIONIST_ROLE = 2
    TECHNICIAN_ROLE = 3
    ROLES = (
        (MANAGER_ROLE, 'manager'),
        (RECEPTIONIST_ROLE, 'receptionist'),
        (TECHNICIAN_ROLE, 'technician')
    )

    repair_shop = models.ForeignKey('shops.RepairShop', verbose_name=_(
        'repair shop'), on_delete=models.PROTECT, related_name='staff_members', null=True, blank=True)
    role = models.PositiveSmallIntegerField(
        _('role'), choices=ROLES, null=True, blank=True)

    def __str__(self):
        return self.get_full_name() or self.username
