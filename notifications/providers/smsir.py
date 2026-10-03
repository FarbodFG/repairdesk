import json
import math
import re
import socket
from collections.abc import Callable, Mapping
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from notifications.exceptions import (
    NotificationConfigurationError,
    PermanentNotificationProviderError,
    TransientNotificationProviderError,
)

from .base import ProviderSendResult, ProviderSendStatus, SmsProvider
from notifications.templates import TEMPLATES


class SmsIrProvider(SmsProvider):
    name = "smsir"
    endpoint = "https://api.sms.ir/v1/send/verify"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        template_ids: Mapping[str, Any] | None = None,
        parameter_names: Mapping[str, str] | None = None,
        timeout: float | None = None,
        opener: Callable[..., Any] | None = None,
    ):
        configured_api_key = (
            api_key
            if api_key is not None
            else getattr(settings, "SMSIR_API_KEY", "")
        )
        if not isinstance(configured_api_key, str):
            raise NotificationConfigurationError(
                "SMSIR_API_KEY must be a string."
            )
        self.api_key = configured_api_key.strip()
        try:
            self.template_ids = dict(
                template_ids
                if template_ids is not None
                else getattr(settings, "SMSIR_TEMPLATE_IDS", {})
            )
            self.parameter_names = dict(
                parameter_names
                if parameter_names is not None
                else getattr(
                    settings,
                    "SMSIR_PARAMETER_NAMES",
                    {
                        "customer_name": "NAME",
                        "tracking_code": "CODE",
                        "tracking_url": "LINK",
                    },
                )
            )
        except (TypeError, ValueError) as error:
            raise NotificationConfigurationError(
                "SMS.ir template and parameter settings must be mappings."
            ) from error
        configured_timeout = (
            timeout
            if timeout is not None
            else getattr(settings, "SMSIR_TIMEOUT_SECONDS", 10)
        )
        try:
            self.timeout = float(configured_timeout)
        except (TypeError, ValueError) as error:
            raise NotificationConfigurationError(
                "SMS.ir timeout must be a number."
            ) from error
        if not math.isfinite(self.timeout) or self.timeout <= 0:
            raise NotificationConfigurationError(
                "SMS.ir timeout must be a finite number greater than zero."
            )
        self._opener = opener or urlopen

    def validate_configuration(self) -> None:
        if not self.api_key:
            raise NotificationConfigurationError(
                "SMSIR_API_KEY is not configured."
            )

        for template_key in TEMPLATES:
            try:
                template_id = int(self.template_ids[template_key])
            except (KeyError, TypeError, ValueError) as error:
                raise NotificationConfigurationError(
                    f"SMS.ir template ID is not configured for {template_key!r}."
                ) from error
            if template_id <= 0:
                raise NotificationConfigurationError(
                    f"SMS.ir template ID for {template_key!r} must be positive."
                )

        required_context = set().union(
            *(template.required_context for template in TEMPLATES.values())
        )
        missing_names = required_context.difference(self.parameter_names)
        if missing_names:
            missing = ", ".join(sorted(missing_names))
            raise NotificationConfigurationError(
                f"SMS.ir parameter names are not configured for: {missing}."
            )

        provider_names = []
        for context_name in required_context:
            provider_name = self.parameter_names[context_name]
            if not isinstance(provider_name, str) or not provider_name.strip():
                raise NotificationConfigurationError(
                    f"SMS.ir parameter name for {context_name!r} is invalid."
                )
            provider_names.append(provider_name.strip())
        if len(provider_names) != len(set(provider_names)):
            raise NotificationConfigurationError(
                "SMS.ir parameter names must be unique."
            )

    def send(
        self,
        *,
        recipient: str,
        template_key: str,
        context: Mapping[str, Any],
        rendered_message: str,
        idempotency_key: str,
    ) -> ProviderSendResult:
        del rendered_message, idempotency_key

        if not self.api_key:
            raise NotificationConfigurationError(
                "SMSIR_API_KEY is not configured."
            )

        try:
            template_id = int(self.template_ids[template_key])
        except (KeyError, TypeError, ValueError) as error:
            raise NotificationConfigurationError(
                f"SMS.ir template ID is not configured for {template_key!r}."
            ) from error
        if template_id <= 0:
            raise NotificationConfigurationError(
                f"SMS.ir template ID for {template_key!r} must be positive."
            )

        missing_parameter_names = set(context).difference(self.parameter_names)
        if missing_parameter_names:
            missing = ", ".join(sorted(missing_parameter_names))
            raise NotificationConfigurationError(
                f"SMS.ir parameter names are not configured for: {missing}."
            )

        parameters = []
        used_parameter_names = set()
        for context_name, value in context.items():
            if value is None or not str(value).strip():
                raise NotificationConfigurationError(
                    f"SMS.ir parameter {context_name!r} is empty."
                )
            provider_name = self.parameter_names[context_name]
            if not isinstance(provider_name, str) or not provider_name.strip():
                raise NotificationConfigurationError(
                    f"SMS.ir parameter name for {context_name!r} is invalid."
                )
            provider_name = provider_name.strip()
            if provider_name in used_parameter_names:
                raise NotificationConfigurationError(
                    f"SMS.ir parameter name {provider_name!r} is duplicated."
                )
            used_parameter_names.add(provider_name)
            parameters.append(
                {
                    "name": provider_name,
                    "value": str(value),
                }
            )

        payload = {
            "mobile": self._mobile_for_smsir(recipient),
            "templateId": template_id,
            "parameters": parameters,
        }
        request = Request(
            self.endpoint,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-API-KEY": self.api_key,
            },
            method="POST",
        )

        try:
            with self._opener(request, timeout=self.timeout) as response:
                http_status = getattr(response, "status", 200)
                raw_body = response.read()
        except HTTPError as error:
            response_payload = self._parse_error_response(error.read())
            self._raise_http_error(error.code, response_payload)
        except (URLError, TimeoutError, socket.timeout, OSError) as error:
            raise TransientNotificationProviderError(
                "ارتباط با سرویس SMS.ir برقرار نشد.",
                code="smsir_connection_error",
            ) from error

        response_payload = self._parse_response(raw_body)
        if not 200 <= http_status < 300:
            self._raise_http_error(http_status, response_payload)

        api_status = response_payload.get("status")
        if api_status is not None and str(api_status).lower() not in {
            "1",
            "success",
        }:
            self._raise_api_error(api_status, response_payload)

        data = response_payload.get("data")
        if not isinstance(data, Mapping):
            raise TransientNotificationProviderError(
                "پاسخ SMS.ir ساختار معتبر ندارد.",
                code="smsir_invalid_response",
                response=response_payload,
            )

        message_id = data.get("messageId", data.get("MessageId"))
        if message_id in (None, ""):
            raise TransientNotificationProviderError(
                "شناسه پیام در پاسخ SMS.ir وجود ندارد.",
                code="smsir_missing_message_id",
                response=response_payload,
            )

        return ProviderSendResult(
            status=ProviderSendStatus.SENT,
            provider_message_id=str(message_id),
            provider_template_id=str(template_id),
            raw_response=response_payload,
        )

    @staticmethod
    def _mobile_for_smsir(recipient: str) -> str:
        if isinstance(recipient, str) and re.fullmatch(
            r"\+989[0-9]{9}",
            recipient,
        ):
            return recipient[3:]
        raise NotificationConfigurationError(
            "SMS.ir recipient must be a normalized Iranian mobile number."
        )

    @staticmethod
    def _parse_response(raw_body: bytes) -> dict[str, Any]:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise TransientNotificationProviderError(
                "پاسخ SMS.ir قابل خواندن نیست.",
                code="smsir_invalid_json",
            ) from error
        if not isinstance(payload, dict):
            raise TransientNotificationProviderError(
                "پاسخ SMS.ir باید یک شیء JSON باشد.",
                code="smsir_invalid_response",
            )
        return payload

    @staticmethod
    def _parse_error_response(raw_body: bytes) -> dict[str, Any]:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            body = raw_body.decode("utf-8", errors="replace").strip()
            return {"body": body[:1000]} if body else {}
        if isinstance(payload, dict):
            return payload
        return {"body": str(payload)[:1000]}

    @staticmethod
    def _raise_http_error(
        http_status: int,
        response_payload: Mapping[str, Any],
    ) -> None:
        error_class = (
            TransientNotificationProviderError
            if http_status in {408, 425, 429} or http_status >= 500
            else PermanentNotificationProviderError
        )
        safe_response = dict(response_payload)
        safe_response["http_status"] = http_status
        message = response_payload.get("message") or (
            f"SMS.ir request failed with HTTP {http_status}."
        )
        raise error_class(
            str(message),
            code=f"smsir_http_{http_status}",
            response=safe_response,
        )

    @staticmethod
    def _raise_api_error(
        api_status: Any,
        response_payload: Mapping[str, Any],
    ) -> None:
        status_text = str(api_status)
        error_class = (
            TransientNotificationProviderError
            if status_text in {"408", "425", "429"}
            or status_text.startswith("5")
            else PermanentNotificationProviderError
        )
        message = response_payload.get("message") or "SMS.ir rejected the request."
        raise error_class(
            str(message),
            code=f"smsir_api_{status_text}",
            response=response_payload,
        )
