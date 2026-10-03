from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers

from shops.serializer import RepairShopSerializer

from .models import User


class UserAccountSerializer(serializers.ModelSerializer):
    repair_shop = RepairShopSerializer(read_only=True)
    role_display = serializers.CharField(
        source='get_role_display',
        read_only=True,
    )

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'role', 'role_display', 'repair_shop',
                  'is_staff', 'is_active', 'date_joined', 'last_login')
        read_only_fields = ['id', 'date_joined',
                            'repair_shop', 'last_login', 'role_display', 'is_staff']
        extra_kwargs = {
            'password': {
                'write_only': True,
                'validators': [validate_password],
            },
        }

    def create(self, validated_data):
        password = validated_data.pop('password')

        return User.objects.create_user(
            password=password,
            **validated_data,
        )


class UserAccountUpdateSerializer(serializers.ModelSerializer):
    new_password = serializers.CharField(required=False, validators=[
                                         validate_password], write_only=True)

    class Meta:
        model = User
        fields = (
            'first_name',
            'last_name',
            'username',
            'email',
            'role',
            'is_active',
            'new_password'
        )

    def update(self, instance, validated_data):
        new_password = validated_data.pop('new_password', None)

        instance = super().update(instance, validated_data)

        if new_password:
            instance.set_password(new_password)
            instance.save(update_fields=['password'])

        return instance


class CurrentUserSerializer(serializers.ModelSerializer):
    repair_shop = RepairShopSerializer(read_only=True)
    role_display = serializers.CharField(
        source='get_role_display',
        read_only=True,
    )

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'role',
            'role_display',
            'repair_shop',
            'is_active',
        )
        read_only_fields = fields
