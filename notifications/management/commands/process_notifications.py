import logging

from django.core.management.base import BaseCommand, CommandError

from notifications.models import Notification
from notifications.services import (
    DispatchOutcome,
    dispatch_notification_with_outcome,
    get_due_notification_ids,
)


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Process due notification Outbox records once."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=100,
            help="Maximum records to inspect in this run (default: 100).",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        if limit <= 0:
            raise CommandError("--limit must be greater than zero.")

        notification_ids = get_due_notification_ids(limit=limit)
        succeeded_count = 0
        failed_count = 0
        skipped_count = 0
        unexpected_error_count = 0

        successful_statuses = {
            Notification.Status.SIMULATED,
            Notification.Status.SENT,
            Notification.Status.DELIVERED,
        }

        for notification_id in notification_ids:
            try:
                dispatch_result = dispatch_notification_with_outcome(
                    notification_id
                )
            except Notification.DoesNotExist:
                skipped_count += 1
                continue
            except Exception:
                unexpected_error_count += 1
                logger.exception(
                    "Outbox processor failed unexpectedly",
                    extra={"notification_id": notification_id},
                )
                continue

            if dispatch_result.outcome != DispatchOutcome.DISPATCHED:
                skipped_count += 1
            elif dispatch_result.notification.status in successful_statuses:
                succeeded_count += 1
            elif (
                dispatch_result.notification.status
                == Notification.Status.FAILED
            ):
                failed_count += 1
            else:
                skipped_count += 1

        summary = (
            "Notification processing finished: "
            f"selected={len(notification_ids)}, "
            f"succeeded={succeeded_count}, "
            f"failed={failed_count}, "
            f"skipped={skipped_count}, "
            f"unexpected_errors={unexpected_error_count}."
        )

        if unexpected_error_count:
            self.stderr.write(self.style.ERROR(summary))
            raise CommandError(
                f"{unexpected_error_count} unexpected processing error(s)."
            )

        self.stdout.write(self.style.SUCCESS(summary))
