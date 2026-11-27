from django.apps import AppConfig


class LedgerConfig(AppConfig):
    name = "ledger"

    def ready(self) -> None:
        from . import schema_ext  # noqa: F401 - registers the OpenAPI auth scheme
