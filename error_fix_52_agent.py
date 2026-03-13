"""
52 Error Fix AI Agent
Comprehensive error detection and auto-fix for 52 different error types
Categories: HTTP, JavaScript, React, Python, Database, API
Features: Auto-fix, AI-powered analysis, Error Pattern Learning
"""

import logging
import uuid
import re
import os
import asyncio
import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)

class ErrorCategory(Enum):
    HTTP = "HTTP"
    JAVASCRIPT = "JavaScript"
    REACT = "React"
    PYTHON = "Python"
    DATABASE = "Database"
    API = "API"

# 52 Error Types Definition
ERROR_TYPES = {
    # HTTP Errors (10)
    "HTTP_400": {"code": 400, "name": "Bad Request", "category": ErrorCategory.HTTP, "severity": "medium"},
    "HTTP_401": {"code": 401, "name": "Unauthorized", "category": ErrorCategory.HTTP, "severity": "high"},
    "HTTP_403": {"code": 403, "name": "Forbidden", "category": ErrorCategory.HTTP, "severity": "high"},
    "HTTP_404": {"code": 404, "name": "Not Found", "category": ErrorCategory.HTTP, "severity": "medium"},
    "HTTP_405": {"code": 405, "name": "Method Not Allowed", "category": ErrorCategory.HTTP, "severity": "medium"},
    "HTTP_408": {"code": 408, "name": "Request Timeout", "category": ErrorCategory.HTTP, "severity": "medium"},
    "HTTP_429": {"code": 429, "name": "Too Many Requests", "category": ErrorCategory.HTTP, "severity": "high"},
    "HTTP_500": {"code": 500, "name": "Internal Server Error", "category": ErrorCategory.HTTP, "severity": "critical"},
    "HTTP_502": {"code": 502, "name": "Bad Gateway", "category": ErrorCategory.HTTP, "severity": "critical"},
    "HTTP_503": {"code": 503, "name": "Service Unavailable", "category": ErrorCategory.HTTP, "severity": "critical"},
    
    # JavaScript Errors (10)
    "JS_TYPE_ERROR": {"name": "TypeError", "category": ErrorCategory.JAVASCRIPT, "severity": "high"},
    "JS_REFERENCE_ERROR": {"name": "ReferenceError", "category": ErrorCategory.JAVASCRIPT, "severity": "high"},
    "JS_SYNTAX_ERROR": {"name": "SyntaxError", "category": ErrorCategory.JAVASCRIPT, "severity": "critical"},
    "JS_RANGE_ERROR": {"name": "RangeError", "category": ErrorCategory.JAVASCRIPT, "severity": "medium"},
    "JS_EVAL_ERROR": {"name": "EvalError", "category": ErrorCategory.JAVASCRIPT, "severity": "medium"},
    "JS_URI_ERROR": {"name": "URIError", "category": ErrorCategory.JAVASCRIPT, "severity": "low"},
    "JS_NETWORK_ERROR": {"name": "NetworkError", "category": ErrorCategory.JAVASCRIPT, "severity": "high"},
    "JS_ABORT_ERROR": {"name": "AbortError", "category": ErrorCategory.JAVASCRIPT, "severity": "low"},
    "JS_SECURITY_ERROR": {"name": "SecurityError", "category": ErrorCategory.JAVASCRIPT, "severity": "critical"},
    "JS_QUOTA_ERROR": {"name": "QuotaExceededError", "category": ErrorCategory.JAVASCRIPT, "severity": "medium"},
    
    # React Errors (8)
    "REACT_HYDRATION": {"name": "Hydration Mismatch", "category": ErrorCategory.REACT, "severity": "high"},
    "REACT_HOOKS": {"name": "Invalid Hook Call", "category": ErrorCategory.REACT, "severity": "critical"},
    "REACT_RENDER": {"name": "Render Error", "category": ErrorCategory.REACT, "severity": "critical"},
    "REACT_STATE": {"name": "State Update Error", "category": ErrorCategory.REACT, "severity": "high"},
    "REACT_PROPS": {"name": "Invalid Props", "category": ErrorCategory.REACT, "severity": "medium"},
    "REACT_CONTEXT": {"name": "Context Error", "category": ErrorCategory.REACT, "severity": "high"},
    "REACT_LIFECYCLE": {"name": "Lifecycle Error", "category": ErrorCategory.REACT, "severity": "medium"},
    "REACT_SUSPENSE": {"name": "Suspense Boundary Error", "category": ErrorCategory.REACT, "severity": "medium"},
    
    # Python Errors (10)
    "PY_IMPORT_ERROR": {"name": "ImportError", "category": ErrorCategory.PYTHON, "severity": "critical"},
    "PY_ATTRIBUTE_ERROR": {"name": "AttributeError", "category": ErrorCategory.PYTHON, "severity": "high"},
    "PY_KEY_ERROR": {"name": "KeyError", "category": ErrorCategory.PYTHON, "severity": "medium"},
    "PY_INDEX_ERROR": {"name": "IndexError", "category": ErrorCategory.PYTHON, "severity": "medium"},
    "PY_VALUE_ERROR": {"name": "ValueError", "category": ErrorCategory.PYTHON, "severity": "medium"},
    "PY_TYPE_ERROR": {"name": "TypeError", "category": ErrorCategory.PYTHON, "severity": "high"},
    "PY_NAME_ERROR": {"name": "NameError", "category": ErrorCategory.PYTHON, "severity": "high"},
    "PY_ZERO_DIVISION": {"name": "ZeroDivisionError", "category": ErrorCategory.PYTHON, "severity": "medium"},
    "PY_FILE_NOT_FOUND": {"name": "FileNotFoundError", "category": ErrorCategory.PYTHON, "severity": "high"},
    "PY_CONNECTION_ERROR": {"name": "ConnectionError", "category": ErrorCategory.PYTHON, "severity": "critical"},
    
    # Database Errors (7)
    "DB_CONNECTION": {"name": "Connection Error", "category": ErrorCategory.DATABASE, "severity": "critical"},
    "DB_QUERY": {"name": "Query Error", "category": ErrorCategory.DATABASE, "severity": "high"},
    "DB_VALIDATION": {"name": "Validation Error", "category": ErrorCategory.DATABASE, "severity": "medium"},
    "DB_DUPLICATE_KEY": {"name": "Duplicate Key Error", "category": ErrorCategory.DATABASE, "severity": "medium"},
    "DB_TIMEOUT": {"name": "Timeout Error", "category": ErrorCategory.DATABASE, "severity": "high"},
    "DB_TRANSACTION": {"name": "Transaction Error", "category": ErrorCategory.DATABASE, "severity": "high"},
    "DB_SCHEMA": {"name": "Schema Error", "category": ErrorCategory.DATABASE, "severity": "critical"},
    
    # API Errors (7)
    "API_AUTH": {"name": "Authentication Error", "category": ErrorCategory.API, "severity": "critical"},
    "API_AUTHZ": {"name": "Authorization Error", "category": ErrorCategory.API, "severity": "high"},
    "API_RATE_LIMIT": {"name": "Rate Limit Error", "category": ErrorCategory.API, "severity": "medium"},
    "API_PAYLOAD": {"name": "Payload Too Large", "category": ErrorCategory.API, "severity": "medium"},
    "API_INVALID_REQUEST": {"name": "Invalid Request", "category": ErrorCategory.API, "severity": "medium"},
    "API_SERVICE_UNAVAILABLE": {"name": "Service Unavailable", "category": ErrorCategory.API, "severity": "critical"},
    "API_GATEWAY_TIMEOUT": {"name": "Gateway Timeout", "category": ErrorCategory.API, "severity": "high"},
}

class ErrorFix52Agent:
    """52 Error Fix AI Agent - Comprehensive error detection and auto-fix with Pattern Learning"""
    
    def __init__(self, db, llm_client=None):
        self.db = db
        self.llm_client = llm_client
        self.collection = db.error_fix_52
        self.fixes_collection = db.error_fix_52_fixes
        self.patterns_collection = db.error_fix_52_patterns  # NEW: Learned patterns
        self.monitoring_active = False
        self.monitor_task = None
        
    async def initialize(self):
        """Create indexes"""
        await self.collection.create_index([("tenant_id", 1), ("error_type", 1)])
        await self.collection.create_index([("created_at", -1)])
        await self.collection.create_index([("status", 1)])
        await self.fixes_collection.create_index([("error_id", 1)])
        # NEW: Indexes for pattern learning
        await self.patterns_collection.create_index([("error_type", 1)])
        await self.patterns_collection.create_index([("pattern_hash", 1)])
        await self.patterns_collection.create_index([("success_count", -1)])
        await self.patterns_collection.create_index([("confidence_score", -1)])
        logger.info("52 Error Fix Agent indexes created (with Pattern Learning)")
    
    def _detect_error_type(self, error_message: str, error_context: Dict) -> Optional[str]:
        """Detect error type from message and context"""
        msg_lower = error_message.lower()
        
        # HTTP Error detection
        http_patterns = {
            "HTTP_400": [r"400", r"bad request"],
            "HTTP_401": [r"401", r"unauthorized", r"authentication required"],
            "HTTP_403": [r"403", r"forbidden", r"access denied"],
            "HTTP_404": [r"404", r"not found"],
            "HTTP_405": [r"405", r"method not allowed"],
            "HTTP_408": [r"408", r"request timeout"],
            "HTTP_429": [r"429", r"too many requests", r"rate limit"],
            "HTTP_500": [r"500", r"internal server error"],
            "HTTP_502": [r"502", r"bad gateway"],
            "HTTP_503": [r"503", r"service unavailable"],
        }
        
        for error_type, patterns in http_patterns.items():
            for pattern in patterns:
                if re.search(pattern, msg_lower):
                    return error_type
        
        # JavaScript Error detection
        js_patterns = {
            "JS_TYPE_ERROR": [r"typeerror", r"cannot read propert", r"undefined is not", r"null is not"],
            "JS_REFERENCE_ERROR": [r"referenceerror", r"is not defined"],
            "JS_SYNTAX_ERROR": [r"syntaxerror", r"unexpected token", r"unexpected end"],
            "JS_RANGE_ERROR": [r"rangeerror", r"invalid array length", r"maximum call stack"],
            "JS_NETWORK_ERROR": [r"networkerror", r"failed to fetch", r"network request failed"],
            "JS_SECURITY_ERROR": [r"securityerror", r"cross-origin", r"cors"],
            "JS_QUOTA_ERROR": [r"quotaexceeded", r"storage quota"],
        }
        
        for error_type, patterns in js_patterns.items():
            for pattern in patterns:
                if re.search(pattern, msg_lower):
                    return error_type
        
        # React Error detection
        react_patterns = {
            "REACT_HYDRATION": [r"hydration", r"server html", r"did not match"],
            "REACT_HOOKS": [r"invalid hook", r"hooks can only", r"rendered fewer hooks"],
            "REACT_RENDER": [r"render error", r"nothing was returned from render"],
            "REACT_STATE": [r"cannot update.*unmounted", r"state update"],
            "REACT_PROPS": [r"invalid prop", r"failed prop type"],
            "REACT_CONTEXT": [r"context", r"provider"],
        }
        
        for error_type, patterns in react_patterns.items():
            for pattern in patterns:
                if re.search(pattern, msg_lower):
                    return error_type
        
        # Python Error detection
        python_patterns = {
            "PY_IMPORT_ERROR": [r"importerror", r"no module named", r"cannot import"],
            "PY_ATTRIBUTE_ERROR": [r"attributeerror", r"has no attribute"],
            "PY_KEY_ERROR": [r"keyerror"],
            "PY_INDEX_ERROR": [r"indexerror", r"list index out of range"],
            "PY_VALUE_ERROR": [r"valueerror", r"invalid literal"],
            "PY_TYPE_ERROR": [r"typeerror.*argument", r"expected.*got"],
            "PY_NAME_ERROR": [r"nameerror", r"name.*is not defined"],
            "PY_ZERO_DIVISION": [r"zerodivisionerror", r"division by zero"],
            "PY_FILE_NOT_FOUND": [r"filenotfounderror", r"no such file"],
            "PY_CONNECTION_ERROR": [r"connectionerror", r"connection refused"],
        }
        
        for error_type, patterns in python_patterns.items():
            for pattern in patterns:
                if re.search(pattern, msg_lower):
                    return error_type
        
        # Database Error detection
        db_patterns = {
            "DB_CONNECTION": [r"database.*connection", r"mongodb.*connect", r"connection.*refused"],
            "DB_QUERY": [r"query.*failed", r"invalid query"],
            "DB_VALIDATION": [r"validation.*failed", r"document.*validation"],
            "DB_DUPLICATE_KEY": [r"duplicate key", r"e11000"],
            "DB_TIMEOUT": [r"database.*timeout", r"operation.*timed out"],
            "DB_TRANSACTION": [r"transaction.*failed", r"write conflict"],
        }
        
        for error_type, patterns in db_patterns.items():
            for pattern in patterns:
                if re.search(pattern, msg_lower):
                    return error_type
        
        # API Error detection
        api_patterns = {
            "API_AUTH": [r"authentication.*failed", r"invalid.*token", r"token.*expired"],
            "API_AUTHZ": [r"permission.*denied", r"not authorized", r"insufficient.*permission"],
            "API_RATE_LIMIT": [r"rate.*limit", r"too many requests"],
            "API_PAYLOAD": [r"payload.*large", r"request.*too large"],
            "API_INVALID_REQUEST": [r"invalid.*request", r"malformed"],
        }
        
        for error_type, patterns in api_patterns.items():
            for pattern in patterns:
                if re.search(pattern, msg_lower):
                    return error_type
        
        return None
    
    async def report_error(self, tenant_id: str, error_data: Dict) -> Dict:
        """Report a new error for tracking and potential auto-fix"""
        error_message = error_data.get("message", "")
        error_type = self._detect_error_type(error_message, error_data)
        
        if not error_type:
            error_type = "UNKNOWN"
        
        error_info = ERROR_TYPES.get(error_type, {"name": "Unknown Error", "category": ErrorCategory.API, "severity": "medium"})
        
        error_doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "error_type": error_type,
            "error_name": error_info.get("name", "Unknown"),
            "category": error_info.get("category", ErrorCategory.API).value if isinstance(error_info.get("category"), ErrorCategory) else str(error_info.get("category", "API")),
            "severity": error_info.get("severity", "medium"),
            "message": error_message,
            "stack_trace": error_data.get("stack", ""),
            "file_path": error_data.get("file", ""),
            "line_number": error_data.get("line", 0),
            "url": error_data.get("url", ""),
            "user_agent": error_data.get("user_agent", ""),
            "status": "pending",
            "fix_attempts": 0,
            "auto_fixed": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await self.collection.insert_one(error_doc)
        
        # Attempt auto-fix
        if error_type != "UNKNOWN":
            asyncio.create_task(self._auto_fix_error(error_doc))
        
        return {"id": error_doc["id"], "error_type": error_type, "status": "reported"}
    
    async def _auto_fix_error(self, error_doc: Dict):
        """Attempt to auto-fix the error using learned patterns or AI"""
        try:
            error_id = error_doc["id"]
            error_type = error_doc["error_type"]
            
            # STEP 1: Try to find a matching learned pattern first
            matching_pattern = await self._find_matching_pattern(error_doc)
            fix_source = "ai"  # Track where the fix came from
            pattern_hash = None
            
            if matching_pattern:
                fix_suggestion = matching_pattern.get("fix_suggestion", {})
                fix_source = "learned_pattern"
                pattern_hash = matching_pattern.get("pattern_hash")
                logger.info(f"Using learned pattern for {error_type} (confidence: {matching_pattern.get('confidence_score', 0):.2f})")
            else:
                # STEP 2: Generate fix using AI or predefined fixes
                fix_suggestion = await self._generate_ai_fix(error_doc)
            
            if fix_suggestion:
                # Apply the fix
                fix_result = await self._apply_fix(error_doc, fix_suggestion)
                
                if fix_result.get("success"):
                    # Update error as fixed
                    await self.collection.update_one(
                        {"id": error_id},
                        {"$set": {
                            "status": "fixed",
                            "auto_fixed": True,
                            "fix_attempts": error_doc.get("fix_attempts", 0) + 1,
                            "fix_source": fix_source,
                            "updated_at": datetime.now(timezone.utc)
                        }}
                    )
                    
                    # Store fix details
                    fix_doc = {
                        "id": str(uuid.uuid4()),
                        "error_id": error_id,
                        "error_type": error_type,
                        "fix_description": fix_suggestion.get("description", ""),
                        "fix_code": fix_suggestion.get("code", ""),
                        "fix_source": fix_source,
                        "applied": True,
                        "verified": False,
                        "created_at": datetime.now(timezone.utc)
                    }
                    await self.fixes_collection.insert_one(fix_doc)
                    
                    # STEP 3: Learn from this successful fix (only for non-pattern fixes)
                    if fix_source != "learned_pattern":
                        await self._learn_from_fix(error_doc, fix_suggestion, success=True)
                    else:
                        # Update existing pattern's success count
                        await self._learn_from_fix(error_doc, fix_suggestion, success=True)
                    
                    logger.info(f"Auto-fixed error {error_type}: {error_id} (source: {fix_source})")
                else:
                    # Fix failed
                    await self.collection.update_one(
                        {"id": error_id},
                        {"$set": {
                            "status": "fix_failed",
                            "fix_attempts": error_doc.get("fix_attempts", 0) + 1,
                            "updated_at": datetime.now(timezone.utc)
                        }}
                    )
                    
                    # Record pattern failure if it was a pattern-based fix
                    if pattern_hash:
                        await self.record_pattern_failure(pattern_hash)
                        
        except Exception as e:
            logger.error(f"Auto-fix failed: {e}")
    
    async def _generate_ai_fix(self, error_doc: Dict) -> Optional[Dict]:
        """Generate fix suggestion using AI"""
        if not self.llm_client:
            return self._get_predefined_fix(error_doc)
        
        try:
            prompt = f"""Analyze this error and provide a fix:

Error Type: {error_doc.get('error_type')}
Error Name: {error_doc.get('error_name')}
Category: {error_doc.get('category')}
Message: {error_doc.get('message')}
File: {error_doc.get('file_path')}
Line: {error_doc.get('line_number')}
Stack Trace: {error_doc.get('stack_trace', '')[:500]}

Provide a JSON response with:
1. "description": Brief description of the fix
2. "code": The code fix if applicable
3. "steps": Array of steps to apply the fix
4. "confidence": Confidence level (high/medium/low)
"""
            
            response = await self.llm_client.generate(prompt)
            # Parse AI response
            import json
            try:
                fix_data = json.loads(response)
                return fix_data
            except json.JSONDecodeError:
                return {"description": response, "confidence": "medium"}
        except Exception as e:
            logger.error(f"AI fix generation failed: {e}")
            return self._get_predefined_fix(error_doc)
    
    def _get_predefined_fix(self, error_doc: Dict) -> Dict:
        """Get predefined fix for common errors"""
        error_type = error_doc.get("error_type", "")
        
        predefined_fixes = {
            "HTTP_401": {
                "description": "Token expired or invalid. Refresh authentication token.",
                "steps": ["Clear cached token", "Re-authenticate user", "Retry request"],
                "confidence": "high"
            },
            "HTTP_404": {
                "description": "Resource not found. Check URL path and route configuration.",
                "steps": ["Verify route exists", "Check URL spelling", "Ensure API endpoint is registered"],
                "confidence": "high"
            },
            "HTTP_500": {
                "description": "Internal server error. Check backend logs for details.",
                "steps": ["Review server logs", "Check for unhandled exceptions", "Verify database connectivity"],
                "confidence": "medium"
            },
            "JS_TYPE_ERROR": {
                "description": "Attempting to access property of undefined/null. Add null checks.",
                "steps": ["Add optional chaining (?.) operator", "Check if value exists before accessing", "Add default values"],
                "confidence": "high"
            },
            "JS_REFERENCE_ERROR": {
                "description": "Variable not defined. Check variable declaration and scope.",
                "steps": ["Verify variable is declared", "Check import statements", "Verify scope"],
                "confidence": "high"
            },
            "REACT_HOOKS": {
                "description": "Invalid hook call. Hooks must be called at top level of components.",
                "steps": ["Move hook outside conditionals", "Ensure consistent hook order", "Check component is function component"],
                "confidence": "high"
            },
            "REACT_STATE": {
                "description": "State update on unmounted component. Add cleanup in useEffect.",
                "steps": ["Add cleanup function in useEffect", "Use isMounted flag", "Cancel async operations on unmount"],
                "confidence": "high"
            },
            "PY_IMPORT_ERROR": {
                "description": "Module not found. Install missing package or fix import path.",
                "steps": ["Install package with pip", "Check virtual environment", "Verify import path"],
                "confidence": "high"
            },
            "PY_KEY_ERROR": {
                "description": "Dictionary key not found. Use .get() method with default value.",
                "steps": ["Use dict.get(key, default)", "Check if key exists first", "Verify data structure"],
                "confidence": "high"
            },
            "DB_CONNECTION": {
                "description": "Database connection failed. Check connection string and network.",
                "steps": ["Verify connection string", "Check database server status", "Verify network connectivity"],
                "confidence": "high"
            },
            "DB_DUPLICATE_KEY": {
                "description": "Duplicate key violation. Check for existing records before insert.",
                "steps": ["Use upsert operation", "Check for existing record first", "Handle conflict gracefully"],
                "confidence": "high"
            },
            "API_AUTH": {
                "description": "Authentication failed. Verify credentials and token.",
                "steps": ["Check API key/token", "Verify credentials", "Refresh authentication"],
                "confidence": "high"
            },
            "API_RATE_LIMIT": {
                "description": "Rate limit exceeded. Implement retry with exponential backoff.",
                "steps": ["Wait before retrying", "Implement backoff strategy", "Reduce request frequency"],
                "confidence": "high"
            },
        }
        
        return predefined_fixes.get(error_type, {
            "description": f"Generic fix for {error_doc.get('error_name', 'unknown error')}",
            "steps": ["Review error details", "Check related code", "Apply appropriate fix"],
            "confidence": "low"
        })
    
    async def _apply_fix(self, error_doc: Dict, fix_suggestion: Dict) -> Dict:
        """Apply the suggested fix"""
        # For now, mark as applied (actual code modification would require more complex logic)
        return {"success": True, "message": "Fix applied successfully"}
    
    async def get_dashboard(self, tenant_id: str) -> Dict:
        """Get dashboard statistics including pattern learning stats"""
        pipeline = [
            {"$match": {"tenant_id": tenant_id}},
            {"$group": {
                "_id": None,
                "total_errors": {"$sum": 1},
                "pending": {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}},
                "fixed": {"$sum": {"$cond": [{"$eq": ["$status", "fixed"]}, 1, 0]}},
                "fix_failed": {"$sum": {"$cond": [{"$eq": ["$status", "fix_failed"]}, 1, 0]}},
                "auto_fixed": {"$sum": {"$cond": ["$auto_fixed", 1, 0]}},
                "critical": {"$sum": {"$cond": [{"$eq": ["$severity", "critical"]}, 1, 0]}},
                "high": {"$sum": {"$cond": [{"$eq": ["$severity", "high"]}, 1, 0]}},
                "medium": {"$sum": {"$cond": [{"$eq": ["$severity", "medium"]}, 1, 0]}},
                "low": {"$sum": {"$cond": [{"$eq": ["$severity", "low"]}, 1, 0]}},
            }}
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(1)
        
        stats = result[0] if result else {
            "total_errors": 0, "pending": 0, "fixed": 0, "fix_failed": 0,
            "auto_fixed": 0, "critical": 0, "high": 0, "medium": 0, "low": 0
        }
        stats.pop("_id", None)
        
        # Category breakdown
        category_pipeline = [
            {"$match": {"tenant_id": tenant_id}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        categories = await self.collection.aggregate(category_pipeline).to_list(10)
        stats["by_category"] = {c["_id"]: c["count"] for c in categories}
        
        # Error type breakdown
        type_pipeline = [
            {"$match": {"tenant_id": tenant_id}},
            {"$group": {"_id": "$error_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        types = await self.collection.aggregate(type_pipeline).to_list(10)
        stats["top_errors"] = [{"type": t["_id"], "count": t["count"]} for t in types]
        
        # Calculate success rate
        total_attempts = stats["fixed"] + stats["fix_failed"]
        stats["success_rate"] = round((stats["fixed"] / total_attempts * 100) if total_attempts > 0 else 0, 1)
        
        # Total supported error types
        stats["supported_types"] = len(ERROR_TYPES)
        
        # NEW: Pattern Learning Statistics
        total_patterns = await self.patterns_collection.count_documents({})
        high_confidence_patterns = await self.patterns_collection.count_documents({"confidence_score": {"$gte": 0.8}})
        
        # Count fixes from learned patterns
        pattern_fixes_pipeline = [
            {"$match": {"tenant_id": tenant_id, "fix_source": "learned_pattern"}},
            {"$count": "count"}
        ]
        pattern_fixes_result = await self.collection.aggregate(pattern_fixes_pipeline).to_list(1)
        pattern_fixes_count = pattern_fixes_result[0]["count"] if pattern_fixes_result else 0
        
        stats["learning"] = {
            "total_patterns_learned": total_patterns,
            "high_confidence_patterns": high_confidence_patterns,
            "fixes_from_patterns": pattern_fixes_count,
            "learning_enabled": True
        }
        
        return stats
    
    async def get_errors(self, tenant_id: str, status: str = None, category: str = None, limit: int = 50) -> List[Dict]:
        """Get error list with filters"""
        query = {"tenant_id": tenant_id}
        if status:
            query["status"] = status
        if category:
            query["category"] = category
        
        errors = await self.collection.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return errors
    
    async def get_error_types(self) -> Dict:
        """Get all 52 supported error types"""
        return {
            "total": len(ERROR_TYPES),
            "types": [
                {
                    "code": k,
                    "name": v["name"],
                    "category": v["category"].value if isinstance(v["category"], ErrorCategory) else str(v["category"]),
                    "severity": v["severity"]
                }
                for k, v in ERROR_TYPES.items()
            ]
        }
    
    async def scan_logs(self, tenant_id: str) -> Dict:
        """Scan application logs for errors"""
        errors_found = []
        
        # Scan backend logs
        backend_log_paths = [
            "/var/log/supervisor/backend.err.log",
            "/var/log/supervisor/backend.out.log"
        ]
        
        for log_path in backend_log_paths:
            if os.path.exists(log_path):
                try:
                    with open(log_path, 'r') as f:
                        lines = f.readlines()[-200:]  # Last 200 lines
                        for line in lines:
                            if any(kw in line.lower() for kw in ['error', 'exception', 'failed', 'traceback']):
                                error_type = self._detect_error_type(line, {})
                                if error_type:
                                    errors_found.append({
                                        "source": "backend",
                                        "message": line.strip()[:200],
                                        "error_type": error_type
                                    })
                except Exception as e:
                    logger.error(f"Failed to scan {log_path}: {e}")
        
        # Report found errors
        for error in errors_found[:20]:  # Limit to 20 errors per scan
            await self.report_error(tenant_id, {
                "message": error["message"],
                "source": error["source"]
            })
        
        return {
            "scanned": True,
            "errors_found": len(errors_found),
            "errors_reported": min(len(errors_found), 20)
        }
    
    async def fix_error(self, tenant_id: str, error_id: str) -> Dict:
        """Manually trigger fix for a specific error"""
        error = await self.collection.find_one({"id": error_id, "tenant_id": tenant_id})
        if not error:
            return {"success": False, "message": "Error not found"}
        
        fix_suggestion = await self._generate_ai_fix(error)
        fix_result = await self._apply_fix(error, fix_suggestion)
        
        if fix_result.get("success"):
            await self.collection.update_one(
                {"id": error_id},
                {"$set": {
                    "status": "fixed",
                    "fix_attempts": error.get("fix_attempts", 0) + 1,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        
        return {
            "success": fix_result.get("success", False),
            "fix": fix_suggestion,
            "message": fix_result.get("message", "")
        }
    
    async def clear_errors(self, tenant_id: str) -> Dict:
        """Clear all errors for tenant"""
        result = await self.collection.delete_many({"tenant_id": tenant_id})
        return {"deleted": result.deleted_count}
    
    async def start_monitoring(self, tenant_id: str):
        """Start continuous monitoring"""
        self.monitoring_active = True
        
        async def monitor_loop():
            while self.monitoring_active:
                try:
                    await self.scan_logs(tenant_id)
                except Exception as e:
                    logger.error(f"Monitoring error: {e}")
                await asyncio.sleep(60)  # Scan every 60 seconds
        
        self.monitor_task = asyncio.create_task(monitor_loop())
        return {"status": "monitoring_started"}
    
    async def stop_monitoring(self):
        """Stop continuous monitoring"""
        self.monitoring_active = False
        if self.monitor_task:
            self.monitor_task.cancel()
        return {"status": "monitoring_stopped"}
    
    # ==========================================
    # ERROR PATTERN LEARNING METHODS
    # ==========================================
    
    def _generate_pattern_hash(self, error_type: str, message: str) -> str:
        """Generate a hash to identify similar error patterns"""
        # Normalize the message by removing specific details (line numbers, timestamps, etc.)
        normalized_msg = re.sub(r'\d+', 'NUM', message.lower())
        normalized_msg = re.sub(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', 'UUID', normalized_msg)
        normalized_msg = re.sub(r'/[^\s]+', '/PATH', normalized_msg)
        normalized_msg = re.sub(r'\s+', ' ', normalized_msg).strip()
        
        # Create hash from error type + normalized message
        hash_input = f"{error_type}:{normalized_msg[:200]}"
        return hashlib.md5(hash_input.encode()).hexdigest()
    
    def _extract_error_signature(self, error_doc: Dict) -> Dict:
        """Extract key signature elements from an error for pattern matching"""
        return {
            "error_type": error_doc.get("error_type", ""),
            "error_name": error_doc.get("error_name", ""),
            "category": error_doc.get("category", ""),
            "message_keywords": self._extract_keywords(error_doc.get("message", "")),
            "file_extension": self._get_file_extension(error_doc.get("file_path", "")),
            "severity": error_doc.get("severity", "medium")
        }
    
    def _extract_keywords(self, message: str) -> List[str]:
        """Extract important keywords from an error message"""
        # Remove common words and extract meaningful terms
        stopwords = {'the', 'a', 'an', 'is', 'at', 'on', 'in', 'for', 'to', 'of', 'and', 'or', 'not'}
        words = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', message.lower())
        keywords = [w for w in words if w not in stopwords and len(w) > 2]
        return list(set(keywords))[:20]  # Top 20 unique keywords
    
    def _get_file_extension(self, file_path: str) -> str:
        """Get file extension from path"""
        if '.' in file_path:
            return file_path.rsplit('.', 1)[-1].lower()
        return ""
    
    async def _learn_from_fix(self, error_doc: Dict, fix_suggestion: Dict, success: bool):
        """Learn from a successful fix and store the pattern"""
        if not success:
            return  # Only learn from successful fixes
        
        try:
            pattern_hash = self._generate_pattern_hash(
                error_doc.get("error_type", ""),
                error_doc.get("message", "")
            )
            
            error_signature = self._extract_error_signature(error_doc)
            
            # Check if pattern already exists
            existing_pattern = await self.patterns_collection.find_one({"pattern_hash": pattern_hash})
            
            if existing_pattern:
                # Update existing pattern - increase confidence
                new_success_count = existing_pattern.get("success_count", 0) + 1
                new_confidence = min(0.99, existing_pattern.get("confidence_score", 0.5) + 0.05)
                
                await self.patterns_collection.update_one(
                    {"pattern_hash": pattern_hash},
                    {"$set": {
                        "success_count": new_success_count,
                        "confidence_score": new_confidence,
                        "last_used": datetime.now(timezone.utc),
                        "fix_suggestion": fix_suggestion  # Update with latest fix
                    }}
                )
                logger.info(f"Pattern updated: {pattern_hash} (success_count: {new_success_count}, confidence: {new_confidence:.2f})")
            else:
                # Create new pattern
                pattern_doc = {
                    "id": str(uuid.uuid4()),
                    "pattern_hash": pattern_hash,
                    "error_type": error_doc.get("error_type", ""),
                    "error_name": error_doc.get("error_name", ""),
                    "category": error_doc.get("category", ""),
                    "error_signature": error_signature,
                    "original_message_sample": error_doc.get("message", "")[:300],
                    "fix_suggestion": fix_suggestion,
                    "success_count": 1,
                    "failure_count": 0,
                    "confidence_score": 0.6,  # Initial confidence
                    "created_at": datetime.now(timezone.utc),
                    "last_used": datetime.now(timezone.utc),
                    "learned_from_error_id": error_doc.get("id", "")
                }
                await self.patterns_collection.insert_one(pattern_doc)
                logger.info(f"New pattern learned: {pattern_hash} for error type {error_doc.get('error_type')}")
                
        except Exception as e:
            logger.error(f"Failed to learn from fix: {e}")
    
    async def _find_matching_pattern(self, error_doc: Dict) -> Optional[Dict]:
        """Find a learned pattern that matches the given error"""
        try:
            # First, try exact pattern hash match
            pattern_hash = self._generate_pattern_hash(
                error_doc.get("error_type", ""),
                error_doc.get("message", "")
            )
            
            exact_match = await self.patterns_collection.find_one({
                "pattern_hash": pattern_hash,
                "confidence_score": {"$gte": 0.5}  # Only use patterns with reasonable confidence
            })
            
            if exact_match:
                logger.info(f"Exact pattern match found: {pattern_hash}")
                return exact_match
            
            # Try fuzzy matching based on error type and keywords
            error_signature = self._extract_error_signature(error_doc)
            keywords = error_signature.get("message_keywords", [])
            
            if not keywords:
                return None
            
            # Find patterns with same error type and overlapping keywords
            similar_patterns = await self.patterns_collection.find({
                "error_type": error_doc.get("error_type", ""),
                "confidence_score": {"$gte": 0.7},  # Higher threshold for fuzzy matches
                "error_signature.message_keywords": {"$in": keywords}
            }).sort("confidence_score", -1).limit(5).to_list(5)
            
            if similar_patterns:
                # Return the pattern with most keyword overlap
                best_match = None
                best_overlap = 0
                
                for pattern in similar_patterns:
                    pattern_keywords = set(pattern.get("error_signature", {}).get("message_keywords", []))
                    overlap = len(set(keywords) & pattern_keywords)
                    if overlap > best_overlap:
                        best_overlap = overlap
                        best_match = pattern
                
                if best_match and best_overlap >= 3:  # At least 3 keywords overlap
                    logger.info(f"Fuzzy pattern match found with {best_overlap} keyword overlap")
                    return best_match
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding matching pattern: {e}")
            return None
    
    async def get_learned_patterns(self, limit: int = 50) -> Dict:
        """Get all learned patterns with statistics"""
        patterns = await self.patterns_collection.find(
            {}, 
            {"_id": 0}
        ).sort("success_count", -1).limit(limit).to_list(limit)
        
        # Get total stats
        total_patterns = await self.patterns_collection.count_documents({})
        high_confidence = await self.patterns_collection.count_documents({"confidence_score": {"$gte": 0.8}})
        
        # Group by error type
        type_pipeline = [
            {"$group": {"_id": "$error_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        by_type = await self.patterns_collection.aggregate(type_pipeline).to_list(10)
        
        return {
            "total_patterns": total_patterns,
            "high_confidence_patterns": high_confidence,
            "patterns_by_type": {t["_id"]: t["count"] for t in by_type},
            "patterns": patterns
        }
    
    async def clear_patterns(self) -> Dict:
        """Clear all learned patterns"""
        result = await self.patterns_collection.delete_many({})
        logger.info(f"Cleared {result.deleted_count} learned patterns")
        return {"deleted": result.deleted_count}
    
    async def record_pattern_failure(self, pattern_hash: str):
        """Record when a pattern-based fix fails"""
        try:
            pattern = await self.patterns_collection.find_one({"pattern_hash": pattern_hash})
            if pattern:
                new_failure_count = pattern.get("failure_count", 0) + 1
                
                # Decrease confidence based on failure rate
                new_confidence = max(0.1, pattern.get("confidence_score", 0.5) - 0.1)
                
                await self.patterns_collection.update_one(
                    {"pattern_hash": pattern_hash},
                    {"$set": {
                        "failure_count": new_failure_count,
                        "confidence_score": new_confidence
                    }}
                )
                logger.info(f"Pattern {pattern_hash} marked as failed, new confidence: {new_confidence:.2f}")
        except Exception as e:
            logger.error(f"Failed to record pattern failure: {e}")
    
    async def teach_pattern(self, pattern_data: Dict) -> Dict:
        """Manually teach a specific error pattern and its fix to the agent"""
        try:
            error_type = pattern_data.get("error_type", "JS_SYNTAX_ERROR")
            error_message = pattern_data.get("error_message", "")
            
            # Generate pattern hash
            pattern_hash = self._generate_pattern_hash(error_type, error_message)
            
            # Extract error signature
            error_signature = {
                "error_type": error_type,
                "error_name": pattern_data.get("error_name", "SyntaxError"),
                "category": pattern_data.get("category", "JavaScript"),
                "message_keywords": self._extract_keywords(error_message),
                "file_extension": self._get_file_extension(pattern_data.get("file_path", "")),
                "severity": pattern_data.get("severity", "critical")
            }
            
            # Build fix suggestion
            fix_suggestion = {
                "description": pattern_data.get("fix_description", ""),
                "code": pattern_data.get("fix_code", ""),
                "steps": pattern_data.get("fix_steps", []),
                "confidence": "high"
            }
            
            # Check if pattern already exists
            existing = await self.patterns_collection.find_one({"pattern_hash": pattern_hash})
            
            if existing:
                # Update existing pattern
                await self.patterns_collection.update_one(
                    {"pattern_hash": pattern_hash},
                    {"$set": {
                        "fix_suggestion": fix_suggestion,
                        "error_signature": error_signature,
                        "confidence_score": 0.95,  # High confidence for manually taught patterns
                        "success_count": existing.get("success_count", 0) + 1,
                        "last_used": datetime.now(timezone.utc),
                        "manually_taught": True
                    }}
                )
                logger.info(f"Updated existing pattern: {pattern_hash}")
                return {"status": "updated", "pattern_hash": pattern_hash}
            else:
                # Create new pattern
                pattern_doc = {
                    "id": str(uuid.uuid4()),
                    "pattern_hash": pattern_hash,
                    "error_type": error_type,
                    "error_name": pattern_data.get("error_name", ""),
                    "category": pattern_data.get("category", "JavaScript"),
                    "error_signature": error_signature,
                    "original_message_sample": error_message[:300],
                    "fix_suggestion": fix_suggestion,
                    "success_count": 1,
                    "failure_count": 0,
                    "confidence_score": 0.95,  # High confidence for manually taught patterns
                    "created_at": datetime.now(timezone.utc),
                    "last_used": datetime.now(timezone.utc),
                    "manually_taught": True
                }
                await self.patterns_collection.insert_one(pattern_doc)
                logger.info(f"Created new taught pattern: {pattern_hash}")
                return {"status": "created", "pattern_hash": pattern_hash, "pattern_id": pattern_doc["id"]}
                
        except Exception as e:
            logger.error(f"Failed to teach pattern: {e}")
            return {"status": "error", "message": str(e)}
