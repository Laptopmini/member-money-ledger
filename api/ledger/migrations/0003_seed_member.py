# ruff: noqa
import os

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations

EMAIL = "member@example.com"


def seed(apps, schema_editor):
    """One seeded member. Password: DEMO_MEMBER_PASSWORD, or the dev default when DEBUG=1.
    With neither (prod, no env) nothing is created: run `manage.py seed_member` after setting it."""
    password = os.environ.get("DEMO_MEMBER_PASSWORD") or (
        "demo-password-2026" if settings.ALLOW_DEV_DEFAULTS else None
    )
    if password is None:
        return
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    if not User.objects.filter(username=EMAIL).exists():
        User.objects.create(
            username=EMAIL, email=EMAIL, first_name="Sam", password=make_password(password)
        )


class Migration(migrations.Migration):
    dependencies = [
        ("ledger", "0002_tax_models"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
