"""Private access logging for the local Werkzeug development server.

WSGI servers and reverse proxies have independent access logs. Their deployment
configuration must omit sensitive request targets and Referer values as well.
"""

import logging
import re
from urllib.parse import unquote, urlsplit

from werkzeug.serving import WSGIRequestHandler

_REQUEST_LINE = re.compile(r"\b([A-Z]+) (\S+) (HTTP/\d(?:\.\d)?)\b", re.IGNORECASE)


def redacted_request_target(target):
    """Log the route without URL queries or password-reset bearer tokens."""
    if not isinstance(target, str):
        return "[invalid-target]"
    try:
        path = unquote(
            target.split("?", 1)[0].split("#", 1)[0]
            if target.startswith("/")
            else urlsplit(target).path
        )
    except (TypeError, ValueError):
        return "[invalid-target]"
    if "/redefinir-senha/" in path.casefold():
        return "/redefinir-senha/[redacted]"
    # Access log lines must not accept decoded control characters.
    return (
        "".join(
            f"\\x{ord(character):02x}"
            if ord(character) < 32 or 127 <= ord(character) < 160
            else character
            for character in path
        )
        or "/"
    )


class SafeRequestHandler(WSGIRequestHandler):
    """Keep dispatch targets intact and redact only the access-log message."""

    def log_request(self, code="-", size="-"):
        # Never fall back to raw requestline, which can contain private targets.
        method = getattr(self, "command", "REQUEST")
        version = getattr(self, "request_version", "")
        target = redacted_request_target(getattr(self, "path", None))
        self.log("info", '"%s %s %s" %s %s', method, target, version, code, size)


class _PrivateRequestFilter(logging.Filter):
    def filter(self, record):
        try:
            message = record.getMessage()
        except (TypeError, ValueError):
            record.msg, record.args = "werkzeug.log.invalid-format", ()
            return True
        message, replacements = _REQUEST_LINE.subn(
            lambda match: f"{match[1]} {redacted_request_target(match[2])} {match[3]}",
            message,
        )
        # Malformed request logs may lack a complete method/HTTP request line.
        # Such records must not fall back to logging a raw recovery URL.
        if not replacements and "/redefinir-senha/" in unquote(message).casefold():
            message = "werkzeug.private_request [redacted]"
        record.msg, record.args = message, ()
        return True


def install_werkzeug_redaction():
    """Also protect Flask CLI/default Werkzeug handlers in this process."""
    logger = logging.getLogger("werkzeug")
    if not any(isinstance(item, _PrivateRequestFilter) for item in logger.filters):
        logger.addFilter(_PrivateRequestFilter())
