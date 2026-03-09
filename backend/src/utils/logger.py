"""
Structured Logging System
=========================
Enterprise-grade logging with structured JSON output for analysis and monitoring.
"""

import logging
import json
import sys
import traceback
from datetime import datetime, timezone
from typing import Any, Optional, Dict
from enum import Enum
from functools import wraps
import time


class LogLevel(Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class StructuredLogger:
    """
    Structured logger that outputs JSON-formatted logs.
    
    Log format:
    {
        "timestamp": "2026-02-20T15:00:00Z",
        "level": "error",
        "module": "InvoiceService",
        "message": "Duplicate invoice number",
        "context": {...},
        "stack": "..."
    }
    """
    
    def __init__(self, module_name: str):
        self.module_name = module_name
        self._logger = logging.getLogger(module_name)
        self._setup_handler()
    
    def _setup_handler(self):
        """Setup JSON handler if not already configured"""
        if not self._logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(StructuredFormatter())
            self._logger.addHandler(handler)
            self._logger.setLevel(logging.DEBUG)
    
    def _log(self, level: LogLevel, message: str, context: Optional[Dict] = None, 
             exc_info: bool = False, stack: Optional[str] = None):
        """Internal log method"""
        extra = {
            "module": self.module_name,
            "context": context or {},
            "stack": stack
        }
        
        log_method = getattr(self._logger, level.value)
        log_method(message, extra=extra, exc_info=exc_info)
    
    def debug(self, message: str, context: Optional[Dict] = None):
        """Debug level log"""
        self._log(LogLevel.DEBUG, message, context)
    
    def info(self, message: str, context: Optional[Dict] = None):
        """Info level log"""
        self._log(LogLevel.INFO, message, context)
    
    def warning(self, message: str, context: Optional[Dict] = None):
        """Warning level log"""
        self._log(LogLevel.WARNING, message, context)
    
    def error(self, message: str, context: Optional[Dict] = None, 
              exc_info: bool = True, stack: Optional[str] = None):
        """Error level log with optional stack trace"""
        if exc_info and not stack:
            stack = traceback.format_exc()
        self._log(LogLevel.ERROR, message, context, exc_info=False, stack=stack)
    
    def critical(self, message: str, context: Optional[Dict] = None,
                 exc_info: bool = True, stack: Optional[str] = None):
        """Critical level log"""
        if exc_info and not stack:
            stack = traceback.format_exc()
        self._log(LogLevel.CRITICAL, message, context, exc_info=False, stack=stack)
    
    def exception(self, message: str, context: Optional[Dict] = None):
        """Log exception with full traceback"""
        self.error(message, context, exc_info=True)


class StructuredFormatter(logging.Formatter):
    """Custom formatter that outputs JSON"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "module": getattr(record, "module", record.name),
            "message": record.getMessage(),
        }
        
        # Add context if present
        context = getattr(record, "context", None)
        if context:
            log_entry["context"] = context
        
        # Add stack trace if present
        stack = getattr(record, "stack", None)
        if stack and stack.strip() and "NoneType" not in stack:
            log_entry["stack"] = stack.strip()
        
        return json.dumps(log_entry)


def log_execution_time(logger: StructuredLogger):
    """Decorator to log function execution time"""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                elapsed = time.time() - start_time
                logger.info(f"{func.__name__} completed", {
                    "function": func.__name__,
                    "execution_time_ms": round(elapsed * 1000, 2)
                })
                return result
            except Exception as e:
                elapsed = time.time() - start_time
                logger.error(f"{func.__name__} failed", {
                    "function": func.__name__,
                    "execution_time_ms": round(elapsed * 1000, 2),
                    "error": str(e)
                })
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                elapsed = time.time() - start_time
                logger.info(f"{func.__name__} completed", {
                    "function": func.__name__,
                    "execution_time_ms": round(elapsed * 1000, 2)
                })
                return result
            except Exception as e:
                elapsed = time.time() - start_time
                logger.error(f"{func.__name__} failed", {
                    "function": func.__name__,
                    "execution_time_ms": round(elapsed * 1000, 2),
                    "error": str(e)
                })
                raise
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


# Factory function for creating loggers
def get_logger(module_name: str) -> StructuredLogger:
    """Get a structured logger for a module"""
    return StructuredLogger(module_name)


# Pre-configured loggers for common modules
class Loggers:
    """Pre-configured logger instances"""
    auth = get_logger("AuthService")
    invoice = get_logger("InvoiceService")
    inventory = get_logger("InventoryService")
    sales = get_logger("SalesService")
    purchase = get_logger("PurchaseService")
    ledger = get_logger("LedgerService")
    user = get_logger("UserService")
    ai_developer = get_logger("AIDeveloperService")
    system = get_logger("SystemService")
