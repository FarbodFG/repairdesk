from django.urls import path

from .views import (
    ClaimRepairView,
    RepairOrderListCreateView,
    RepairOrderDetailView,
    RepairOrderHistoryView,
    UnassignedRepairListView,
)


urlpatterns = [
    path(
        '',
        RepairOrderListCreateView.as_view(),
        name='repair-orders-list-create',
    ),
    path(
        'unassigned/',
        UnassignedRepairListView.as_view(),
        name='unassigned-repairs',
    ),
    path(
        '<int:repair_order_id>/claim/',
        ClaimRepairView.as_view(),
        name='claim-repair',
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
