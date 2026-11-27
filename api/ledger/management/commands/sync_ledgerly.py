import logging
import time
from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from ledger.sync import sync_with_lock

log = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Mirror Ledgerly into Postgres (once, or forever with --loop)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--loop", action="store_true")
        parser.add_argument("--interval", type=int, default=30)

    def handle(self, *args: Any, **opts: Any) -> None:
        while True:
            try:
                run = sync_with_lock(wait=not opts["loop"])
                if run is None:
                    log.info("sync_skipped code=lock_held")
                else:
                    log.info(
                        "sync_done status=%s fetched=%s upserted=%s rejected=%s tombstoned=%s",
                        run.status,
                        run.fetched,
                        run.upserted,
                        run.rejected,
                        run.tombstoned,
                    )
            except Exception as exc:  # noqa: BLE001 - the worker must survive anything
                log.error("sync_error type=%s", type(exc).__name__)
                if not opts["loop"]:
                    raise
            if not opts["loop"]:
                return
            time.sleep(opts["interval"])
