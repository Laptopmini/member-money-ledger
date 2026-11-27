import logging
import re

_QUERY = re.compile(r"\?\S*")


class RedactQueryFilter(logging.Filter):
    """Replace `?query` in log messages (django.server / gunicorn.access request lines)."""

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name not in ("django.server", "gunicorn.access"):
            return True
        message = record.getMessage()
        if "?" in message:
            record.msg = _QUERY.sub("?[redacted]", message)
            record.args = ()
        return True
