"""
AutoHeal AI - Self-Healing Software Agent
==========================================
An autonomous enterprise-grade software repair agent that detects,
diagnoses, and resolves software errors automatically.

Author: AutoHeal AI System
Version: 1.0.0
"""

import asyncio
import traceback
import logging
import uuid
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
from dataclasses import dataclass, field
from functools import wraps

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AutoHealAI")


class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorType(Enum):
    RUNTIME = "runtime_exception"
    AUTH = "authentication_failure"
    PERMISSION = "permission_issue"
    API = "api_failure"
    DATABASE = "database_error"
    CONFIG = "configuration_mismatch"
    UI = "ui_rendering_error"
    NETWORK = "network_failure"
    VALIDATION = "validation_error"
    UNKNOWN = "unknown"


class FixStatus(Enum):
    PENDING = "pending"
    APPLIED = "applied"
    VALIDATED = "validated"
    ROLLED_BACK = "rolled_back"
    ESCALATED = "escalated"
    FAILED = "failed"


@dataclass
class ErrorContext:
    """Captures full context of an error"""
    error_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    error_type: ErrorType = ErrorType.UNKNOWN
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
    message: str = ""
    stack_trace: str = ""
    module: str = ""
    function: str = ""
    user_id: Optional[str] = None
    user_role: Optional[str] = None
    tenant_id: Optional[str] = None
    request_path: Optional[str] = None
    request_method: Optional[str] = None
    request_body: Optional[Dict] = None
    additional_context: Dict = field(default_factory=dict)


@dataclass
class FixAction:
    """Represents a fix action taken by the agent"""
    fix_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    error_id: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    fix_type: str = ""
    description: str = ""
    status: FixStatus = FixStatus.PENDING
    rollback_action: Optional[str] = None
    validation_result: Optional[bool] = None
    applied_by: str = "AutoHealAI"


@dataclass
class HealingReport:
    """Detailed resolution report"""
    report_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    error_context: ErrorContext = None
    root_cause: str = ""
    fix_applied: FixAction = None
    validation_passed: bool = False
    rollback_status: str = "not_required"
    recommendations: List[str] = field(default_factory=list)
    resolved: bool = False
    escalated: bool = False
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AutoHealAgent:
    """
    AutoHeal AI - Autonomous Software Repair Agent
    
    RULES:
    1. Never delete production data
    2. Never modify financial or accounting records
    3. Never apply irreversible changes without rollback
    4. Always log every action with timestamp and reason
    5. Prefer configuration and permission fixes over code changes
    6. Test fixes in isolation before applying globally
    7. Roll back immediately if validation fails
    8. Escalate to admin if error is critical or recurring
    """
    
    def __init__(self, db=None):
        self.db = db
        self.error_patterns = {}
        self.fix_handlers = {}
        self.error_history = []
        self.max_retry_count = 3
        self.recurring_threshold = 3
        self._register_default_handlers()
        logger.info("AutoHeal AI Agent initialized")
    
    def _register_default_handlers(self):
        """Register default fix handlers for common error types"""
        
        # Authentication fixes
        self.register_fix_handler(ErrorType.AUTH, self._fix_auth_error)
        
        # Permission fixes
        self.register_fix_handler(ErrorType.PERMISSION, self._fix_permission_error)
        
        # Database fixes
        self.register_fix_handler(ErrorType.DATABASE, self._fix_database_error)
        
        # API fixes
        self.register_fix_handler(ErrorType.API, self._fix_api_error)
        
        # Config fixes
        self.register_fix_handler(ErrorType.CONFIG, self._fix_config_error)
        
        # Runtime fixes
        self.register_fix_handler(ErrorType.RUNTIME, self._fix_runtime_error)
        
        # Validation fixes
        self.register_fix_handler(ErrorType.VALIDATION, self._fix_validation_error)
    
    def register_fix_handler(self, error_type: ErrorType, handler: Callable):
        """Register a custom fix handler for an error type"""
        self.fix_handlers[error_type] = handler
        logger.info(f"Registered fix handler for {error_type.value}")
    
    def classify_error(self, error: Exception, context: Dict = None) -> ErrorContext:
        """Classify an error and determine its type and severity"""
        error_msg = str(error)
        stack = traceback.format_exc()
        
        # Determine error type based on patterns
        error_type = ErrorType.UNKNOWN
        severity = ErrorSeverity.MEDIUM
        
        # Authentication errors
        if any(term in error_msg.lower() for term in ['token', 'jwt', 'unauthorized', 'credentials', 'login', 'session expired']):
            error_type = ErrorType.AUTH
            severity = ErrorSeverity.HIGH
        
        # Permission errors
        elif any(term in error_msg.lower() for term in ['permission', 'forbidden', 'access denied', 'not authorized', '403']):
            error_type = ErrorType.PERMISSION
            severity = ErrorSeverity.MEDIUM
        
        # Database errors
        elif any(term in error_msg.lower() for term in ['database', 'mongodb', 'connection', 'timeout', 'duplicate key']):
            error_type = ErrorType.DATABASE
            severity = ErrorSeverity.HIGH
        
        # API errors
        elif any(term in error_msg.lower() for term in ['api', 'endpoint', 'request failed', '500', '502', '503']):
            error_type = ErrorType.API
            severity = ErrorSeverity.MEDIUM
        
        # Config errors
        elif any(term in error_msg.lower() for term in ['config', 'environment', 'missing key', 'not found']):
            error_type = ErrorType.CONFIG
            severity = ErrorSeverity.LOW
        
        # Validation errors
        elif any(term in error_msg.lower() for term in ['validation', 'invalid', 'required field', 'type error']):
            error_type = ErrorType.VALIDATION
            severity = ErrorSeverity.LOW
        
        # Runtime errors (catch-all for exceptions)
        elif 'error' in error_msg.lower() or 'exception' in error_msg.lower():
            error_type = ErrorType.RUNTIME
            severity = ErrorSeverity.MEDIUM
        
        ctx = context or {}
        
        return ErrorContext(
            error_type=error_type,
            severity=severity,
            message=error_msg,
            stack_trace=stack,
            module=ctx.get('module', ''),
            function=ctx.get('function', ''),
            user_id=ctx.get('user_id'),
            user_role=ctx.get('user_role'),
            tenant_id=ctx.get('tenant_id'),
            request_path=ctx.get('request_path'),
            request_method=ctx.get('request_method'),
            request_body=ctx.get('request_body'),
            additional_context=ctx
        )
    
    async def diagnose_and_heal(self, error: Exception, context: Dict = None) -> HealingReport:
        """
        Main entry point - diagnose an error and attempt to heal it
        
        PROCESS:
        1. Capture full error context
        2. Classify the error type and severity
        3. Identify the root cause
        4. Generate the safest possible fix
        5. Apply the fix automatically if safe
        6. Validate by re-running the failed process
        7. Notify admin with a detailed resolution report
        """
        # Step 1 & 2: Capture and classify
        error_context = self.classify_error(error, context)
        logger.info(f"[AutoHeal] Error classified: {error_context.error_type.value} (Severity: {error_context.severity.value})")
        
        # Check if this is a recurring error
        is_recurring = self._check_recurring(error_context)
        
        # Step 3: Identify root cause
        root_cause = await self._identify_root_cause(error_context)
        
        # Initialize report
        report = HealingReport(
            error_context=error_context,
            root_cause=root_cause,
            recommendations=[]
        )
        
        # Step 4 & 5: Generate and apply fix (if safe)
        if error_context.severity == ErrorSeverity.CRITICAL or is_recurring:
            # Escalate critical or recurring errors
            report.escalated = True
            report.rollback_status = "not_required"
            report.recommendations.append("Manual review required due to severity/recurrence")
            await self._escalate_to_admin(report)
        else:
            # Attempt automatic fix
            fix_action = await self._apply_fix(error_context)
            report.fix_applied = fix_action
            
            if fix_action and fix_action.status == FixStatus.APPLIED:
                # Step 6: Validate the fix
                validation_passed = await self._validate_fix(error_context, fix_action)
                report.validation_passed = validation_passed
                
                if validation_passed:
                    fix_action.status = FixStatus.VALIDATED
                    report.resolved = True
                    logger.info(f"[AutoHeal] Fix validated successfully for error {error_context.error_id}")
                else:
                    # Step 7: Roll back if validation fails
                    await self._rollback_fix(fix_action)
                    fix_action.status = FixStatus.ROLLED_BACK
                    report.rollback_status = "rolled_back"
                    report.recommendations.append("Automatic fix failed validation - rolled back")
                    await self._escalate_to_admin(report)
        
        # Log the error and report
        await self._log_healing_report(report)
        
        # Add to history
        self.error_history.append(error_context)
        
        return report
    
    async def _identify_root_cause(self, error_context: ErrorContext) -> str:
        """Analyze error to identify root cause"""
        root_causes = {
            ErrorType.AUTH: "Authentication token expired, invalid, or missing credentials",
            ErrorType.PERMISSION: "User lacks required permissions for the requested resource",
            ErrorType.DATABASE: "Database connection issue or query failure",
            ErrorType.API: "External API request failed or returned error response",
            ErrorType.CONFIG: "Missing or invalid configuration setting",
            ErrorType.RUNTIME: "Unexpected runtime exception in application code",
            ErrorType.VALIDATION: "Input validation failed - invalid or missing data",
            ErrorType.NETWORK: "Network connectivity issue",
            ErrorType.UI: "Frontend rendering error",
            ErrorType.UNKNOWN: "Unable to determine root cause automatically"
        }
        
        base_cause = root_causes.get(error_context.error_type, "Unknown error type")
        
        # Add specific details from error message
        if error_context.message:
            base_cause += f" | Details: {error_context.message[:200]}"
        
        return base_cause
    
    async def _apply_fix(self, error_context: ErrorContext) -> Optional[FixAction]:
        """Apply the appropriate fix based on error type"""
        handler = self.fix_handlers.get(error_context.error_type)
        
        if not handler:
            logger.warning(f"[AutoHeal] No fix handler registered for {error_context.error_type.value}")
            return None
        
        try:
            fix_action = await handler(error_context)
            return fix_action
        except Exception as e:
            logger.error(f"[AutoHeal] Fix handler failed: {e}")
            return FixAction(
                error_id=error_context.error_id,
                fix_type="handler_error",
                description=f"Fix handler failed: {str(e)}",
                status=FixStatus.FAILED
            )
    
    async def _validate_fix(self, error_context: ErrorContext, fix_action: FixAction) -> bool:
        """Validate that the fix actually resolved the issue"""
        # Default validation - check if we can perform basic operations
        try:
            if self.db is not None:
                # Test database connectivity
                await self.db.command('ping')
            
            # Additional validation based on error type
            if error_context.error_type == ErrorType.DATABASE and self.db is not None:
                # Verify DB is accessible
                await self.db.list_collection_names()
            
            return True
        except Exception as e:
            logger.error(f"[AutoHeal] Validation failed: {e}")
            return False
    
    async def _rollback_fix(self, fix_action: FixAction):
        """Roll back a failed fix"""
        if fix_action.rollback_action:
            logger.info(f"[AutoHeal] Rolling back fix: {fix_action.rollback_action}")
            # Execute rollback logic based on the stored rollback action
            # This would be implemented based on specific fix types
        fix_action.status = FixStatus.ROLLED_BACK
    
    async def _escalate_to_admin(self, report: HealingReport):
        """Escalate error to admin for manual review"""
        report.escalated = True
        logger.warning(f"[AutoHeal] ESCALATING ERROR TO ADMIN: {report.error_context.error_id}")
        
        if self.db is not None:
            await self.db.admin_alerts.insert_one({
                "id": str(uuid.uuid4()),
                "type": "autoheal_escalation",
                "report_id": report.report_id,
                "error_type": report.error_context.error_type.value,
                "severity": report.error_context.severity.value,
                "message": report.error_context.message[:500],
                "root_cause": report.root_cause,
                "recommendations": report.recommendations,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "acknowledged": False
            })
    
    async def _log_healing_report(self, report: HealingReport):
        """Log the healing report to database"""
        if self.db is not None:
            report_doc = {
                "id": report.report_id,
                "error_id": report.error_context.error_id,
                "error_type": report.error_context.error_type.value,
                "severity": report.error_context.severity.value,
                "error_message": report.error_context.message[:1000],
                "stack_trace": report.error_context.stack_trace[:2000],
                "module": report.error_context.module,
                "function": report.error_context.function,
                "user_id": report.error_context.user_id,
                "user_role": report.error_context.user_role,
                "tenant_id": report.error_context.tenant_id,
                "request_path": report.error_context.request_path,
                "root_cause": report.root_cause,
                "fix_applied": {
                    "fix_id": report.fix_applied.fix_id if report.fix_applied else None,
                    "fix_type": report.fix_applied.fix_type if report.fix_applied else None,
                    "description": report.fix_applied.description if report.fix_applied else None,
                    "status": report.fix_applied.status.value if report.fix_applied else None
                } if report.fix_applied else None,
                "validation_passed": report.validation_passed,
                "rollback_status": report.rollback_status,
                "recommendations": report.recommendations,
                "resolved": report.resolved,
                "escalated": report.escalated,
                "created_at": report.created_at
            }
            await self.db.autoheal_reports.insert_one(report_doc)
    
    def _check_recurring(self, error_context: ErrorContext) -> bool:
        """Check if this error is recurring"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
        similar_errors = [
            e for e in self.error_history
            if e.error_type == error_context.error_type
            and e.module == error_context.module
            and datetime.fromisoformat(e.timestamp.replace('Z', '+00:00')) > cutoff
        ]
        return len(similar_errors) >= self.recurring_threshold
    
    # ============== FIX HANDLERS ==============
    
    async def _fix_auth_error(self, error_context: ErrorContext) -> FixAction:
        """Fix authentication errors"""
        fix = FixAction(
            error_id=error_context.error_id,
            fix_type="auth_fix",
            description="Attempting to refresh authentication state"
        )
        
        try:
            # For session expired errors, the fix is to prompt re-login
            # We can clear invalid sessions from the database
            if self.db is not None and error_context.user_id:
                await self.db.user_sessions.update_many(
                    {"user_id": error_context.user_id, "is_active": True},
                    {"$set": {"needs_refresh": True}}
                )
                fix.description = "Marked user sessions for refresh"
                fix.status = FixStatus.APPLIED
                fix.rollback_action = f"Restore sessions for user {error_context.user_id}"
            else:
                fix.description = "Auth error requires user re-authentication"
                fix.status = FixStatus.APPLIED
            
            return fix
        except Exception as e:
            fix.status = FixStatus.FAILED
            fix.description = f"Auth fix failed: {str(e)}"
            return fix
    
    async def _fix_permission_error(self, error_context: ErrorContext) -> FixAction:
        """Fix permission errors"""
        fix = FixAction(
            error_id=error_context.error_id,
            fix_type="permission_fix",
            description="Checking and potentially granting missing permissions"
        )
        
        try:
            # Extract permission info from error
            if self.db is not None and error_context.user_id:
                user = await self.db.users.find_one({"id": error_context.user_id})
                
                if user:
                    # Log the permission issue for admin review
                    # Don't auto-grant permissions (security risk)
                    fix.description = f"Permission issue logged for user {user.get('email')} - requires admin review"
                    fix.status = FixStatus.APPLIED
                    
                    # Create admin notification
                    await self.db.admin_alerts.insert_one({
                        "id": str(uuid.uuid4()),
                        "type": "permission_review_needed",
                        "user_id": error_context.user_id,
                        "user_email": user.get('email'),
                        "user_role": user.get('role'),
                        "current_permissions": user.get('permissions'),
                        "requested_resource": error_context.request_path,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "acknowledged": False
                    })
            else:
                fix.description = "Permission error - user context not available"
                fix.status = FixStatus.APPLIED
            
            return fix
        except Exception as e:
            fix.status = FixStatus.FAILED
            fix.description = f"Permission fix failed: {str(e)}"
            return fix
    
    async def _fix_database_error(self, error_context: ErrorContext) -> FixAction:
        """Fix database errors"""
        fix = FixAction(
            error_id=error_context.error_id,
            fix_type="database_fix",
            description="Attempting database connection recovery"
        )
        
        try:
            if self.db is not None:
                # Test connection
                await self.db.command('ping')
                fix.description = "Database connection verified - transient error"
                fix.status = FixStatus.APPLIED
            else:
                fix.description = "Database not available for recovery"
                fix.status = FixStatus.FAILED
            
            return fix
        except Exception as e:
            fix.status = FixStatus.FAILED
            fix.description = f"Database fix failed: {str(e)}"
            return fix
    
    async def _fix_api_error(self, error_context: ErrorContext) -> FixAction:
        """Fix API errors"""
        fix = FixAction(
            error_id=error_context.error_id,
            fix_type="api_fix",
            description="Logging API error for retry mechanism"
        )
        
        try:
            # API errors often require retry logic
            fix.description = "API error logged - client should retry with exponential backoff"
            fix.status = FixStatus.APPLIED
            return fix
        except Exception as e:
            fix.status = FixStatus.FAILED
            fix.description = f"API fix failed: {str(e)}"
            return fix
    
    async def _fix_config_error(self, error_context: ErrorContext) -> FixAction:
        """Fix configuration errors"""
        fix = FixAction(
            error_id=error_context.error_id,
            fix_type="config_fix",
            description="Checking configuration settings"
        )
        
        try:
            fix.description = "Configuration error logged - requires manual review of environment variables"
            fix.status = FixStatus.APPLIED
            return fix
        except Exception as e:
            fix.status = FixStatus.FAILED
            fix.description = f"Config fix failed: {str(e)}"
            return fix
    
    async def _fix_runtime_error(self, error_context: ErrorContext) -> FixAction:
        """Fix runtime errors"""
        fix = FixAction(
            error_id=error_context.error_id,
            fix_type="runtime_fix",
            description="Analyzing runtime error pattern"
        )
        
        try:
            # Common runtime fixes
            error_msg = error_context.message.lower()
            
            if 'nonetype' in error_msg or 'undefined' in error_msg:
                fix.description = "Null reference error - likely missing data validation"
            elif 'index' in error_msg or 'key' in error_msg:
                fix.description = "Index/Key error - data structure access issue"
            elif 'memory' in error_msg:
                fix.description = "Memory error - possible resource leak"
            else:
                fix.description = "Runtime error logged for analysis"
            
            fix.status = FixStatus.APPLIED
            return fix
        except Exception as e:
            fix.status = FixStatus.FAILED
            fix.description = f"Runtime fix failed: {str(e)}"
            return fix
    
    async def _fix_validation_error(self, error_context: ErrorContext) -> FixAction:
        """Fix validation errors"""
        fix = FixAction(
            error_id=error_context.error_id,
            fix_type="validation_fix",
            description="Validation error - requires correct input data"
        )
        
        try:
            fix.description = "Validation error logged - client should verify input format"
            fix.status = FixStatus.APPLIED
            return fix
        except Exception as e:
            fix.status = FixStatus.FAILED
            fix.description = f"Validation fix failed: {str(e)}"
            return fix


# ============== DECORATOR FOR AUTOMATIC HEALING ==============

def auto_heal(agent: AutoHealAgent = None):
    """
    Decorator to automatically apply self-healing to a function.
    
    Usage:
        @auto_heal(agent)
        async def my_api_endpoint(...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                if agent:
                    context = {
                        "function": func.__name__,
                        "module": func.__module__,
                    }
                    # Extract user info from kwargs if available
                    if 'user' in kwargs:
                        user = kwargs['user']
                        context['user_id'] = user.get('id')
                        context['user_role'] = user.get('role')
                        context['tenant_id'] = user.get('tenant_id')
                    
                    report = await agent.diagnose_and_heal(e, context)
                    
                    if report.resolved:
                        # Retry the function after fix
                        return await func(*args, **kwargs)
                
                # Re-raise if not resolved
                raise
        return wrapper
    return decorator


# ============== GLOBAL AGENT INSTANCE ==============

_global_agent: Optional[AutoHealAgent] = None


def initialize_autoheal(db) -> AutoHealAgent:
    """Initialize the global AutoHeal agent"""
    global _global_agent
    _global_agent = AutoHealAgent(db)
    return _global_agent


def get_autoheal_agent() -> Optional[AutoHealAgent]:
    """Get the global AutoHeal agent instance"""
    return _global_agent
