from django.urls import path

from .views import DeviceModelListView


urlpatterns = [
    path('models/', DeviceModelListView.as_view(), name='device-models-list',),
]