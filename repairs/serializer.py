from django.db import transaction
from django.utils import timezone

from rest_framework import serializers

from customers.serializer import (
    CustomerSerializer, DeviceSerializer,
    CustomerQuickCreateSerializer, DeviceQuickCreateSerializer
)
from shops.serializer import RepairShopSerializer
from accounts.serializer import UserAccountSerializer
from customers.models import Customer, Device
from accounts.models import User
from notifications.services import (
    create_repair_notification,
    schedule_notification_dispatch,
)
from notifications.templates import REPAIR_CREATED

from .models import RepairOrder, RepairStatusHistory


class RepairOrderSerializer(serializers.ModelSerializer):
    repair_shop = RepairShopSerializer(read_only=True)
    customer = CustomerSerializer(read_only=True)
    device = DeviceSerializer(read_only=True)
    assigned_technician = UserAccountSerializer(read_only=True)

    customer_id = serializers.PrimaryKeyRelatedField(
        source='customer',
        queryset=Customer.objects.none(),
        required=False,
        write_only=True,
    )

    new_customer = CustomerQuickCreateSerializer(
        required=False,
        write_only=True,
    )

    device_id = serializers.PrimaryKeyRelatedField(
        source='device',
        queryset=Device.objects.none(),
        required=False,
        write_only=True,
    )

    new_device = DeviceQuickCreateSerializer(
        required=False,
        write_only=True,
    )

    assigned_technician_id = serializers.PrimaryKeyRelatedField(
        source='assigned_technician',
        queryset=User.objects.none(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    repair_status_display = serializers.CharField(
        source='get_repair_status_display',
        read_only=True,
    )

    def validate(self, attrs):
        customer = attrs.get('customer')
        new_customer = attrs.get('new_customer')

        device = attrs.get('device')
        new_device = attrs.get('new_device')

        if not customer and not new_customer:
            raise serializers.ValidationError(
                "مشتری را انتخاب یا ثبت کنید."
            )

        if not device and not new_device:
            raise serializers.ValidationError(
                "دستگاه را انتخاب یا ثبت کنید."
            )

        if customer and device and device.customer_id != customer.id:
            raise serializers.ValidationError(
                "این دستگاه متعلق به مشتری انتخاب‌شده نیست."
            )

        if new_customer and device:
            raise serializers.ValidationError(
                "برای مشتری جدید باید دستگاه جدید ثبت شود."
            )

        return attrs

    class Meta:
        model = RepairOrder
        fields = (
            'id',
            'repair_shop',
            'customer',
            'customer_id',
            'new_customer',
            'device',
            'device_id',
            'new_device',
            'assigned_technician',
            'assigned_technician_id',
            'tracking_code',
            'repair_status',
            'repair_status_display',
            'issue_description',
            'final_amount',
            'is_paid',
            'paid_at',
            'received_at',
            'created_at'
        )
        read_only_fields = [
            'id',
            'repair_shop',
            'repair_status_display',
            'tracking_code',
            'created_at',
            'customer',
            'device',
            'paid_at',
            'received_at',
        ]

    def __init__(self,  *args, **kwargs):
        super().__init__(*args, **kwargs)

        request = self.context['request']
        if request.method == 'POST':
            repair_shop = request.user.repair_shop

            self.fields['customer_id'].queryset = Customer.objects.filter(
                repair_shop=repair_shop)

            self.fields['device_id'].queryset = Device.objects.filter(
                customer__repair_shop=repair_shop)

            self.fields['assigned_technician_id'].queryset = User.objects.filter(
                repair_shop=repair_shop,
                role=User.TECHNICIAN_ROLE, is_active=True,)

    def create(self, validated_data):
        request = self.context["request"]
        repair_shop = request.user.repair_shop

        customer = validated_data.pop('customer', None)
        new_customer = validated_data.pop('new_customer', None)

        device = validated_data.pop('device', None)
        new_device = validated_data.pop('new_device', None)

        if validated_data.get('is_paid'):
            validated_data['paid_at'] = timezone.now()

        with transaction.atomic():
            if new_customer:
                customer = Customer.objects.create(
                    repair_shop=repair_shop,
                    **new_customer,
                )

            if new_device:
                device = Device.objects.create(
                    customer=customer,
                    **new_device,
                )

            repair_order = RepairOrder.objects.create(
                repair_shop=repair_shop,
                customer=customer,
                device=device,
                **validated_data,
            )

            notification, _ = create_repair_notification(
                repair_order=repair_order,
                event_type=REPAIR_CREATED,
                template_key=REPAIR_CREATED,
                idempotency_key=f"repair-created:{repair_order.pk}",
            )
            schedule_notification_dispatch(notification)

        return repair_order


class RepairOrderUpdateSerializer(serializers.ModelSerializer):
    assigned_technician_id = serializers.PrimaryKeyRelatedField(
        source='assigned_technician',
        queryset=User.objects.none(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    receive_now = serializers.BooleanField(
        required=False,
        write_only=True,
        default=False,
    )

    received_at = serializers.DateTimeField(
        required=False,
        allow_null=True,
    )

    class Meta:
        model = RepairOrder
        fields = (
            'assigned_technician_id',
            'repair_status',
            'final_amount',
            'is_paid',
            'issue_description',
            'received_at',
            'receive_now',
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        request = self.context.get('request')

        if not request:
            return

        if request.user.role in {
            User.MANAGER_ROLE,
            User.RECEPTIONIST_ROLE,
        }:
            self.fields[
                'assigned_technician_id'
            ].queryset = User.objects.filter(
                repair_shop=request.user.repair_shop,
                role=User.TECHNICIAN_ROLE,
                is_active=True,
            )
        else:
            self.fields['assigned_technician_id'].read_only = True

    def validate_received_at(self, value):
        if value is not None and value > timezone.now():
            raise serializers.ValidationError(
                'زمان تحویل گرفتن دستگاه نمی‌تواند مربوط به آینده باشد.'
            )

        return value

    def validate(self, attrs):
        if attrs.get('receive_now') and 'received_at' in attrs:
            raise serializers.ValidationError(
                {
                    'received_at': (
                        'receive_now و received_at را هم‌زمان ارسال نکنید.'
                    ),
                }
            )

        return attrs

    def update(self, instance, validated_data):                
        receive_now = validated_data.pop('receive_now', False)

        if receive_now:
            validated_data['received_at'] = timezone.now()

        new_is_paid = validated_data.get('is_paid')

        if new_is_paid is True and instance.paid_at is None:
            validated_data['paid_at'] = timezone.now()

        elif new_is_paid is False:
            validated_data['paid_at'] = None

        return super().update(instance, validated_data)


class RepairStatusHistorySerializer(serializers.ModelSerializer):
    previous_status_display = serializers.CharField(
        source='get_repair_previous_status_display',
        read_only=True,
    )
    new_status_display = serializers.CharField(
        source='get_repair_new_status_display',
        read_only=True,
    )
    modifier_name = serializers.SerializerMethodField()

    class Meta:
        model = RepairStatusHistory
        fields = (
            'id',
            'repair_previous_status',
            'previous_status_display',
            'repair_new_status',
            'new_status_display',
            'modifier_name',
            'modified_at',
        )

    def get_modifier_name(self, obj):
        return obj.modifier.get_full_name() or obj.modifier.username


class PublicRepairTrackingSerializer(serializers.ModelSerializer):
    repair_status_display = serializers.CharField(
        source='get_repair_status_display',
        read_only=True,
    )

    class Meta:
        model = RepairOrder
        fields = (
            'id',
            'tracking_code',
            'repair_status',
            'repair_status_display',
            'final_amount',
            'is_paid',
            'created_at',
        )
        read_only_fields = fields


class CustomerRepairHistorySerializer(serializers.ModelSerializer):
    repair_status_display = serializers.CharField(
        source='get_repair_status_display',
        read_only=True,
    )
    device_name = serializers.SerializerMethodField()
    technician_name = serializers.SerializerMethodField()

    class Meta:
        model = RepairOrder
        fields = (
            'id',
            'tracking_code',
            'device_name',
            'repair_status',
            'repair_status_display',
            'issue_description',
            'final_amount',
            'is_paid',
            'paid_at',
            'technician_name',
            'created_at',
        )
        read_only_fields = fields

    def get_device_name(self, obj):
        return str(obj.device)

    def get_technician_name(self, obj):
        if not obj.assigned_technician:
            return None

        return (
            obj.assigned_technician.get_full_name()
            or obj.assigned_technician.username
        )
