from rest_framework.permissions import BasePermission

from accounts.models import User


def has_active_workspace(user):
    return bool(
        user.is_authenticated
        and user.is_active
        and user.repair_shop_id
        and user.repair_shop.is_active
        and user.role in {role for role, _ in User.ROLES}
    )


class HasActiveWorkspace(BasePermission):
    message = "برای دسترسی، حساب و تعمیرگاه باید فعال باشند."

    def has_permission(self, request, view):
        return has_active_workspace(request.user)


class IsManagerOrReceptionist(BasePermission):
    message = "فقط مدیر یا پذیرش تعمیرگاه اجازه دسترسی دارد."

    def has_permission(self, request, view):
        user = request.user

        return bool(
            has_active_workspace(user)
            and user.role
            in {
                User.MANAGER_ROLE,
                User.RECEPTIONIST_ROLE,
            }
        )


class IsManage(BasePermission):
    message = "فقط مدیر تعمیرگاه اجازه دسترسی دارد."

    def has_permission(self, request, view):
        user = request.user

        return bool(
            has_active_workspace(user)
            and user.role
            in {
                User.MANAGER_ROLE,
            }
        )


class CanUpdateRepairOrder(HasActiveWorkspace):
    message = "اجازه ویرایش این سفارش را ندارید."

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.role in [User.MANAGER_ROLE, User.RECEPTIONIST_ROLE]:
            return True
        
        return (user.role == User.TECHNICIAN_ROLE and obj.assigned_technician_id == user.id)
