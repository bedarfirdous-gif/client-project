"""
Syntax Error Auto-Fix Agent
============================
AI-powered agent that automatically detects and fixes syntax errors
in both frontend (JavaScript/React) and backend (Python) code.

Uses Gemini 3 Flash for intelligent error analysis and fix generation.
"""

import os
import re
import json
import asyncio
import subprocess
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Try to import LLM
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_LLM = True
except ImportError:
    HAS_LLM = False
    logger.warning("LLM not available for syntax autofix agent")


@dataclass
class SyntaxError:
    """Represents a detected syntax error"""
    file_path: str
    line_number: int
    column: int
    error_message: str
    error_type: str  # 'javascript', 'python'
    code_snippet: str = ""
    severity: str = "error"  # 'error', 'warning'


@dataclass 
class SyntaxFix:
    """Represents a proposed fix for a syntax error"""
    error: SyntaxError
    original_code: str
    fixed_code: str
    explanation: str
    confidence: float
    applied: bool = False
    applied_at: Optional[datetime] = None


class SyntaxAutoFixAgent:
    """
    AI Agent that automatically detects and fixes syntax errors.
    
    Features:
    - Real-time monitoring of frontend and backend code
    - Automatic detection using ESLint (JS) and Ruff (Python)
    - AI-powered fix generation using Gemini 3 Flash
    - Auto-apply safe fixes
    - Detailed fix explanations
    """
    
    def __init__(self, db=None, api_key: str = None):
        self.db = db
        self.api_key = api_key or os.environ.get('EMERGENT_LLM_KEY')
        self.llm = None
        self.is_monitoring = False
        self.detected_errors: List[SyntaxError] = []
        self.applied_fixes: List[SyntaxFix] = []
        self.stats = {
            'total_scans': 0,
            'errors_detected': 0,
            'fixes_applied': 0,
            'frontend_errors': 0,
            'backend_errors': 0,
            'last_scan': None
        }
        
        if HAS_LLM and self.api_key:
            try:
                self.llm = LlmChat(
                    api_key=self.api_key,
                    session_id=f"syntax-autofix-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    system_message=self._get_system_prompt()
                ).with_model("gemini", "gemini-3-flash-preview")
                logger.info("Syntax AutoFix Agent initialized with Gemini 3 Flash")
            except Exception as e:
                logger.warning(f"Failed to initialize LLM: {e}")
    
    def _get_system_prompt(self) -> str:
        return """You are an expert code syntax analyzer and fixer. Your job is to:

1. Analyze syntax errors in JavaScript/React and Python code
2. Understand the root cause of the error
3. Generate a precise fix that maintains code functionality
4. Explain the fix clearly

When given a syntax error, respond in this exact JSON format:
{
    "analysis": "Brief explanation of what caused the error",
    "fix": {
        "original_line": "The original problematic code",
        "fixed_line": "The corrected code",
        "full_fix": "If multiple lines need changing, provide the complete fixed block"
    },
    "explanation": "Clear explanation of what was wrong and how it was fixed",
    "confidence": 0.0-1.0,
    "is_safe_to_auto_apply": true/false
}

Important rules:
- Only fix syntax errors, don't change logic
- Preserve indentation and formatting style
- Be conservative - if unsure, set is_safe_to_auto_apply to false
- For JSX, ensure proper tag closing and attribute syntax
- For Python, check indentation, colons, and brackets"""

    async def scan_frontend(self) -> List[SyntaxError]:
        """Scan frontend JavaScript/React files for syntax errors using ESLint"""
        errors = []
        try:
            # Run ESLint on frontend src directory
            result = subprocess.run(
                ['npx', 'eslint', 'src/', '--format', 'json', '--no-error-on-unmatched-pattern'],
                cwd='/app/frontend',
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.stdout:
                try:
                    eslint_output = json.loads(result.stdout)
                    for file_result in eslint_output:
                        file_path = file_result.get('filePath', '')
                        for msg in file_result.get('messages', []):
                            if msg.get('severity', 0) >= 2:  # Error level
                                # Read code snippet
                                code_snippet = self._get_code_snippet(file_path, msg.get('line', 1))
                                
                                error = SyntaxError(
                                    file_path=file_path,
                                    line_number=msg.get('line', 0),
                                    column=msg.get('column', 0),
                                    error_message=msg.get('message', 'Unknown error'),
                                    error_type='javascript',
                                    code_snippet=code_snippet,
                                    severity='error' if msg.get('severity') == 2 else 'warning'
                                )
                                errors.append(error)
                                self.stats['frontend_errors'] += 1
                except json.JSONDecodeError:
                    logger.warning("Failed to parse ESLint output")
                    
        except subprocess.TimeoutExpired:
            logger.error("ESLint scan timed out")
        except Exception as e:
            logger.error(f"Frontend scan error: {e}")
        
        return errors
    
    async def scan_backend(self) -> List[SyntaxError]:
        """Scan backend Python files for syntax errors using Ruff"""
        errors = []
        try:
            # Run Ruff on backend directory
            result = subprocess.run(
                ['ruff', 'check', '.', '--output-format', 'json', '--select', 'E,F'],
                cwd='/app/backend',
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.stdout:
                try:
                    ruff_output = json.loads(result.stdout)
                    for issue in ruff_output:
                        file_path = os.path.join('/app/backend', issue.get('filename', ''))
                        code_snippet = self._get_code_snippet(file_path, issue.get('location', {}).get('row', 1))
                        
                        error = SyntaxError(
                            file_path=file_path,
                            line_number=issue.get('location', {}).get('row', 0),
                            column=issue.get('location', {}).get('column', 0),
                            error_message=issue.get('message', 'Unknown error'),
                            error_type='python',
                            code_snippet=code_snippet,
                            severity='error'
                        )
                        errors.append(error)
                        self.stats['backend_errors'] += 1
                except json.JSONDecodeError:
                    logger.warning("Failed to parse Ruff output")
                    
        except subprocess.TimeoutExpired:
            logger.error("Ruff scan timed out")
        except Exception as e:
            logger.error(f"Backend scan error: {e}")
        
        return errors
    
    def _get_code_snippet(self, file_path: str, line_number: int, context_lines: int = 5) -> str:
        """Get code snippet around the error line"""
        try:
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
            logger.warning(f"Failed to get code snippet: {e}")
            return ""
    
    async def generate_fix(self, error: SyntaxError) -> Optional[SyntaxFix]:
        """Use AI to generate a fix for the syntax error"""
        if not self.llm:
            logger.warning("LLM not available for fix generation")
            return None
        
        try:
            prompt = f"""Analyze and fix this {error.error_type} syntax error:

File: {error.file_path}
Line: {error.line_number}
Error: {error.error_message}

Code context:
```
{error.code_snippet}
```

Provide a fix in the specified JSON format."""

            user_message = UserMessage(text=prompt)
            response = await self.llm.send_message(user_message)
            
            # Parse the AI response
            try:
                # Extract JSON from response
                json_match = re.search(r'\{[\s\S]*\}', response)
                if json_match:
                    fix_data = json.loads(json_match.group())
                    
                    fix = SyntaxFix(
                        error=error,
                        original_code=fix_data.get('fix', {}).get('original_line', ''),
                        fixed_code=fix_data.get('fix', {}).get('fixed_line', '') or fix_data.get('fix', {}).get('full_fix', ''),
                        explanation=fix_data.get('explanation', 'AI-generated fix'),
                        confidence=fix_data.get('confidence', 0.5)
                    )
                    
                    # Auto-apply if safe and high confidence
                    if fix_data.get('is_safe_to_auto_apply', False) and fix.confidence >= 0.8:
                        applied = await self.apply_fix(fix)
                        if applied:
                            fix.applied = True
                            fix.applied_at = datetime.now(timezone.utc)
                            self.stats['fixes_applied'] += 1
                    
                    return fix
            except json.JSONDecodeError:
                logger.warning("Failed to parse AI fix response")
                
        except Exception as e:
            logger.error(f"Fix generation error: {e}")
        
        return None
    
    async def apply_fix(self, fix: SyntaxFix) -> bool:
        """Apply the fix to the file"""
        try:
            with open(fix.error.file_path, 'r') as f:
                lines = f.readlines()
            
            line_idx = fix.error.line_number - 1
            if 0 <= line_idx < len(lines):
                # Replace the problematic line
                original_line = lines[line_idx]
                
                # Try to preserve indentation
                indent = len(original_line) - len(original_line.lstrip())
                fixed_line = ' ' * indent + fix.fixed_code.strip() + '\n'
                
                lines[line_idx] = fixed_line
                
                with open(fix.error.file_path, 'w') as f:
                    f.writelines(lines)
                
                logger.info(f"Applied fix to {fix.error.file_path}:{fix.error.line_number}")
                self.applied_fixes.append(fix)
                return True
                
        except Exception as e:
            logger.error(f"Failed to apply fix: {e}")
        
        return False
    
    async def full_scan(self) -> Dict[str, Any]:
        """Run a full scan of both frontend and backend"""
        self.stats['total_scans'] += 1
        self.stats['last_scan'] = datetime.now(timezone.utc).isoformat()
        
        # Scan both frontend and backend
        frontend_errors = await self.scan_frontend()
        backend_errors = await self.scan_backend()
        
        all_errors = frontend_errors + backend_errors
        self.detected_errors = all_errors
        self.stats['errors_detected'] = len(all_errors)
        
        # Generate fixes for each error
        fixes = []
        for error in all_errors[:10]:  # Limit to 10 errors per scan
            fix = await self.generate_fix(error)
            if fix:
                fixes.append({
                    'file': error.file_path,
                    'line': error.line_number,
                    'error': error.error_message,
                    'error_type': error.error_type,
                    'fix': fix.fixed_code,
                    'explanation': fix.explanation,
                    'confidence': fix.confidence,
                    'applied': fix.applied
                })
        
        return {
            'success': True,
            'scan_time': self.stats['last_scan'],
            'total_errors': len(all_errors),
            'frontend_errors': len(frontend_errors),
            'backend_errors': len(backend_errors),
            'fixes_generated': len(fixes),
            'fixes_auto_applied': sum(1 for f in fixes if f['applied']),
            'fixes': fixes,
            'stats': self.stats
        }
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get data for the dashboard"""
        return {
            'agent_name': 'Syntax AutoFix Agent',
            'model': 'Gemini 3 Flash',
            'status': 'active' if self.llm else 'inactive',
            'is_monitoring': self.is_monitoring,
            'stats': self.stats,
            'recent_errors': [
                {
                    'file': e.file_path.split('/')[-1],
                    'line': e.line_number,
                    'error': e.error_message[:50] + '...' if len(e.error_message) > 50 else e.error_message,
                    'type': e.error_type
                }
                for e in self.detected_errors[:5]
            ],
            'recent_fixes': [
                {
                    'file': f.error.file_path.split('/')[-1],
                    'line': f.error.line_number,
                    'applied': f.applied,
                    'confidence': f.confidence
                }
                for f in self.applied_fixes[-5:]
            ]
        }
    
    async def start_monitoring(self, interval_seconds: int = 30):
        """Start continuous monitoring"""
        self.is_monitoring = True
        logger.info(f"Starting syntax monitoring with {interval_seconds}s interval")
        
        while self.is_monitoring:
            try:
                await self.full_scan()
            except Exception as e:
                logger.error(f"Monitoring scan error: {e}")
            
            await asyncio.sleep(interval_seconds)
    
    def stop_monitoring(self):
        """Stop continuous monitoring"""
        self.is_monitoring = False
        logger.info("Stopped syntax monitoring")


# Global agent instance
_syntax_agent: Optional[SyntaxAutoFixAgent] = None


def get_syntax_agent(db=None) -> SyntaxAutoFixAgent:
    """Get or create the global syntax agent instance"""
    global _syntax_agent
    if _syntax_agent is None:
        _syntax_agent = SyntaxAutoFixAgent(db=db)
    return _syntax_agent
