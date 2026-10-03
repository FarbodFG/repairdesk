from collections.abc import Mapping
from typing import Any


class NotificationProviderError(Exception):
    retryable = False

    def __init__(
        self,
        message: str,
        *,
        code: str = "provider_error",
        response: Mapping[str, Any] | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.response = dict(response or {})


class TransientNotificationProviderError(NotificationProviderError):
    retryable = True


class PermanentNotificationProviderError(NotificationProviderError):
    retryable = False


class NotificationTemplateError(ValueError):
    pass


class NotificationConfigurationError(RuntimeError):
    pass
