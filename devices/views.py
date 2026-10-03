from django.db.models import Q

from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import DeviceModel
from .pagination import DeviceModelPagination
from .serializer import DeviceModelSerializer


class DeviceModelListView(ListAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = DeviceModelSerializer
    pagination_class = DeviceModelPagination

    def get_queryset(self):
        search = self.request.query_params.get(
            'search',
            '',
        ).strip()

        device_models = (
            DeviceModel.objects
            .filter(is_active=True)
            .select_related('brand')
        )

        if search:
            device_models = device_models.filter(
                Q(name__icontains=search)
                | Q(brand__name__icontains=search)
                | Q(search_aliases__icontains=search)
            )

        return device_models.order_by(
            'brand__name',
            'name',
        )