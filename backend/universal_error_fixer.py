"""
Universal Error Fixer AI Agent
==============================
Comprehensive AI-powered agent that automatically detects and fixes:
- HTTP Errors (404, 502, 500, etc.)
- Runtime Errors
- Logic Errors
- TypeErrors
- Systematic/Recurring Errors
- Random/Unexpected Errors

Uses Gemini 3 Flash for intelligent error analysis and fix generation.
"""

import os
import re
import json
import asyncio
import subprocess
import logging
import shutil
import traceback
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from pathlib import Path
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Try to import LLM
try:
    # from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_LLM = True
except ImportError:
    HAS_LLM = False
    logger.warning("LLM not available for Universal Error Fixer")


# Error Categories
class ErrorCategory:
    HTTP_404 = "http_404"
    HTTP_502 = "http_502"
    HTTP_500 = "http_500"
    HTTP_OTHER = "http_other"
    RUNTIME = "runtime"
    LOGIC = "logic"
    TYPE_ERROR = "type_error"
    REFERENCE_ERROR = "reference_error"
    SYSTEMATIC = "systematic"
    RANDOM = "random"
    DATABASE = "database"
    API = "api"
    ASYNC = "async"
    IMPORT = "import"


@dataclass
class UniversalError:
    """Represents any type of detected error"""
    id: str
    category: str
    subcategory: str
    message: str
    stack_trace: str
    file_path: str
    line_number: int
    source: str  # 'frontend', 'backend', 'api', 'database'
    severity: str  # 'critical', 'high', 'medium', 'low'
    timestamp: str
    occurrence_count: int = 1
    is_systematic: bool = False
    related_errors: List[str] = field(default_factory=list)
    context: Dict = field(default_factory=dict)
    suggested_fix: str = ""
    auto_fixable: bool = False


@dataclass
class UniversalFix:
    """Represents a fix for any error type"""
    id: str
    error_id: str
    error: UniversalError
    fix_type: str  # 'code_change', 'config_change', 'route_fix', 'dependency_fix'
    original_code: str
    fixed_code: str
    file_path: str
    line_range: Tuple[int, int]
    explanation: str
    confidence: float
    status: str = "pending"
    applied_at: Optional[str] = None
    rolled_back_at: Optional[str] = None
    backup_path: Optional[str] = None
    verification_status: str = "pending"  # 'pending', 'verified', 'failed'


class UniversalErrorFixerAgent:
    """
    Comprehensive AI Agent that detects and fixes all types of errors.
    
    Handles:
    - HTTP Errors: 404 (Not Found), 502 (Bad Gateway), 500 (Internal Server Error)
    - Runtime Errors: Exceptions, crashes, undefined behavior
    - Logic Errors: Incorrect behavior, wrong outputs
    - TypeErrors: Type mismatches, null/undefined access
    - Systematic Errors: Recurring patterns, design flaws
    - Random Errors: Intermittent, hard-to-reproduce issues
    """
    
    BACKUP_DIR = "/app/backend/universal_backups"
    FRONTEND_LOG = "/var/log/supervisor/frontend.err.log"
    BACKEND_LOG = "/var/log/supervisor/backend.err.log"
    NGINX_ACCESS_LOG = "/var/log/nginx/access.log"
    NGINX_ERROR_LOG = "/var/log/nginx/error.log"
    
    def __init__(self, db=None, api_key: str = None):
        self.db = db
        self.api_key = api_key or os.environ.get('EMERGENT_LLM_KEY')
        self.llm = None
        self.is_monitoring = False
        
        # Error storage
        self.errors: Dict[str, UniversalError] = {}
        self.fixes: Dict[str, UniversalFix] = {}
        self.fix_history: List[UniversalFix] = []
        
        # Pattern tracking for systematic errors
        self.error_patterns: Dict[str, List[str]] = defaultdict(list)
        self.error_frequency: Dict[str, int] = defaultdict(int)
        
        # Statistics
        self.stats = {
            'total_errors': 0,
            'by_category': {
                'http_404': 0,
                'http_502': 0,
                'http_500': 0,
                'runtime': 0,
                'logic': 0,
                'type_error': 0,
                'systematic': 0,
                'random': 0,
                'other': 0
            },
            'by_source': {
                'frontend': 0,
                'backend': 0,
                'api': 0,
                'database': 0
            },
            'fixes_applied': 0,
            'fixes_verified': 0,
            'fixes_rolled_back': 0,
            'auto_fix_rate': 0.0,
            'last_scan': None,
            'monitoring_started': None
        }
        
        # Create backup directory
        Path(self.BACKUP_DIR).mkdir(parents=True, exist_ok=True)
        
        # Initialize LLM
        if HAS_LLM and self.api_key:
            try:
                self.llm = LlmChat(
                    api_key=self.api_key,
                    session_id=f"universal-fixer-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    system_message=self._get_system_prompt()
                ).with_model("gemini", "gemini-3-flash-preview")
                logger.info("Universal Error Fixer initialized with Gemini 3 Flash")
            except Exception as e:
                logger.warning(f"Failed to initialize LLM: {e}")
    
    def _get_system_prompt(self) -> str:
        return """You are an expert error analyzer and fixer for web applications. You handle ALL types of errors:

## Error Types You Handle:

### 1. HTTP Errors
- **404 Not Found**: Missing routes, broken links, deleted resources
- **502 Bad Gateway**: Proxy errors, backend crashes, timeout issues
- **500 Internal Server Error**: Unhandled exceptions, server crashes

### 2. Runtime Errors
- Uncaught exceptions
- Memory issues
- Process crashes
- Undefined behavior

### 3. Logic Errors
- Incorrect calculations
- Wrong conditional logic
- Off-by-one errors
- Infinite loops
- Race conditions

### 4. TypeErrors
- Null/undefined access
- Type mismatches
- Invalid operations on types
- Missing properties

### 5. Systematic Errors
- Recurring patterns
- Design flaws
- Architectural issues
- Configuration problems

### 6. Random/Intermittent Errors
- Race conditions
- Timing issues
- Resource contention
- Network flakiness

## Response Format:
Always respond in this exact JSON format:
{
    "error_analysis": {
        "category": "http_404|http_502|runtime|logic|type_error|systematic|random",
        "root_cause": "Detailed explanation of why this error occurred",
        "is_systematic": true/false,
        "related_patterns": ["list of related error patterns if any"],
        "severity": "critical|high|medium|low"
    },
    "fix": {
        "fix_type": "code_change|config_change|route_fix|dependency_fix|refactor",
        "file_path": "path/to/file",
        "line_start": 1,
        "line_end": 10,
        "original_code": "problematic code",
        "fixed_code": "corrected code",
        "additional_changes": [
            {"file": "path", "change": "description"}
        ]
    },
    "explanation": "Clear explanation of the fix",
    "confidence": 0.0-1.0,
    "is_safe_to_auto_apply": true/false,
    "verification_steps": ["steps to verify the fix worked"],
    "prevention_tips": ["how to prevent this error in the future"]
}

## Important Rules:
1. Always identify the ROOT CAUSE, not just symptoms
2. For 404 errors: Check routes, imports, and file paths
3. For 502 errors: Check backend health, timeouts, and proxy config
4. For TypeErrors: Add proper null checks and type guards
5. For Logic errors: Trace the data flow and identify incorrect assumptions
6. For Systematic errors: Propose architectural fixes
7. Always preserve existing code style
8. Add proper error handling where missing
9. Consider edge cases and race conditions"""

    def _generate_error_id(self, category: str, message: str, file_path: str) -> str:
        """Generate unique error ID"""
        import hashlib
        signature = f"{category}:{message[:100]}:{file_path}"
        return hashlib.md5(signature.encode()).hexdigest()[:12]
    
    def _generate_fix_id(self) -> str:
        """Generate unique fix ID"""
        import uuid
        return str(uuid.uuid4())[:8]
    
    def _classify_error(self, message: str, stack_trace: str, source: str) -> Tuple[str, str, str]:
        """Classify error into category, subcategory, and severity"""
        message_lower = message.lower()
        stack_lower = stack_trace.lower()
        
        # HTTP Errors
        if '404' in message or 'not found' in message_lower:
            return ErrorCategory.HTTP_404, 'route_not_found', 'medium'
        if '502' in message or 'bad gateway' in message_lower:
            return ErrorCategory.HTTP_502, 'gateway_error', 'critical'
        if '500' in message or 'internal server error' in message_lower:
            return ErrorCategory.HTTP_500, 'server_error', 'high'
        
        # TypeErrors
        if 'typeerror' in message_lower or 'cannot read prop' in message_lower:
            return ErrorCategory.TYPE_ERROR, 'null_access', 'high'
        if 'undefined is not' in message_lower or 'null is not' in message_lower:
            return ErrorCategory.TYPE_ERROR, 'undefined_access', 'high'
        
        # Reference Errors
        if 'referenceerror' in message_lower or 'is not defined' in message_lower:
            return ErrorCategory.REFERENCE_ERROR, 'undefined_variable', 'high'
        
        # Import Errors
        if 'importerror' in message_lower or 'modulenotfounderror' in message_lower:
            return ErrorCategory.IMPORT, 'missing_module', 'high'
        if "cannot find module" in message_lower:
            return ErrorCategory.IMPORT, 'missing_module', 'high'
        
        # Database Errors
        if 'mongo' in message_lower or 'database' in message_lower or 'connection' in message_lower:
            return ErrorCategory.DATABASE, 'connection_error', 'critical'
        
        # Async Errors
        if 'promise' in message_lower or 'async' in message_lower or 'await' in message_lower:
            return ErrorCategory.ASYNC, 'async_error', 'medium'
        
        # API Errors
        if 'fetch' in message_lower or 'axios' in message_lower or 'api' in message_lower:
            return ErrorCategory.API, 'api_failure', 'medium'
        
        # Logic Errors (harder to detect automatically)
        if 'assertion' in message_lower or 'expected' in message_lower:
            return ErrorCategory.LOGIC, 'assertion_failure', 'medium'
        
        # Runtime Errors
        if 'error' in message_lower or 'exception' in message_lower:
            return ErrorCategory.RUNTIME, 'general_exception', 'medium'
        
        return ErrorCategory.RANDOM, 'unknown', 'low'
    
    async def scan_http_errors(self) -> List[UniversalError]:
        """Scan for HTTP errors (404, 502, 500)"""
        errors = []
        
        try:
            # Check backend logs for HTTP errors
            if os.path.exists(self.BACKEND_LOG):
                result = subprocess.run(
                    ['tail', '-n', '500', self.BACKEND_LOG],
                    capture_output=True, text=True, timeout=10
                )
                log_content = result.stdout
                
                # Pattern for HTTP errors
                http_patterns = [
                    (r'HTTP/\d\.\d"\s+404', ErrorCategory.HTTP_404, '404 Not Found'),
                    (r'HTTP/\d\.\d"\s+502', ErrorCategory.HTTP_502, '502 Bad Gateway'),
                    (r'HTTP/\d\.\d"\s+500', ErrorCategory.HTTP_500, '500 Internal Server Error'),
                    (r'HTTPException.*404', ErrorCategory.HTTP_404, 'Route not found'),
                    (r'HTTPException.*502', ErrorCategory.HTTP_502, 'Bad Gateway'),
                    (r'HTTPException.*500', ErrorCategory.HTTP_500, 'Internal Server Error'),
                ]
                
                for pattern, category, msg_prefix in http_patterns:
                    matches = re.finditer(pattern, log_content, re.IGNORECASE)
                    for match in matches:
                        context = log_content[max(0, match.start()-200):match.end()+200]
                        
                        # Try to extract the route/path
                        route_match = re.search(r'(GET|POST|PUT|DELETE|PATCH)\s+(/[^\s"]+)', context)
                        route = route_match.group(2) if route_match else 'unknown'
                        
                        error_id = self._generate_error_id(category, f"{msg_prefix}:{route}", route)
                        
                        if error_id in self.errors:
                            self.errors[error_id].occurrence_count += 1
                            continue
                        
                        error = UniversalError(
                            id=error_id,
                            category=category,
                            subcategory='http_error',
                            message=f"{msg_prefix}: {route}",
                            stack_trace=context,
                            file_path=route,
                            line_number=0,
                            source='api',
                            severity='high' if '502' in category else 'medium',
                            timestamp=datetime.now(timezone.utc).isoformat(),
                            auto_fixable=True
                        )
                        errors.append(error)
                        self.errors[error_id] = error
                        self.stats['by_category'][category] = self.stats['by_category'].get(category, 0) + 1
                        
        except Exception as e:
            logger.error(f"HTTP error scan failed: {e}")
        
        return errors
    
    async def scan_runtime_errors(self) -> List[UniversalError]:
        """Scan for runtime errors in both frontend and backend"""
        errors = []
        
        # Scan frontend
        try:
            if os.path.exists(self.FRONTEND_LOG):
                result = subprocess.run(
                    ['tail', '-n', '500', self.FRONTEND_LOG],
                    capture_output=True, text=True, timeout=10
                )
                frontend_errors = self._parse_js_errors(result.stdout, 'frontend')
                errors.extend(frontend_errors)
        except Exception as e:
            logger.error(f"Frontend scan failed: {e}")
        
        # Scan backend
        try:
            if os.path.exists(self.BACKEND_LOG):
                result = subprocess.run(
                    ['tail', '-n', '500', self.BACKEND_LOG],
                    capture_output=True, text=True, timeout=10
                )
                backend_errors = self._parse_python_errors(result.stdout, 'backend')
                errors.extend(backend_errors)
        except Exception as e:
            logger.error(f"Backend scan failed: {e}")
        
        return errors
    
    def _parse_js_errors(self, log_content: str, source: str) -> List[UniversalError]:
        """Parse JavaScript/React errors from logs"""
        errors = []
        
        patterns = [
            # React/JS errors
            (r'(TypeError|ReferenceError|SyntaxError|RangeError): (.+?)(?:\n|$)', 'js_error'),
            (r'Uncaught (\w+Error): (.+?)(?:\n|$)', 'uncaught'),
            (r'Error: (.+?)(?:\n|$)', 'general'),
            (r'Warning: (.+?) is not defined', 'undefined'),
            (r'Cannot read propert(?:y|ies) [\'"]?(\w+)[\'"]? of (null|undefined)', 'null_access'),
            (r'(\w+) is not a function', 'not_function'),
        ]
        
        for pattern, error_type in patterns:
            matches = re.finditer(pattern, log_content, re.MULTILINE | re.IGNORECASE)
            for match in matches:
                error_msg = match.group(0)[:300]
                
                # Extract file and line
                file_match = re.search(r'\(([^:]+\.jsx?):(\d+)', log_content[match.start():match.start()+500])
                file_path = file_match.group(1) if file_match else 'unknown'
                line_num = int(file_match.group(2)) if file_match else 0
                
                category, subcategory, severity = self._classify_error(error_msg, '', source)
                error_id = self._generate_error_id(category, error_msg, file_path)
                
                if error_id in self.errors:
                    self.errors[error_id].occurrence_count += 1
                    continue
                
                error = UniversalError(
                    id=error_id,
                    category=category,
                    subcategory=subcategory,
                    message=error_msg[:200],
                    stack_trace=log_content[match.start():match.start()+500],
                    file_path=file_path,
                    line_number=line_num,
                    source=source,
                    severity=severity,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    auto_fixable=category in [ErrorCategory.TYPE_ERROR, ErrorCategory.REFERENCE_ERROR]
                )
                errors.append(error)
                self.errors[error_id] = error
                self.stats['by_source'][source] = self.stats['by_source'].get(source, 0) + 1
                self.stats['by_category'][category] = self.stats['by_category'].get(category, 0) + 1
        
        return errors
    
    def _parse_python_errors(self, log_content: str, source: str) -> List[UniversalError]:
        """Parse Python errors from logs"""
        errors = []
        
        # Find Python tracebacks
        traceback_pattern = r'Traceback \(most recent call last\):[\s\S]+?(?:Error|Exception): .+?(?=\n[^\s]|\Z)'
        matches = re.finditer(traceback_pattern, log_content)
        
        for match in matches:
            traceback_text = match.group(0)
            
            # Extract error type and message
            error_line_match = re.search(r'(\w+(?:Error|Exception)): (.+?)$', traceback_text, re.MULTILINE)
            if error_line_match:
                error_type = error_line_match.group(1)
                error_msg = error_line_match.group(2)
            else:
                error_type = 'UnknownError'
                error_msg = traceback_text.split('\n')[-1]
            
            # Extract file and line
            file_matches = re.findall(r'File "([^"]+)", line (\d+)', traceback_text)
            if file_matches:
                file_path, line_num = file_matches[-1]  # Last file in traceback
                line_num = int(line_num)
            else:
                file_path, line_num = 'unknown', 0
            
            category, subcategory, severity = self._classify_error(f"{error_type}: {error_msg}", traceback_text, source)
            error_id = self._generate_error_id(category, error_msg, file_path)
            
            if error_id in self.errors:
                self.errors[error_id].occurrence_count += 1
                continue
            
            error = UniversalError(
                id=error_id,
                category=category,
                subcategory=subcategory,
                message=f"{error_type}: {error_msg}"[:200],
                stack_trace=traceback_text,
                file_path=file_path,
                line_number=line_num,
                source=source,
                severity=severity,
                timestamp=datetime.now(timezone.utc).isoformat(),
                auto_fixable=True
            )
            errors.append(error)
            self.errors[error_id] = error
            self.stats['by_source'][source] = self.stats['by_source'].get(source, 0) + 1
            self.stats['by_category'][category] = self.stats['by_category'].get(category, 0) + 1
        
        return errors
    
    def _detect_systematic_errors(self) -> List[str]:
        """Detect systematic/recurring error patterns"""
        systematic_ids = []
        
        # Group errors by category and file
        pattern_groups = defaultdict(list)
        for error_id, error in self.errors.items():
            pattern_key = f"{error.category}:{Path(error.file_path).name}"
            pattern_groups[pattern_key].append(error_id)
        
        # Mark errors as systematic if they occur frequently
        for pattern_key, error_ids in pattern_groups.items():
            if len(error_ids) >= 3 or sum(self.errors[eid].occurrence_count for eid in error_ids) >= 5:
                for eid in error_ids:
                    self.errors[eid].is_systematic = True
                    self.errors[eid].related_errors = [e for e in error_ids if e != eid]
                    systematic_ids.append(eid)
        
        return systematic_ids
    
    def _get_code_context(self, file_path: str, line_number: int, context_lines: int = 15) -> str:
        """Get code context around the error line"""
        try:
            # Handle relative paths
            if not file_path.startswith('/'):
                possible_paths = [
                    f"/app/frontend/src/{file_path}",
                    f"/app/backend/{file_path}",
                    f"/app/{file_path}",
                ]
                for path in possible_paths:
                    if os.path.exists(path):
                        file_path = path
                        break
            
            if not os.path.exists(file_path):
                return ""
            
            with open(file_path, 'r') as f:
                lines = f.readlines()
            
            start = max(0, line_number - context_lines - 1)
            end = min(len(lines), line_number + context_lines)
            
            snippet = []
            for i in range(start, end):
                marker = ">>> " if i + 1 == line_number else "    "
                snippet.append(f"{marker}{i+1}: {lines[i].rstrip()}")
            
            return '\n'.join(snippet)
        except Exception as e:
            return ""
    
    async def generate_fix(self, error: UniversalError) -> Optional[UniversalFix]:
        """Use AI to generate a fix for any error type"""
        if not self.llm:
            return None
        
        try:
            code_context = self._get_code_context(error.file_path, error.line_number)
            
            prompt = f"""Analyze and fix this error:

## Error Information
- **Category**: {error.category}
- **Subcategory**: {error.subcategory}
- **Source**: {error.source}
- **Severity**: {error.severity}
- **Message**: {error.message}
- **File**: {error.file_path}
- **Line**: {error.line_number}
- **Occurrences**: {error.occurrence_count}
- **Is Systematic**: {error.is_systematic}

## Stack Trace
```
{error.stack_trace}
```

## Code Context
```
{code_context}
```

## Related Errors
{json.dumps(error.related_errors) if error.related_errors else 'None'}

Provide a comprehensive fix following the JSON format specified."""

            user_message = UserMessage(text=prompt)
            response = await self.llm.send_message(user_message)
            
            # Parse response
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                fix_data = json.loads(json_match.group())
                
                fix = UniversalFix(
                    id=self._generate_fix_id(),
                    error_id=error.id,
                    error=error,
                    fix_type=fix_data.get('fix', {}).get('fix_type', 'code_change'),
                    original_code=fix_data.get('fix', {}).get('original_code', ''),
                    fixed_code=fix_data.get('fix', {}).get('fixed_code', ''),
                    file_path=fix_data.get('fix', {}).get('file_path', error.file_path),
                    line_range=(
                        fix_data.get('fix', {}).get('line_start', error.line_number),
                        fix_data.get('fix', {}).get('line_end', error.line_number)
                    ),
                    explanation=fix_data.get('explanation', ''),
                    confidence=fix_data.get('confidence', 0.5)
                )
                
                # Store prevention tips in error
                error.suggested_fix = fix_data.get('explanation', '')
                
                # Auto-apply if safe
                if fix_data.get('is_safe_to_auto_apply', False) and fix.confidence >= 0.75:
                    applied = await self.apply_fix(fix)
                    if applied:
                        fix.status = 'applied'
                        fix.applied_at = datetime.now(timezone.utc).isoformat()
                        self.stats['fixes_applied'] += 1
                
                self.fixes[fix.id] = fix
                self.fix_history.append(fix)
                return fix
                
        except Exception as e:
            logger.error(f"Fix generation failed: {e}")
        
        return None
    
    async def apply_fix(self, fix: UniversalFix) -> bool:
        """Apply fix with backup for rollback"""
        try:
            file_path = fix.file_path
            
            # Resolve path
            if not file_path.startswith('/'):
                for base in ['/app/frontend/src/', '/app/backend/', '/app/']:
                    if os.path.exists(base + file_path):
                        file_path = base + file_path
                        break
            
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return False
            
            # Create backup
            backup_name = f"{fix.id}_{Path(file_path).name}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            backup_path = os.path.join(self.BACKUP_DIR, backup_name)
            shutil.copy2(file_path, backup_path)
            fix.backup_path = backup_path
            
            # Apply fix
            with open(file_path, 'r') as f:
                lines = f.readlines()
            
            start, end = fix.line_range
            if 0 < start <= len(lines) and end <= len(lines):
                fixed_lines = fix.fixed_code.split('\n')
                lines[start-1:end] = [line + '\n' for line in fixed_lines]
                
                with open(file_path, 'w') as f:
                    f.writelines(lines)
                
                logger.info(f"Applied fix {fix.id} to {file_path}")
                return True
            
        except Exception as e:
            logger.error(f"Apply fix failed: {e}")
        
        return False
    
    async def rollback_fix(self, fix_id: str) -> bool:
        """Rollback a fix"""
        try:
            if fix_id not in self.fixes:
                return False
            
            fix = self.fixes[fix_id]
            
            if not fix.backup_path or not os.path.exists(fix.backup_path):
                return False
            
            # Restore backup
            shutil.copy2(fix.backup_path, fix.file_path)
            
            fix.status = 'rolled_back'
            fix.rolled_back_at = datetime.now(timezone.utc).isoformat()
            self.stats['fixes_rolled_back'] += 1
            
            return True
            
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
        
        return False
    
    async def verify_fix(self, fix_id: str) -> bool:
        """Verify that a fix resolved the error"""
        try:
            if fix_id not in self.fixes:
                return False
            
            fix = self.fixes[fix_id]
            
            # Run a quick scan to see if error still occurs
            await asyncio.sleep(2)  # Wait for services to reload
            
            # Check if error still appears in recent logs
            old_count = self.errors.get(fix.error_id, UniversalError(
                id='', category='', subcategory='', message='', stack_trace='',
                file_path='', line_number=0, source='', severity='', timestamp=''
            )).occurrence_count
            
            await self.full_scan()
            
            new_count = self.errors.get(fix.error_id, UniversalError(
                id='', category='', subcategory='', message='', stack_trace='',
                file_path='', line_number=0, source='', severity='', timestamp=''
            )).occurrence_count
            
            if new_count <= old_count:
                fix.verification_status = 'verified'
                self.stats['fixes_verified'] += 1
                return True
            else:
                fix.verification_status = 'failed'
                return False
                
        except Exception as e:
            logger.error(f"Verification failed: {e}")
        
        return False
    
    async def full_scan(self) -> Dict[str, Any]:
        """Run comprehensive error scan"""
        self.stats['last_scan'] = datetime.now(timezone.utc).isoformat()
        
        # Scan all error types
        http_errors = await self.scan_http_errors()
        runtime_errors = await self.scan_runtime_errors()
        
        all_errors = http_errors + runtime_errors
        
        # Detect systematic patterns
        systematic_ids = self._detect_systematic_errors()
        
        self.stats['total_errors'] = len(self.errors)
        
        # Generate fixes for new errors
        fixes = []
        for error in all_errors[:10]:  # Limit per scan
            fix = await self.generate_fix(error)
            if fix:
                fixes.append({
                    'id': fix.id,
                    'error_id': error.id,
                    'category': error.category,
                    'file': fix.file_path,
                    'confidence': fix.confidence,
                    'status': fix.status,
                    'explanation': fix.explanation[:100]
                })
        
        # Calculate auto-fix rate
        total = len(self.fix_history)
        applied = sum(1 for f in self.fix_history if f.status == 'applied')
        self.stats['auto_fix_rate'] = (applied / total * 100) if total > 0 else 0
        
        return {
            'success': True,
            'scan_time': self.stats['last_scan'],
            'errors': {
                'total': len(all_errors),
                'http': len(http_errors),
                'runtime': len(runtime_errors),
                'systematic': len(systematic_ids)
            },
            'fixes': {
                'generated': len(fixes),
                'auto_applied': sum(1 for f in fixes if f['status'] == 'applied')
            },
            'fix_details': fixes,
            'stats': self.stats
        }
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get dashboard data"""
        recent_errors = sorted(
            self.errors.values(),
            key=lambda e: e.timestamp,
            reverse=True
        )[:15]
        
        recent_fixes = sorted(
            self.fix_history,
            key=lambda f: f.applied_at or f.error.timestamp,
            reverse=True
        )[:10]
        
        return {
            'agent_name': 'Universal Error Fixer',
            'model': 'Gemini 3 Flash',
            'status': 'monitoring' if self.is_monitoring else 'idle',
            'is_monitoring': self.is_monitoring,
            'stats': self.stats,
            'recent_errors': [
                {
                    'id': e.id,
                    'category': e.category,
                    'subcategory': e.subcategory,
                    'message': e.message[:80],
                    'source': e.source,
                    'severity': e.severity,
                    'file': Path(e.file_path).name if e.file_path != 'unknown' else 'unknown',
                    'line': e.line_number,
                    'occurrences': e.occurrence_count,
                    'is_systematic': e.is_systematic,
                    'auto_fixable': e.auto_fixable,
                    'timestamp': e.timestamp
                }
                for e in recent_errors
            ],
            'recent_fixes': [
                {
                    'id': f.id,
                    'error_id': f.error_id,
                    'category': f.error.category,
                    'status': f.status,
                    'confidence': f.confidence,
                    'verification': f.verification_status,
                    'can_rollback': f.backup_path is not None and f.status == 'applied',
                    'explanation': f.explanation[:80]
                }
                for f in recent_fixes
            ]
        }
    
    async def start_monitoring(self, interval: int = 30):
        """Start continuous monitoring"""
        self.is_monitoring = True
        self.stats['monitoring_started'] = datetime.now(timezone.utc).isoformat()
        
        while self.is_monitoring:
            try:
                await self.full_scan()
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
            await asyncio.sleep(interval)
    
    def stop_monitoring(self):
        """Stop monitoring"""
        self.is_monitoring = False
    
    def clear_all(self):
        """Clear all tracked errors and fixes"""
        self.errors.clear()
        self.stats['total_errors'] = 0
        for key in self.stats['by_category']:
            self.stats['by_category'][key] = 0
        for key in self.stats['by_source']:
            self.stats['by_source'][key] = 0


# Global instance
_universal_agent: Optional[UniversalErrorFixerAgent] = None


def get_universal_agent(db=None) -> UniversalErrorFixerAgent:
    """Get or create global agent"""
    global _universal_agent
    if _universal_agent is None:
        _universal_agent = UniversalErrorFixerAgent(db=db)
    return _universal_agent
