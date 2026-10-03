from rest_framework.serializers import ModelSerializer

from .models import RepairShop


class RepairShopSerializer(ModelSerializer):
    class Meta:
        model = RepairShop
        fields = ('id', 'title', 'is_active', 'created_at')
