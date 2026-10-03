from rest_framework.serializers import ModelSerializer

from .models import Brand, DeviceModel


class BrandSerializer(ModelSerializer):
    class Meta:
        model = Brand
        fields = ('id', 'name')


class DeviceModelSerializer(ModelSerializer):
    brand = BrandSerializer(read_only=True)
    
    class Meta:
        model = DeviceModel
        fields = ('id', 'brand', 'name', 'search_aliases', 'is_active',)