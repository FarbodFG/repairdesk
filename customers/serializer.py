from rest_framework import serializers

from shops.serializer import RepairShopSerializer
from devices.serializer import DeviceModelSerializer, DeviceModel

from .models import Customer, Device


class CustomerSerializer(serializers.ModelSerializer):
    repair_shop = RepairShopSerializer(read_only=True)

    class Meta:
        model = Customer
        fields = ('id', 'name', 'phone_number',
                  'available_phone_number', 'repair_shop', 'created_at')
        read_only_fields = ['id', 'created_at']


class DeviceSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)
    device_model = serializers.PrimaryKeyRelatedField(
        queryset=DeviceModel.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Device
        fields = ('id', 'customer', 'device_model',
                  'custom_model_name', 'created_at')

        read_only_fields = (
            "id",
            "customer",
        )

    def validate(self, attrs):
        device_model = attrs.get('device_model')
        custom_model_name = attrs.get('custom_model_name', '').strip()

        if not device_model and not custom_model_name:
            raise serializers.ValidationError(
                "مدل دستگاه را انتخاب یا به‌صورت دستی وارد کنید.")

        if device_model and custom_model_name:
            raise serializers.ValidationError(
                "فقط یکی از مدل آماده یا مدل دستی را وارد کنید.")

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.device_model:
            data['device_model'] = DeviceModelSerializer(
                instance.device_model
            ).data
        else:
            data['device_model'] = None

        return data


class CustomerQuickCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ('name', 'phone_number', 'available_phone_number')


class DeviceQuickCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ('customer', 'device_model', 'custom_model_name')
        read_only_fields = ['customer']
        
        
    def validate(self, attrs):
        device_model = attrs.get('device_model')
        custom_model_name = attrs.get('custom_model_name', '').strip()

        if not device_model and not custom_model_name:
            raise serializers.ValidationError(
                "مدل دستگاه را انتخاب یا به‌صورت دستی وارد کنید.")

        if device_model and custom_model_name:
            raise serializers.ValidationError(
                "فقط یکی از مدل آماده یا مدل دستی را وارد کنید.")

        return attrs

