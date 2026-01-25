"""
Structured logging configuration for Krishyak backend
Provides JSON and text logging formats with request tracing
"""
import logging
import sys
import json
from datetime import datetime
from typing import Optional
import os

from dotenv import load_dotenv

load_dotenv()


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields if present
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "user_ip"):
            log_data["user_ip"] = record.user_ip
        if hasattr(record, "endpoint"):
            log_data["endpoint"] = record.endpoint
        if hasattr(record, "duration_ms"):
            log_data["duration_ms"] = record.duration_ms
        if hasattr(record, "status_code"):
            log_data["status_code"] = record.status_code
        
        return json.dumps(log_data, ensure_ascii=False)


class ColoredFormatter(logging.Formatter):
    """Colored formatter for development console output"""
    
    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[41m",  # Red background
    }
    RESET = "\033[0m"
    
    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        record.levelname = f"{color}{record.levelname}{self.RESET}"
        
        # Add request_id if present
        request_id = getattr(record, "request_id", "")
        if request_id:
            record.msg = f"[{request_id[:8]}] {record.msg}"
        
        return super().format(record)


def setup_logging(
    log_level: str = None,
    log_format: str = None,
) -> logging.Logger:
    """
    Configure application logging
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Output format ('json' or 'text')
    
    Returns:
        Configured root logger
    """
    # Get settings from environment if not provided
    if log_level is None:
        log_level = os.getenv("LOG_LEVEL", "INFO")
    if log_format is None:
        log_format = os.getenv("LOG_FORMAT", "text")
    
    environment = os.getenv("ENVIRONMENT", "development")
    
    # Get log level
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    
    # Set formatter based on format preference and environment
    if log_format.lower() == "json" or environment == "production":
        formatter = JSONFormatter()
    else:
        formatter = ColoredFormatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
    
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Configure specific loggers
    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    
    return root_logger


class RequestLogger:
    """Context-aware request logging"""
    
    def __init__(self, logger_name: str = "krishyak"):
        self.logger = logging.getLogger(logger_name)
    
    def log_request(
        self,
        request_id: str,
        method: str,
        path: str,
        user_ip: str,
        extra: dict = None
    ):
        """Log incoming request"""
        extra_data = extra or {}
        self.logger.info(
            f"Request: {method} {path}",
            extra={
                "request_id": request_id,
                "user_ip": user_ip,
                "endpoint": path,
                **extra_data
            }
        )
    
    def log_response(
        self,
        request_id: str,
        status_code: int,
        duration_ms: float,
        path: str = "",
    ):
        """Log outgoing response"""
        level = logging.INFO if status_code < 400 else logging.WARNING if status_code < 500 else logging.ERROR
        
        self.logger.log(
            level,
            f"Response: {status_code} ({duration_ms:.2f}ms)",
            extra={
                "request_id": request_id,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "endpoint": path,
            }
        )
    
    def log_error(
        self,
        request_id: str,
        error: Exception,
        context: str = "",
    ):
        """Log error with context"""
        self.logger.error(
            f"Error: {context} - {str(error)}",
            extra={"request_id": request_id},
            exc_info=True
        )


# Initialize logging on module import
logger = setup_logging()
request_logger = RequestLogger()
