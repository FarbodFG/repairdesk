from django.urls import path, include

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from .views import DashboardSummaryView


urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),

    path('dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),

    path('customers/', include('customers.urls')),
    path('accounts/', include('accounts.urls')),
    path('repairs/', include('repairs.urls')),
    path('devices/', include('devices.urls')),
    path('notifications/', include('notifications.urls')),
]
