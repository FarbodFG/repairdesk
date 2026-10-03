from rest_framework.permissions import BasePermission

from accounts.models import User


class IsManagerOrReceptionist(BasePermission):
    message = "فقط مدیر یا پذیرش تعمیرگاه اجازه دسترسی دارد."

    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
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
            user
            and user.role
            in {
                User.MANAGER_ROLE,
            }
        )


class CanUpdateRepairOrder(BasePermission):
    message = "اجازه ویرایش این سفارش را ندارید."

    def has_object_permission(self, request, view, obj):
        user = request.user
        
        if user.role in [User.MANAGER_ROLE, User.RECEPTIONIST_ROLE]:
            return True
        
        return (user.role == User.TECHNICIAN_ROLE and obj.assigned_technician_id == user.id)
            