from django.shortcuts import get_object_or_404

from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from rest_framework_simplejwt.authentication import JWTAuthentication

from utils.permissions import IsManagerOrReceptionist, IsManage

from .serializer import (
    UserAccountSerializer,
    UserAccountUpdateSerializer,
    CurrentUserSerializer,
)
from .models import User


class UserAccountListCreateView(APIView):
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'POST':
            permission_classes = [IsAuthenticated, IsManage]
        else:
            permission_classes = [IsAuthenticated, IsManagerOrReceptionist]

        return [permission() for permission in permission_classes]

    def get(self, request):
        repair_shop_users = User.objects.filter(
            repair_shop=request.user.repair_shop).select_related('repair_shop')

        serializer = UserAccountSerializer(repair_shop_users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        serializer = UserAccountSerializer(data=data)

        serializer.is_valid(raise_exception=True)

        serializer.save(repair_shop=request.user.repair_shop)

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UserAccountDetaileView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManage]

    def patch(self, request, user_id):
        data = request.data

        user = get_object_or_404(
            User,
            id=user_id,
            repair_shop=request.user.repair_shop
        )

        serializer = UserAccountUpdateSerializer(user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CurrentUserSerializer(request.user)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )
