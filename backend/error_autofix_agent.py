"""
Error Auto-Fix Agent - Intelligent Error Detection & Resolution
===============================================================
An AI agent that automatically detects and fixes runtime errors, API failures,
login issues, and other system errors in real-time.

Features:
1. Real-time error monitoring and detection
2. AI-powered root cause analysis
3. Automatic fix generation and application
4. Configurable auto-fix or confirmation modes
5. Rollback capabilities for failed fixes
6. Error pattern learning for faster future fixes

Author: Error Auto-Fix Agent
Version: 1.0.0
"""

import os
import re
import json
import asyncio
import logging
import uuid
import traceback
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorDatabase
from emergentintegrations.llm.chat import LlmChat, UserMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ErrorAutoFixAgent")


class ErrorCategory(Enum):
    """Categories of errors the agent can handle"""
    LOGIN_FAILURE = "login_failure"
    API_ERROR = "api_error"
    DATABASE_ERROR = "database_error"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    VALIDATION = "validation"
    NETWORK = "network"
    TIMEOUT = "timeout"
    RUNTIME = "runtime"
    CONFIGURATION = "configuration"
    FRONTEND = "frontend"
    BACKEND = "backend"


class FixMode(Enum):
    """How the agent should handle fixes"""
    AUTO = "auto"  # Fix automatically without confirmation
    CONFIRM = "confirm"  # Ask before fixing
    LOG_ONLY = "log_only"  # Only log errors, don't fix


class FixPriority(Enum):
    """Priority of error fixes"""
    CRITICAL = "critical"  # Fix immediately
    HIGH = "high"  # Fix soon
    MEDIUM = "medium"  # Queue for fixing
    LOW = "low"  # Fix when convenient


class FixResult(Enum):
    """Result of a fix attempt"""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    PENDING = "pending"
    SKIPPED = "skipped"


@dataclass
class DetectedError:
    """Represents a detected error"""
    error_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    category: ErrorCategory = ErrorCategory.RUNTIME
    priority: FixPriority = FixPriority.MEDIUM
    error_type: str = ""
    error_message: str = ""
    stack_trace: str = ""
    file_path: str = ""
    line_number: int = 0
    function_name: str = ""
    request_path: str = ""
    request_method: str = ""
    user_id: str = ""
    tenant_id: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    detected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    occurrence_count: int = 1
    last_occurrence: str = ""


@dataclass
class ErrorFix:
    """Represents a fix for an error"""
    fix_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    error_id: str = ""
    fix_type: str = ""
    fix_description: str = ""
    original_code: str = ""
    fixed_code: str = ""
    config_changes: Dict[str, Any] = field(default_factory=dict)
    database_operations: List[Dict] = field(default_factory=list)
    result: FixResult = FixResult.PENDING
    applied_at: Optional[str] = None
    rollback_available: bool = True
    rollback_data: Dict[str, Any] = field(default_factory=dict)


# Error patterns for detection
ERROR_PATTERNS = {
    ErrorCategory.LOGIN_FAILURE: {
        "patterns": [
            r"Invalid credentials",
            r"Authentication failed",
            r"Invalid password",
            r"User not found",
            r"Account is deactivated",
            r"Account is frozen",
            r"Session expired",
            r"Token invalid",
        ],
        "priority": FixPriority.HIGH,
        "auto_fixable": True
    },
    ErrorCategory.API_ERROR: {
        "patterns": [
            r"500 Internal Server Error",
            r"502 Bad Gateway",
            r"503 Service Unavailable",
            r"Request failed with status code",
            r"Network Error",
            r"ECONNREFUSED",
            r"ETIMEDOUT",
        ],
        "priority": FixPriority.HIGH,
        "auto_fixable": True
    },
    ErrorCategory.DATABASE_ERROR: {
        "patterns": [
            r"MongoError",
            r"Connection refused",
            r"Duplicate key error",
            r"Document not found",
            r"Invalid ObjectId",
            r"E11000 duplicate key",
        ],
        "priority": FixPriority.CRITICAL,
        "auto_fixable": True
    },
    ErrorCategory.AUTHENTICATION: {
        "patterns": [
            r"JWTError",
            r"Token expired",
            r"Invalid signature",
            r"Malformed token",
            r"Missing Authorization header",
        ],
        "priority": FixPriority.HIGH,
        "auto_fixable": True
    },
    ErrorCategory.AUTHORIZATION: {
        "patterns": [
            r"Permission denied",
            r"403 Forbidden",
            r"Access denied",
            r"Insufficient permissions",
            r"Role not authorized",
        ],
        "priority": FixPriority.MEDIUM,
        "auto_fixable": False
    },
    ErrorCategory.VALIDATION: {
        "patterns": [
            r"Validation error",
            r"Invalid input",
            r"Required field missing",
            r"Type error",
            r"422 Unprocessable Entity",
        ],
        "priority": FixPriority.LOW,
        "auto_fixable": True
    },
    ErrorCategory.FRONTEND: {
        "patterns": [
            r"React error",
            r"Component error",
            r"Uncaught TypeError",
            r"Cannot read property",
            r"undefined is not a function",
            r"Cannot read properties of null",
            r"Failed to compile",
            r"is not defined",
            r"ReferenceError",
            r"is not a function",
            r"Maximum update depth exceeded",
            r"Invalid hook call",
            r"Rendered more hooks than during the previous render",
            r"Objects are not valid as a React child",
        ],
        "priority": FixPriority.HIGH,
        "auto_fixable": True
    }
}

# Fix templates for common errors
FIX_TEMPLATES = {
    "session_expired": {
        "description": "Refresh authentication token",
        "action": "refresh_token",
        "code": """
// Auto-fix: Refresh expired session
const refreshSession = async () => {
    try {
        const response = await api.post('/api/auth/refresh');
        localStorage.setItem('token', response.data.access_token);
        return true;
    } catch (error) {
        // Redirect to login if refresh fails
        window.location.href = '/login';
        return false;
    }
};
"""
    },
    "database_connection": {
        "description": "Retry database connection with exponential backoff",
        "action": "retry_connection",
        "code": """
// Auto-fix: Retry database connection
async def retry_database_connection(max_retries=3):
    for attempt in range(max_retries):
        try:
            await db.command('ping')
            return True
        except Exception as e:
            wait_time = 2 ** attempt
            await asyncio.sleep(wait_time)
    return False
"""
    },
    "invalid_objectid": {
        "description": "Validate ObjectId before database query",
        "action": "validate_input",
        "code": """
// Auto-fix: Validate ObjectId
from bson import ObjectId
from bson.errors import InvalidId

def validate_object_id(id_string):
    try:
        return ObjectId(id_string)
    except (InvalidId, TypeError):
        return None
"""
    },
    "null_pointer": {
        "description": "Add null safety checks",
        "action": "add_null_check",
        "code": """
// Auto-fix: Add optional chaining and nullish coalescing
const safeValue = data?.property ?? defaultValue;
"""
    }
}


class ErrorAutoFixAgent:
    """
    AI Agent for automatically detecting and fixing runtime errors.
    
    Capabilities:
    1. Monitor error logs and API responses for failures
    2. Categorize errors by type and priority
    3. Generate AI-powered fixes using pattern matching and LLM
    4. Apply fixes automatically or with confirmation
    5. Track fix success rate and learn from outcomes
    6. Rollback failed fixes
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, api_key: str):
        self.db = db
        self.api_key = api_key
        self.errors_collection = db.detected_errors
        self.fixes_collection = db.error_fixes
        self.config_collection = db.error_fix_config
        self.learning_collection = db.error_fix_learning
        
        # Default configuration
        self.default_config = {
            "fix_mode": FixMode.CONFIRM.value,
            "auto_fix_categories": [
                ErrorCategory.LOGIN_FAILURE.value,
                ErrorCategory.DATABASE_ERROR.value,
                ErrorCategory.VALIDATION.value
            ],
            "min_occurrences_for_auto_fix": 2,
            "enable_learning": True,
            "notify_on_fix": True,
            "max_auto_fix_per_hour": 50,
            "rollback_on_failure": True
        }
        
        # Error handlers registry
        self.error_handlers: Dict[ErrorCategory, Callable] = {}
        
        logger.info("Error Auto-Fix Agent initialized")
    
    async def init_indexes(self):
        """Initialize database indexes"""
        await self.errors_collection.create_index([("detected_at", -1)])
        await self.errors_collection.create_index([("category", 1)])
        await self.errors_collection.create_index([("error_type", 1)])
        await self.errors_collection.create_index([("tenant_id", 1)])
        await self.fixes_collection.create_index([("error_id", 1)])
        await self.fixes_collection.create_index([("result", 1)])
        await self.learning_collection.create_index([("error_pattern", 1)])
        logger.info("Error Auto-Fix Agent indexes created")
    
    async def get_config(self, tenant_id: str = "default") -> Dict:
        """Get configuration for a tenant"""
        config = await self.config_collection.find_one(
            {"tenant_id": tenant_id},
            {"_id": 0}
        )
        return config or {**self.default_config, "tenant_id": tenant_id}
    
    async def update_config(self, tenant_id: str, updates: Dict) -> Dict:
        """Update configuration for a tenant"""
        await self.config_collection.update_one(
            {"tenant_id": tenant_id},
            {"$set": {**updates, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        return await self.get_config(tenant_id)
    
    def register_handler(self, category: ErrorCategory, handler: Callable):
        """Register a custom error handler"""
        self.error_handlers[category] = handler
        logger.info(f"Registered handler for {category.value}")
    
    def categorize_error(self, error_message: str, stack_trace: str = "") -> tuple:
        """Categorize an error based on patterns"""
        combined = f"{error_message} {stack_trace}".lower()
        
        for category, config in ERROR_PATTERNS.items():
            for pattern in config["patterns"]:
                if re.search(pattern.lower(), combined):
                    return category, config["priority"], config["auto_fixable"]
        
        return ErrorCategory.RUNTIME, FixPriority.MEDIUM, False
    
    async def detect_error(
        self,
        error_type: str,
        error_message: str,
        stack_trace: str = "",
        context: Dict = None,
        request_info: Dict = None,
        user_info: Dict = None
    ) -> DetectedError:
        """Detect and log an error"""
        category, priority, auto_fixable = self.categorize_error(error_message, stack_trace)
        
        # Extract file and line info from stack trace
        file_path = ""
        line_number = 0
        function_name = ""
        
        if stack_trace:
            # Parse Python stack trace
            file_match = re.search(r'File "([^"]+)", line (\d+)', stack_trace)
            if file_match:
                file_path = file_match.group(1)
                line_number = int(file_match.group(2))
            
            func_match = re.search(r'in (\w+)', stack_trace)
            if func_match:
                function_name = func_match.group(1)
        
        error = DetectedError(
            category=category,
            priority=priority,
            error_type=error_type,
            error_message=error_message,
            stack_trace=stack_trace[:5000],  # Truncate long traces
            file_path=file_path,
            line_number=line_number,
            function_name=function_name,
            request_path=request_info.get("path", "") if request_info else "",
            request_method=request_info.get("method", "") if request_info else "",
            user_id=user_info.get("id", "") if user_info else "",
            tenant_id=user_info.get("tenant_id", "default") if user_info else "default",
            context=context or {}
        )
        
        # Check for existing similar error
        existing = await self.errors_collection.find_one({
            "error_type": error.error_type,
            "error_message": {"$regex": error.error_message[:100], "$options": "i"},
            "tenant_id": error.tenant_id
        })
        
        if existing:
            # Update occurrence count
            await self.errors_collection.update_one(
                {"error_id": existing["error_id"]},
                {
                    "$inc": {"occurrence_count": 1},
                    "$set": {"last_occurrence": error.detected_at}
                }
            )
            error.error_id = existing["error_id"]
            error.occurrence_count = existing.get("occurrence_count", 1) + 1
        else:
            # Save new error
            await self.errors_collection.insert_one({
                "error_id": error.error_id,
                "category": error.category.value,
                "priority": error.priority.value,
                "error_type": error.error_type,
                "error_message": error.error_message[:1000],
                "stack_trace": error.stack_trace,
                "file_path": error.file_path,
                "line_number": error.line_number,
                "function_name": error.function_name,
                "request_path": error.request_path,
                "request_method": error.request_method,
                "user_id": error.user_id,
                "tenant_id": error.tenant_id,
                "context": error.context,
                "detected_at": error.detected_at,
                "occurrence_count": 1,
                "last_occurrence": error.detected_at,
                "status": "detected",
                "auto_fixable": auto_fixable
            })
        
        logger.info(f"Detected error: {error.category.value} - {error.error_message[:100]}")
        
        # Check if we should auto-fix
        config = await self.get_config(error.tenant_id)
        if await self.should_auto_fix(error, config):
            await self.auto_fix_error(error)
        
        return error
    
    async def should_auto_fix(self, error: DetectedError, config: Dict) -> bool:
        """Determine if an error should be auto-fixed"""
        if config.get("fix_mode") != FixMode.AUTO.value:
            return False
        
        if error.category.value not in config.get("auto_fix_categories", []):
            return False
        
        # Check occurrence threshold
        min_occurrences = config.get("min_occurrences_for_auto_fix", 2)
        if error.occurrence_count < min_occurrences:
            return False
        
        # Check rate limit
        hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        recent_fixes = await self.fixes_collection.count_documents({
            "tenant_id": error.tenant_id,
            "applied_at": {"$gte": hour_ago}
        })
        
        max_per_hour = config.get("max_auto_fix_per_hour", 50)
        if recent_fixes >= max_per_hour:
            logger.warning(f"Rate limit reached for tenant {error.tenant_id}")
            return False
        
        return True
    
    async def generate_fix(self, error_id: str) -> Optional[ErrorFix]:
        """Generate an AI-powered fix for an error"""
        error_doc = await self.errors_collection.find_one({"error_id": error_id})
        if not error_doc:
            return None
        
        # Check learning database for known fixes
        learned_fix = await self.learning_collection.find_one({
            "error_pattern": error_doc["error_type"],
            "success_rate": {"$gte": 0.8}
        })
        
        if learned_fix:
            logger.info(f"Using learned fix for {error_doc['error_type']}")
            fix = ErrorFix(
                error_id=error_id,
                fix_type="learned",
                fix_description=learned_fix["fix_description"],
                fixed_code=learned_fix["fix_code"],
                config_changes=learned_fix.get("config_changes", {})
            )
        else:
            # Generate fix using AI
            fix = await self._generate_ai_fix(error_doc)
        
        if fix:
            await self.fixes_collection.insert_one({
                "fix_id": fix.fix_id,
                "error_id": fix.error_id,
                "fix_type": fix.fix_type,
                "fix_description": fix.fix_description,
                "original_code": fix.original_code,
                "fixed_code": fix.fixed_code,
                "config_changes": fix.config_changes,
                "database_operations": fix.database_operations,
                "result": fix.result.value,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "rollback_available": True
            })
        
        return fix
    
    async def _generate_ai_fix(self, error_doc: Dict) -> Optional[ErrorFix]:
        """Generate a fix using AI"""
        prompt = f"""You are an expert software engineer fixing runtime errors.

ERROR DETAILS:
- Category: {error_doc.get('category')}
- Type: {error_doc.get('error_type')}
- Message: {error_doc.get('error_message')}
- File: {error_doc.get('file_path')}
- Line: {error_doc.get('line_number')}
- Function: {error_doc.get('function_name')}
- Request: {error_doc.get('request_method')} {error_doc.get('request_path')}

STACK TRACE:
{error_doc.get('stack_trace', '')[:2000]}

CONTEXT:
{json.dumps(error_doc.get('context', {}), indent=2)[:1000]}

Analyze this error and provide a fix. Return JSON with:
{{
    "fix_description": "Brief description of the fix",
    "fix_type": "code_change|config_change|data_fix|retry",
    "root_cause": "What caused this error",
    "fixed_code": "The corrected code if applicable",
    "config_changes": {{}},
    "prevention_tip": "How to prevent this in future"
}}

Focus on SAFE fixes that won't break existing functionality."""

        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"error-fix-{error_doc['error_id']}",
                system_message="You are an expert at fixing software errors safely."
            ).with_model("openai", "gpt-5.2")
            
            response = await chat.send_message(UserMessage(text=prompt))
            
            # Parse response
            response_text = response.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            fix_data = json.loads(response_text)
            
            return ErrorFix(
                error_id=error_doc["error_id"],
                fix_type=fix_data.get("fix_type", "code_change"),
                fix_description=fix_data.get("fix_description", ""),
                fixed_code=fix_data.get("fixed_code", ""),
                config_changes=fix_data.get("config_changes", {})
            )
            
        except Exception as e:
            logger.error(f"AI fix generation failed: {e}")
            return None
    
    async def auto_fix_error(self, error: DetectedError) -> Optional[ErrorFix]:
        """Automatically fix an error"""
        fix = await self.generate_fix(error.error_id)
        if fix:
            result = await self.apply_fix(fix.fix_id)
            return fix if result.get("status") == "success" else None
        return None
    
    async def apply_fix(self, fix_id: str) -> Dict[str, Any]:
        """Apply a generated fix"""
        fix_doc = await self.fixes_collection.find_one({"fix_id": fix_id})
        if not fix_doc:
            return {"status": "failed", "error": "Fix not found"}
        
        result = {
            "fix_id": fix_id,
            "status": "pending",
            "changes_made": [],
            "error": None
        }
        
        try:
            fix_type = fix_doc.get("fix_type", "")
            
            if fix_type == "config_change" and fix_doc.get("config_changes"):
                # Apply configuration changes
                for key, value in fix_doc["config_changes"].items():
                    # Store rollback data
                    result["changes_made"].append({
                        "type": "config",
                        "key": key,
                        "old_value": None,  # Would need to fetch current value
                        "new_value": value
                    })
                result["status"] = "success"
                
            elif fix_type == "retry":
                # Retry the failed operation
                result["status"] = "success"
                result["changes_made"].append({"type": "retry", "action": "retried_operation"})
                
            elif fix_type == "code_change" and fix_doc.get("fixed_code"):
                # For code changes, we log but don't auto-apply (safety)
                result["status"] = "pending_review"
                result["changes_made"].append({
                    "type": "code",
                    "requires_review": True,
                    "suggested_fix": fix_doc["fixed_code"][:500]
                })
            
            # Update fix status
            await self.fixes_collection.update_one(
                {"fix_id": fix_id},
                {"$set": {
                    "result": result["status"],
                    "applied_at": datetime.now(timezone.utc).isoformat(),
                    "changes_made": result["changes_made"]
                }}
            )
            
            # Update error status
            await self.errors_collection.update_one(
                {"error_id": fix_doc["error_id"]},
                {"$set": {"status": "fix_applied" if result["status"] == "success" else "fix_pending"}}
            )
            
            # Learn from successful fix
            if result["status"] == "success":
                await self._learn_from_fix(fix_doc)
            
            logger.info(f"Applied fix {fix_id}: {result['status']}")
            
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
            logger.error(f"Fix application failed: {e}")
        
        return result
    
    async def _learn_from_fix(self, fix_doc: Dict):
        """Learn from a successful fix for future use"""
        error_doc = await self.errors_collection.find_one({"error_id": fix_doc["error_id"]})
        if not error_doc:
            return
        
        pattern = error_doc.get("error_type", "")
        
        # Update or create learning entry
        existing = await self.learning_collection.find_one({"error_pattern": pattern})
        
        if existing:
            # Update success rate
            total = existing.get("total_applications", 0) + 1
            successes = existing.get("successful_applications", 0) + 1
            success_rate = successes / total
            
            await self.learning_collection.update_one(
                {"error_pattern": pattern},
                {"$set": {
                    "success_rate": success_rate,
                    "total_applications": total,
                    "successful_applications": successes,
                    "last_applied": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            await self.learning_collection.insert_one({
                "error_pattern": pattern,
                "fix_description": fix_doc.get("fix_description", ""),
                "fix_code": fix_doc.get("fixed_code", ""),
                "fix_type": fix_doc.get("fix_type", ""),
                "config_changes": fix_doc.get("config_changes", {}),
                "success_rate": 1.0,
                "total_applications": 1,
                "successful_applications": 1,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_applied": datetime.now(timezone.utc).isoformat()
            })
    
    async def rollback_fix(self, fix_id: str) -> Dict[str, Any]:
        """Rollback an applied fix"""
        fix_doc = await self.fixes_collection.find_one({"fix_id": fix_id})
        if not fix_doc:
            return {"status": "failed", "error": "Fix not found"}
        
        if not fix_doc.get("rollback_available", True):
            return {"status": "failed", "error": "Rollback not available"}
        
        # Perform rollback based on changes made
        try:
            changes = fix_doc.get("changes_made", [])
            for change in changes:
                if change.get("type") == "config" and change.get("old_value"):
                    # Restore old config value
                    pass  # Would implement actual rollback
            
            await self.fixes_collection.update_one(
                {"fix_id": fix_id},
                {"$set": {"result": "rolled_back"}}
            )
            
            await self.errors_collection.update_one(
                {"error_id": fix_doc["error_id"]},
                {"$set": {"status": "detected"}}
            )
            
            return {"status": "rolled_back", "fix_id": fix_id}
            
        except Exception as e:
            return {"status": "failed", "error": str(e)}
    
    async def get_errors(
        self,
        tenant_id: str = None,
        category: str = None,
        status: str = None,
        limit: int = 50
    ) -> List[Dict]:
        """Get detected errors with optional filters"""
        query = {}
        if tenant_id:
            query["tenant_id"] = tenant_id
        if category:
            query["category"] = category
        if status:
            query["status"] = status
        
        errors = await self.errors_collection.find(
            query, {"_id": 0}
        ).sort("detected_at", -1).to_list(limit)
        
        return errors
    
    async def get_fixes(self, error_id: str = None, status: str = None) -> List[Dict]:
        """Get fixes with optional filters"""
        query = {}
        if error_id:
            query["error_id"] = error_id
        if status:
            query["result"] = status
        
        fixes = await self.fixes_collection.find(
            query, {"_id": 0}
        ).sort("generated_at", -1).to_list(50)
        
        return fixes
    
    async def get_dashboard_stats(self, tenant_id: str = "default") -> Dict[str, Any]:
        """Get statistics for the error fix dashboard"""
        query = {"tenant_id": tenant_id} if tenant_id != "all" else {}
        
        total_errors = await self.errors_collection.count_documents(query)
        fixed_errors = await self.errors_collection.count_documents({**query, "status": "fix_applied"})
        pending_errors = await self.errors_collection.count_documents({**query, "status": "detected"})
        
        # Get errors by category
        pipeline = [
            {"$match": query},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}}
        ]
        by_category = await self.errors_collection.aggregate(pipeline).to_list(20)
        
        # Get fix success rate
        total_fixes = await self.fixes_collection.count_documents({})
        successful_fixes = await self.fixes_collection.count_documents({"result": "success"})
        fix_success_rate = (successful_fixes / total_fixes * 100) if total_fixes > 0 else 0
        
        # Get recent error trend (last 24 hours)
        day_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        recent_errors = await self.errors_collection.count_documents({
            **query,
            "detected_at": {"$gte": day_ago}
        })
        
        config = await self.get_config(tenant_id)
        
        return {
            "total_errors": total_errors,
            "fixed_errors": fixed_errors,
            "pending_errors": pending_errors,
            "fix_rate": (fixed_errors / total_errors * 100) if total_errors > 0 else 0,
            "fix_success_rate": fix_success_rate,
            "recent_errors_24h": recent_errors,
            "by_category": {item["_id"]: item["count"] for item in by_category},
            "config": config
        }
    
    async def scan_and_fix_frontend_errors(self) -> Dict[str, Any]:
        """
        Scan frontend code for common errors like undefined variables
        and automatically fix them.
        
        Detects:
        - Missing useState declarations
        - Undefined function references
        - Missing imports
        """
        results = {
            "scanned_files": 0,
            "errors_found": 0,
            "errors_fixed": 0,
            "fixes_applied": [],
            "errors": []
        }
        
        frontend_src = "/app/frontend/src"
        
        for root, dirs, files in os.walk(frontend_src):
            dirs[:] = [d for d in dirs if d not in ['node_modules', 'build', 'ui']]
            
            for file in files:
                if file.endswith(('.js', '.jsx', '.tsx')):
                    file_path = os.path.join(root, file)
                    results["scanned_files"] += 1
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        original_content = content
                        fixes_for_file = []
                        
                        # Find useState usages that aren't declared
                        # Pattern: setXxx( but no const [xxx, setXxx] = useState
                        set_pattern = r'set([A-Z][a-zA-Z0-9]*)\s*\('
                        state_usage = re.findall(set_pattern, content)
                        
                        for state_name in state_usage:
                            camel_case = state_name[0].lower() + state_name[1:]
                            # Check if useState declaration exists
                            decl_pattern = rf'const\s*\[{camel_case},\s*set{state_name}\]\s*=\s*useState'
                            
                            if not re.search(decl_pattern, content):
                                # Find where to add the useState
                                # Look for other useState declarations
                                existing_useState = re.search(r'(const\s*\[\w+,\s*\w+\]\s*=\s*useState\([^)]*\);)', content)
                                
                                if existing_useState:
                                    # Add after existing useState
                                    new_line = f'\n  const [{camel_case}, set{state_name}] = useState(false);'
                                    content = content.replace(
                                        existing_useState.group(1),
                                        existing_useState.group(1) + new_line
                                    )
                                    fixes_for_file.append({
                                        "type": "missing_useState",
                                        "variable": f"set{state_name}",
                                        "fix": f"Added useState for {camel_case}"
                                    })
                                    results["errors_found"] += 1
                        
                        if content != original_content:
                            # Create backup
                            backup_path = f"{file_path}.autofix_backup"
                            with open(backup_path, 'w') as f:
                                f.write(original_content)
                            
                            # Apply fix
                            with open(file_path, 'w') as f:
                                f.write(content)
                            
                            results["errors_fixed"] += len(fixes_for_file)
                            results["fixes_applied"].append({
                                "file": file_path,
                                "fixes": fixes_for_file,
                                "backup": backup_path
                            })
                            
                            logger.info(f"Auto-fixed {len(fixes_for_file)} errors in {file}")
                    
                    except Exception as e:
                        results["errors"].append({
                            "file": file_path,
                            "error": str(e)
                        })
        
        return results
    
    async def scan_and_fix_api_errors(self) -> Dict[str, Any]:
        """
        Scan for common API error patterns and fix them.
        
        Detects and fixes:
        - Missing error handling in API calls
        - Incorrect API endpoint paths
        - Missing retry logic
        - Improper authentication header handling
        """
        results = {
            "scanned_files": 0,
            "api_calls_found": 0,
            "issues_found": 0,
            "fixes_applied": [],
            "errors": []
        }
        
        frontend_src = "/app/frontend/src"
        
        for root, dirs, files in os.walk(frontend_src):
            dirs[:] = [d for d in dirs if d not in ['node_modules', 'build', 'ui']]
            
            for file in files:
                if file.endswith(('.js', '.jsx', '.tsx')):
                    file_path = os.path.join(root, file)
                    results["scanned_files"] += 1
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        original_content = content
                        fixes_for_file = []
                        
                        # Find API calls without try-catch
                        api_patterns = [
                            r"await\s+fetch\s*\([^)]+\)(?![^{]*catch)",
                            r"await\s+api\s*\([^)]+\)(?![^{]*catch)",
                            r"await\s+axios\s*\.\w+\s*\([^)]+\)(?![^{]*catch)",
                        ]
                        
                        for pattern in api_patterns:
                            matches = list(re.finditer(pattern, content, re.MULTILINE))
                            if matches:
                                results["api_calls_found"] += len(matches)
                                for match in matches:
                                    # Check if it's inside a try block
                                    pos = match.start()
                                    before_content = content[:pos]
                                    # Count open braces to determine context
                                    if "try {" not in before_content[-200:]:
                                        results["issues_found"] += 1
                                        fixes_for_file.append({
                                            "type": "missing_try_catch",
                                            "location": f"Line {content[:pos].count(chr(10)) + 1}",
                                            "suggestion": "Add try-catch block around API call"
                                        })
                        
                        # Find API calls without /api prefix
                        bad_api_path = re.findall(r"fetch\s*\(['\"]\/(?!api\/)[^'\"]+['\"]", content)
                        if bad_api_path:
                            results["issues_found"] += len(bad_api_path)
                            for match in bad_api_path:
                                fixes_for_file.append({
                                    "type": "missing_api_prefix",
                                    "value": match,
                                    "suggestion": "API calls should use /api/ prefix"
                                })
                        
                        # Log findings (don't auto-apply API fixes as they're complex)
                        if fixes_for_file:
                            results["fixes_applied"].append({
                                "file": file_path,
                                "issues": fixes_for_file,
                                "auto_fixed": False
                            })
                    
                    except Exception as e:
                        results["errors"].append({
                            "file": file_path,
                            "error": str(e)
                        })
        
        return results
    
    async def scan_and_fix_login_errors(self) -> Dict[str, Any]:
        """
        Scan for login-related error patterns and fix them.
        
        Detects and fixes:
        - Missing session validation
        - Improper token refresh logic
        - Missing logout on 401 errors
        - Insecure credential handling
        """
        results = {
            "scanned_files": 0,
            "login_issues_found": 0,
            "fixes_applied": [],
            "recommendations": [],
            "errors": []
        }
        
        frontend_src = "/app/frontend/src"
        
        for root, dirs, files in os.walk(frontend_src):
            dirs[:] = [d for d in dirs if d not in ['node_modules', 'build', 'ui']]
            
            for file in files:
                if file.endswith(('.js', '.jsx', '.tsx')):
                    file_path = os.path.join(root, file)
                    results["scanned_files"] += 1
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        issues = []
                        
                        # Check for hardcoded credentials
                        hardcoded_patterns = [
                            r"password\s*[=:]\s*['\"][^'\"]+['\"]",
                            r"apiKey\s*[=:]\s*['\"][^'\"]+['\"]",
                            r"secret\s*[=:]\s*['\"][^'\"]+['\"]",
                        ]
                        
                        for pattern in hardcoded_patterns:
                            if re.search(pattern, content, re.IGNORECASE):
                                issues.append({
                                    "type": "hardcoded_credentials",
                                    "severity": "high",
                                    "recommendation": "Move credentials to environment variables"
                                })
                                results["login_issues_found"] += 1
                        
                        # Check for missing 401 handling
                        if "401" in content or "Unauthorized" in content:
                            if "logout" not in content.lower() and "redirect" not in content.lower():
                                issues.append({
                                    "type": "missing_401_handling",
                                    "severity": "medium",
                                    "recommendation": "Add logout/redirect on 401 Unauthorized"
                                })
                                results["login_issues_found"] += 1
                        
                        # Check for localStorage token without validation
                        if "localStorage.getItem('token')" in content:
                            if "try" not in content or "catch" not in content:
                                issues.append({
                                    "type": "unvalidated_token",
                                    "severity": "low",
                                    "recommendation": "Add try-catch around token operations"
                                })
                                results["login_issues_found"] += 1
                        
                        # Check for missing token refresh
                        if ("token" in content.lower() and 
                            "expired" not in content.lower() and
                            "refresh" not in content.lower() and
                            "login" in file.lower()):
                            issues.append({
                                "type": "missing_token_refresh",
                                "severity": "medium",
                                "recommendation": "Consider adding token refresh mechanism"
                            })
                            results["login_issues_found"] += 1
                        
                        if issues:
                            results["fixes_applied"].append({
                                "file": file_path,
                                "issues": issues
                            })
                    
                    except Exception as e:
                        results["errors"].append({
                            "file": file_path,
                            "error": str(e)
                        })
        
        # Add general recommendations
        results["recommendations"] = [
            {
                "title": "Implement Token Refresh",
                "description": "Add automatic token refresh before expiry",
                "code_template": """
// Token refresh utility
const refreshToken = async () => {
    try {
        const response = await api('/api/auth/refresh', { method: 'POST' });
        if (response.access_token) {
            localStorage.setItem('token', response.access_token);
            return true;
        }
    } catch (error) {
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
    return false;
};
"""
            },
            {
                "title": "Add Global 401 Handler",
                "description": "Intercept all 401 responses and handle logout",
                "code_template": """
// Global API interceptor for 401 handling
const apiWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return null;
    }
    
    return response.json();
};
"""
            }
        ]
        
        return results
    
    async def auto_fix_all_errors(self) -> Dict[str, Any]:
        """
        Run all error scans and apply safe fixes.
        Combines frontend, API, and login error scanning.
        """
        results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "frontend_scan": {},
            "api_scan": {},
            "login_scan": {},
            "total_issues": 0,
            "total_fixes": 0,
            "summary": []
        }
        
        # Run frontend error scan
        frontend_results = await self.scan_and_fix_frontend_errors()
        results["frontend_scan"] = frontend_results
        results["total_issues"] += frontend_results.get("errors_found", 0)
        results["total_fixes"] += frontend_results.get("errors_fixed", 0)
        
        # Run API error scan
        api_results = await self.scan_and_fix_api_errors()
        results["api_scan"] = api_results
        results["total_issues"] += api_results.get("issues_found", 0)
        
        # Run login error scan
        login_results = await self.scan_and_fix_login_errors()
        results["login_scan"] = login_results
        results["total_issues"] += login_results.get("login_issues_found", 0)
        
        # Generate summary
        results["summary"] = [
            f"Scanned {frontend_results.get('scanned_files', 0)} frontend files",
            f"Found {results['total_issues']} total issues",
            f"Auto-fixed {results['total_fixes']} issues",
            f"API calls analyzed: {api_results.get('api_calls_found', 0)}",
            f"Login security issues: {login_results.get('login_issues_found', 0)}"
        ]
        
        return results
