from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Any


class ProviderSendStatus(str, Enum):
    SIMULATED = "simulated"
    SENT = "sent"
    DELIVERED = "delivered"


@dataclass(frozen=True, slots=True)
class ProviderSendResult:
    status: ProviderSendStatus
    provider_message_id: str | None = None
    provider_template_id: str = ""
    raw_response: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        object.__setattr__(
            self,
            "raw_response",
            MappingProxyType(dict(self.raw_response)),
        )


class SmsProvider(ABC):
    name: str

    @abstractmethod
    def send(
        self,
        *,
        recipient: str,
        template_key: str,
        context: Mapping[str, Any],
        rendered_message: str,
        idempotency_key: str,
    ) -> ProviderSendResult:
        """Send one transactional SMS and return a provider-neutral result."""
