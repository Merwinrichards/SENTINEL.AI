import logging
import sys


class CustomFormatter(logging.Formatter):
    """Clean structured log formatter with ISO timestamps and module names."""

    FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s"
    DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

    def __init__(self) -> None:
        super().__init__(fmt=self.FORMAT, datefmt=self.DATE_FORMAT)


def setup_logging(log_level: str = "INFO") -> None:
    """Configure root and application loggers."""
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Remove existing handlers to avoid duplicates
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(CustomFormatter())

    root_logger.addHandler(console_handler)

    # Set levels for third party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("websockets").setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> logging.Logger:
    """Get a named application logger."""
    return logging.getLogger(name or "sentinel")
