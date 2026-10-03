from collections.abc import Mapping
from hashlib import sha256
from typing import Any

from notifications.exceptions import PermanentNotificationProviderError

from .base import ProviderSendResult, ProviderSendStatus, SmsProvider


class FakeSmsProvider(SmsProvider):
    name = "fake"

    def send(
        self,
        *,
        recipient: str,
        template_key: str,
        context: Mapping[str, Any],
        rendered_message: str,
        idempotency_key: str,
    ) -> ProviderSendResult:
        if not recipient.strip():
            raise PermanentNotificationProviderError(
                "شماره گیرنده پیامک خالی است.",
                code="missing_recipient",
            )

        if not template_key.strip():
            raise PermanentNotificationProviderError(
                "کلید قالب پیامک خالی است.",
                code="missing_template_key",
            )

        if not rendered_message.strip():
            raise PermanentNotificationProviderError(
                "متن پیامک خالی است.",
                code="empty_message",
            )

        if not idempotency_key.strip():
            raise PermanentNotificationProviderError(
                "کلید جلوگیری از ارسال تکراری خالی است.",
                code="missing_idempotency_key",
            )

        message_hash = sha256(idempotency_key.encode("utf-8")).hexdigest()[:24]

        return ProviderSendResult(
            status=ProviderSendStatus.SIMULATED,
            provider_message_id=f"fake-{message_hash}",
            provider_template_id=template_key,
            raw_response={
                "accepted": True,
                "status": ProviderSendStatus.SIMULATED.value,
                "template_key": template_key,
                "context_keys": sorted(context.keys()),
            },
        )
