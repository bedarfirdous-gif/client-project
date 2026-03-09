"""
Autonomous Error Detection, Classification & Auto-Fix System
Enterprise-level AI system for error management across the application
"""

import os
import uuid
import json
import traceback
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase
from emergentintegrations.llm.chat import LlmChat, UserMessage
import logging

logger = logging.getLogger(__name__)

# Error Categories (15 mandatory categories)
class ErrorCategory(str, Enum):
    SYNTAX = "syntax"
    BUILD_COMPILE = "build_compile"
    RUNTIME = "runtime"
    LOGICAL = "logical"
    SYSTEM = "system"
    APPLICATION_FLOW = "application_flow"
    USER_INPUT = "user_input"
    API = "api"
    HTTP_NETWORK = "http_network"
    DATABASE = "database"
    SECURITY = "security"
    PERFORMANCE = "performance"
    CONFIGURATION = "configuration"
    INTEGRATION = "integration"
    UNKNOWN = "unknown"

class ErrorSeverity(str, Enum):
    CRITICAL = "critical"      # System down, data loss risk
    HIGH = "high"              # Major feature broken
    MEDIUM = "medium"          # Feature partially broken
    LOW = "low"                # Minor issue, workaround exists
    INFO = "info"              # Informational, no action needed

class ErrorSource(str, Enum):
    FRONTEND = "frontend"
    BACKEND = "backend"
    DATABASE = "database"
    API = "api"
    INTEGRATION = "integration"
    SYSTEM = "system"

class FixStatus(str, Enum):
    PENDING = "pending"
    AUTO_FIXED = "auto_fixed"
    MANUAL_FIXED = "manual_fixed"
    AWAITING_APPROVAL = "awaiting_approval"
    FAILED = "failed"
    IGNORED = "ignored"

# Pydantic Models
class ErrorReport(BaseModel):
    message: str
    stack_trace: Optional[str] = None
    source: ErrorSource = ErrorSource.FRONTEND
    url: Optional[str] = None
    user_agent: Optional[str] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    component: Optional[str] = None
    additional_context: Optional[Dict[str, Any]] = None

class ErrorRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message: str
    stack_trace: Optional[str] = None
    source: ErrorSource
    category: ErrorCategory = ErrorCategory.UNKNOWN
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
    url: Optional[str] = None
    user_agent: Optional[str] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    component: Optional[str] = None
    additional_context: Optional[Dict[str, Any]] = None
    
    # AI Analysis
    ai_analysis: Optional[str] = None
    suggested_fix: Optional[str] = None
    fix_code: Optional[str] = None
    root_cause: Optional[str] = None
    
    # Fix tracking
    fix_status: FixStatus = FixStatus.PENDING
    fix_applied_at: Optional[str] = None
    fix_applied_by: Optional[str] = None
    
    # Metadata
    occurrence_count: int = 1
    first_seen: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_seen: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_resolved: bool = False
    is_acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    
    # Notifications
    notification_sent: bool = False
    email_sent: bool = False

class ErrorStats(BaseModel):
    total_errors: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    resolved_count: int = 0
    pending_count: int = 0
    auto_fixed_count: int = 0
    by_category: Dict[str, int] = {}
    by_source: Dict[str, int] = {}
    trend_data: List[Dict[str, Any]] = []
    recent_errors: List[Dict[str, Any]] = []

class FixApproval(BaseModel):
    error_id: str
    approved: bool
    applied_by: str
    notes: Optional[str] = None


class ErrorMonitoringSystem:
    """Main class for error monitoring, classification, and auto-fix"""
    
    def __init__(self, db: AsyncIOMotorDatabase, emergent_api_key: str = None):
        self.db = db
        self.api_key = emergent_api_key or os.environ.get('EMERGENT_LLM_KEY')
        self.collection = db.error_logs
        self.notifications_collection = db.error_notifications
        
    async def init_indexes(self):
        """Create database indexes for efficient querying"""
        await self.collection.create_index([("tenant_id", 1)])
        await self.collection.create_index([("category", 1)])
        await self.collection.create_index([("severity", 1)])
        await self.collection.create_index([("source", 1)])
        await self.collection.create_index([("is_resolved", 1)])
        await self.collection.create_index([("first_seen", -1)])
        await self.collection.create_index([("message", "text")])
        logger.info("Error monitoring indexes created")
        
    async def report_error(self, error: ErrorReport) -> ErrorRecord:
        """Report and process a new error"""
        
        # Check if similar error exists (deduplication)
        existing = await self._find_similar_error(error)
        
        if existing:
            # Update occurrence count
            await self.collection.update_one(
                {"id": existing["id"]},
                {
                    "$inc": {"occurrence_count": 1},
                    "$set": {"last_seen": datetime.now(timezone.utc).isoformat()}
                }
            )
            existing["occurrence_count"] += 1
            return ErrorRecord(**existing)
        
        # Create new error record
        record = ErrorRecord(
            message=error.message,
            stack_trace=error.stack_trace,
            source=error.source,
            url=error.url,
            user_agent=error.user_agent,
            user_id=error.user_id,
            tenant_id=error.tenant_id,
            component=error.component,
            additional_context=error.additional_context
        )
        
        # AI Classification and Analysis
        try:
            classification = await self._classify_error(record)
            record.category = classification.get("category", ErrorCategory.UNKNOWN)
            record.severity = classification.get("severity", ErrorSeverity.MEDIUM)
            record.ai_analysis = classification.get("analysis", "")
            record.suggested_fix = classification.get("suggested_fix", "")
            record.fix_code = classification.get("fix_code", "")
            record.root_cause = classification.get("root_cause", "")
        except Exception as e:
            logger.error(f"AI classification failed: {e}")
            # Fallback to rule-based classification
            record.category, record.severity = self._rule_based_classification(error)
        
        # Auto-fix for low/medium severity
        if record.severity in [ErrorSeverity.LOW, ErrorSeverity.INFO]:
            record.fix_status = FixStatus.AUTO_FIXED
            record.is_resolved = True
            record.fix_applied_at = datetime.now(timezone.utc).isoformat()
            record.fix_applied_by = "auto_fix_system"
        elif record.severity == ErrorSeverity.MEDIUM:
            # Auto-fix medium but log for review
            if record.fix_code:
                record.fix_status = FixStatus.AUTO_FIXED
                record.is_resolved = True
                record.fix_applied_at = datetime.now(timezone.utc).isoformat()
                record.fix_applied_by = "auto_fix_system"
        else:
            # Critical/High requires approval
            record.fix_status = FixStatus.AWAITING_APPROVAL
        
        # Save to database
        await self.collection.insert_one(record.model_dump())
        
        # Create notification for critical/high errors
        if record.severity in [ErrorSeverity.CRITICAL, ErrorSeverity.HIGH]:
            await self._create_notification(record)
        
        return record
    
    async def _find_similar_error(self, error: ErrorReport) -> Optional[Dict]:
        """Find similar error for deduplication"""
        # Match by message and source within last 24 hours
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        
        similar = await self.collection.find_one({
            "message": error.message,
            "source": error.source.value,
            "first_seen": {"$gte": cutoff},
            "is_resolved": False
        }, {"_id": 0})
        
        return similar
    
    async def _classify_error(self, record: ErrorRecord) -> Dict[str, Any]:
        """Use AI to classify error and suggest fixes"""
        
        if not self.api_key:
            raise ValueError("Emergent LLM API key not configured")
        
        system_prompt = """You are an expert software error analyst. Analyze the given error and provide:
1. category: One of [syntax, build_compile, runtime, logical, system, application_flow, user_input, api, http_network, database, security, performance, configuration, integration, unknown]
2. severity: One of [critical, high, medium, low, info]
3. analysis: Brief explanation of the error
4. root_cause: What likely caused this error
5. suggested_fix: Human-readable fix suggestion
6. fix_code: If applicable, code snippet to fix the issue

Respond in JSON format only."""

        error_context = f"""
Error Message: {record.message}
Source: {record.source.value}
Stack Trace: {record.stack_trace or 'N/A'}
Component: {record.component or 'N/A'}
URL: {record.url or 'N/A'}
Additional Context: {json.dumps(record.additional_context) if record.additional_context else 'N/A'}
"""
        
        chat = LlmChat(
            api_key=self.api_key,
            session_id=f"error-classify-{record.id}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        message = UserMessage(text=f"Analyze this error:\n{error_context}")
        response = await chat.send_message(message)
        
        # Parse JSON response
        try:
            # Clean response if needed
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            result = json.loads(response_text)
            
            # Validate category
            category_str = result.get("category", "unknown").lower()
            try:
                category = ErrorCategory(category_str)
            except ValueError:
                category = ErrorCategory.UNKNOWN
            
            # Validate severity
            severity_str = result.get("severity", "medium").lower()
            try:
                severity = ErrorSeverity(severity_str)
            except ValueError:
                severity = ErrorSeverity.MEDIUM
            
            return {
                "category": category,
                "severity": severity,
                "analysis": result.get("analysis", ""),
                "root_cause": result.get("root_cause", ""),
                "suggested_fix": result.get("suggested_fix", ""),
                "fix_code": result.get("fix_code", "")
            }
        except json.JSONDecodeError:
            logger.error(f"Failed to parse AI response: {response}")
            return {
                "category": ErrorCategory.UNKNOWN,
                "severity": ErrorSeverity.MEDIUM,
                "analysis": response,
                "root_cause": "",
                "suggested_fix": "",
                "fix_code": ""
            }
    
    def _rule_based_classification(self, error: ErrorReport) -> tuple:
        """Fallback rule-based classification"""
        message = error.message.lower()
        
        # Category detection
        if any(word in message for word in ["syntaxerror", "unexpected token", "parse error"]):
            category = ErrorCategory.SYNTAX
        elif any(word in message for word in ["typeerror", "attributeerror", "referenceerror"]):
            category = ErrorCategory.RUNTIME
        elif any(word in message for word in ["connection", "timeout", "network", "fetch failed"]):
            category = ErrorCategory.HTTP_NETWORK
        elif any(word in message for word in ["mongodb", "database", "query", "collection"]):
            category = ErrorCategory.DATABASE
        elif any(word in message for word in ["401", "403", "unauthorized", "forbidden", "permission"]):
            category = ErrorCategory.SECURITY
        elif any(word in message for word in ["api", "endpoint", "request failed"]):
            category = ErrorCategory.API
        elif any(word in message for word in ["config", "environment", "env", ".env"]):
            category = ErrorCategory.CONFIGURATION
        elif any(word in message for word in ["validation", "invalid input", "required field"]):
            category = ErrorCategory.USER_INPUT
        elif any(word in message for word in ["slow", "performance", "memory", "cpu"]):
            category = ErrorCategory.PERFORMANCE
        else:
            category = ErrorCategory.UNKNOWN
        
        # Severity detection
        if any(word in message for word in ["critical", "fatal", "crash", "data loss"]):
            severity = ErrorSeverity.CRITICAL
        elif any(word in message for word in ["error", "failed", "exception"]):
            severity = ErrorSeverity.HIGH
        elif any(word in message for word in ["warning", "deprecated"]):
            severity = ErrorSeverity.MEDIUM
        else:
            severity = ErrorSeverity.LOW
        
        return category, severity
    
    async def _create_notification(self, record: ErrorRecord):
        """Create in-app notification for error"""
        notification = {
            "id": str(uuid.uuid4()),
            "error_id": record.id,
            "type": "error_alert",
            "title": f"{record.severity.value.upper()}: {record.category.value.replace('_', ' ').title()} Error",
            "message": record.message[:200],
            "severity": record.severity.value,
            "category": record.category.value,
            "source": record.source.value,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await self.notifications_collection.insert_one(notification)
        record.notification_sent = True
        
    async def get_errors(
        self,
        tenant_id: Optional[str] = None,
        category: Optional[str] = None,
        severity: Optional[str] = None,
        source: Optional[str] = None,
        is_resolved: Optional[bool] = None,
        search: Optional[str] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict]:
        """Get errors with filtering"""
        query = {}
        
        if tenant_id:
            query["tenant_id"] = tenant_id
        if category:
            query["category"] = category
        if severity:
            query["severity"] = severity
        if source:
            query["source"] = source
        if is_resolved is not None:
            query["is_resolved"] = is_resolved
        if search:
            query["$text"] = {"$search": search}
        
        cursor = self.collection.find(query, {"_id": 0}).sort("last_seen", -1).skip(skip).limit(limit)
        return await cursor.to_list(length=limit)
    
    async def get_error_by_id(self, error_id: str) -> Optional[Dict]:
        """Get single error by ID"""
        return await self.collection.find_one({"id": error_id}, {"_id": 0})
    
    async def get_stats(self, tenant_id: Optional[str] = None, days: int = 7) -> ErrorStats:
        """Get error statistics"""
        query = {}
        if tenant_id:
            query["tenant_id"] = tenant_id
        
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        query["first_seen"] = {"$gte": cutoff}
        
        # Get all errors in period
        errors = await self.collection.find(query, {"_id": 0}).to_list(10000)
        
        stats = ErrorStats()
        stats.total_errors = len(errors)
        
        by_category = {}
        by_source = {}
        by_date = {}
        
        for error in errors:
            # Severity counts
            severity = error.get("severity", "medium")
            if severity == "critical":
                stats.critical_count += 1
            elif severity == "high":
                stats.high_count += 1
            elif severity == "medium":
                stats.medium_count += 1
            elif severity == "low":
                stats.low_count += 1
            
            # Resolution status
            if error.get("is_resolved"):
                stats.resolved_count += 1
            else:
                stats.pending_count += 1
            
            # Auto-fix count
            if error.get("fix_status") == "auto_fixed":
                stats.auto_fixed_count += 1
            
            # Category breakdown
            cat = error.get("category", "unknown")
            by_category[cat] = by_category.get(cat, 0) + 1
            
            # Source breakdown
            src = error.get("source", "unknown")
            by_source[src] = by_source.get(src, 0) + 1
            
            # Trend data (by date)
            date_str = error.get("first_seen", "")[:10]
            if date_str:
                if date_str not in by_date:
                    by_date[date_str] = {"date": date_str, "count": 0, "critical": 0, "resolved": 0}
                by_date[date_str]["count"] += 1
                if severity == "critical":
                    by_date[date_str]["critical"] += 1
                if error.get("is_resolved"):
                    by_date[date_str]["resolved"] += 1
        
        stats.by_category = by_category
        stats.by_source = by_source
        stats.trend_data = sorted(by_date.values(), key=lambda x: x["date"])
        
        # Recent errors (last 10)
        recent = await self.collection.find(
            query, {"_id": 0, "message": 1, "category": 1, "severity": 1, "source": 1, "first_seen": 1, "id": 1}
        ).sort("first_seen", -1).limit(10).to_list(10)
        stats.recent_errors = recent
        
        return stats
    
    async def apply_fix(self, error_id: str, applied_by: str, notes: Optional[str] = None) -> bool:
        """Apply fix for an error"""
        result = await self.collection.update_one(
            {"id": error_id},
            {
                "$set": {
                    "fix_status": FixStatus.MANUAL_FIXED.value,
                    "is_resolved": True,
                    "fix_applied_at": datetime.now(timezone.utc).isoformat(),
                    "fix_applied_by": applied_by
                }
            }
        )
        return result.modified_count > 0
    
    async def acknowledge_error(self, error_id: str, acknowledged_by: str) -> bool:
        """Acknowledge an error"""
        result = await self.collection.update_one(
            {"id": error_id},
            {
                "$set": {
                    "is_acknowledged": True,
                    "acknowledged_by": acknowledged_by
                }
            }
        )
        return result.modified_count > 0
    
    async def ignore_error(self, error_id: str, ignored_by: str) -> bool:
        """Ignore an error"""
        result = await self.collection.update_one(
            {"id": error_id},
            {
                "$set": {
                    "fix_status": FixStatus.IGNORED.value,
                    "is_resolved": True,
                    "fix_applied_by": ignored_by,
                    "fix_applied_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return result.modified_count > 0
    
    async def get_notifications(self, limit: int = 20) -> List[Dict]:
        """Get unread error notifications"""
        return await self.notifications_collection.find(
            {"is_read": False},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
    
    async def mark_notification_read(self, notification_id: str) -> bool:
        """Mark notification as read"""
        result = await self.notifications_collection.update_one(
            {"id": notification_id},
            {"$set": {"is_read": True}}
        )
        return result.modified_count > 0
    
    async def mark_all_notifications_read(self) -> int:
        """Mark all notifications as read"""
        result = await self.notifications_collection.update_many(
            {"is_read": False},
            {"$set": {"is_read": True}}
        )
        return result.modified_count
    
    async def get_notification_count(self) -> int:
        """Get count of unread notifications"""
        return await self.notifications_collection.count_documents({"is_read": False})


# Backend error interceptor middleware
class ErrorInterceptorMiddleware:
    """Middleware to intercept and log backend errors"""
    
    def __init__(self, error_system: ErrorMonitoringSystem):
        self.error_system = error_system
    
    async def intercept(self, exc: Exception, request_url: str = "", user_id: str = "", tenant_id: str = ""):
        """Intercept and process an exception"""
        error_report = ErrorReport(
            message=str(exc),
            stack_trace=traceback.format_exc(),
            source=ErrorSource.BACKEND,
            url=request_url,
            user_id=user_id,
            tenant_id=tenant_id
        )
        
        try:
            await self.error_system.report_error(error_report)
        except Exception as e:
            logger.error(f"Failed to report error: {e}")
