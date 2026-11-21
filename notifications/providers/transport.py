import errno
import socket
from urllib.error import URLError

from notifications.exceptions import (
    AmbiguousNotificationProviderError,
    NotificationProviderError,
    TransientNotificationProviderError,
)


def transport_failure(
    provider_name: str, error: BaseException, *, code: str,
) -> NotificationProviderError:
    """Only retry failures known to precede transmission of the request."""
    reason = error.reason if isinstance(error, URLError) else error
    not_connected = isinstance(reason, (socket.gaierror, ConnectionRefusedError)) or (
        isinstance(reason, OSError)
        and reason.errno in {errno.ECONNREFUSED, errno.ENETUNREACH, errno.EHOSTUNREACH}
    )
    error_class = (
        TransientNotificationProviderError
        if not_connected
        else AmbiguousNotificationProviderError
    )
    return error_class(
        f"ارتباط با سرویس {provider_name} کامل نشد.",
        code=code,
    )
