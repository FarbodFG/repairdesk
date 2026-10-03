from django.db import models
from django.utils.translation import gettext_lazy as _


class Brand(models.Model):
    name = models.CharField(max_length=50, unique=True)
    
    
    class Meta:
        db_table = 'device_brand'
        verbose_name = _('device brand')
        verbose_name_plural = _('device brands')

    def __str__(self):
        return f'{self.name}'



class DeviceModel(models.Model):
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name='device_models')
    name = models.CharField(max_length=120)
    search_aliases = models.TextField(blank=True, default="", verbose_name=_("search aliases"))
    is_active = models.BooleanField(default=True, verbose_name=_("active"))
    
    
    class Meta:
        db_table = 'device_model'
        verbose_name = _('device model')
        verbose_name_plural = _('device models')

    def __str__(self):
        return f'{self.name}'
    