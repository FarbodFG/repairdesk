from django.db import models
from django.utils.translation import gettext_lazy as _

from utils.validators import validate_phone_number


class Customer(models.Model):
    name = models.CharField(_('name'), max_length=100)
    phone_number = models.CharField(
        _('phone number'), max_length=11, validators=[validate_phone_number])
    available_phone_number = models.CharField(
        _('available phone number'), max_length=11, blank=True, validators=[validate_phone_number])
    repair_shop = models.ForeignKey(
        'shops.RepairShop', verbose_name=_('repair shop'), on_delete=models.PROTECT, related_name='customers',)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)

    class Meta:
        db_table = 'customers'
        verbose_name = _('customer')
        verbose_name_plural = _('customers')

    def __str__(self):
        return f'{self.name} - {self.phone_number}'


class Device(models.Model):
    customer = models.ForeignKey(
        Customer, verbose_name=_('customer'), on_delete=models.CASCADE, related_name='%(class)s')
    device_model = models.ForeignKey(
        'devices.DeviceModel', on_delete=models.PROTECT, null=True, blank=True, related_name='%(class)s')
    custom_model_name = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)

    class Meta:
        db_table = 'device'
        verbose_name = _('customers device')
        verbose_name_plural = _('customers devices')

    def __str__(self):
        if self.device_model:
            return f'{self.device_model.brand.name} - {self.device_model.name}'.strip()
        
        return self.custom_model_name
