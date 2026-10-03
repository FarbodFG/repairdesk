import json
import math
import re
import socket
from collections.abc import Callable, Mapping
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from django.conf import settings

from notifications.exceptions import (
    NotificationConfigurationError,
    PermanentNotificationProviderError,
    TransientNotificationProviderError,
)
from notifications.templates import TEMPLATES

from .base import ProviderSendResult, ProviderSendStatus, SmsProvider


class KavenegarProvider(SmsProvider):
    name = "kavenegar"
    base_url = "https://api.kavenegar.com/v1"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        templates: Mapping[str, Any] | None = None,
        token_mappings: Mapping[str, str] | None = None,
        timeout: float | None = None,
        opener: Callable[..., Any] | None = None,
    ):
        configured_api_key = (
            api_key
            if api_key is not None
            else getattr(settings, "KAVENEGAR_API_KEY", "")
        )
        if not isinstance(configured_api_key, str):
            raise NotificationConfigurationError(
                "KAVENEGAR_API_KEY must be a string."
            )
        self.api_key = configured_api_key.strip()

        try:
            self.templates = dict(
                templates
                if templates is not None
                else getattr(settings, "KAVENEGAR_TEMPLATES", {})
            )
            self.token_mappings = dict(
                token_mappings
                if token_mappings is not None
                else getattr(
                    settings,
                    "KAVENEGAR_TOKEN_MAPPINGS",
                    {
                        "tracking_code": "token",
                        "customer_name": "token10",
                    },
                )
            )
        except (TypeError, ValueError) as error:
            raise NotificationConfigurationError(
                "Kavenegar template and token settings must be mappings."
            ) from error

        configured_timeout = (
            timeout
            if timeout is not None
            else getattr(settings, "KAVENEGAR_TIMEOUT_SECONDS", 10)
        )
        try:
            self.timeout = float(configured_timeout)
        except (TypeError, ValueError) as error:
            raise NotificationConfigurationError(
                "Kavenegar timeout must be a number."
            ) from error
        if not math.isfinite(self.timeout) or self.timeout <= 0:
            raise NotificationConfigurationError(
                "Kavenegar timeout must be a finite number greater than zero."
            )

        self._opener = opener or urlopen

    def validate_configuration(self) -> None:
        if not self.api_key:
            raise NotificationConfigurationError(
                "KAVENEGAR_API_KEY is not configured."
            )

        for template_key in TEMPLATES:
            template_name = self.templates.get(template_key)
            if (
                not isinstance(template_name, str)
                or not re.fullmatch(r"[A-Za-z0-9-]+", template_name.strip())
            ):
                raise NotificationConfigurationError(
                    "Kavenegar template name for "
                    f"{template_key!r} is missing or invalid."
                )

        expected_token_mappings = {
            "tracking_code": "token",
            "customer_name": "token10",
        }
        if self.token_mappings != expected_token_mappings:
            raise NotificationConfigurationError(
                "Kavenegar token mappings must be exactly "
                "tracking_code=token and customer_name=token10."
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

        self.validate_configuration()
        try:
            template_name = self.templates[template_key].strip()
        except (KeyError, AttributeError) as error:
            raise NotificationConfigurationError(
                f"Kavenegar template is not configured for {template_key!r}."
            ) from error

        payload = {
            "receptor": self._validate_recipient(recipient),
            "template": template_name,
            "type": "sms",
        }
        for context_name, token_name in self.token_mappings.items():
            try:
                value = str(context[context_name]).strip()
            except (KeyError, TypeError, ValueError) as error:
                raise NotificationConfigurationError(
                    f"Kavenegar context {context_name!r} is missing."
                ) from error
            self._validate_token_value(token_name, value)
            payload[token_name] = value

        endpoint = (
            f"{self.base_url}/{quote(self.api_key, safe='')}"
            "/verify/lookup.json"
        )
        request = Request(
            endpoint,
            data=urlencode(payload).encode("utf-8"),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
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
                "ارتباط با سرویس کاوه‌نگار برقرار نشد.",
                code="kavenegar_connection_error",
            ) from error

        response_payload = self._parse_response(raw_body)
        if not 200 <= http_status < 300:
            self._raise_http_error(http_status, response_payload)

        return_data = response_payload.get("return")
        if not isinstance(return_data, Mapping):
            raise TransientNotificationProviderError(
                "پاسخ کاوه‌نگار ساختار معتبر ندارد.",
                code="kavenegar_invalid_response",
                response=response_payload,
            )
        api_status = self._parse_status(
            return_data.get("status"),
            response_payload=response_payload,
            field_name="return.status",
        )
        if api_status != 200:
            self._raise_api_error(api_status, response_payload)

        entries = response_payload.get("entries")
        if not isinstance(entries, list) or not entries or not isinstance(
            entries[0], Mapping
        ):
            raise TransientNotificationProviderError(
                "جزئیات پیام در پاسخ کاوه‌نگار وجود ندارد.",
                code="kavenegar_missing_entry",
                response=response_payload,
            )
        entry = entries[0]
        message_id = entry.get("messageid")
        if message_id in (None, ""):
            raise TransientNotificationProviderError(
                "شناسه پیام در پاسخ کاوه‌نگار وجود ندارد.",
                code="kavenegar_missing_message_id",
                response=response_payload,
            )

        message_status = self._parse_status(
            entry.get("status"),
            response_payload=response_payload,
            field_name="entries[0].status",
        )
        if message_status not in {1, 2, 4, 5, 10}:
            raise PermanentNotificationProviderError(
                entry.get("statustext") or "کاوه‌نگار پیام را نپذیرفت.",
                code=f"kavenegar_message_{message_status}",
                response=response_payload,
            )

        return ProviderSendResult(
            status=(
                ProviderSendStatus.DELIVERED
                if message_status == 10
                else ProviderSendStatus.SENT
            ),
            provider_message_id=str(message_id),
            provider_template_id=template_name,
            raw_response=response_payload,
        )

    @staticmethod
    def _validate_recipient(recipient: str) -> str:
        if isinstance(recipient, str) and re.fullmatch(
            r"\+989[0-9]{9}",
            recipient,
        ):
            return recipient
        raise NotificationConfigurationError(
            "Kavenegar recipient must be a normalized Iranian mobile number."
        )

    @staticmethod
    def _validate_token_value(token_name: str, value: str) -> None:
        if not value or len(value) > 100 or "\n" in value or "\r" in value:
            raise NotificationConfigurationError(
                f"Kavenegar {token_name} value is empty or too long."
            )
        allowed_spaces = {"token10": 5, "token20": 8}.get(token_name, 0)
        if value.count(" ") > allowed_spaces:
            raise NotificationConfigurationError(
                f"Kavenegar {token_name} contains too many spaces."
            )
        if token_name in {"token", "token2", "token3"} and (
            any(character.isspace() for character in value) or "_" in value
        ):
            raise NotificationConfigurationError(
                f"Kavenegar {token_name} cannot contain spaces or underscores."
            )

    @staticmethod
    def _parse_response(raw_body: bytes) -> dict[str, Any]:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise TransientNotificationProviderError(
                "پاسخ کاوه‌نگار قابل خواندن نیست.",
                code="kavenegar_invalid_json",
            ) from error
        if not isinstance(payload, dict):
            raise TransientNotificationProviderError(
                "پاسخ کاوه‌نگار باید یک شیء JSON باشد.",
                code="kavenegar_invalid_response",
            )
        return payload

    @staticmethod
    def _parse_error_response(raw_body: bytes) -> dict[str, Any]:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            body = raw_body.decode("utf-8", errors="replace").strip()
            return {"body": body[:1000]} if body else {}
        return payload if isinstance(payload, dict) else {"body": str(payload)[:1000]}

    @staticmethod
    def _parse_status(
        value: Any,
        *,
        response_payload: Mapping[str, Any],
        field_name: str,
    ) -> int:
        if isinstance(value, bool):
            value = None
        try:
            parsed_status = int(value)
        except (TypeError, ValueError) as error:
            raise TransientNotificationProviderError(
                f"Kavenegar response has an invalid {field_name}.",
                code="kavenegar_invalid_response",
                response=response_payload,
            ) from error
        return parsed_status

    @classmethod
    def _raise_http_error(
        cls,
        http_status: int,
        response_payload: Mapping[str, Any],
    ) -> None:
        if http_status in {408, 409, 425, 429, 451} or http_status >= 500:
            error_class = TransientNotificationProviderError
        else:
            return_data = response_payload.get("return")
            if isinstance(return_data, Mapping):
                api_status = return_data.get("status")
                if (
                    not isinstance(api_status, bool)
                    and str(api_status).isdigit()
                ):
                    cls._raise_api_error(int(api_status), response_payload)
            error_class = PermanentNotificationProviderError
        safe_response = dict(response_payload)
        safe_response["http_status"] = http_status
        raise error_class(
            f"Kavenegar request failed with HTTP {http_status}.",
            code=f"kavenegar_http_{http_status}",
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
            if status_text in {"409", "451"} or status_text.startswith("5")
            else PermanentNotificationProviderError
        )
        return_data = response_payload.get("return")
        message = (
            return_data.get("message")
            if isinstance(return_data, Mapping)
            else None
        ) or "Kavenegar rejected the request."
        raise error_class(
            str(message),
            code=f"kavenegar_api_{status_text}",
            response=response_payload,
        )
