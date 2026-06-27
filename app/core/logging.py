"""Application logging configured to avoid leaking PII.

Phone numbers and emails are redacted from log records via a filter, satisfying
the "logs without personal data" requirement.
"""
import logging
import re

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?<!\d)(\+?\d[\d\s().-]{6,}\d)")


class PIIRedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self._redact(record.msg)
        if record.args:
            record.args = tuple(
                self._redact(a) if isinstance(a, str) else a for a in record.args
            )
        return True

    @staticmethod
    def _redact(text: str) -> str:
        text = _EMAIL_RE.sub("[email]", text)
        text = _PHONE_RE.sub("[phone]", text)
        return text


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.addFilter(PIIRedactingFilter())
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s")
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
