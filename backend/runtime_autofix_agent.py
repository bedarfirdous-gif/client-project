"""
Runtime Auto-Fix AI Agent
==========================
AI-powered agent that automatically detects and fixes runtime errors
in both frontend (React/JS) and backend (Python) applications.

Features:
- Real-time error monitoring
- Log analysis for error patterns
- AI-powered fix generation using Gemini 3 Flash
- Auto-apply with rollback capability
- Error history and analytics
"""

import os
import re
import json
import asyncio
import subprocess
import logging
import shutil
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Try to import LLM
try:
    # from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_LLM = True
except ImportError:
    HAS_LLM = False
    logger.warning("LLM not available for runtime autofix agent")


@dataclass
class RuntimeError:
    """Represents a detected runtime error"""
    id: str
    error_type: str  # 'frontend', 'backend'
    category: str  # 'exception', 'api_error', 'undefined', 'type_error', etc.
    message: str
    stack_trace: str
    file_path: str
    line_number: int
    timestamp: str
    severity: str = "error"  # 'critical', 'error', 'warning'
    context: Dict = field(default_factory=dict)
    occurrence_count: int = 1


@dataclass
class RuntimeFix:
    """Represents a fix for a runtime error"""
    id: str
    error_id: str
    error: RuntimeError
    original_code: str
    fixed_code: str
    file_path: str
    line_range: tuple  # (start_line, end_line)
    explanation: str
    confidence: float
    status: str = "pending"  # 'pending', 'applied', 'rolled_back', 'failed'
    applied_at: Optional[str] = None
    rolled_back_at: Optional[str] = None
    backup_path: Optional[str] = None


class RuntimeAutoFixAgent:
    """
    AI Agent that automatically detects and fixes runtime errors.
    
    Features:
    - Real-time monitoring of frontend and backend errors
    - Log file analysis for error patterns
    - AI-powered fix generation using Gemini 3 Flash
    - Auto-apply fixes with rollback capability
    - Comprehensive error history and analytics
    """
    
    BACKUP_DIR = "/app/backend/runtime_backups"
    FRONTEND_LOG = "/var/log/supervisor/frontend.err.log"
    BACKEND_LOG = "/var/log/supervisor/backend.err.log"
    
    def __init__(self, db=None, api_key: str = None):
        self.db = db
        self.api_key = api_key or os.environ.get('EMERGENT_LLM_KEY')
        self.llm = None
        self.is_monitoring = False
        self.monitoring_task = None
        
        # Error and fix storage
        self.detected_errors: Dict[str, RuntimeError] = {}
        self.applied_fixes: Dict[str, RuntimeFix] = {}
        self.fix_history: List[RuntimeFix] = []
        
        # Statistics
        self.stats = {
            'total_errors_detected': 0,
            'frontend_errors': 0,
            'backend_errors': 0,
            'fixes_applied': 0,
            'fixes_rolled_back': 0,
            'auto_fix_success_rate': 0.0,
            'last_scan': None,
            'last_error': None,
            'monitoring_started': None
        }
        
        # Create backup directory
        Path(self.BACKUP_DIR).mkdir(parents=True, exist_ok=True)
        
        # Initialize LLM
        if HAS_LLM and self.api_key:
            try:
                self.llm = LlmChat(
                    api_key=self.api_key,
                    session_id=f"runtime-autofix-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    system_message=self._get_system_prompt()
                ).with_model("gemini", "gemini-3-flash-preview")
                logger.info("Runtime AutoFix Agent initialized with Gemini 3 Flash")
            except Exception as e:
                logger.warning(f"Failed to initialize LLM: {e}")
    
    def _get_system_prompt(self) -> str:
        return """You are an expert runtime error analyzer and fixer. Your job is to:

1. Analyze runtime errors from JavaScript/React and Python applications
2. Understand the root cause from stack traces and error messages
3. Generate precise fixes that resolve the error without breaking functionality
4. Provide clear explanations for each fix

When given a runtime error, respond in this exact JSON format:
{
    "analysis": {
        "root_cause": "Brief explanation of what caused the error",
        "error_category": "type_error|reference_error|api_error|null_check|async_error|import_error|other",
        "affected_components": ["list of affected files/functions"]
    },
    "fix": {
        "file_path": "path to file that needs fixing",
        "line_start": 1,
        "line_end": 5,
        "original_code": "The original problematic code block",
        "fixed_code": "The corrected code block",
        "imports_needed": ["any new imports required"]
    },
    "explanation": "Clear explanation of what was wrong and how it was fixed",
    "confidence": 0.0-1.0,
    "is_safe_to_auto_apply": true/false,
    "potential_side_effects": ["list of potential side effects to watch for"]
}

Important rules:
- Preserve code style and formatting
- Add proper error handling where missing
- Don't change unrelated code
- For React: ensure proper hooks usage, null checks, and async handling
- For Python: ensure proper exception handling, type checking, and async/await
- If confidence is below 0.7, set is_safe_to_auto_apply to false"""

    def _generate_error_id(self, error_type: str, message: str, file_path: str) -> str:
        """Generate unique error ID based on error signature"""
        import hashlib
        signature = f"{error_type}:{message[:100]}:{file_path}"
        return hashlib.md5(signature.encode()).hexdigest()[:12]
    
    def _generate_fix_id(self) -> str:
        """Generate unique fix ID"""
        import uuid
        return str(uuid.uuid4())[:8]
    
    async def analyze_frontend_logs(self) -> List[RuntimeError]:
        """Analyze frontend error logs for runtime errors"""
        errors = []
        try:
            if not os.path.exists(self.FRONTEND_LOG):
                return errors
            
            # Read last 500 lines of log
            result = subprocess.run(
                ['tail', '-n', '500', self.FRONTEND_LOG],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            log_content = result.stdout
            
            # Parse React/JS runtime errors
            error_patterns = [
                # React errors
                (r'Error: (.+?)\n\s+at\s+(\S+)\s+\(([^:]+):(\d+)', 'exception'),
                # Uncaught errors
                (r'Uncaught (\w+Error): (.+?)\n', 'uncaught'),
                # TypeError/ReferenceError
                (r'(TypeError|ReferenceError|SyntaxError): (.+?)\n', 'type_error'),
                # API errors
                (r'(Failed to fetch|Network Error|API Error|axios error)(.+?)\n', 'api_error'),
                # React warnings that indicate issues
                (r'Warning: (.+?) is not defined', 'undefined'),
            ]
            
            for pattern, category in error_patterns:
                matches = re.finditer(pattern, log_content, re.MULTILINE)
                for match in matches:
                    error_msg = match.group(0)[:500]
                    
                    # Extract file path and line number if available
                    file_match = re.search(r'\(([^:]+\.jsx?):(\d+)', error_msg)
                    file_path = file_match.group(1) if file_match else 'unknown'
                    line_num = int(file_match.group(2)) if file_match else 0
                    
                    error_id = self._generate_error_id('frontend', error_msg, file_path)
                    
                    # Check if we already have this error
                    if error_id in self.detected_errors:
                        self.detected_errors[error_id].occurrence_count += 1
                        continue
                    
                    error = RuntimeError(
                        id=error_id,
                        error_type='frontend',
                        category=category,
                        message=error_msg[:200],
                        stack_trace=error_msg,
                        file_path=file_path,
                        line_number=line_num,
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        severity='error' if category != 'undefined' else 'warning'
                    )
                    errors.append(error)
                    self.detected_errors[error_id] = error
                    self.stats['frontend_errors'] += 1
                    
        except Exception as e:
            logger.error(f"Frontend log analysis error: {e}")
        
        return errors
    
    async def analyze_backend_logs(self) -> List[RuntimeError]:
        """Analyze backend error logs for runtime errors"""
        errors = []
        try:
            if not os.path.exists(self.BACKEND_LOG):
                return errors
            
            # Read last 500 lines of log
            result = subprocess.run(
                ['tail', '-n', '500', self.BACKEND_LOG],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            log_content = result.stdout
            
            # Parse Python runtime errors
            error_patterns = [
                # Python exceptions
                (r'(Traceback \(most recent call last\):[\s\S]+?(?:Error|Exception): .+?)(?=\n[^\s]|\Z)', 'exception'),
                # Specific errors
                (r'(TypeError|ValueError|KeyError|AttributeError|ImportError): (.+?)\n', 'type_error'),
                # FastAPI/Starlette errors
                (r'(HTTPException|ValidationError|RequestValidationError)(.+?)\n', 'api_error'),
                # Database errors
                (r'(pymongo\.errors\.\w+|MongoError|ConnectionError): (.+?)\n', 'database_error'),
            ]
            
            for pattern, category in error_patterns:
                matches = re.finditer(pattern, log_content, re.MULTILINE)
                for match in matches:
                    error_msg = match.group(0)[:1000]
                    
                    # Extract file path and line number from traceback
                    file_match = re.search(r'File "([^"]+)", line (\d+)', error_msg)
                    file_path = file_match.group(1) if file_match else 'unknown'
                    line_num = int(file_match.group(2)) if file_match else 0
                    
                    error_id = self._generate_error_id('backend', error_msg, file_path)
                    
                    # Check if we already have this error
                    if error_id in self.detected_errors:
                        self.detected_errors[error_id].occurrence_count += 1
                        continue
                    
                    error = RuntimeError(
                        id=error_id,
                        error_type='backend',
                        category=category,
                        message=error_msg.split('\n')[-1][:200] if '\n' in error_msg else error_msg[:200],
                        stack_trace=error_msg,
                        file_path=file_path,
                        line_number=line_num,
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        severity='critical' if 'database' in category else 'error'
                    )
                    errors.append(error)
                    self.detected_errors[error_id] = error
                    self.stats['backend_errors'] += 1
                    
        except Exception as e:
            logger.error(f"Backend log analysis error: {e}")
        
        return errors
    
    def _get_code_context(self, file_path: str, line_number: int, context_lines: int = 10) -> str:
        """Get code context around the error line"""
        try:
            # Handle relative paths
            if not file_path.startswith('/'):
                # Try common locations
                possible_paths = [
                    f"/app/frontend/src/{file_path}",
                    f"/app/backend/{file_path}",
                    f"/app/{file_path}",
                    file_path
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
            
            snippet_lines = []
            for i in range(start, end):
                line_num = i + 1
                marker = ">>> " if line_num == line_number else "    "
                snippet_lines.append(f"{marker}{line_num}: {lines[i].rstrip()}")
            
            return '\n'.join(snippet_lines)
        except Exception as e:
            logger.warning(f"Failed to get code context: {e}")
            return ""
    
    async def generate_fix(self, error: RuntimeError) -> Optional[RuntimeFix]:
        """Use AI to generate a fix for the runtime error"""
        if not self.llm:
            logger.warning("LLM not available for fix generation")
            return None
        
        try:
            # Get code context
            code_context = self._get_code_context(error.file_path, error.line_number)
            
            prompt = f"""Analyze and fix this {error.error_type} runtime error:

Error Type: {error.category}
Error Message: {error.message}
File: {error.file_path}
Line: {error.line_number}
Occurrences: {error.occurrence_count}

Stack Trace:
```
{error.stack_trace}
```

Code Context:
```
{code_context}
```

Provide a fix in the specified JSON format. Focus on:
1. Proper null/undefined checks
2. Error handling
3. Type safety
4. Async/await correctness"""

            user_message = UserMessage(text=prompt)
            response = await self.llm.send_message(user_message)
            
            # Parse the AI response
            try:
                json_match = re.search(r'\{[\s\S]*\}', response)
                if json_match:
                    fix_data = json.loads(json_match.group())
                    
                    fix = RuntimeFix(
                        id=self._generate_fix_id(),
                        error_id=error.id,
                        error=error,
                        original_code=fix_data.get('fix', {}).get('original_code', ''),
                        fixed_code=fix_data.get('fix', {}).get('fixed_code', ''),
                        file_path=fix_data.get('fix', {}).get('file_path', error.file_path),
                        line_range=(
                            fix_data.get('fix', {}).get('line_start', error.line_number),
                            fix_data.get('fix', {}).get('line_end', error.line_number)
                        ),
                        explanation=fix_data.get('explanation', 'AI-generated fix'),
                        confidence=fix_data.get('confidence', 0.5)
                    )
                    
                    # Auto-apply if safe and high confidence
                    if fix_data.get('is_safe_to_auto_apply', False) and fix.confidence >= 0.75:
                        applied = await self.apply_fix(fix)
                        if applied:
                            fix.status = 'applied'
                            fix.applied_at = datetime.now(timezone.utc).isoformat()
                            self.stats['fixes_applied'] += 1
                    
                    self.fix_history.append(fix)
                    return fix
                    
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse AI fix response: {e}")
                
        except Exception as e:
            logger.error(f"Fix generation error: {e}")
        
        return None
    
    async def apply_fix(self, fix: RuntimeFix) -> bool:
        """Apply the fix to the file with backup for rollback"""
        try:
            file_path = fix.file_path
            
            # Handle relative paths
            if not file_path.startswith('/'):
                possible_paths = [
                    f"/app/frontend/src/{file_path}",
                    f"/app/backend/{file_path}",
                    f"/app/{file_path}"
                ]
                for path in possible_paths:
                    if os.path.exists(path):
                        file_path = path
                        break
            
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return False
            
            # Create backup
            backup_name = f"{fix.id}_{Path(file_path).name}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            backup_path = os.path.join(self.BACKUP_DIR, backup_name)
            shutil.copy2(file_path, backup_path)
            fix.backup_path = backup_path
            
            # Read file
            with open(file_path, 'r') as f:
                lines = f.readlines()
            
            # Apply fix
            start_line, end_line = fix.line_range
            if start_line > 0 and end_line <= len(lines):
                # Replace the lines with fixed code
                fixed_lines = fix.fixed_code.split('\n')
                lines[start_line-1:end_line] = [line + '\n' for line in fixed_lines]
                
                with open(file_path, 'w') as f:
                    f.writelines(lines)
                
                logger.info(f"Applied fix {fix.id} to {file_path}")
                self.applied_fixes[fix.id] = fix
                return True
            else:
                logger.error(f"Invalid line range for fix: {start_line}-{end_line}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to apply fix: {e}")
            return False
    
    async def rollback_fix(self, fix_id: str) -> bool:
        """Rollback a previously applied fix"""
        try:
            if fix_id not in self.applied_fixes:
                logger.error(f"Fix {fix_id} not found in applied fixes")
                return False
            
            fix = self.applied_fixes[fix_id]
            
            if not fix.backup_path or not os.path.exists(fix.backup_path):
                logger.error(f"Backup not found for fix {fix_id}")
                return False
            
            # Restore from backup
            shutil.copy2(fix.backup_path, fix.file_path)
            
            fix.status = 'rolled_back'
            fix.rolled_back_at = datetime.now(timezone.utc).isoformat()
            self.stats['fixes_rolled_back'] += 1
            
            # Remove from applied fixes
            del self.applied_fixes[fix_id]
            
            logger.info(f"Rolled back fix {fix_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to rollback fix: {e}")
            return False
    
    async def full_scan(self) -> Dict[str, Any]:
        """Run a full scan of both frontend and backend logs"""
        self.stats['last_scan'] = datetime.now(timezone.utc).isoformat()
        
        # Analyze logs
        frontend_errors = await self.analyze_frontend_logs()
        backend_errors = await self.analyze_backend_logs()
        
        all_errors = frontend_errors + backend_errors
        self.stats['total_errors_detected'] = len(self.detected_errors)
        
        if all_errors:
            self.stats['last_error'] = all_errors[-1].timestamp
        
        # Generate fixes for new errors (limit to 5 per scan)
        fixes = []
        for error in all_errors[:5]:
            fix = await self.generate_fix(error)
            if fix:
                fixes.append({
                    'id': fix.id,
                    'error_id': error.id,
                    'file': fix.file_path,
                    'line_range': fix.line_range,
                    'explanation': fix.explanation,
                    'confidence': fix.confidence,
                    'status': fix.status,
                    'can_rollback': fix.backup_path is not None
                })
        
        # Calculate success rate
        total_fixes = len(self.fix_history)
        successful = sum(1 for f in self.fix_history if f.status == 'applied')
        self.stats['auto_fix_success_rate'] = (successful / total_fixes * 100) if total_fixes > 0 else 0
        
        return {
            'success': True,
            'scan_time': self.stats['last_scan'],
            'total_errors': len(all_errors),
            'new_frontend_errors': len(frontend_errors),
            'new_backend_errors': len(backend_errors),
            'total_tracked_errors': len(self.detected_errors),
            'fixes_generated': len(fixes),
            'fixes_auto_applied': sum(1 for f in fixes if f['status'] == 'applied'),
            'fixes': fixes,
            'stats': self.stats
        }
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get data for the dashboard"""
        recent_errors = sorted(
            self.detected_errors.values(),
            key=lambda e: e.timestamp,
            reverse=True
        )[:10]
        
        recent_fixes = sorted(
            self.fix_history,
            key=lambda f: f.applied_at or f.error.timestamp,
            reverse=True
        )[:10]
        
        return {
            'agent_name': 'Runtime AutoFix Agent',
            'model': 'Gemini 3 Flash',
            'status': 'monitoring' if self.is_monitoring else 'idle',
            'is_monitoring': self.is_monitoring,
            'stats': self.stats,
            'recent_errors': [
                {
                    'id': e.id,
                    'type': e.error_type,
                    'category': e.category,
                    'message': e.message[:100],
                    'file': Path(e.file_path).name if e.file_path != 'unknown' else 'unknown',
                    'line': e.line_number,
                    'occurrences': e.occurrence_count,
                    'severity': e.severity,
                    'timestamp': e.timestamp
                }
                for e in recent_errors
            ],
            'recent_fixes': [
                {
                    'id': f.id,
                    'error_id': f.error_id,
                    'file': Path(f.file_path).name if f.file_path else 'unknown',
                    'status': f.status,
                    'confidence': f.confidence,
                    'can_rollback': f.backup_path is not None and f.status == 'applied',
                    'explanation': f.explanation[:100]
                }
                for f in recent_fixes
            ],
            'applied_fixes_count': len(self.applied_fixes)
        }
    
    def get_error_details(self, error_id: str) -> Optional[Dict]:
        """Get detailed information about an error"""
        if error_id not in self.detected_errors:
            return None
        
        error = self.detected_errors[error_id]
        related_fixes = [f for f in self.fix_history if f.error_id == error_id]
        
        return {
            'error': asdict(error),
            'code_context': self._get_code_context(error.file_path, error.line_number),
            'fixes': [
                {
                    'id': f.id,
                    'status': f.status,
                    'confidence': f.confidence,
                    'explanation': f.explanation,
                    'original_code': f.original_code,
                    'fixed_code': f.fixed_code,
                    'can_rollback': f.backup_path is not None and f.status == 'applied'
                }
                for f in related_fixes
            ]
        }
    
    async def start_monitoring(self, interval_seconds: int = 30):
        """Start continuous monitoring"""
        self.is_monitoring = True
        self.stats['monitoring_started'] = datetime.now(timezone.utc).isoformat()
        logger.info(f"Starting runtime monitoring with {interval_seconds}s interval")
        
        while self.is_monitoring:
            try:
                result = await self.full_scan()
                if result['total_errors'] > 0:
                    logger.info(f"Runtime scan: {result['total_errors']} errors, {result['fixes_auto_applied']} fixed")
            except Exception as e:
                logger.error(f"Monitoring scan error: {e}")
            
            await asyncio.sleep(interval_seconds)
    
    def stop_monitoring(self):
        """Stop continuous monitoring"""
        self.is_monitoring = False
        logger.info("Stopped runtime monitoring")
    
    def clear_errors(self):
        """Clear all tracked errors"""
        self.detected_errors.clear()
        self.stats['total_errors_detected'] = 0
        self.stats['frontend_errors'] = 0
        self.stats['backend_errors'] = 0


# Global agent instance
_runtime_agent: Optional[RuntimeAutoFixAgent] = None


def get_runtime_agent(db=None) -> RuntimeAutoFixAgent:
    """Get or create the global runtime agent instance"""
    global _runtime_agent
    if _runtime_agent is None:
        _runtime_agent = RuntimeAutoFixAgent(db=db)
    return _runtime_agent
