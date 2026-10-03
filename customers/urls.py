from django.urls import path

from .views import CustomerListCreateView, DeviceListCreateView, CustomerRepairHistoryView

urlpatterns = [
    path('', CustomerListCreateView.as_view(), name='customers-list-create'),
    path('<int:customer_id>/devices/', DeviceListCreateView.as_view(), name='devices-list-create'),
    path('<int:customer_id>/repairs/', CustomerRepairHistoryView.as_view(), name='customer-repair-histor')
]
