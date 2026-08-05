"""
Structured JSON logging with file rotation.
"""

import logging
import logging.handlers
import sys
from pathlib import Path

import json


class JSONFormatter(logging.Formatter):
    """Emit log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "funcName": record.funcName,
            "lineno": record.lineno,
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def setup_logging(log_level: str = "INFO", log_file: str = "logs/patentai.log") -> None:
    """Configure root logger with console + rotating file handlers."""
    level = getattr(logging, log_level.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Remove any existing handlers
    root_logger.handlers.clear()

    # ── Console Handler (human-readable in dev) ───────────────────────────────
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_fmt = logging.Formatter(
        "%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console_handler.setFormatter(console_fmt)
    root_logger.addHandler(console_handler)

    # ── File Handler (JSON, rotating) ─────────────────────────────────────────
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    file_handler = logging.handlers.RotatingFileHandler(
        log_path,
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(file_handler)

    # Silence noisy third-party loggers
    for noisy in ("httpx", "httpcore", "urllib3", "multipart"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger("patentai").info("Logging initialized at level %s", log_level)
