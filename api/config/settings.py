import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def _flag(name: str, default: str) -> bool:
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


DEBUG = _flag("DJANGO_DEBUG", "0")

# Captured at import: Django flips settings.DEBUG to False while running tests.
ALLOW_DEV_DEFAULTS = DEBUG

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

TRUST_PROXY = _flag("TRUST_PROXY", "0")

# Sessions (ADR 0009/0013): the 15-minute idle rule is enforced by IdleTimeoutMiddleware and
# only refreshed by requests with `X-User-Activity: 1`. The store lifetime is longer than the
# idle limit on purpose, so an idle session is reported as `session_expired` (not a bare 401).
IDLE_TIMEOUT_SECONDS = 900
SESSION_COOKIE_AGE = 4 * 3600
SESSION_SAVE_EVERY_REQUEST = False
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

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
    "ledger.apps.LedgerConfig",
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
    "ledger.middleware.IdleTimeoutMiddleware",
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

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "django_cache",  # created by migration ledger.0005
    }
}

USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
APPEND_SLASH = False

REST_FRAMEWORK = {
    # Session auth; the permission reads the `auth-required` flag on every request.
    "DEFAULT_AUTHENTICATION_CLASSES": ["ledger.permissions.SessionAuth401"],
    "DEFAULT_PERMISSION_CLASSES": ["ledger.permissions.AuthIfFlagOn"],
    "NUM_PROXIES": 1 if TRUST_PROXY else 0,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "ledger.errors.exception_handler",
    "DEFAULT_THROTTLE_CLASSES": ["ledger.throttles.ScopedUserThrottle"],
    # Keyed by user id when signed in, else client IP. Shared DB cache (all workers).
    "DEFAULT_THROTTLE_RATES": {
        "reads": "300/min",
        "writes": "30/min",
        "sync": "6/min",
        "login_ip": "5/min",
        "login_user": "20/hour",
    },
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
    SESSION_COOKIE_SECURE = _flag("DJANGO_SECURE_COOKIES", "1")
    CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"

# Never log merchant/description text: only ids, codes, counts. Query strings can carry
# search terms (`q=`), so access logs are redacted too (rule 17).
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"redact_query": {"()": "ledger.logging.RedactQueryFilter"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "filters": ["redact_query"]}},
    "loggers": {
        "django.server": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "gunicorn.access": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
    "root": {"handlers": ["console"], "level": os.environ.get("LOG_LEVEL", "INFO")},
}
