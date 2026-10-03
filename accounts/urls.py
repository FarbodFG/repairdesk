from django.urls import path

from .views import UserAccountListCreateView, UserAccountDetaileView, CurrentUserView

urlpatterns = [
    path('', UserAccountListCreateView.as_view(), name='accounts-list-create'),
    path('<int:user_id>/', UserAccountDetaileView.as_view(), name='accounts-detail'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
]