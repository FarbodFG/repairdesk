from collections.abc import Mapping
from dataclasses import dataclass
from string import Formatter
from types import MappingProxyType
from typing import Any

from .exceptions import NotificationTemplateError


REPAIR_CREATED = "repair_created"
REPAIR_WAITING_FOR_PARTS = "repair_waiting_for_parts"
REPAIR_READY = "repair_ready"
REPAIR_CANCELLED = "repair_cancelled"


@dataclass(frozen=True, slots=True)
class NotificationTemplate:
    key: str
    body: str
    required_context: frozenset[str]

    def __post_init__(self):
        placeholders = frozenset(
            field_name
            for _, field_name, _, _ in Formatter().parse(self.body)
            if field_name
        )

        if placeholders != self.required_context:
            raise NotificationTemplateError(
                f"Template {self.key!r} placeholders do not match required_context."
            )

    def render(self, context: Mapping[str, Any]) -> str:
        missing_keys = self.required_context.difference(context.keys())

        if missing_keys:
            missing = ", ".join(sorted(missing_keys))
            raise NotificationTemplateError(
                f"Template {self.key!r} is missing context values: {missing}."
            )

        invalid_keys = {
            key
            for key in self.required_context
            if context[key] is None
            or (isinstance(context[key], str) and not context[key].strip())
        }

        if invalid_keys:
            invalid = ", ".join(sorted(invalid_keys))
            raise NotificationTemplateError(
                f"Template {self.key!r} has empty context values: {invalid}."
            )

        rendered = self.body.format_map(dict(context)).strip()

        if not rendered:
            raise NotificationTemplateError(
                f"Template {self.key!r} rendered an empty message."
            )

        return rendered


TEMPLATES: Mapping[str, NotificationTemplate] = MappingProxyType({
    REPAIR_CREATED: NotificationTemplate(
        key=REPAIR_CREATED,
        body=(
            "{customer_name} عزیز، سفارش تعمیر شما ثبت شد. "
            "کد پیگیری: {tracking_code}\n{tracking_url}"
        ),
        required_context=frozenset(
            {"customer_name", "tracking_code", "tracking_url"}
        ),
    ),
    REPAIR_WAITING_FOR_PARTS: NotificationTemplate(
        key=REPAIR_WAITING_FOR_PARTS,
        body=(
            "{customer_name} عزیز، سفارش {tracking_code} در انتظار تأمین قطعه است. "
            "وضعیت را از این نشانی ببینید:\n{tracking_url}"
        ),
        required_context=frozenset(
            {"customer_name", "tracking_code", "tracking_url"}
        ),
    ),
    REPAIR_READY: NotificationTemplate(
        key=REPAIR_READY,
        body=(
            "{customer_name} عزیز، سفارش {tracking_code} آماده تحویل است. "
            "جزئیات:\n{tracking_url}"
        ),
        required_context=frozenset(
            {"customer_name", "tracking_code", "tracking_url"}
        ),
    ),
    REPAIR_CANCELLED: NotificationTemplate(
        key=REPAIR_CANCELLED,
        body=(
            "{customer_name} عزیز، فرایند سفارش {tracking_code} لغو شد. "
            "جزئیات:\n{tracking_url}"
        ),
        required_context=frozenset(
            {"customer_name", "tracking_code", "tracking_url"}
        ),
    ),
})


def get_template(template_key: str) -> NotificationTemplate:
    try:
        return TEMPLATES[template_key]
    except KeyError as error:
        raise NotificationTemplateError(
            f"Unknown notification template: {template_key!r}."
        ) from error


def render_template(template_key: str, context: Mapping[str, Any]) -> str:
    return get_template(template_key).render(context)
