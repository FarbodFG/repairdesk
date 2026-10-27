import logging
import signal
from threading import Event

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connections


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Continuously process the notification Outbox, with graceful shutdown."

    def add_arguments(self, parser):
        parser.add_argument("--interval", type=float, default=60)
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        if options["interval"] <= 0 or options["limit"] <= 0:
            raise CommandError("--interval and --limit must be greater than zero.")

        stopped = Event()
        previous_handlers = {}
        try:
            for signum in (signal.SIGTERM, signal.SIGINT):
                previous_handlers[signum] = signal.signal(
                    signum, lambda *_: stopped.set()
                )
            while not stopped.is_set():
                try:
                    connections.close_all()
                    call_command(
                        "process_notifications", limit=options["limit"],
                        stdout=self.stdout, stderr=self.stderr,
                    )
                except Exception:
                    # Failed batches are retried on the next interval; keep the
                    # worker alive during temporary database/provider outages.
                    logger.exception("Notification worker batch failed")
                finally:
                    connections.close_all()
                stopped.wait(options["interval"])
        finally:
            for signum, handler in previous_handlers.items():
                signal.signal(signum, handler)
