from typing import Any

from django.core.management.base import BaseCommand, CommandParser
from django.db import connection, transaction

from ledger.demo import demo_payloads
from ledger.models import AuditEvent, DataVersion, SyncRejection, SyncRun, Transaction
from ledger.sync import sync_with_lock
from ledger.vendor import LedgerlyClient


class Command(BaseCommand):
    help = "Delete the local mirror (transactions, rejections, sync runs, audit). Dev/E2E only."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--sync", action="store_true", help="sync from the vendor afterwards")
        parser.add_argument(
            "--seed", action="store_true", help="POST demo rows to the vendor first"
        )

    def handle(self, *args: Any, **opts: Any) -> None:
        with transaction.atomic():
            # AuditEvent is append-only at the ORM level; reset is the one sanctioned wipe.
            with connection.cursor() as cur:
                cur.execute("DELETE FROM " + connection.ops.quote_name(AuditEvent._meta.db_table))  # noqa: S608
            Transaction.objects.all().delete()
            SyncRejection.objects.all().delete()
            SyncRun.objects.all().delete()
            DataVersion.bump()
        self.stdout.write("mirror cleared")
        client = LedgerlyClient()
        if opts["seed"]:
            payloads = demo_payloads()  # validates everything before the first POST
            for body in payloads:
                client.create(body)
            self.stdout.write(f"seeded {len(payloads)} demo rows")
        if opts["sync"] or opts["seed"]:
            run = sync_with_lock(client, wait=True)
            self.stdout.write(f"sync {run.status if run else 'skipped'}")
