# ruff: noqa
from django.core.management import call_command
from django.db import migrations


def create_cache_table(apps, schema_editor):
    """Shared throttle cache (CACHES default = DatabaseCache): created here so no compose or
    entrypoint change is needed."""
    call_command("createcachetable", "django_cache", database=schema_editor.connection.alias)


class Migration(migrations.Migration):
    dependencies = [("ledger", "0004_setasidemark_reason")]
    operations = [migrations.RunPython(create_cache_table, migrations.RunPython.noop)]
