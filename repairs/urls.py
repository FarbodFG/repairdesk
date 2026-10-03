from django.urls import path

from .views import (
    RepairOrderListCreateView,
    RepairOrderDetailView,
    RepairOrderHistoryView,
)


urlpatterns = [
    path(
        '',
        RepairOrderListCreateView.as_view(),
        name='repair-orders-list-create',
    ),
    path(
        '<int:repair_order_id>/history/',
        RepairOrderHistoryView.as_view(),
        name='repair-order-history',
    ),
    path(
        '<int:repair_order_id>/',
        RepairOrderDetailView.as_view(),
        name='repair-order-detail',
    ),
]
