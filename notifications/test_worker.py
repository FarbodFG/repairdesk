from io import StringIO
from threading import Event
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase


class WorkerTests(SimpleTestCase):
    def test_invalid_interval_is_rejected(self):
        with self.assertRaises(CommandError):
            call_command("run_notification_worker", interval=0)

    def test_worker_survives_a_failed_batch_and_stops_when_requested(self):
        stopped = Event()
        calls = []

        def batch(*args, **kwargs):
            calls.append(args[0])
            if len(calls) == 1:
                raise CommandError("temporary database outage")
            stopped.set()

        target = "notifications.management.commands.run_notification_worker"
        with (
            patch(f"{target}.Event", return_value=stopped),
            patch(f"{target}.call_command", side_effect=batch),
            patch(f"{target}.connections.close_all"),
            patch(f"{target}.logger.exception") as logged,
        ):
            call_command("run_notification_worker", interval=0.001, stdout=StringIO())
        self.assertEqual(calls, ["process_notifications", "process_notifications"])
        logged.assert_called_once()
