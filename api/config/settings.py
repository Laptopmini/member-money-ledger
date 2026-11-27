import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def _flag(name: str, default: str) -> bool:
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


DEBUG = _flag("DJANGO_DEBUG", "0")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY is required when DJANGO_DEBUG=0")
    SECRET_KEY = "dev-only-insecure-key-not-a-secret"  # noqa: S105

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

# Ledgerly (vendor) client settings.
VENDOR_URL = os.environ.get("VENDOR_URL", "http://vendor:8080")
VENDOR_TIMEOUT = float(os.environ.get("VENDOR_TIMEOUT", "5"))
VENDOR_RETRIES = int(os.environ.get("VENDOR_RETRIES", "2"))
SYNC_STALE_SECONDS = int(os.environ.get("SYNC_STALE_SECONDS", "60"))

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "rest_framework",
    "drf_spectacular",
    "ledger",
]

MIDDLEWARE = [
    "django.middleware.gzip.GZipMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "ledger.middleware.RequestIdMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "ledger"),
        "USER": os.environ.get("POSTGRES_USER", "ledger"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "ledger"),
        "HOST": os.environ.get("POSTGRES_HOST", "db"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
    }
}

USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
APPEND_SLASH = False

REST_FRAMEWORK = {
    # Auth lands in a later stage: add the classes / a global IsAuthenticated here.
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "ledger.errors.exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Member Money Ledger API",
    "DESCRIPTION": "Mirror of the Ledgerly bank feed with recategorize write-through.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api",
    "ENUM_NAME_OVERRIDES": {
        "TransactionStatusEnum": "ledger.models.Transaction.STATUS_CHOICES",
        "DirectionEnum": "ledger.models.Transaction.DIRECTION_CHOICES",
        "RowKindEnum": "ledger.serializers.ROW_KIND_CHOICES",
        "CategoryKindEnum": "ledger.serializers.CATEGORY_KIND_CHOICES",
        "SyncStateEnum": "ledger.serializers.SYNC_STATE_CHOICES",
    },
}

if not DEBUG:
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "31536000"))
    SECURE_SSL_REDIRECT = _flag("DJANGO_SSL_REDIRECT", "0")
    SESSION_COOKIE_SECURE = _flag("DJANGO_SECURE_COOKIES", "0")
    CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"

# Never log merchant/description text: only ids, codes, counts.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.environ.get("LOG_LEVEL", "INFO")},
}
