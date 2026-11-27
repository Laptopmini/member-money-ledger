from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from ledger.members import ensure_member


class Command(BaseCommand):
    help = "Create the seeded member (password from DEMO_MEMBER_PASSWORD)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--reset-password", action="store_true")

    def handle(self, *args: Any, **opts: Any) -> None:
        user = ensure_member(reset_password=opts["reset_password"])
        if user is None:
            raise CommandError("Set DEMO_MEMBER_PASSWORD (no dev default when DEBUG=0).")
        self.stdout.write(f"member ready: {user.email}")
