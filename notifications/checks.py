from django.core.checks import Error, register

from .exceptions import NotificationConfigurationError
from .models import Notification
from .services import (
    get_notification_send_mode,
    get_notification_provider_name,
    get_processing_timeout,
    get_provider,
    get_public_tracking_base_url,
    get_retry_policy,
)


@register()
def check_notification_send_mode(app_configs, **kwargs):
    del app_configs, kwargs

    try:
        get_notification_send_mode(Notification.Provider.FAKE)
    except NotificationConfigurationError as error:
        return [
            Error(
                str(error),
                hint=(
                    "Set NOTIFICATION_SEND_MODE to auto, sync, or worker."
                ),
                id="notifications.E001",
            )
        ]

    return []


def _configuration_error(*, message, hint, error_id):
    return Error(message, hint=hint, id=error_id)


@register()
def check_notification_runtime_configuration(app_configs, **kwargs):
    del app_configs, kwargs

    errors = []
    try:
        provider_name = get_notification_provider_name()
    except NotificationConfigurationError as error:
        errors.append(_configuration_error(
            message=str(error),
            hint="Set it to fake, smsir, or kavenegar.",
            error_id="notifications.E002",
        ))
        return errors

    try:
        provider = get_provider(provider_name)
    except NotificationConfigurationError as error:
        errors.append(_configuration_error(
            message=str(error),
            hint="Select a notification provider implemented by this project.",
            error_id="notifications.E002",
        ))
        provider = None

    for validator, hint, error_id in (
        (
            get_processing_timeout,
            "Use a positive integer number of seconds.",
            "notifications.E003",
        ),
        (
            get_retry_policy,
            "Use a positive max-attempt count and enough positive retry delays.",
            "notifications.E004",
        ),
    ):
        try:
            validator()
        except NotificationConfigurationError as error:
            errors.append(_configuration_error(
                message=str(error),
                hint=hint,
                error_id=error_id,
            ))

    try:
        get_public_tracking_base_url(
            require_public=provider_name != Notification.Provider.FAKE,
        )
    except NotificationConfigurationError as error:
        errors.append(_configuration_error(
            message=str(error),
            hint=(
                "Use the public HTTPS URL of the frontend tracking page for "
                "real providers; localhost is valid only for the fake provider."
            ),
            error_id="notifications.E005",
        ))

    if provider is not None and hasattr(provider, "validate_configuration"):
        try:
            provider.validate_configuration()
        except NotificationConfigurationError as error:
            errors.append(_configuration_error(
                message=str(error),
                hint="Complete every required setting for the selected provider.",
                error_id="notifications.E006",
            ))

    return errors
