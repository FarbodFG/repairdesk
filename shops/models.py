from django.db import models
from django.utils.translation import gettext_lazy as _


class RepairShop(models.Model):
    title = models.CharField(_('title'), max_length=90)
    description = models.TextField(_('description'), blank=True)
    is_active = models.BooleanField(_('is active'), default=True)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    
    class Meta:
        db_table = 'repair_shops'
        verbose_name = _('repair shop')
        verbose_name_plural = _('repair shops')


    def __str__(self):
        return self.title