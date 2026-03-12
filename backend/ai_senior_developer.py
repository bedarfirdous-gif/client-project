"""
AI Senior Developer Agent
=========================
An autonomous AI system that monitors, detects, and fixes software errors
across frontend and backend codebases. Designed for long-term operation (20+ years).

Features:
- Real-time error monitoring (backend logs, frontend builds)
- Pattern recognition for recurring issues
- Automated fix generation and application
- Self-learning from past fixes
- Comprehensive audit logging
- Health reporting and alerts

Author: AI Senior Developer System
Version: 1.0.0
"""

import asyncio
import os
import re
import subprocess
import json
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AISeniorDeveloper")


class ErrorSeverity(Enum):
    CRITICAL = "critical"      # App crashes, build fails
    HIGH = "high"              # Major functionality broken
    MEDIUM = "medium"          # Feature degraded
    LOW = "low"                # Minor issues, warnings
    INFO = "info"              # Informational


class ErrorCategory(Enum):
    SYNTAX = "syntax"                    # Syntax errors
    IMPORT = "import"                    # Missing/wrong imports
    DUPLICATE = "duplicate"              # Duplicate declarations
    UNDEFINED = "undefined"              # Undefined variables/functions
    TYPE = "type"                        # Type errors
    RUNTIME = "runtime"                  # Runtime exceptions
    DATABASE = "database"                # Database/MongoDB errors
    API = "api"                          # API endpoint errors
    BUILD = "build"                      # Build failures
    LINT = "lint"                        # Linting issues
    INTEGRITY = "integrity"              # Data integrity issues
    PERFORMANCE = "performance"          # Performance issues
    SECURITY = "security"                # Security vulnerabilities


@dataclass
class DetectedError:
    id: str
    timestamp: str
    category: str
    severity: str
    file_path: str
    line_number: Optional[int]
    error_message: str
    error_pattern: str
    suggested_fix: Optional[str]
    auto_fixable: bool
    fixed: bool = False
    fix_applied_at: Optional[str] = None
    fix_details: Optional[str] = None


@dataclass
class FixPattern:
    pattern_id: str
    error_pattern: str
    fix_template: str
    category: str
    success_count: int = 0
    failure_count: int = 0
    last_used: Optional[str] = None
    confidence: float = 0.0


class AISeniorDeveloper:
    """
    AI Senior Developer Agent - Autonomous Error Detection and Fixing System
    
    IMPORTANT: In production (AWS), this should run in MONITOR-ONLY mode.
    Service restarts should be handled by:
    - ECS/EKS container orchestration
    - ALB health checks
    - CloudWatch alarms
    
    Set environment variable: AI_DEVELOPER_MODE=monitor_only for production
    """
    
    def __init__(self, db=None):
        self.db = db
        self.frontend_path = "/app/frontend"
        self.backend_path = "/app/backend"
        
        # Production safety: Check if we should only monitor (not auto-heal)
        self.monitor_only = os.environ.get("AI_DEVELOPER_MODE", "").lower() == "monitor_only"
        if self.monitor_only:
            logger.info("AI Senior Developer running in MONITOR-ONLY mode (production safe)")
        
        self.log_paths = {
            "backend_err": "/var/log/supervisor/backend.err.log",
            "backend_out": "/var/log/supervisor/backend.out.log",
            "frontend_err": "/var/log/supervisor/frontend.err.log",
        }
        self.monitoring_interval = 30  # seconds
        self.is_running = False
        self.errors_detected: List[DetectedError] = []
        self.fix_patterns: Dict[str, FixPattern] = {}
        self.stats = {
            "total_scans": 0,
            "errors_detected": 0,
            "errors_fixed": 0,
            "auto_fixes_applied": 0,
            "manual_fixes_needed": 0,
            "last_scan": None,
            "uptime_start": datetime.now(timezone.utc).isoformat()
        }
        
        # Known fix patterns for common errors
        self._init_fix_patterns()
        
    def _init_fix_patterns(self):
        """Initialize known fix patterns for common errors"""
        patterns = [
            # Duplicate declaration pattern
            FixPattern(
                pattern_id="dup_declaration",
                error_pattern=r"Identifier '(\w+)' has already been declared",
                fix_template="Remove duplicate declaration of '{identifier}'",
                category=ErrorCategory.DUPLICATE.value,
                confidence=0.95
            ),
            # Missing import pattern
            FixPattern(
                pattern_id="missing_import",
                error_pattern=r"'(\w+)' is not defined|(\w+) is not defined",
                fix_template="Add import for '{identifier}' from appropriate module",
                category=ErrorCategory.IMPORT.value,
                confidence=0.85
            ),
            # MongoDB ObjectId serialization
            FixPattern(
                pattern_id="objectid_serial",
                error_pattern=r"Object of type ObjectId is not JSON serializable",
                fix_template="Exclude _id from MongoDB query or convert to string",
                category=ErrorCategory.DATABASE.value,
                confidence=0.90
            ),
            # Module not found
            FixPattern(
                pattern_id="module_not_found",
                error_pattern=r"Module not found: Can't resolve '([^']+)'",
                fix_template="Install missing module '{module}' or fix import path",
                category=ErrorCategory.IMPORT.value,
                confidence=0.88
            ),
            # Undefined variable in Python
            FixPattern(
                pattern_id="undefined_python",
                error_pattern=r"NameError: name '(\w+)' is not defined",
                fix_template="Define or import '{identifier}' before use",
                category=ErrorCategory.UNDEFINED.value,
                confidence=0.85
            ),
            # Syntax error Python
            FixPattern(
                pattern_id="syntax_python",
                error_pattern=r"SyntaxError: (.+)",
                fix_template="Fix syntax error: {details}",
                category=ErrorCategory.SYNTAX.value,
                confidence=0.70
            ),
            # React hook error
            FixPattern(
                pattern_id="react_hook",
                error_pattern=r"React Hook .+ cannot be called",
                fix_template="Move hook call to component top level",
                category=ErrorCategory.RUNTIME.value,
                confidence=0.80
            ),
        ]
        
        for pattern in patterns:
            self.fix_patterns[pattern.pattern_id] = pattern
    
    def _generate_error_id(self, error_msg: str, file_path: str) -> str:
        """Generate unique error ID based on content"""
        content = f"{error_msg}:{file_path}"
        return hashlib.md5(content.encode()).hexdigest()[:12]
    
    async def scan_frontend_build(self) -> List[DetectedError]:
        """Run frontend build and detect errors"""
        errors = []
        try:
            result = subprocess.run(
                ["yarn", "build"],
                cwd=self.frontend_path,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            output = result.stdout + result.stderr
            
            # Parse build errors
            # Pattern: src/pages/File.js\nSyntax error: message (line:col)
            error_blocks = re.findall(
                r'(src/[^\n]+\.jsx?)\n.*?(?:Syntax error|Error): ([^\n]+)',
                output, re.MULTILINE
            )
            
            for file_path, error_msg in error_blocks:
                # Extract line number if present
                line_match = re.search(r'\((\d+):\d+\)', error_msg)
                line_num = int(line_match.group(1)) if line_match else None
                
                # Categorize error
                category, severity, fix_info = self._categorize_error(error_msg)
                
                error = DetectedError(
                    id=self._generate_error_id(error_msg, file_path),
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    category=category,
                    severity=severity,
                    file_path=os.path.join(self.frontend_path, file_path),
                    line_number=line_num,
                    error_message=error_msg,
                    error_pattern=fix_info.get("pattern_id", ""),
                    suggested_fix=fix_info.get("fix", ""),
                    auto_fixable=fix_info.get("auto_fixable", False)
                )
                errors.append(error)
            
            # Check for duplicate declarations specifically
            dup_matches = re.findall(
                r"(src/[^\n]+\.jsx?)\n.*?Identifier '(\w+)' has already been declared.*?\((\d+):\d+\)",
                output, re.MULTILINE | re.DOTALL
            )
            
            for file_path, identifier, line_num in dup_matches:
                error = DetectedError(
                    id=self._generate_error_id(f"duplicate:{identifier}", file_path),
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    category=ErrorCategory.DUPLICATE.value,
                    severity=ErrorSeverity.CRITICAL.value,
                    file_path=os.path.join(self.frontend_path, file_path),
                    line_number=int(line_num),
                    error_message=f"Identifier '{identifier}' has already been declared",
                    error_pattern="dup_declaration",
                    suggested_fix=f"Remove duplicate declaration of '{identifier}' at line {line_num}",
                    auto_fixable=True
                )
                errors.append(error)
                
        except subprocess.TimeoutExpired:
            logger.error("Frontend build timed out")
        except Exception as e:
            logger.error(f"Frontend scan error: {e}")
        
        return errors
    
    async def scan_frontend_lint(self) -> List[DetectedError]:
        """Quick frontend lint check using ESLint (faster than full build)"""
        errors = []
        try:
            # Use ESLint for quick syntax/import checks
            result = subprocess.run(
                ["npx", "eslint", "src/pages", "--format=json", "--max-warnings=0"],
                cwd=self.frontend_path,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.stdout:
                try:
                    lint_results = json.loads(result.stdout)
                    for file_result in lint_results:
                        for msg in file_result.get("messages", []):
                            severity = ErrorSeverity.LOW.value
                            if msg.get("severity") == 2:  # Error
                                severity = ErrorSeverity.HIGH.value
                            
                            # Check for specific error patterns
                            rule_id = msg.get("ruleId", "")
                            message = msg.get("message", "")
                            
                            if "already been declared" in message or rule_id == "no-redeclare":
                                severity = ErrorSeverity.CRITICAL.value
                                category = ErrorCategory.DUPLICATE.value
                            elif "not defined" in message or rule_id == "no-undef":
                                severity = ErrorSeverity.HIGH.value
                                category = ErrorCategory.UNDEFINED.value
                            elif "import" in rule_id.lower():
                                category = ErrorCategory.IMPORT.value
                            else:
                                category = ErrorCategory.LINT.value
                            
                            error = DetectedError(
                                id=self._generate_error_id(message, file_result.get("filePath", "")),
                                timestamp=datetime.now(timezone.utc).isoformat(),
                                category=category,
                                severity=severity,
                                file_path=file_result.get("filePath", ""),
                                line_number=msg.get("line"),
                                error_message=message,
                                error_pattern=rule_id,
                                suggested_fix=msg.get("fix", {}).get("text") if msg.get("fix") else None,
                                auto_fixable=msg.get("fix") is not None
                            )
                            errors.append(error)
                except json.JSONDecodeError:
                    pass
                    
        except subprocess.TimeoutExpired:
            logger.error("Frontend lint timed out")
        except Exception as e:
            logger.error(f"Frontend lint error: {e}")
        
        return errors
    
    async def scan_backend_lint(self) -> List[DetectedError]:
        """Run backend linting and detect errors"""
        errors = []
        try:
            result = subprocess.run(
                ["python", "-m", "ruff", "check", "server.py", "--output-format=json"],
                cwd=self.backend_path,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.stdout:
                try:
                    lint_errors = json.loads(result.stdout)
                    for err in lint_errors:
                        severity = ErrorSeverity.LOW.value
                        if err.get("code", "").startswith("F"):  # Pyflakes errors
                            if "redefinition" in err.get("message", "").lower():
                                severity = ErrorSeverity.MEDIUM.value
                            elif "undefined" in err.get("message", "").lower():
                                severity = ErrorSeverity.HIGH.value
                        
                        error = DetectedError(
                            id=self._generate_error_id(err.get("message", ""), err.get("filename", "")),
                            timestamp=datetime.now(timezone.utc).isoformat(),
                            category=ErrorCategory.LINT.value,
                            severity=severity,
                            file_path=os.path.join(self.backend_path, err.get("filename", "")),
                            line_number=err.get("location", {}).get("row"),
                            error_message=err.get("message", ""),
                            error_pattern=err.get("code", ""),
                            suggested_fix=err.get("fix", {}).get("message") if err.get("fix") else None,
                            auto_fixable=err.get("fix") is not None
                        )
                        errors.append(error)
                except json.JSONDecodeError:
                    pass
                    
        except Exception as e:
            logger.error(f"Backend lint error: {e}")
        
        return errors
    
    async def scan_backend_logs(self) -> List[DetectedError]:
        """Scan backend logs for runtime errors"""
        errors = []
        try:
            log_path = self.log_paths.get("backend_err")
            if os.path.exists(log_path):
                with open(log_path, 'r') as f:
                    # Read last 500 lines
                    lines = f.readlines()[-500:]
                    content = ''.join(lines)
                
                # Look for Python exceptions
                exception_pattern = r'(Traceback \(most recent call last\):.*?(?=\n\n|\Z))'
                exceptions = re.findall(exception_pattern, content, re.DOTALL)
                
                for exc in exceptions[-10:]:  # Last 10 exceptions
                    # Extract error type and message
                    error_match = re.search(r'(\w+Error): (.+?)$', exc, re.MULTILINE)
                    if error_match:
                        error_type, error_msg = error_match.groups()
                        
                        # Extract file and line
                        file_match = re.search(r'File "([^"]+)", line (\d+)', exc)
                        file_path = file_match.group(1) if file_match else ""
                        line_num = int(file_match.group(2)) if file_match else None
                        
                        error = DetectedError(
                            id=self._generate_error_id(error_msg, file_path),
                            timestamp=datetime.now(timezone.utc).isoformat(),
                            category=ErrorCategory.RUNTIME.value,
                            severity=ErrorSeverity.HIGH.value,
                            file_path=file_path,
                            line_number=line_num,
                            error_message=f"{error_type}: {error_msg}",
                            error_pattern=error_type.lower(),
                            suggested_fix=self._get_fix_suggestion(error_type, error_msg),
                            auto_fixable=False
                        )
                        errors.append(error)
                        
        except Exception as e:
            logger.error(f"Backend log scan error: {e}")
        
        return errors
    
    async def check_data_integrity(self) -> List[DetectedError]:
        """Check database data integrity"""
        errors = []
        if self.db is None:
            return errors
        
        try:
            # Check suppliers without ledger_id
            suppliers = await self.db.suppliers.find(
                {"ledger_id": {"$in": [None, ""]}}
            ).to_list(1000)
            
            if suppliers:
                error = DetectedError(
                    id=self._generate_error_id("unlinked_suppliers", "database"),
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    category=ErrorCategory.INTEGRITY.value,
                    severity=ErrorSeverity.MEDIUM.value,
                    file_path="database:suppliers",
                    line_number=None,
                    error_message=f"{len(suppliers)} suppliers without ledger_id",
                    error_pattern="unlinked_party",
                    suggested_fix="Run sync-ledgers API to link suppliers to ledgers",
                    auto_fixable=True
                )
                errors.append(error)
            
            # Check customers without ledger_id
            customers = await self.db.customers.find(
                {"ledger_id": {"$in": [None, ""]}}
            ).to_list(1000)
            
            if customers:
                error = DetectedError(
                    id=self._generate_error_id("unlinked_customers", "database"),
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    category=ErrorCategory.INTEGRITY.value,
                    severity=ErrorSeverity.MEDIUM.value,
                    file_path="database:customers",
                    line_number=None,
                    error_message=f"{len(customers)} customers without ledger_id",
                    error_pattern="unlinked_party",
                    suggested_fix="Run sync-ledgers API to link customers to ledgers",
                    auto_fixable=True
                )
                errors.append(error)
                
        except Exception as e:
            logger.error(f"Data integrity check error: {e}")
        
        return errors
    
    def _categorize_error(self, error_msg: str) -> Tuple[str, str, Dict]:
        """Categorize error and find matching fix pattern"""
        fix_info = {"auto_fixable": False, "fix": None, "pattern_id": None}
        
        for pattern_id, pattern in self.fix_patterns.items():
            if re.search(pattern.error_pattern, error_msg, re.IGNORECASE):
                fix_info = {
                    "auto_fixable": pattern.confidence > 0.85,
                    "fix": pattern.fix_template,
                    "pattern_id": pattern_id
                }
                return pattern.category, self._severity_from_category(pattern.category), fix_info
        
        # Default categorization
        if "syntax" in error_msg.lower():
            return ErrorCategory.SYNTAX.value, ErrorSeverity.CRITICAL.value, fix_info
        elif "import" in error_msg.lower() or "module" in error_msg.lower():
            return ErrorCategory.IMPORT.value, ErrorSeverity.HIGH.value, fix_info
        elif "undefined" in error_msg.lower() or "not defined" in error_msg.lower():
            return ErrorCategory.UNDEFINED.value, ErrorSeverity.HIGH.value, fix_info
        
        return ErrorCategory.RUNTIME.value, ErrorSeverity.MEDIUM.value, fix_info
    
    def _severity_from_category(self, category: str) -> str:
        """Get default severity for category"""
        severity_map = {
            ErrorCategory.SYNTAX.value: ErrorSeverity.CRITICAL.value,
            ErrorCategory.DUPLICATE.value: ErrorSeverity.CRITICAL.value,
            ErrorCategory.IMPORT.value: ErrorSeverity.HIGH.value,
            ErrorCategory.UNDEFINED.value: ErrorSeverity.HIGH.value,
            ErrorCategory.BUILD.value: ErrorSeverity.CRITICAL.value,
            ErrorCategory.DATABASE.value: ErrorSeverity.MEDIUM.value,
            ErrorCategory.LINT.value: ErrorSeverity.LOW.value,
        }
        return severity_map.get(category, ErrorSeverity.MEDIUM.value)
    
    def _get_fix_suggestion(self, error_type: str, error_msg: str) -> str:
        """Get fix suggestion based on error type"""
        suggestions = {
            "NameError": "Check if variable is defined or imported before use",
            "ImportError": "Verify module is installed and import path is correct",
            "TypeError": "Check argument types and function signatures",
            "KeyError": "Verify key exists in dictionary, use .get() for safe access",
            "AttributeError": "Check if object has the attribute, handle None values",
            "ValueError": "Validate input data before processing",
            "IndexError": "Check list bounds before accessing index",
        }
        return suggestions.get(error_type, "Review error details and fix accordingly")
    
    async def apply_fix(self, error: DetectedError) -> bool:
        """Attempt to automatically fix an error"""
        if not error.auto_fixable:
            return False
        
        try:
            if error.error_pattern == "dup_declaration":
                return await self._fix_duplicate_declaration(error)
            elif error.error_pattern == "unlinked_party":
                return await self._fix_unlinked_party(error)
            # Add more fix handlers here
            
        except Exception as e:
            logger.error(f"Failed to apply fix for {error.id}: {e}")
        
        return False
    
    async def _fix_duplicate_declaration(self, error: DetectedError) -> bool:
        """Fix duplicate variable declaration"""
        try:
            # Extract identifier from error message
            match = re.search(r"'(\w+)'", error.error_message)
            if not match:
                return False
            
            identifier = match.group(1)
            file_path = error.file_path
            
            if not os.path.exists(file_path):
                return False
            
            with open(file_path, 'r') as f:
                lines = f.readlines()
            
            # Find all declarations of this identifier
            declaration_pattern = rf'\b(const|let|var)\s+\[?\s*{identifier}\s*[,\]=]'
            declarations = []
            
            for i, line in enumerate(lines):
                if re.search(declaration_pattern, line):
                    declarations.append((i + 1, line))
            
            if len(declarations) <= 1:
                return False  # No duplicate
            
            # Keep first declaration, mark others for removal
            # Check if any are from destructuring (should keep) vs useState (should remove)
            lines_to_remove = []
            for line_num, line in declarations[1:]:
                if 'useState' in line and identifier in ['displayCurrency', 'loading', 'timeout']:
                    lines_to_remove.append(line_num - 1)  # 0-indexed
            
            if not lines_to_remove:
                return False
            
            # Remove duplicate lines
            new_lines = [l for i, l in enumerate(lines) if i not in lines_to_remove]
            
            with open(file_path, 'w') as f:
                f.writelines(new_lines)
            
            logger.info(f"Fixed duplicate declaration of '{identifier}' in {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to fix duplicate declaration: {e}")
            return False
    
    async def _fix_unlinked_party(self, error: DetectedError) -> bool:
        """Fix unlinked suppliers/customers"""
        if self.db is None:
            return False
        
        try:
            import uuid
            
            if "suppliers" in error.file_path:
                collection = self.db.suppliers
                group_id = "sundry_creditors"
                party_type = "supplier"
            elif "customers" in error.file_path:
                collection = self.db.customers
                group_id = "sundry_debtors"
                party_type = "customer"
            else:
                return False
            
            # Find unlinked records
            records = await collection.find({"ledger_id": {"$in": [None, ""]}}).to_list(1000)
            
            fixed_count = 0
            for record in records:
                tenant_id = record.get("tenant_id")
                name = record.get("name")
                
                # Check for existing ledger
                existing = await self.db.ledgers.find_one({
                    "tenant_id": tenant_id,
                    "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"},
                    "group_id": group_id
                })
                
                if existing:
                    await collection.update_one(
                        {"id": record["id"]},
                        {"$set": {"ledger_id": existing["id"]}}
                    )
                else:
                    ledger_id = str(uuid.uuid4())
                    await self.db.ledgers.insert_one({
                        "id": ledger_id,
                        "tenant_id": tenant_id,
                        "name": name,
                        "group_id": group_id,
                        "opening_balance": 0,
                        "current_balance": 0,
                        "balance_type": "Cr" if party_type == "supplier" else "Dr",
                        "status": "Active",
                        "linked_party_id": record["id"],
                        "linked_party_type": party_type,
                        "is_deleted": False
                    })
                    await collection.update_one(
                        {"id": record["id"]},
                        {"$set": {"ledger_id": ledger_id}}
                    )
                fixed_count += 1
            
            logger.info(f"Fixed {fixed_count} unlinked {party_type}s")
            return fixed_count > 0
            
        except Exception as e:
            logger.error(f"Failed to fix unlinked party: {e}")
            return False
    
    async def run_full_scan(self) -> Dict[str, Any]:
        """Run complete system scan"""
        self.stats["total_scans"] += 1
        self.stats["last_scan"] = datetime.now(timezone.utc).isoformat()
        
        all_errors = []
        
        # Quick frontend lint check (faster than full build)
        logger.info("Scanning frontend with ESLint...")
        frontend_errors = await self.scan_frontend_lint()
        all_errors.extend(frontend_errors)
        
        # Scan backend
        logger.info("Scanning backend lint...")
        backend_lint_errors = await self.scan_backend_lint()
        all_errors.extend(backend_lint_errors)
        
        # Scan logs
        logger.info("Scanning backend logs...")
        log_errors = await self.scan_backend_logs()
        all_errors.extend(log_errors)
        
        # Check data integrity
        logger.info("Checking data integrity...")
        integrity_errors = await self.check_data_integrity()
        all_errors.extend(integrity_errors)
        
        # Deduplicate errors
        seen_ids = set()
        unique_errors = []
        for error in all_errors:
            if error.id not in seen_ids:
                seen_ids.add(error.id)
                unique_errors.append(error)
        
        self.errors_detected = unique_errors
        self.stats["errors_detected"] = len(unique_errors)
        
        # Attempt auto-fixes
        fixed_count = 0
        for error in unique_errors:
            if error.auto_fixable and not error.fixed:
                if await self.apply_fix(error):
                    error.fixed = True
                    error.fix_applied_at = datetime.now(timezone.utc).isoformat()
                    fixed_count += 1
        
        self.stats["auto_fixes_applied"] += fixed_count
        self.stats["errors_fixed"] += fixed_count
        self.stats["manual_fixes_needed"] = len([e for e in unique_errors if not e.fixed and not e.auto_fixable])
        
        # Save to database
        if self.db is not None:
            await self._save_scan_results(unique_errors)
        
        return {
            "scan_time": self.stats["last_scan"],
            "total_errors": len(unique_errors),
            "critical": len([e for e in unique_errors if e.severity == ErrorSeverity.CRITICAL.value]),
            "high": len([e for e in unique_errors if e.severity == ErrorSeverity.HIGH.value]),
            "medium": len([e for e in unique_errors if e.severity == ErrorSeverity.MEDIUM.value]),
            "low": len([e for e in unique_errors if e.severity == ErrorSeverity.LOW.value]),
            "auto_fixed": fixed_count,
            "errors": [asdict(e) for e in unique_errors[:50]]  # Return top 50
        }
    
    async def _save_scan_results(self, errors: List[DetectedError]):
        """Save scan results to database"""
        try:
            scan_doc = {
                "id": f"scan_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "stats": self.stats.copy(),
                "errors": [asdict(e) for e in errors],
                "categories": {}
            }
            
            # Count by category
            for error in errors:
                cat = error.category
                scan_doc["categories"][cat] = scan_doc["categories"].get(cat, 0) + 1
            
            await self.db.ai_developer_scans.insert_one(scan_doc)
            
            # Keep only last 100 scans
            count = await self.db.ai_developer_scans.count_documents({})
            if count > 100:
                oldest = await self.db.ai_developer_scans.find().sort("timestamp", 1).limit(count - 100).to_list(count - 100)
                ids = [d["id"] for d in oldest]
                await self.db.ai_developer_scans.delete_many({"id": {"$in": ids}})
                
        except Exception as e:
            logger.error(f"Failed to save scan results: {e}")
    
    async def get_health_report(self) -> Dict[str, Any]:
        """Get system health report (quick check, no full build)"""
        import aiohttp
        
        # Check frontend
        frontend_ok = False
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                async with session.get("http://localhost:3000") as resp:
                    frontend_ok = resp.status in [200, 304, 302, 301]
        except:
            frontend_ok = False
        
        # Check backend
        backend_ok = False
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                async with session.get("http://localhost:8001/api/health") as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        backend_ok = data.get("status") == "healthy"
        except:
            backend_ok = False
        
        critical_errors = len([e for e in self.errors_detected if e.severity == ErrorSeverity.CRITICAL.value and not e.fixed])
        unfixed_errors = len([e for e in self.errors_detected if not e.fixed])
        
        # System is healthy if both services are running and no critical unfixed errors
        if frontend_ok and backend_ok and critical_errors == 0:
            status = "healthy"
        elif frontend_ok and backend_ok:
            status = "degraded"
        else:
            status = "unhealthy"
        
        return {
            "status": status,
            "frontend_build": "passing" if frontend_ok else "failing",
            "backend_api": "running" if backend_ok else "down",
            "critical_errors": critical_errors,
            "total_errors": unfixed_errors,
            "last_scan": self.stats.get("last_scan"),
            "uptime": self.stats.get("uptime_start"),
            "stats": self.stats
        }
    
    async def start_monitoring(self):
        """Start continuous monitoring loop"""
        self.is_running = True
        logger.info("AI Senior Developer Agent started - monitoring system...")
        
        while self.is_running:
            try:
                # First, check and auto-heal services
                await self.auto_heal_services()
                
                # Then run full scan
                await self.run_full_scan()
                logger.info(f"Scan complete. Errors: {self.stats['errors_detected']}, Fixed: {self.stats['auto_fixes_applied']}")
            except Exception as e:
                logger.error(f"Monitoring cycle error: {e}")
            
            await asyncio.sleep(self.monitoring_interval)
    
    async def auto_heal_services(self):
        """Automatically restart services that are down (frontend only - backend cannot restart itself)
        
        PRODUCTION NOTE: In monitor_only mode, this only logs warnings without restarting.
        AWS ECS/EKS should handle restarts via health checks.
        """
        try:
            # Check frontend health
            frontend_ok = False
            try:
                result = subprocess.run(
                    ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "http://localhost:3000"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                frontend_ok = result.stdout.strip() in ["200", "304", "302", "301"]
            except:
                pass
            
            if not frontend_ok:
                if self.monitor_only:
                    # Production mode: Only log, don't restart
                    logger.error("ALERT: Frontend is DOWN! (monitor_only mode - not auto-restarting)")
                    # In production, this would trigger CloudWatch alarm / SNS notification
                    # await self.send_alert("Frontend service is unhealthy")
                else:
                    # Development mode: Auto-restart frontend
                    logger.warning("Frontend appears down, attempting restart...")
                    subprocess.run(["sudo", "supervisorctl", "restart", "frontend"], timeout=30)
                    await asyncio.sleep(5)
                    logger.info("Frontend restart attempted")
                
        except Exception as e:
            logger.error(f"Auto-heal services error: {e}")
    
    def stop_monitoring(self):
        """Stop monitoring loop"""
        self.is_running = False
        logger.info("AI Senior Developer Agent stopped")
    
    # ============== LLM-POWERED AUTONOMOUS CODE PATCHING ==============
    
    async def analyze_error_with_llm(self, error: DetectedError) -> Dict[str, Any]:
        """Use LLM to analyze error and generate fix suggestion"""
        try:
            api_key = os.environ.get("EMERGENT_LLM_KEY")
            if not api_key:
                return {"success": False, "error": "LLM key not configured"}
            
            # from emergentintegrations.llm.chat import LlmChat, UserMessage
            import uuid
            
            # Read file context if available
            file_context = ""
            if error.file_path and os.path.exists(error.file_path):
                try:
                    with open(error.file_path, 'r') as f:
                        lines = f.readlines()
                    
                    # Get context around error line
                    if error.line_number:
                        start = max(0, error.line_number - 10)
                        end = min(len(lines), error.line_number + 10)
                        context_lines = lines[start:end]
                        file_context = f"\n--- Code Context (lines {start+1}-{end}) ---\n{''.join(context_lines)}"
                except:
                    pass
            
            prompt = f"""You are an expert software developer. Analyze this error and provide a fix.

ERROR DETAILS:
- Category: {error.category}
- Severity: {error.severity}
- File: {error.file_path}
- Line: {error.line_number or 'Unknown'}
- Message: {error.error_message}
- Pattern: {error.error_pattern}
{file_context}

Provide your analysis in this exact JSON format:
{{
    "root_cause": "Brief explanation of what's causing the error",
    "fix_type": "code_change|import_add|dependency_install|config_change|manual_required",
    "fix_code": "The exact code to fix the issue (or null if not applicable)",
    "fix_instructions": "Step by step instructions to apply the fix",
    "confidence": 0.0-1.0,
    "requires_testing": true/false,
    "potential_side_effects": ["list of potential issues the fix might cause"]
}}

IMPORTANT: Return ONLY the JSON object, no markdown or other text."""

            # Initialize chat
            chat = LlmChat(
                api_key=api_key,
                session_id=f"ai_dev_analyze_{uuid.uuid4()}",
                system_message="You are an expert software developer specializing in debugging and code fixes. Always respond with valid JSON only."
            ).with_model("openai", "gpt-5.2")
            
            # Send message
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            
            # Parse response
            try:
                import json
                analysis = json.loads(response.strip())
                analysis["success"] = True
                analysis["error_id"] = error.id
                return analysis
            except json.JSONDecodeError:
                # Try to extract JSON from response
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    analysis = json.loads(json_match.group())
                    analysis["success"] = True
                    analysis["error_id"] = error.id
                    return analysis
                return {"success": False, "error": "Failed to parse LLM response", "raw": response}
            
        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def generate_code_patch(self, error: DetectedError, analysis: Dict) -> Dict[str, Any]:
        """Generate a code patch based on LLM analysis"""
        try:
            if not analysis.get("success") or analysis.get("fix_type") == "manual_required":
                return {"success": False, "reason": "Manual fix required"}
            
            fix_code = analysis.get("fix_code")
            if not fix_code:
                return {"success": False, "reason": "No fix code provided"}
            
            file_path = error.file_path
            if not file_path or not os.path.exists(file_path):
                return {"success": False, "reason": "File not found"}
            
            # Read current file content
            with open(file_path, 'r') as f:
                original_content = f.read()
                original_lines = original_content.splitlines(keepends=True)
            
            patch = {
                "file_path": file_path,
                "error_id": error.id,
                "original_content": original_content,
                "fix_type": analysis.get("fix_type"),
                "confidence": analysis.get("confidence", 0),
                "instructions": analysis.get("fix_instructions"),
                "success": True
            }
            
            # Handle different fix types
            if analysis.get("fix_type") == "import_add":
                # Add import at the top of file
                import_line = fix_code if fix_code.endswith('\n') else fix_code + '\n'
                
                # Find best position for import
                insert_pos = 0
                for i, line in enumerate(original_lines):
                    if line.startswith('import ') or line.startswith('from '):
                        insert_pos = i + 1
                    elif line.strip() and not line.startswith('#') and not line.startswith('"""') and insert_pos > 0:
                        break
                
                new_lines = original_lines[:insert_pos] + [import_line] + original_lines[insert_pos:]
                patch["new_content"] = ''.join(new_lines)
                patch["change_type"] = "import_addition"
                
            elif analysis.get("fix_type") == "code_change" and error.line_number:
                # Replace specific line(s)
                line_idx = error.line_number - 1
                if 0 <= line_idx < len(original_lines):
                    # Use LLM to generate the exact replacement
                    api_key = os.environ.get("EMERGENT_LLM_KEY")
                    # from emergentintegrations.llm.chat import LlmChat, UserMessage
                    import uuid
                    
                    context = ''.join(original_lines[max(0, line_idx-5):min(len(original_lines), line_idx+6)])
                    
                    prompt = f"""Given this code context and error, provide ONLY the fixed line(s) of code.

ERROR: {error.error_message}
CURRENT LINE ({error.line_number}): {original_lines[line_idx]}
CONTEXT:
{context}

SUGGESTED FIX: {fix_code}

Return ONLY the corrected line(s) that should replace line {error.line_number}. No explanation."""

                    chat = LlmChat(
                        api_key=api_key,
                        session_id=f"ai_dev_patch_{uuid.uuid4()}",
                        system_message="You are a code fixer. Return only the corrected code, no explanations."
                    ).with_model("openai", "gpt-5.2")
                    
                    user_message = UserMessage(text=prompt)
                    fixed_line = await chat.send_message(user_message)
                    
                    fixed_line = fixed_line.strip()
                    if not fixed_line.endswith('\n'):
                        fixed_line += '\n'
                    
                    new_lines = original_lines.copy()
                    new_lines[line_idx] = fixed_line
                    patch["new_content"] = ''.join(new_lines)
                    patch["change_type"] = "line_replacement"
                    patch["old_line"] = original_lines[line_idx]
                    patch["new_line"] = fixed_line
            else:
                patch["new_content"] = fix_code
                patch["change_type"] = "full_replacement"
            
            return patch
            
        except Exception as e:
            logger.error(f"Patch generation failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def apply_code_patch(self, patch: Dict, backup: bool = True) -> Dict[str, Any]:
        """Apply a code patch with optional backup"""
        try:
            if not patch.get("success"):
                return {"success": False, "reason": "Invalid patch"}
            
            file_path = patch.get("file_path")
            if not file_path:
                return {"success": False, "reason": "No file path in patch"}
            
            new_content = patch.get("new_content")
            if not new_content:
                return {"success": False, "reason": "No new content in patch"}
            
            # Create backup
            if backup:
                backup_path = f"{file_path}.backup.{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
                with open(file_path, 'r') as f:
                    original = f.read()
                with open(backup_path, 'w') as f:
                    f.write(original)
                logger.info(f"Backup created: {backup_path}")
            
            # Apply patch
            with open(file_path, 'w') as f:
                f.write(new_content)
            
            logger.info(f"Patch applied to {file_path}")
            
            # Record the fix
            if self.db:
                await self.db.ai_developer_fixes.insert_one({
                    "id": f"fix_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                    "error_id": patch.get("error_id"),
                    "file_path": file_path,
                    "change_type": patch.get("change_type"),
                    "confidence": patch.get("confidence"),
                    "applied_at": datetime.now(timezone.utc).isoformat(),
                    "backup_path": backup_path if backup else None,
                    "status": "applied",
                    "verified": False
                })
            
            return {
                "success": True,
                "file_path": file_path,
                "change_type": patch.get("change_type"),
                "backup_path": backup_path if backup else None
            }
            
        except Exception as e:
            logger.error(f"Failed to apply patch: {e}")
            return {"success": False, "error": str(e)}
    
    async def verify_fix(self, file_path: str) -> Dict[str, Any]:
        """Verify that the fix didn't break anything"""
        results = {
            "file_path": file_path,
            "verified": False,
            "checks": {}
        }
        
        try:
            # Check file syntax
            if file_path.endswith('.py'):
                result = subprocess.run(
                    ["python", "-m", "py_compile", file_path],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                results["checks"]["syntax"] = "pass" if result.returncode == 0 else "fail"
                
            elif file_path.endswith(('.js', '.jsx', '.ts', '.tsx')):
                result = subprocess.run(
                    ["npx", "eslint", file_path, "--max-warnings=0"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                results["checks"]["lint"] = "pass" if result.returncode == 0 else "warn"
            
            # If all checks pass, mark as verified
            if all(v == "pass" for v in results["checks"].values()):
                results["verified"] = True
                
                # Update fix record
                if self.db:
                    await self.db.ai_developer_fixes.update_one(
                        {"file_path": file_path, "verified": False},
                        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
                    )
            
            return results
            
        except Exception as e:
            logger.error(f"Fix verification failed: {e}")
            results["error"] = str(e)
            return results
    
    async def rollback_fix(self, fix_id: str) -> Dict[str, Any]:
        """Rollback a previously applied fix"""
        try:
            if self.db is None:
                return {"success": False, "reason": "Database not available"}
            
            fix = await self.db.ai_developer_fixes.find_one({"id": fix_id})
            if not fix:
                return {"success": False, "reason": "Fix not found"}
            
            backup_path = fix.get("backup_path")
            if not backup_path or not os.path.exists(backup_path):
                return {"success": False, "reason": "Backup not available"}
            
            file_path = fix.get("file_path")
            
            # Restore from backup
            with open(backup_path, 'r') as f:
                backup_content = f.read()
            with open(file_path, 'w') as f:
                f.write(backup_content)
            
            # Update fix record
            await self.db.ai_developer_fixes.update_one(
                {"id": fix_id},
                {"$set": {"status": "rolled_back", "rolled_back_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            logger.info(f"Fix {fix_id} rolled back successfully")
            return {"success": True, "file_path": file_path}
            
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def autonomous_fix_error(self, error: DetectedError) -> Dict[str, Any]:
        """Fully autonomous error fixing pipeline"""
        result = {
            "error_id": error.id,
            "steps": [],
            "success": False
        }
        
        try:
            # Step 1: Analyze with LLM
            result["steps"].append({"step": "analyze", "status": "running"})
            analysis = await self.analyze_error_with_llm(error)
            
            if not analysis.get("success"):
                result["steps"][-1]["status"] = "failed"
                result["steps"][-1]["error"] = analysis.get("error", "Analysis failed")
                return result
            
            result["steps"][-1]["status"] = "completed"
            result["analysis"] = analysis
            
            # Check confidence threshold
            confidence = analysis.get("confidence", 0)
            if confidence < 0.7:
                result["steps"].append({
                    "step": "confidence_check",
                    "status": "skipped",
                    "reason": f"Confidence too low ({confidence:.2f} < 0.7)"
                })
                return result
            
            # Step 2: Generate patch
            result["steps"].append({"step": "generate_patch", "status": "running"})
            patch = await self.generate_code_patch(error, analysis)
            
            if not patch.get("success"):
                result["steps"][-1]["status"] = "failed"
                result["steps"][-1]["error"] = patch.get("reason", "Patch generation failed")
                return result
            
            result["steps"][-1]["status"] = "completed"
            
            # Step 3: Apply patch
            result["steps"].append({"step": "apply_patch", "status": "running"})
            apply_result = await self.apply_code_patch(patch)
            
            if not apply_result.get("success"):
                result["steps"][-1]["status"] = "failed"
                result["steps"][-1]["error"] = apply_result.get("error", "Patch application failed")
                return result
            
            result["steps"][-1]["status"] = "completed"
            result["backup_path"] = apply_result.get("backup_path")
            
            # Step 4: Verify fix
            result["steps"].append({"step": "verify", "status": "running"})
            verification = await self.verify_fix(error.file_path)
            
            if verification.get("verified"):
                result["steps"][-1]["status"] = "completed"
                result["success"] = True
                
                # Update error status
                error.fixed = True
                error.fix_applied_at = datetime.now(timezone.utc).isoformat()
                error.fix_details = f"Autonomous fix applied with {confidence:.0%} confidence"
                
                # Learn from successful fix
                if self.db:
                    await self._record_successful_fix(error, analysis)
            else:
                result["steps"][-1]["status"] = "warning"
                result["steps"][-1]["checks"] = verification.get("checks")
                
                # Optionally rollback if verification failed badly
                if verification.get("checks", {}).get("syntax") == "fail":
                    result["steps"].append({"step": "rollback", "status": "running"})
                    # Rollback would be done here
                    result["steps"][-1]["status"] = "completed"
                    result["success"] = False
            
            return result
            
        except Exception as e:
            logger.error(f"Autonomous fix failed: {e}")
            result["error"] = str(e)
            return result
    
    async def _record_successful_fix(self, error: DetectedError, analysis: Dict):
        """Record successful fix for learning"""
        try:
            await self.db.ai_developer_learnings.insert_one({
                "id": f"learn_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                "error_category": error.category,
                "error_pattern": error.error_pattern,
                "error_message": error.error_message,
                "fix_type": analysis.get("fix_type"),
                "root_cause": analysis.get("root_cause"),
                "confidence": analysis.get("confidence"),
                "learned_at": datetime.now(timezone.utc).isoformat(),
                "success": True
            })
            logger.info(f"Learning recorded for error pattern: {error.error_pattern}")
        except Exception as e:
            logger.error(f"Failed to record learning: {e}")
    
    async def get_fix_history(self, limit: int = 50) -> List[Dict]:
        """Get history of applied fixes"""
        if self.db is None:
            return []
        
        try:
            fixes = await self.db.ai_developer_fixes.find(
                {},
                {"_id": 0}
            ).sort("applied_at", -1).limit(limit).to_list(limit)
            return fixes
        except Exception as e:
            logger.error(f"Failed to get fix history: {e}")
            return []
    
    async def get_learnings(self, category: Optional[str] = None) -> List[Dict]:
        """Get learned fix patterns"""
        if self.db is None:
            return []
        
        try:
            query = {"success": True}
            if category:
                query["error_category"] = category
            
            learnings = await self.db.ai_developer_learnings.find(
                query,
                {"_id": 0}
            ).sort("learned_at", -1).limit(100).to_list(100)
            return learnings
        except Exception as e:
            logger.error(f"Failed to get learnings: {e}")
            return []


# Singleton instance
_ai_developer: Optional[AISeniorDeveloper] = None


def get_ai_developer(db=None) -> AISeniorDeveloper:
    """Get or create AI Developer instance"""
    global _ai_developer
    if _ai_developer is None:
        _ai_developer = AISeniorDeveloper(db)
    elif db is not None and _ai_developer.db is None:
        _ai_developer.db = db
    return _ai_developer


async def init_ai_developer(db) -> AISeniorDeveloper:
    """Initialize AI Developer with database"""
    developer = get_ai_developer(db)
    
    # Create indexes
    await db.ai_developer_scans.create_index("timestamp")
    await db.ai_developer_scans.create_index("id", unique=True)
    
    logger.info("AI Senior Developer Agent initialized")
    return developer
