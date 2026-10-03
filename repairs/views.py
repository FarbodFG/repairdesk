from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status

from rest_framework_simplejwt.authentication import JWTAuthentication

from utils.permissions import IsManagerOrReceptionist, CanUpdateRepairOrder
from accounts.models import User
from notifications.services import (
    create_repair_notification,
    schedule_notification_dispatch,
)
from notifications.templates import (
    REPAIR_CANCELLED,
    REPAIR_READY,
    REPAIR_WAITING_FOR_PARTS,
)

from .serializer import (
    RepairOrderSerializer,
    RepairOrderUpdateSerializer,
    RepairStatusHistorySerializer,
    PublicRepairTrackingSerializer,
)
from .models import RepairOrder, RepairStatusHistory
from .pagination import RepairOrderPagination


class RepairOrderListCreateView(APIView):
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method in ['POST']:
            permission_classes = [IsAuthenticated, IsManagerOrReceptionist]
        else:
            permission_classes = [AllowAny]

        return [permission() for permission in permission_classes]

    def get(self, request):
        if request.user.is_authenticated:
            user = request.user

            repair_orders = (
                RepairOrder.objects
                .filter(repair_shop=user.repair_shop)
                .select_related(
                    'repair_shop',
                    'customer',
                    'device',
                    'assigned_technician',
                )
            )

            if user.role == User.TECHNICIAN_ROLE:
                repair_orders = repair_orders.filter(
                    assigned_technician=user,
                )

            elif user.role not in {
                User.MANAGER_ROLE,
                User.RECEPTIONIST_ROLE,
            }:
                return Response(
                    {
                        'detail': (
                            'شما اجازه مشاهده سفارش‌های تعمیر را ندارید.'
                        ),
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            search = request.query_params.get('search', '').strip()

            if search:
                repair_orders = repair_orders.filter(
                    Q(tracking_code__icontains=search)
                    | Q(customer__name__icontains=search)
                    | Q(customer__phone_number__icontains=search)
                    | Q(customer__available_phone_number__icontains=search)
                )

            repair_status = request.query_params.get('status')

            if repair_status:
                try:
                    repair_status = int(repair_status)
                except ValueError:
                    return Response(
                        {'detail': 'وضعیت سفارش نامعتبر است.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                valid_statuses = {
                    choice[0]
                    for choice in RepairOrder.REPAIR_STATUS_CHOICES
                }

                if repair_status not in valid_statuses:
                    return Response(
                        {'detail': 'وضعیت سفارش نامعتبر است.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                repair_orders = repair_orders.filter(
                    repair_status=repair_status,
                )

            technician_id = request.query_params.get('technician_id')

            if (
                technician_id
                and user.role in {
                    User.MANAGER_ROLE,
                    User.RECEPTIONIST_ROLE,
                }
            ):

                try:
                    technician_id = int(technician_id)
                except ValueError:
                    return Response(
                        {'detail': 'شناسه تعمیرکار نامعتبر است.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                repair_orders = repair_orders.filter(
                    assigned_technician_id=technician_id,
                )

            repair_orders = repair_orders.order_by('-created_at')

            paginator = RepairOrderPagination()

            page = paginator.paginate_queryset(
                repair_orders,
                request,
                view=self,
            )

            serializer = RepairOrderSerializer(
                page,
                context={'request': request},
                many=True,
            )

            return paginator.get_paginated_response(serializer.data)

        tracking_code = request.query_params.get('tracking_code')

        if not tracking_code:
            return Response(
                {'detail': 'کد پیگیری الزامی است.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        repair_order = get_object_or_404(
            RepairOrder.objects.select_related(
                'repair_shop',
                'customer',
                'device',
            ),
            tracking_code=tracking_code,
        )

        serializer = PublicRepairTrackingSerializer(repair_order)

        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        serializer = RepairOrderSerializer(
            data=data, context={"request": request},)

        serializer.is_valid(raise_exception=True)

        serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RepairOrderDetailView(APIView):
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method in {'PATCH', 'GET'}:
            permission_classes = [IsAuthenticated, CanUpdateRepairOrder]
        elif self.request.method == 'DELETE':
            permission_classes = [IsAuthenticated, IsManagerOrReceptionist]
        else:
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

    def get(self, request, repair_order_id):
        repair_order = get_object_or_404(
            RepairOrder,
            id=repair_order_id,
            repair_shop_id=request.user.repair_shop_id,
        )

        self.check_object_permissions(request, repair_order)

        serializer = RepairOrderSerializer(
            repair_order, context={"request": request})

        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, repair_order_id):
        data = request.data

        with transaction.atomic():
            repair_order = get_object_or_404(
                RepairOrder.objects.select_for_update(),
                id=repair_order_id,
                repair_shop_id=request.user.repair_shop_id,
            )

            self.check_object_permissions(request, repair_order)

            update_serializer = RepairOrderUpdateSerializer(
                repair_order,
                data=data,
                partial=True,
                context={"request": request},
            )

            update_serializer.is_valid(raise_exception=True)

            if "repair_status" in update_serializer.validated_data:
                new_status = update_serializer.validated_data.pop("repair_status")
                try:
                    status_history = repair_order.change_status(
                        new_status=new_status,
                        modified_by=request.user,
                    )
                except ValueError as error:
                    return Response(
                        {"detail": str(error)},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                notification_event = {
                    RepairOrder.WAITING_FOR_PARTS: REPAIR_WAITING_FOR_PARTS,
                    RepairOrder.READY_FOR_DELIVERY: REPAIR_READY,
                    RepairOrder.CANCELLED: REPAIR_CANCELLED,
                }.get(new_status)

                if notification_event:
                    notification, _ = create_repair_notification(
                        repair_order=repair_order,
                        event_type=notification_event,
                        template_key=notification_event,
                        idempotency_key=(
                            f"repair-status-history:{status_history.pk}"
                        ),
                    )
                    schedule_notification_dispatch(notification)

            update_serializer.save()

        serializer = RepairOrderSerializer(
            repair_order, context={"request": request},)

        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, repair_order_id):
        repair_order = get_object_or_404(
            RepairOrder,
            id=repair_order_id,
            repair_shop_id=request.user.repair_shop_id,
        )

        has_history = RepairStatusHistory.objects.filter(
            repair_order=repair_order,
        ).exists()

        if has_history:
            return Response(
                {
                    'detail': (
                        'این سفارش وارد فرایند تعمیر شده و قابل حذف نیست؛ '
                        'در صورت نیاز آن را لغو کنید.'
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        repair_order.delete()

        return Response({'detail': 'سفارش تعمیر حذف شد!'}, status=status.HTTP_200_OK)


class RepairOrderHistoryView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanUpdateRepairOrder]

    def get(self, request, repair_order_id):
        repair_order = get_object_or_404(
            RepairOrder,
            id=repair_order_id,
            repair_shop_id=request.user.repair_shop_id,
        )

        self.check_object_permissions(request, repair_order)

        histories = (
            RepairStatusHistory.objects
            .filter(repair_order=repair_order)
            .select_related('modifier')
            .order_by('-modified_at')
        )

        serializer = RepairStatusHistorySerializer(
            histories,
            many=True,
        )

        return Response(serializer.data, status=status.HTTP_200_OK)
