from django.shortcuts import get_object_or_404
from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from rest_framework_simplejwt.authentication import JWTAuthentication

from repairs.models import RepairOrder
from repairs.pagination import RepairOrderPagination
from repairs.serializer import CustomerRepairHistorySerializer
from utils.permissions import IsManagerOrReceptionist

from .serializer import CustomerSerializer, DeviceSerializer
from .models import Customer, Device


class CustomerListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManagerOrReceptionist]

    def get(self, request):
        search = request.query_params.get('search', '')

        if search:
            print("ok")
            customers = Customer.objects.filter(
                Q(name__icontains=search) |
                Q(phone_number__icontains=search),
                repair_shop_id=request.user.repair_shop_id
            ).select_related('repair_shop')
        else:
            customers = Customer.objects.filter(
                repair_shop_id=request.user.repair_shop_id).order_by('-created_at').select_related('repair_shop')

        serializer = CustomerSerializer(customers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        serializer = CustomerSerializer(data=data)

        serializer.is_valid(raise_exception=True)

        serializer.save(repair_shop=request.user.repair_shop)

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DeviceListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManagerOrReceptionist]

    def get_customer(self, request, customer_id):
        return get_object_or_404(
            Customer,
            id=customer_id,
            repair_shop_id=request.user.repair_shop_id,
        )

    def get(self, request, customer_id):
        customer = self.get_customer(
            request,
            customer_id
        )

        device = Device.objects.filter(customer=customer).select_related(
            'customer', 'device_model', 'device_model__brand')

        serializer = DeviceSerializer(device, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, customer_id):
        customer = self.get_customer(
            request,
            customer_id
        )

        data = request.data
        serializer = DeviceSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        serializer.save(customer=customer)

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CustomerRepairHistoryView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [
        IsAuthenticated,
        IsManagerOrReceptionist,
    ]

    def get(self, request, customer_id):
        customer = get_object_or_404(
            Customer,
            id=customer_id,
            repair_shop_id=request.user.repair_shop_id,
        )

        repair_orders = (
            RepairOrder.objects.filter(customer=customer).select_related(
                'device',
                'device__device_model',
                'device__device_model__brand',
                'assigned_technician',
            )
            .order_by('-created_at')
        )

        paginator = RepairOrderPagination()

        page = paginator.paginate_queryset(
            repair_orders,
            request,
            view=self,
        )

        serializer = CustomerRepairHistorySerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(serializer.data)
