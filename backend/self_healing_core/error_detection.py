"""
Error Detection Engine
======================
Centralized logging, error fingerprinting, and pattern detection.
Creates unique identifiers for errors to prevent duplicates and enable tracking.
"""

import hashlib
import re
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ErrorDetectionEngine")


class ErrorSeverity(Enum):
    """Error severity levels"""
    CRITICAL = "critical"  # System down, data loss risk
    HIGH = "high"          # Major functionality broken
    MEDIUM = "medium"      # Feature degraded
    LOW = "low"            # Minor issue, workaround exists
    INFO = "info"          # Informational, not an error


class ErrorCategory(Enum):
    """High-level error categories"""
    RUNTIME = "runtime"
    SYNTAX = "syntax"
    DATABASE = "database"
    NETWORK = "network"
    SECURITY = "security"
    PERFORMANCE = "performance"
    CONFIGURATION = "configuration"
    DEPENDENCY = "dependency"
    BUSINESS_LOGIC = "business_logic"
    USER_INPUT = "user_input"
    INFRASTRUCTURE = "infrastructure"
    UNKNOWN = "unknown"


class ErrorSource(Enum):
    """Where the error originated"""
    BACKEND = "backend"
    FRONTEND = "frontend"
    DATABASE = "database"
    EXTERNAL_API = "external_api"
    SCHEDULER = "scheduler"
    WEBSOCKET = "websocket"
    USER_REPORTED = "user_reported"
    MONITORING = "monitoring"


@dataclass
class ErrorFingerprint:
    """
    Unique identifier for an error based on its characteristics.
    Used to group similar errors and prevent duplicate notifications.
    """
    fingerprint_id: str = ""
    error_type: str = ""
    error_category: ErrorCategory = ErrorCategory.UNKNOWN
    normalized_message: str = ""
    file_signature: str = ""  # file:function:line pattern
    stack_signature: str = ""  # Hash of key stack frames
    
    def __post_init__(self):
        if not self.fingerprint_id:
            # Generate fingerprint from components
            components = [
                self.error_type,
                self.error_category.value,
                self.normalized_message[:100],
                self.file_signature,
                self.stack_signature
            ]
            combined = "|".join(str(c) for c in components if c)
            self.fingerprint_id = hashlib.md5(combined.encode()).hexdigest()


@dataclass
class ErrorPattern:
    """
    A detected error pattern for learning and auto-fix matching.
    """
    pattern_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    fingerprint: Optional[ErrorFingerprint] = None
    regex_pattern: str = ""
    error_category: ErrorCategory = ErrorCategory.UNKNOWN
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
    occurrence_count: int = 0
    first_seen: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_seen: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    auto_fix_available: bool = False
    fix_confidence: float = 0.0
    fix_id: Optional[str] = None
    is_recurring: bool = False
    affected_modules: List[str] = field(default_factory=list)
    

@dataclass
class DetectedError:
    """
    A detected error with full context and fingerprint.
    """
    error_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    fingerprint: Optional[ErrorFingerprint] = None
    error_type: str = ""
    error_message: str = ""
    error_category: ErrorCategory = ErrorCategory.UNKNOWN
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
    source: ErrorSource = ErrorSource.BACKEND
    
    # Location info
    file_path: Optional[str] = None
    function_name: Optional[str] = None
    line_number: Optional[int] = None
    column_number: Optional[int] = None
    
    # Context
    stack_trace: Optional[str] = None
    request_context: Optional[Dict[str, Any]] = None
    user_context: Optional[Dict[str, Any]] = None
    environment_context: Optional[Dict[str, Any]] = None
    
    # Metadata
    detected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    occurrence_count: int = 1
    last_occurrence: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    # Status
    status: str = "detected"  # detected, analyzing, fixing, fixed, failed, ignored
    assigned_agent: Optional[str] = None
    fix_attempts: int = 0
    resolution: Optional[str] = None
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    
    # Pattern matching
    matched_pattern_id: Optional[str] = None
    is_new_pattern: bool = False


# Patterns for error categorization
ERROR_CATEGORIZATION_PATTERNS = {
    ErrorCategory.SYNTAX: [
        (r"SyntaxError", ErrorSeverity.HIGH),
        (r"IndentationError", ErrorSeverity.HIGH),
        (r"ParseError", ErrorSeverity.HIGH),
        (r"Unexpected token", ErrorSeverity.HIGH),
        (r"Invalid syntax", ErrorSeverity.HIGH),
    ],
    ErrorCategory.RUNTIME: [
        (r"TypeError", ErrorSeverity.MEDIUM),
        (r"ValueError", ErrorSeverity.MEDIUM),
        (r"KeyError", ErrorSeverity.MEDIUM),
        (r"AttributeError", ErrorSeverity.MEDIUM),
        (r"NameError", ErrorSeverity.MEDIUM),
        (r"IndexError", ErrorSeverity.MEDIUM),
        (r"RuntimeError", ErrorSeverity.HIGH),
        (r"Exception", ErrorSeverity.MEDIUM),
    ],
    ErrorCategory.DATABASE: [
        (r"ServerSelectionTimeoutError", ErrorSeverity.CRITICAL),
        (r"ConnectionFailure", ErrorSeverity.CRITICAL),
        (r"DuplicateKeyError", ErrorSeverity.MEDIUM),
        (r"OperationFailure", ErrorSeverity.HIGH),
        (r"pymongo\.errors", ErrorSeverity.HIGH),
        (r"database.*connection", ErrorSeverity.CRITICAL),
    ],
    ErrorCategory.NETWORK: [
        (r"ECONNREFUSED", ErrorSeverity.HIGH),
        (r"ETIMEDOUT", ErrorSeverity.MEDIUM),
        (r"ENOTFOUND", ErrorSeverity.HIGH),
        (r"NetworkError", ErrorSeverity.MEDIUM),
        (r"ConnectionError", ErrorSeverity.HIGH),
        (r"TimeoutError", ErrorSeverity.MEDIUM),
    ],
    ErrorCategory.SECURITY: [
        (r"AuthenticationError", ErrorSeverity.HIGH),
        (r"AuthorizationError", ErrorSeverity.HIGH),
        (r"PermissionDenied", ErrorSeverity.HIGH),
        (r"401.*Unauthorized", ErrorSeverity.HIGH),
        (r"403.*Forbidden", ErrorSeverity.HIGH),
        (r"CSRF.*token", ErrorSeverity.HIGH),
    ],
    ErrorCategory.PERFORMANCE: [
        (r"MemoryError", ErrorSeverity.CRITICAL),
        (r"out of memory", ErrorSeverity.CRITICAL),
        (r"heap.*memory", ErrorSeverity.CRITICAL),
        (r"CPU.*usage.*high", ErrorSeverity.HIGH),
        (r"response.*slow", ErrorSeverity.MEDIUM),
    ],
    ErrorCategory.DEPENDENCY: [
        (r"ModuleNotFoundError", ErrorSeverity.HIGH),
        (r"ImportError", ErrorSeverity.HIGH),
        (r"Cannot find module", ErrorSeverity.HIGH),
        (r"Module not found", ErrorSeverity.HIGH),
        (r"peer dependency", ErrorSeverity.MEDIUM),
    ],
    ErrorCategory.CONFIGURATION: [
        (r"ConfigError", ErrorSeverity.HIGH),
        (r"Environment variable.*not found", ErrorSeverity.HIGH),
        (r"Invalid configuration", ErrorSeverity.HIGH),
        (r"Missing.*config", ErrorSeverity.HIGH),
    ],
}


class ErrorDetectionEngine:
    """
    Central error detection engine with fingerprinting and pattern detection.
    
    Features:
    - Error normalization and deduplication
    - Fingerprint generation for grouping similar errors
    - Pattern detection for recurring issues
    - Real-time error feed
    - Error categorization and severity assessment
    """
    
    def __init__(self, db=None):
        self.db = db
        self.error_buffer: List[DetectedError] = []
        self.pattern_cache: Dict[str, ErrorPattern] = {}
        self.fingerprint_cache: Dict[str, ErrorFingerprint] = {}
        self.max_buffer_size = 1000
        self.dedup_window_minutes = 5  # Deduplicate same errors within this window
        
        # Collections
        if db is not None:
            self.errors_collection = db.detected_errors
            self.patterns_collection = db.error_patterns
            self.fingerprints_collection = db.error_fingerprints
        
        logger.info("ErrorDetectionEngine initialized")
    
    def normalize_error_message(self, message: str) -> str:
        """
        Normalize error message by removing variable content.
        This helps in grouping similar errors together.
        """
        normalized = message
        
        # Remove line numbers
        normalized = re.sub(r'line \d+', 'line N', normalized)
        
        # Remove file paths but keep filename
        normalized = re.sub(r'(/[\w\-./]+/)([^/\s]+)', r'<path>/\2', normalized)
        
        # Remove UUIDs
        normalized = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<uuid>', normalized, flags=re.I)
        
        # Remove ObjectIds
        normalized = re.sub(r'ObjectId\([\'"][0-9a-f]{24}[\'"]\)', 'ObjectId(<id>)', normalized)
        
        # Remove timestamps
        normalized = re.sub(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}', '<timestamp>', normalized)
        
        # Remove IP addresses
        normalized = re.sub(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', '<ip>', normalized)
        
        # Remove port numbers
        normalized = re.sub(r':\d{2,5}(?!\d)', ':<port>', normalized)
        
        # Remove memory addresses
        normalized = re.sub(r'0x[0-9a-f]+', '<addr>', normalized, flags=re.I)
        
        return normalized.strip()
    
    def extract_stack_signature(self, stack_trace: Optional[str]) -> str:
        """
        Extract a signature from stack trace for fingerprinting.
        Focuses on the first few frames which are usually most relevant.
        """
        if not stack_trace:
            return ""
        
        # Extract file:function patterns from stack
        frame_pattern = r'File ["\']([^"\']+)["\'], line \d+, in (\w+)'
        frames = re.findall(frame_pattern, stack_trace)
        
        # Take first 3 unique frames
        unique_frames = []
        seen = set()
        for file_path, func_name in frames[:5]:
            key = f"{file_path}:{func_name}"
            if key not in seen:
                seen.add(key)
                # Get just filename
                filename = file_path.split('/')[-1]
                unique_frames.append(f"{filename}:{func_name}")
                if len(unique_frames) >= 3:
                    break
        
        signature = "->".join(unique_frames)
        return hashlib.md5(signature.encode()).hexdigest()[:12]
    
    def categorize_error(self, error_type: str, error_message: str) -> Tuple[ErrorCategory, ErrorSeverity]:
        """
        Categorize an error based on type and message patterns.
        """
        combined = f"{error_type} {error_message}".lower()
        
        for category, patterns in ERROR_CATEGORIZATION_PATTERNS.items():
            for pattern, severity in patterns:
                if re.search(pattern.lower(), combined):
                    return category, severity
        
        return ErrorCategory.UNKNOWN, ErrorSeverity.MEDIUM
    
    def generate_fingerprint(self, error_type: str, error_message: str,
                            file_path: Optional[str] = None,
                            function_name: Optional[str] = None,
                            line_number: Optional[int] = None,
                            stack_trace: Optional[str] = None) -> ErrorFingerprint:
        """
        Generate a unique fingerprint for an error.
        """
        category, _ = self.categorize_error(error_type, error_message)
        normalized_msg = self.normalize_error_message(error_message)
        
        # Create file signature
        file_sig = ""
        if file_path:
            filename = file_path.split('/')[-1]
            file_sig = f"{filename}"
            if function_name:
                file_sig += f":{function_name}"
            if line_number:
                file_sig += f":L{line_number // 10 * 10}"  # Round to nearest 10
        
        stack_sig = self.extract_stack_signature(stack_trace)
        
        fingerprint = ErrorFingerprint(
            error_type=error_type,
            error_category=category,
            normalized_message=normalized_msg[:100],
            file_signature=file_sig,
            stack_signature=stack_sig
        )
        
        return fingerprint
    
    async def detect_error(
        self,
        error_type: str,
        error_message: str,
        source: ErrorSource = ErrorSource.BACKEND,
        file_path: Optional[str] = None,
        function_name: Optional[str] = None,
        line_number: Optional[int] = None,
        column_number: Optional[int] = None,
        stack_trace: Optional[str] = None,
        request_context: Optional[Dict] = None,
        user_context: Optional[Dict] = None,
        environment_context: Optional[Dict] = None
    ) -> DetectedError:
        """
        Process a new error detection.
        Returns the detected error with fingerprint and pattern matching.
        """
        # Generate fingerprint
        fingerprint = self.generate_fingerprint(
            error_type, error_message, file_path,
            function_name, line_number, stack_trace
        )
        
        # Check for duplicate in window
        existing = await self._check_duplicate(fingerprint)
        if existing:
            # Update existing error
            existing.occurrence_count += 1
            existing.last_occurrence = datetime.now(timezone.utc).isoformat()
            await self._update_error(existing)
            logger.debug(f"Duplicate error detected: {fingerprint.fingerprint_id}")
            return existing
        
        # Get category and severity
        category, severity = self.categorize_error(error_type, error_message)
        
        # Create new detected error
        detected = DetectedError(
            fingerprint=fingerprint,
            error_type=error_type,
            error_message=error_message,
            error_category=category,
            severity=severity,
            source=source,
            file_path=file_path,
            function_name=function_name,
            line_number=line_number,
            column_number=column_number,
            stack_trace=stack_trace,
            request_context=request_context,
            user_context=user_context,
            environment_context=environment_context
        )
        
        # Check for matching pattern
        pattern = await self._match_pattern(fingerprint)
        if pattern:
            detected.matched_pattern_id = pattern.pattern_id
            detected.is_new_pattern = False
            pattern.occurrence_count += 1
            pattern.last_seen = datetime.now(timezone.utc).isoformat()
            await self._update_pattern(pattern)
        else:
            detected.is_new_pattern = True
            # Create new pattern
            new_pattern = ErrorPattern(
                fingerprint=fingerprint,
                error_category=category,
                severity=severity,
                occurrence_count=1,
                affected_modules=[file_path] if file_path else []
            )
            await self._store_pattern(new_pattern)
            detected.matched_pattern_id = new_pattern.pattern_id
        
        # Store error
        await self._store_error(detected)
        
        # Add to buffer
        self.error_buffer.insert(0, detected)
        if len(self.error_buffer) > self.max_buffer_size:
            self.error_buffer = self.error_buffer[:self.max_buffer_size]
        
        logger.info(f"[ErrorDetection] New error: [{severity.value}] {error_type} - {error_message[:100]}")
        
        return detected
    
    async def _check_duplicate(self, fingerprint: ErrorFingerprint) -> Optional[DetectedError]:
        """Check if this error was recently detected"""
        if self.db is None:
            return None
        
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=self.dedup_window_minutes)).isoformat()
        
        result = await self.errors_collection.find_one({
            "fingerprint.fingerprint_id": fingerprint.fingerprint_id,
            "detected_at": {"$gte": cutoff},
            "status": {"$ne": "fixed"}
        })
        
        if result:
            result.pop("_id", None)
            return DetectedError(
                error_id=result["error_id"],
                error_type=result["error_type"],
                error_message=result["error_message"],
                occurrence_count=result.get("occurrence_count", 1),
                last_occurrence=result.get("last_occurrence"),
                status=result.get("status", "detected")
            )
        
        return None
    
    async def _match_pattern(self, fingerprint: ErrorFingerprint) -> Optional[ErrorPattern]:
        """Match fingerprint against known patterns"""
        # Check cache first
        if fingerprint.fingerprint_id in self.pattern_cache:
            return self.pattern_cache[fingerprint.fingerprint_id]
        
        if self.db is None:
            return None
        
        result = await self.patterns_collection.find_one({
            "fingerprint.fingerprint_id": fingerprint.fingerprint_id
        })
        
        if result:
            result.pop("_id", None)
            pattern = ErrorPattern(
                pattern_id=result["pattern_id"],
                error_category=ErrorCategory(result.get("error_category", "unknown")),
                severity=ErrorSeverity(result.get("severity", "medium")),
                occurrence_count=result.get("occurrence_count", 0),
                first_seen=result.get("first_seen"),
                last_seen=result.get("last_seen"),
                auto_fix_available=result.get("auto_fix_available", False),
                fix_confidence=result.get("fix_confidence", 0.0),
                fix_id=result.get("fix_id"),
                is_recurring=result.get("is_recurring", False)
            )
            self.pattern_cache[fingerprint.fingerprint_id] = pattern
            return pattern
        
        return None
    
    async def _store_error(self, error: DetectedError):
        """Store error in database"""
        if self.db is None:
            return
        
        doc = {
            "error_id": error.error_id,
            "fingerprint": {
                "fingerprint_id": error.fingerprint.fingerprint_id,
                "error_type": error.fingerprint.error_type,
                "error_category": error.fingerprint.error_category.value,
                "normalized_message": error.fingerprint.normalized_message,
                "file_signature": error.fingerprint.file_signature,
                "stack_signature": error.fingerprint.stack_signature
            } if error.fingerprint else None,
            "error_type": error.error_type,
            "error_message": error.error_message[:2000],
            "error_category": error.error_category.value,
            "severity": error.severity.value,
            "source": error.source.value,
            "file_path": error.file_path,
            "function_name": error.function_name,
            "line_number": error.line_number,
            "column_number": error.column_number,
            "stack_trace": error.stack_trace[:5000] if error.stack_trace else None,
            "request_context": error.request_context,
            "user_context": error.user_context,
            "environment_context": error.environment_context,
            "detected_at": error.detected_at,
            "occurrence_count": error.occurrence_count,
            "last_occurrence": error.last_occurrence,
            "status": error.status,
            "assigned_agent": error.assigned_agent,
            "fix_attempts": error.fix_attempts,
            "resolution": error.resolution,
            "resolved_at": error.resolved_at,
            "resolved_by": error.resolved_by,
            "matched_pattern_id": error.matched_pattern_id,
            "is_new_pattern": error.is_new_pattern
        }
        
        await self.errors_collection.insert_one(doc)
    
    async def _update_error(self, error: DetectedError):
        """Update existing error"""
        if self.db is None:
            return
        
        await self.errors_collection.update_one(
            {"error_id": error.error_id},
            {"$set": {
                "occurrence_count": error.occurrence_count,
                "last_occurrence": error.last_occurrence,
                "status": error.status
            }}
        )
    
    async def _store_pattern(self, pattern: ErrorPattern):
        """Store new pattern"""
        if self.db is None:
            return
        
        doc = {
            "pattern_id": pattern.pattern_id,
            "fingerprint": {
                "fingerprint_id": pattern.fingerprint.fingerprint_id,
                "error_type": pattern.fingerprint.error_type,
                "error_category": pattern.fingerprint.error_category.value,
                "normalized_message": pattern.fingerprint.normalized_message,
                "file_signature": pattern.fingerprint.file_signature,
                "stack_signature": pattern.fingerprint.stack_signature
            } if pattern.fingerprint else None,
            "error_category": pattern.error_category.value,
            "severity": pattern.severity.value,
            "occurrence_count": pattern.occurrence_count,
            "first_seen": pattern.first_seen,
            "last_seen": pattern.last_seen,
            "auto_fix_available": pattern.auto_fix_available,
            "fix_confidence": pattern.fix_confidence,
            "fix_id": pattern.fix_id,
            "is_recurring": pattern.is_recurring,
            "affected_modules": pattern.affected_modules
        }
        
        await self.patterns_collection.insert_one(doc)
    
    async def _update_pattern(self, pattern: ErrorPattern):
        """Update existing pattern"""
        if self.db is None:
            return
        
        # Mark as recurring if seen more than threshold
        if pattern.occurrence_count >= 3:
            pattern.is_recurring = True
        
        await self.patterns_collection.update_one(
            {"pattern_id": pattern.pattern_id},
            {"$set": {
                "occurrence_count": pattern.occurrence_count,
                "last_seen": pattern.last_seen,
                "is_recurring": pattern.is_recurring
            }}
        )
    
    async def get_recent_errors(self, limit: int = 50, 
                                severity: Optional[str] = None,
                                category: Optional[str] = None,
                                status: Optional[str] = None) -> List[Dict]:
        """Get recent errors with optional filters"""
        if self.db is None:
            return [self._error_to_dict(e) for e in self.error_buffer[:limit]]
        
        query = {}
        if severity:
            query["severity"] = severity
        if category:
            query["error_category"] = category
        if status:
            query["status"] = status
        
        cursor = self.errors_collection.find(query, {"_id": 0}).sort("detected_at", -1).limit(limit)
        return await cursor.to_list(limit)
    
    async def get_recurring_patterns(self, min_occurrences: int = 3) -> List[Dict]:
        """Get recurring error patterns"""
        if self.db is None:
            return []
        
        cursor = self.patterns_collection.find(
            {"occurrence_count": {"$gte": min_occurrences}},
            {"_id": 0}
        ).sort("occurrence_count", -1)
        
        return await cursor.to_list(100)
    
    async def get_error_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get error statistics for dashboard"""
        if self.db is None:
            return {
                "total": 0,
                "by_severity": {},
                "by_category": {},
                "by_source": {},
                "fix_rate": 0
            }
        
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        pipeline = [
            {"$match": {"detected_at": {"$gte": since}}},
            {"$facet": {
                "by_severity": [
                    {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
                ],
                "by_category": [
                    {"$group": {"_id": "$error_category", "count": {"$sum": 1}}}
                ],
                "by_source": [
                    {"$group": {"_id": "$source", "count": {"$sum": 1}}}
                ],
                "total": [{"$count": "count"}],
                "fixed": [
                    {"$match": {"status": "fixed"}},
                    {"$count": "count"}
                ]
            }}
        ]
        
        results = await self.errors_collection.aggregate(pipeline).to_list(1)
        
        if not results:
            return {"total": 0, "by_severity": {}, "by_category": {}, "by_source": {}, "fix_rate": 0}
        
        data = results[0]
        total = data["total"][0]["count"] if data["total"] else 0
        fixed = data["fixed"][0]["count"] if data["fixed"] else 0
        
        return {
            "total": total,
            "fixed": fixed,
            "fix_rate": round((fixed / max(total, 1)) * 100, 1),
            "by_severity": {r["_id"]: r["count"] for r in data["by_severity"]},
            "by_category": {r["_id"]: r["count"] for r in data["by_category"]},
            "by_source": {r["_id"]: r["count"] for r in data["by_source"]}
        }
    
    def _error_to_dict(self, error: DetectedError) -> Dict:
        """Convert DetectedError to dict"""
        return {
            "error_id": error.error_id,
            "error_type": error.error_type,
            "error_message": error.error_message,
            "error_category": error.error_category.value,
            "severity": error.severity.value,
            "source": error.source.value,
            "file_path": error.file_path,
            "line_number": error.line_number,
            "status": error.status,
            "detected_at": error.detected_at,
            "occurrence_count": error.occurrence_count
        }
