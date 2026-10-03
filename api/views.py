from django.db.models import BigIntegerField, Count, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.authentication import JWTAuthentication

from repairs.models import RepairOrder
from utils.permissions import IsManagerOrReceptionist


class DashboardSummaryView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManagerOrReceptionist]

    def get(self, request):
        today = timezone.localdate()

        repair_orders = RepairOrder.objects.filter(
            repair_shop=request.user.repair_shop,
        )

        summary = repair_orders.aggregate(
            total_orders=Count('id'),

            active_orders=Count(
                'id',
                filter=~Q(
                    repair_status__in=[
                        RepairOrder.DELIVERED,
                        RepairOrder.CANCELLED,
                    ],
                ),
            ),

            ready_for_delivery_orders=Count(
                'id',
                filter=Q(
                    repair_status=RepairOrder.READY_FOR_DELIVERY,
                ),
            ),

            unpaid_orders=Count(
                'id',
                filter=(
                    Q(is_paid=False, final_amount__isnull=False)
                    & ~Q(repair_status=RepairOrder.CANCELLED)
                ),
            ),

            today_orders=Count(
                'id',
                filter=Q(created_at__date=today),
            ),

            total_paid_amount=Coalesce(
                Sum(
                    'final_amount',
                    filter=Q(is_paid=True),
                ),
                Value(0),
                output_field=BigIntegerField(),
            ),

            today_paid_amount=Coalesce(
                Sum(
                    'final_amount',
                    filter=Q(
                        is_paid=True,
                        paid_at__date=today,
                    ),
                ),
                Value(0),
                output_field=BigIntegerField(),
            ),
        )

        status_keys = {
            RepairOrder.INITIAL: 'initial',
            RepairOrder.INSPECTING: 'inspecting',
            RepairOrder.WAITING_FOR_PARTS: 'waiting_for_parts',
            RepairOrder.REPAIRING: 'repairing',
            RepairOrder.READY_FOR_DELIVERY: 'ready_for_delivery',
            RepairOrder.DELIVERED: 'delivered',
            RepairOrder.CANCELLED: 'cancelled',
        }

        status_counts = {
            key: 0
            for key in status_keys.values()
        }

        grouped_statuses = (
            repair_orders
            .values('repair_status')
            .annotate(count=Count('id'))
        )

        for item in grouped_statuses:
            status_key = status_keys[item['repair_status']]
            status_counts[status_key] = item['count']

        return Response(
            {
                'orders': {
                    'total': summary['total_orders'],
                    'active': summary['active_orders'],
                    'ready_for_delivery': summary[
                        'ready_for_delivery_orders'
                    ],
                    'unpaid': summary['unpaid_orders'],
                    'today': summary['today_orders'],
                },
                'revenue': {
                    'total_paid_amount': summary['total_paid_amount'],
                    'today_paid_amount': summary['today_paid_amount'],
                },
                'status_counts': status_counts,
            },
            status=status.HTTP_200_OK,
        )
