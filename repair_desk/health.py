from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.views.decorators.http import require_safe


@require_safe
def health(request):
    """Liveness deliberately does not depend on MySQL or the SMS provider."""
    response = JsonResponse({"status": "ok"})
    response["Cache-Control"] = "no-store"
    return response


@require_safe
def ready(request):
    """Readiness verifies that the application can reach its database."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        response = JsonResponse({"status": "unavailable"}, status=503)
    else:
        response = JsonResponse({"status": "ok"})
    response["Cache-Control"] = "no-store"
    return response
