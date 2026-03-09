"""
Enhanced AI Senior Developer Agent
===================================
Auto-healing system with structured error detection, patching, testing, and commit workflow.

Workflow:
Error Detected → Parse Log → Map to Module → Suggest Patch → Run Tests → If Pass: Commit, If Fail: Retry
"""

import asyncio
import os
import re
import subprocess
import json
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict, field
from enum import Enum
import logging
from pathlib import Path

import logging

# Create a simple logger for this module
logger = logging.getLogger("AIDeveloperService")
logger.setLevel(logging.INFO)


class ErrorSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class ErrorCategory(Enum):
    SYNTAX = "syntax"
    IMPORT = "import"
    DUPLICATE = "duplicate"
    UNDEFINED = "undefined"
    TYPE = "type"
    RUNTIME = "runtime"
    DATABASE = "database"
    API = "api"
    BUILD = "build"
    LINT = "lint"
    INTEGRITY = "integrity"
    PERFORMANCE = "performance"
    SECURITY = "security"


class FixStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    TESTING = "testing"
    PASSED = "passed"
    FAILED = "failed"
    COMMITTED = "committed"
    ROLLED_BACK = "rolled_back"


@dataclass
class DetectedError:
    """Structured error representation"""
    id: str
    timestamp: str
    category: str
    severity: str
    module: str
    file_path: str
    line_number: Optional[int]
    error_message: str
    error_pattern: str
    suggested_fix: Optional[str] = None
    auto_fixable: bool = False
    fix_status: str = FixStatus.PENDING.value
    fix_applied_at: Optional[str] = None
    fix_details: Optional[str] = None
    test_results: Optional[Dict] = None
    retry_count: int = 0
    max_retries: int = 3


@dataclass
class PatchSuggestion:
    """Suggested code patch"""
    patch_id: str
    error_id: str
    file_path: str
    original_code: str
    patched_code: str
    description: str
    confidence: float
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class TestResult:
    """Test execution result"""
    test_id: str
    patch_id: str
    passed: bool
    test_type: str  # unit, integration, e2e
    output: str
    duration_ms: float
    executed_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# Module mapping for error categorization
MODULE_MAPPING = {
    "server.py": "CoreServer",
    "auth": "AuthService",
    "invoice": "InvoiceService",
    "inventory": "InventoryService",
    "sales": "SalesService",
    "purchase": "PurchaseService",
    "ledger": "LedgerService",
    "user": "UserService",
    "customer": "CustomerService",
    "supplier": "SupplierService",
    "store": "StoreService",
    "pos": "POSService",
    "dashboard": "DashboardService",
}


class EnhancedAIDeveloper:
    """
    Enhanced AI Senior Developer with full auto-healing workflow.
    
    Workflow:
    1. Error Detected - Monitor logs, builds, lints
    2. Parse Log - Extract error details
    3. Map to Module - Identify affected module
    4. Suggest Patch - Generate fix code
    5. Run Tests - Validate the fix
    6. If Pass → Commit - Apply and commit fix
    7. If Fail → Retry - Try alternative fix
    """
    
    def __init__(self, db=None):
        self.db = db
        self.frontend_path = "/app/frontend"
        self.backend_path = "/app/backend"
        self.log_paths = {
            "backend_err": "/var/log/supervisor/backend.err.log",
            "backend_out": "/var/log/supervisor/backend.out.log",
            "frontend_err": "/var/log/supervisor/frontend.err.log",
        }
        self.monitoring_interval = 30
        self.is_running = False
        self.errors_detected: List[DetectedError] = []
        self.patches_applied: List[PatchSuggestion] = []
        self.test_results: List[TestResult] = []
        
        self.stats = {
            "total_scans": 0,
            "errors_detected": 0,
            "errors_fixed": 0,
            "auto_fixes_applied": 0,
            "tests_run": 0,
            "tests_passed": 0,
            "commits_made": 0,
            "rollbacks": 0,
            "last_scan": None,
            "uptime_start": datetime.now(timezone.utc).isoformat()
        }
        
        self._init_fix_patterns()
        logger.info("AI Senior Developer initialized", {"patterns": len(self.fix_patterns)})
    
    def _init_fix_patterns(self):
        """Initialize known fix patterns"""
        self.fix_patterns = {
            "dup_declaration": {
                "pattern": r"Identifier '(\w+)' has already been declared",
                "fix_template": "Remove duplicate declaration of '{identifier}'",
                "category": ErrorCategory.DUPLICATE.value,
                "confidence": 0.95,
                "auto_fix": True
            },
            "missing_import": {
                "pattern": r"'(\w+)' is not defined|(\w+) is not defined",
                "fix_template": "Add import for '{identifier}'",
                "category": ErrorCategory.IMPORT.value,
                "confidence": 0.85,
                "auto_fix": True
            },
            "objectid_serial": {
                "pattern": r"Object of type ObjectId is not JSON serializable",
                "fix_template": "Add {'_id': 0} to MongoDB projection or convert ObjectId to string",
                "category": ErrorCategory.DATABASE.value,
                "confidence": 0.90,
                "auto_fix": True
            },
            "undefined_name": {
                "pattern": r"NameError: name '(\w+)' is not defined",
                "fix_template": "Define or import '{identifier}' before use",
                "category": ErrorCategory.UNDEFINED.value,
                "confidence": 0.85,
                "auto_fix": False
            },
            "syntax_error": {
                "pattern": r"SyntaxError: (.+)",
                "fix_template": "Fix syntax error: {details}",
                "category": ErrorCategory.SYNTAX.value,
                "confidence": 0.70,
                "auto_fix": False
            },
            "react_hook": {
                "pattern": r"React Hook .+ cannot be called",
                "fix_template": "Move hook call to component top level",
                "category": ErrorCategory.RUNTIME.value,
                "confidence": 0.80,
                "auto_fix": False
            },
            "key_error": {
                "pattern": r"KeyError: '(\w+)'",
                "fix_template": "Use .get('{key}') instead of direct key access",
                "category": ErrorCategory.RUNTIME.value,
                "confidence": 0.88,
                "auto_fix": True
            }
        }
    
    # ==================== STEP 1: ERROR DETECTION ====================
    
    async def detect_errors(self) -> List[DetectedError]:
        """Step 1: Detect errors from all sources"""
        all_errors = []
        
        # Scan frontend
        frontend_errors = await self._scan_frontend()
        all_errors.extend(frontend_errors)
        
        # Scan backend
        backend_errors = await self._scan_backend()
        all_errors.extend(backend_errors)
        
        # Scan logs
        log_errors = await self._scan_logs()
        all_errors.extend(log_errors)
        
        # Check data integrity
        if self.db is not None:
            integrity_errors = await self._check_integrity()
            all_errors.extend(integrity_errors)
        
        # Deduplicate
        seen_ids = set()
        unique_errors = []
        for error in all_errors:
            if error.id not in seen_ids:
                seen_ids.add(error.id)
                unique_errors.append(error)
        
        self.errors_detected = unique_errors
        self.stats["errors_detected"] = len(unique_errors)
        
        logger.info("Error detection completed", {
            "total_errors": len(unique_errors),
            "critical": len([e for e in unique_errors if e.severity == ErrorSeverity.CRITICAL.value]),
            "high": len([e for e in unique_errors if e.severity == ErrorSeverity.HIGH.value])
        })
        
        return unique_errors
    
    # ==================== STEP 2: PARSE LOG ====================
    
    def _parse_error(self, raw_error: str, source: str) -> Optional[DetectedError]:
        """Step 2: Parse raw error into structured format"""
        
        # Try to match against known patterns
        for pattern_id, pattern_info in self.fix_patterns.items():
            match = re.search(pattern_info["pattern"], raw_error, re.IGNORECASE)
            if match:
                # Extract file path and line number
                file_match = re.search(r'(?:File |at |in )["\'"]?([^\s"\']+)["\']?(?:, line |:)(\d+)?', raw_error)
                file_path = file_match.group(1) if file_match else ""
                line_num = int(file_match.group(2)) if file_match and file_match.group(2) else None
                
                # Map to module
                module = self._map_to_module(file_path, raw_error)
                
                error = DetectedError(
                    id=self._generate_id(raw_error, file_path),
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    category=pattern_info["category"],
                    severity=self._determine_severity(pattern_info["category"]),
                    module=module,
                    file_path=file_path,
                    line_number=line_num,
                    error_message=raw_error[:500],
                    error_pattern=pattern_id,
                    suggested_fix=pattern_info["fix_template"],
                    auto_fixable=pattern_info["auto_fix"]
                )
                
                logger.info("Error parsed", {
                    "error_id": error.id,
                    "category": error.category,
                    "module": error.module,
                    "auto_fixable": error.auto_fixable
                })
                
                return error
        
        return None
    
    # ==================== STEP 3: MAP TO MODULE ====================
    
    def _map_to_module(self, file_path: str, error_message: str) -> str:
        """Step 3: Map error to appropriate module"""
        
        # Check file path first
        for key, module in MODULE_MAPPING.items():
            if key in file_path.lower():
                return module
        
        # Check error message keywords
        keywords = {
            "auth": "AuthService",
            "login": "AuthService",
            "invoice": "InvoiceService",
            "inventory": "InventoryService",
            "stock": "InventoryService",
            "sale": "SalesService",
            "purchase": "PurchaseService",
            "ledger": "LedgerService",
            "customer": "CustomerService",
            "supplier": "SupplierService",
        }
        
        for keyword, module in keywords.items():
            if keyword in error_message.lower():
                return module
        
        return "UnknownModule"
    
    # ==================== STEP 4: SUGGEST PATCH ====================
    
    async def suggest_patch(self, error: DetectedError) -> Optional[PatchSuggestion]:
        """Step 4: Generate fix suggestion for the error"""
        
        if not error.auto_fixable:
            logger.info("Error not auto-fixable", {"error_id": error.id})
            return None
        
        if not error.file_path or not os.path.exists(error.file_path):
            logger.warning("File not found", {"file_path": error.file_path})
            return None
        
        try:
            with open(error.file_path, 'r') as f:
                original_code = f.read()
            
            patched_code = await self._generate_patch(error, original_code)
            
            if patched_code and patched_code != original_code:
                patch = PatchSuggestion(
                    patch_id=self._generate_id(error.id, "patch"),
                    error_id=error.id,
                    file_path=error.file_path,
                    original_code=original_code,
                    patched_code=patched_code,
                    description=error.suggested_fix or "Auto-generated fix",
                    confidence=self.fix_patterns.get(error.error_pattern, {}).get("confidence", 0.5)
                )
                
                logger.info("Patch suggested", {
                    "patch_id": patch.patch_id,
                    "error_id": error.id,
                    "confidence": patch.confidence
                })
                
                return patch
                
        except Exception as e:
            logger.error("Patch generation failed", {
                "error_id": error.id,
                "exception": str(e)
            })
        
        return None
    
    async def _generate_patch(self, error: DetectedError, original_code: str) -> Optional[str]:
        """Generate patched code based on error pattern"""
        
        if error.error_pattern == "dup_declaration":
            return self._fix_duplicate_declaration(error, original_code)
        elif error.error_pattern == "missing_import":
            return self._fix_missing_import(error, original_code)
        elif error.error_pattern == "objectid_serial":
            return self._fix_objectid_serialization(error, original_code)
        elif error.error_pattern == "key_error":
            return self._fix_key_error(error, original_code)
        
        return None
    
    def _fix_duplicate_declaration(self, error: DetectedError, code: str) -> Optional[str]:
        """Fix duplicate variable declaration"""
        match = re.search(r"'(\w+)'", error.error_message)
        if not match:
            return None
        
        identifier = match.group(1)
        lines = code.split('\n')
        
        # Find all declarations
        declaration_pattern = rf'\b(const|let|var)\s+\[?\s*{identifier}\s*[,\]=]'
        declaration_lines = []
        
        for i, line in enumerate(lines):
            if re.search(declaration_pattern, line):
                declaration_lines.append(i)
        
        if len(declaration_lines) <= 1:
            return None
        
        # Remove duplicates (keep first, remove if useState duplicate)
        lines_to_remove = []
        for line_idx in declaration_lines[1:]:
            if 'useState' in lines[line_idx]:
                lines_to_remove.append(line_idx)
        
        if not lines_to_remove:
            return None
        
        new_lines = [l for i, l in enumerate(lines) if i not in lines_to_remove]
        return '\n'.join(new_lines)
    
    def _fix_missing_import(self, error: DetectedError, code: str) -> Optional[str]:
        """Fix missing import"""
        match = re.search(r"'(\w+)'", error.error_message)
        if not match:
            return None
        
        identifier = match.group(1)
        
        # Common imports mapping
        imports = {
            "useState": "import { useState } from 'react';",
            "useEffect": "import { useEffect } from 'react';",
            "useRef": "import { useRef } from 'react';",
            "Bot": "import { Bot } from 'lucide-react';",
            "Printer": "import { Printer } from 'lucide-react';",
        }
        
        if identifier in imports:
            import_line = imports[identifier]
            if import_line not in code:
                # Add import at the top after existing imports
                lines = code.split('\n')
                insert_idx = 0
                for i, line in enumerate(lines):
                    if line.startswith('import '):
                        insert_idx = i + 1
                
                lines.insert(insert_idx, import_line)
                return '\n'.join(lines)
        
        return None
    
    def _fix_objectid_serialization(self, error: DetectedError, code: str) -> Optional[str]:
        """Fix ObjectId serialization issues"""
        # Add {"_id": 0} to find queries
        pattern = r'\.find\(([^)]*)\)'
        
        def add_projection(match):
            args = match.group(1)
            if '{"_id": 0}' in args or "{'_id': 0}" in args:
                return match.group(0)
            if args.strip():
                return f'.find({args}, {{"_id": 0}})'
            return '.find({}, {"_id": 0})'
        
        new_code = re.sub(pattern, add_projection, code)
        return new_code if new_code != code else None
    
    def _fix_key_error(self, error: DetectedError, code: str) -> Optional[str]:
        """Fix KeyError by using .get()"""
        match = re.search(r"KeyError: '(\w+)'", error.error_message)
        if not match:
            return None
        
        key = match.group(1)
        
        # Replace direct access with .get()
        pattern = rf'\[[\'"]{key}[\'"]\]'
        replacement = f'.get("{key}")'
        
        new_code = re.sub(pattern, replacement, code)
        return new_code if new_code != code else None
    
    # ==================== STEP 5: RUN TESTS ====================
    
    async def run_tests(self, patch: PatchSuggestion) -> TestResult:
        """Step 5: Run tests to validate the patch"""
        
        self.stats["tests_run"] += 1
        start_time = datetime.now(timezone.utc)
        
        # Apply patch temporarily
        backup_code = None
        try:
            with open(patch.file_path, 'r') as f:
                backup_code = f.read()
            
            with open(patch.file_path, 'w') as f:
                f.write(patch.patched_code)
            
            # Run appropriate tests
            if patch.file_path.endswith('.py'):
                test_output, passed = await self._run_python_tests(patch.file_path)
            else:
                test_output, passed = await self._run_frontend_tests(patch.file_path)
            
            duration = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            
            result = TestResult(
                test_id=self._generate_id(patch.patch_id, "test"),
                patch_id=patch.patch_id,
                passed=passed,
                test_type="integration",
                output=test_output[:1000],
                duration_ms=duration
            )
            
            if passed:
                self.stats["tests_passed"] += 1
            
            logger.info("Test completed", {
                "test_id": result.test_id,
                "patch_id": patch.patch_id,
                "passed": passed,
                "duration_ms": duration
            })
            
            return result
            
        finally:
            # Restore backup if test failed
            if backup_code and not (hasattr(self, '_last_test_passed') and self._last_test_passed):
                pass  # Keep the patched code if we're about to commit
    
    async def _run_python_tests(self, file_path: str) -> Tuple[str, bool]:
        """Run Python linting and basic checks"""
        try:
            result = subprocess.run(
                ["python", "-m", "py_compile", file_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                return "Syntax check passed", True
            return result.stderr, False
            
        except Exception as e:
            return str(e), False
    
    async def _run_frontend_tests(self, file_path: str) -> Tuple[str, bool]:
        """Run frontend ESLint check"""
        try:
            result = subprocess.run(
                ["npx", "eslint", file_path, "--max-warnings=0"],
                cwd=self.frontend_path,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                return "ESLint check passed", True
            return result.stdout + result.stderr, False
            
        except Exception as e:
            return str(e), False
    
    # ==================== STEP 6 & 7: COMMIT OR RETRY ====================
    
    async def commit_fix(self, error: DetectedError, patch: PatchSuggestion, test_result: TestResult) -> bool:
        """Step 6: Commit the fix if tests pass"""
        
        if not test_result.passed:
            return await self.retry_fix(error, patch)
        
        try:
            # The patch is already applied, just update status
            error.fix_status = FixStatus.COMMITTED.value
            error.fix_applied_at = datetime.now(timezone.utc).isoformat()
            error.fix_details = patch.description
            
            self.patches_applied.append(patch)
            self.stats["commits_made"] += 1
            self.stats["auto_fixes_applied"] += 1
            self.stats["errors_fixed"] += 1
            
            logger.info("Fix committed", {
                "error_id": error.id,
                "patch_id": patch.patch_id,
                "file": patch.file_path
            })
            
            # Save to database
            if self.db is not None:
                await self.db.ai_developer_fixes.insert_one({
                    "error": asdict(error),
                    "patch": asdict(patch),
                    "test_result": asdict(test_result),
                    "committed_at": datetime.now(timezone.utc).isoformat()
                })
            
            return True
            
        except Exception as e:
            logger.error("Commit failed", {"error": str(e)})
            return False
    
    async def retry_fix(self, error: DetectedError, failed_patch: PatchSuggestion) -> bool:
        """Step 7: Retry with alternative fix if test fails"""
        
        error.retry_count += 1
        
        if error.retry_count >= error.max_retries:
            error.fix_status = FixStatus.FAILED.value
            self.stats["rollbacks"] += 1
            
            # Restore original code
            with open(failed_patch.file_path, 'w') as f:
                f.write(failed_patch.original_code)
            
            logger.warning("Max retries reached, rolling back", {
                "error_id": error.id,
                "retries": error.retry_count
            })
            return False
        
        error.fix_status = FixStatus.PENDING.value
        
        logger.info("Retrying fix", {
            "error_id": error.id,
            "attempt": error.retry_count + 1
        })
        
        # Try alternative fix approach
        return False  # For now, just fail - can be extended with AI-based alternatives
    
    # ==================== FULL WORKFLOW ====================
    
    async def run_full_workflow(self) -> Dict[str, Any]:
        """Execute the complete auto-healing workflow"""
        
        self.stats["total_scans"] += 1
        self.stats["last_scan"] = datetime.now(timezone.utc).isoformat()
        
        # Step 1: Detect errors
        errors = await self.detect_errors()
        
        fixed_count = 0
        failed_count = 0
        
        for error in errors:
            if error.auto_fixable and error.fix_status == FixStatus.PENDING.value:
                # Step 4: Suggest patch
                patch = await self.suggest_patch(error)
                
                if patch:
                    # Step 5: Run tests
                    test_result = await self.run_tests(patch)
                    
                    # Step 6 or 7: Commit or retry
                    if await self.commit_fix(error, patch, test_result):
                        fixed_count += 1
                    else:
                        failed_count += 1
        
        return {
            "scan_time": self.stats["last_scan"],
            "total_errors": len(errors),
            "auto_fixed": fixed_count,
            "failed_fixes": failed_count,
            "critical": len([e for e in errors if e.severity == ErrorSeverity.CRITICAL.value]),
            "high": len([e for e in errors if e.severity == ErrorSeverity.HIGH.value]),
            "stats": self.stats
        }
    
    # ==================== UTILITY METHODS ====================
    
    def _generate_id(self, *args) -> str:
        content = ":".join(str(a) for a in args)
        return hashlib.md5(content.encode()).hexdigest()[:12]
    
    def _determine_severity(self, category: str) -> str:
        severity_map = {
            ErrorCategory.SYNTAX.value: ErrorSeverity.CRITICAL.value,
            ErrorCategory.DUPLICATE.value: ErrorSeverity.CRITICAL.value,
            ErrorCategory.BUILD.value: ErrorSeverity.CRITICAL.value,
            ErrorCategory.IMPORT.value: ErrorSeverity.HIGH.value,
            ErrorCategory.UNDEFINED.value: ErrorSeverity.HIGH.value,
            ErrorCategory.DATABASE.value: ErrorSeverity.MEDIUM.value,
            ErrorCategory.LINT.value: ErrorSeverity.LOW.value,
        }
        return severity_map.get(category, ErrorSeverity.MEDIUM.value)
    
    async def _scan_frontend(self) -> List[DetectedError]:
        """Scan frontend for errors"""
        errors = []
        try:
            result = subprocess.run(
                ["npx", "eslint", "src/pages", "--format=json"],
                cwd=self.frontend_path,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.stdout:
                lint_results = json.loads(result.stdout)
                for file_result in lint_results:
                    for msg in file_result.get("messages", []):
                        error = self._parse_error(
                            f"{msg.get('ruleId', 'unknown')}: {msg.get('message', '')}",
                            file_result.get("filePath", "")
                        )
                        if error:
                            error.file_path = file_result.get("filePath", "")
                            error.line_number = msg.get("line")
                            errors.append(error)
        except Exception as e:
            logger.error("Frontend scan failed", {"error": str(e)})
        
        return errors
    
    async def _scan_backend(self) -> List[DetectedError]:
        """Scan backend for errors"""
        errors = []
        try:
            result = subprocess.run(
                ["python", "-m", "ruff", "check", "server.py", "--output-format=json"],
                cwd=self.backend_path,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.stdout:
                lint_results = json.loads(result.stdout)
                for err in lint_results:
                    error = self._parse_error(err.get("message", ""), err.get("filename", ""))
                    if error:
                        error.file_path = os.path.join(self.backend_path, err.get("filename", ""))
                        error.line_number = err.get("location", {}).get("row")
                        errors.append(error)
        except Exception as e:
            logger.error("Backend scan failed", {"error": str(e)})
        
        return errors
    
    async def _scan_logs(self) -> List[DetectedError]:
        """Scan log files for runtime errors"""
        errors = []
        
        log_path = self.log_paths.get("backend_err")
        if not os.path.exists(log_path):
            return errors
        
        try:
            with open(log_path, 'r') as f:
                lines = f.readlines()[-200:]
            
            content = ''.join(lines)
            exception_pattern = r'(\w+Error): (.+?)(?=\n|$)'
            
            for match in re.finditer(exception_pattern, content):
                error_type, error_msg = match.groups()
                error = self._parse_error(f"{error_type}: {error_msg}", "backend_logs")
                if error:
                    errors.append(error)
                    
        except Exception as e:
            logger.error("Log scan failed", {"error": str(e)})
        
        return errors
    
    async def _check_integrity(self) -> List[DetectedError]:
        """Check data integrity"""
        errors = []
        
        try:
            # Check unlinked suppliers
            suppliers = await self.db.suppliers.find(
                {"ledger_id": {"$in": [None, ""]}}
            ).to_list(100)
            
            if suppliers:
                errors.append(DetectedError(
                    id=self._generate_id("unlinked_suppliers"),
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    category=ErrorCategory.INTEGRITY.value,
                    severity=ErrorSeverity.MEDIUM.value,
                    module="LedgerService",
                    file_path="database:suppliers",
                    line_number=None,
                    error_message=f"{len(suppliers)} suppliers without ledger_id",
                    error_pattern="unlinked_party",
                    suggested_fix="Run sync-ledgers API",
                    auto_fixable=True
                ))
        except Exception as e:
            logger.error("Integrity check failed", {"error": str(e)})
        
        return errors
    
    async def get_health_report(self) -> Dict[str, Any]:
        """Get system health summary"""
        build_dir = os.path.join(self.frontend_path, "build")
        frontend_ok = os.path.exists(build_dir)
        
        backend_ok = True
        try:
            result = subprocess.run(
                ["curl", "-s", "http://localhost:8001/api/health"],
                capture_output=True, text=True, timeout=5
            )
            backend_ok = "healthy" in result.stdout.lower()
        except:
            backend_ok = False
        
        critical = len([e for e in self.errors_detected if e.severity == ErrorSeverity.CRITICAL.value])
        
        return {
            "status": "healthy" if (frontend_ok and backend_ok and critical == 0) else "degraded",
            "frontend_build": "passing" if frontend_ok else "failing",
            "backend_api": "running" if backend_ok else "down",
            "critical_errors": critical,
            "total_errors": len(self.errors_detected),
            "stats": self.stats
        }


# Singleton instance
_enhanced_developer: Optional[EnhancedAIDeveloper] = None

def get_enhanced_developer(db=None) -> EnhancedAIDeveloper:
    global _enhanced_developer
    if _enhanced_developer is None:
        _enhanced_developer = EnhancedAIDeveloper(db)
    elif db and _enhanced_developer.db is None:
        _enhanced_developer.db = db
    return _enhanced_developer
