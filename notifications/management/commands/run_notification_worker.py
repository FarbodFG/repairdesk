import logging
import math
import signal
from threading import Event

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections, connections

from notifications.wakeup import QueueWakeup, notify_worker


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Continuously process the notification Outbox, with graceful shutdown."

    def add_arguments(self, parser):
        parser.add_argument("--interval", type=float, default=5)
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        if (
            not math.isfinite(options["interval"])
            or options["interval"] <= 0
            or options["limit"] <= 0
        ):
            raise CommandError("--interval and --limit must be greater than zero.")

        stopped = Event()
        previous_handlers = {}
        def request_stop(*args):
            stopped.set()
            notify_worker()

        try:
            for signum in (signal.SIGTERM, signal.SIGINT):
                previous_handlers[signum] = signal.signal(
                    signum, request_stop,
                )
            with QueueWakeup() as wakeup:
                while not stopped.is_set():
                    try:
                        close_old_connections()
                        call_command(
                            "process_notifications", limit=options["limit"],
                            stdout=self.stdout, stderr=self.stderr,
                            stop_event=stopped,
                        )
                    except Exception:
                        logger.exception("Notification worker batch failed")
                    finally:
                        close_old_connections()
                    wakeup.wait(stopped, options["interval"])
        finally:
            for signum, handler in previous_handlers.items():
                signal.signal(signum, handler)
            connections.close_all()
