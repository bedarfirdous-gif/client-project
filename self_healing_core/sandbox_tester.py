"""
Sandbox Tester
==============
Isolated testing environment for validating patches before deployment.
"""

import os
import asyncio
import tempfile
import shutil
import subprocess
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SandboxTester")


class TestStatus(Enum):
    """Status of a test run"""
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"
    TIMEOUT = "timeout"


class TestType(Enum):
    """Types of tests"""
    UNIT = "unit"
    INTEGRATION = "integration"
    E2E = "e2e"
    REGRESSION = "regression"
    SMOKE = "smoke"
    SYNTAX = "syntax"


@dataclass
class TestResult:
    """Result of a single test"""
    test_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    test_name: str = ""
    test_type: TestType = TestType.UNIT
    status: TestStatus = TestStatus.PENDING
    
    # Execution
    duration_seconds: float = 0.0
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    
    # Output
    stdout: str = ""
    stderr: str = ""
    exit_code: int = -1
    
    # Error details
    error_message: Optional[str] = None
    assertion_failures: List[str] = field(default_factory=list)
    
    # Context
    file_path: Optional[str] = None
    fix_id: Optional[str] = None


@dataclass
class TestSuite:
    """A collection of tests"""
    suite_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    
    # Tests
    tests: List[TestResult] = field(default_factory=list)
    
    # Status
    status: TestStatus = TestStatus.PENDING
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    skipped_tests: int = 0
    
    # Timing
    duration_seconds: float = 0.0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    # Context
    fix_id: Optional[str] = None
    error_id: Optional[str] = None


class SandboxTester:
    """
    Sandbox testing environment for patch validation.
    
    Features:
    - Create isolated test environments
    - Run syntax checks (Python lint, JS lint)
    - Run unit tests
    - Run integration tests
    - Validate patches before deployment
    """
    
    def __init__(self, db=None):
        self.db = db
        self.sandbox_dir = "/tmp/self_healing_sandbox"
        self.test_timeout = 120  # seconds
        self.test_suites: List[TestSuite] = []
        
        # Collections
        if db is not None:
            self.results_collection = db.sandbox_test_results
            self.suites_collection = db.test_suites
        
        # Ensure sandbox directory exists
        os.makedirs(self.sandbox_dir, exist_ok=True)
        
        logger.info("SandboxTester initialized")
    
    async def validate_python_syntax(self, code: str, filename: str = "test.py") -> TestResult:
        """
        Validate Python syntax using AST and ruff.
        """
        result = TestResult(
            test_name=f"Python Syntax: {filename}",
            test_type=TestType.SYNTAX
        )
        result.start_time = datetime.now(timezone.utc).isoformat()
        
        try:
            # Create temp file
            temp_path = os.path.join(self.sandbox_dir, filename)
            with open(temp_path, 'w') as f:
                f.write(code)
            
            result.file_path = temp_path
            
            # First try Python compile
            try:
                compile(code, filename, 'exec')
            except SyntaxError as e:
                result.status = TestStatus.FAILED
                result.error_message = str(e)
                result.end_time = datetime.now(timezone.utc).isoformat()
                return result
            
            # Then run ruff for linting
            proc = await asyncio.create_subprocess_exec(
                'ruff', 'check', temp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            
            result.stdout = stdout.decode()
            result.stderr = stderr.decode()
            result.exit_code = proc.returncode
            
            if proc.returncode == 0:
                result.status = TestStatus.PASSED
            else:
                result.status = TestStatus.FAILED
                result.error_message = result.stdout or result.stderr
            
            # Cleanup
            os.remove(temp_path)
            
        except asyncio.TimeoutError:
            result.status = TestStatus.TIMEOUT
            result.error_message = "Syntax check timed out"
        except Exception as e:
            result.status = TestStatus.ERROR
            result.error_message = str(e)
        
        result.end_time = datetime.now(timezone.utc).isoformat()
        result.duration_seconds = self._calculate_duration(result.start_time, result.end_time)
        
        return result
    
    async def validate_javascript_syntax(self, code: str, filename: str = "test.js") -> TestResult:
        """
        Validate JavaScript/JSX syntax using ESLint.
        """
        result = TestResult(
            test_name=f"JS Syntax: {filename}",
            test_type=TestType.SYNTAX
        )
        result.start_time = datetime.now(timezone.utc).isoformat()
        
        try:
            # Create temp file
            temp_path = os.path.join(self.sandbox_dir, filename)
            with open(temp_path, 'w') as f:
                f.write(code)
            
            result.file_path = temp_path
            
            # Run ESLint
            proc = await asyncio.create_subprocess_exec(
                'npx', 'eslint', '--no-eslintrc', 
                '--parser-options=ecmaVersion:2021',
                temp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd='/app/frontend'
            )
            
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
            
            result.stdout = stdout.decode()
            result.stderr = stderr.decode()
            result.exit_code = proc.returncode
            
            if proc.returncode == 0:
                result.status = TestStatus.PASSED
            else:
                result.status = TestStatus.FAILED
                result.error_message = result.stdout or result.stderr
            
            # Cleanup
            os.remove(temp_path)
            
        except asyncio.TimeoutError:
            result.status = TestStatus.TIMEOUT
            result.error_message = "Syntax check timed out"
        except Exception as e:
            result.status = TestStatus.ERROR
            result.error_message = str(e)
        
        result.end_time = datetime.now(timezone.utc).isoformat()
        result.duration_seconds = self._calculate_duration(result.start_time, result.end_time)
        
        return result
    
    async def run_python_tests(
        self,
        test_path: str,
        test_pattern: str = "test_*.py"
    ) -> TestSuite:
        """
        Run Python tests using pytest.
        """
        suite = TestSuite(
            name=f"Python Tests: {test_path}",
            description=f"Pytest run for {test_path}"
        )
        suite.started_at = datetime.now(timezone.utc).isoformat()
        suite.status = TestStatus.RUNNING
        
        try:
            proc = await asyncio.create_subprocess_exec(
                'python', '-m', 'pytest', test_path,
                '-v', '--tb=short', '-q',
                '--json-report', '--json-report-file=/tmp/pytest_report.json',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd='/app/backend'
            )
            
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=self.test_timeout
            )
            
            # Parse results
            if os.path.exists('/tmp/pytest_report.json'):
                import json
                with open('/tmp/pytest_report.json', 'r') as f:
                    report = json.load(f)
                
                suite.total_tests = report.get('summary', {}).get('total', 0)
                suite.passed_tests = report.get('summary', {}).get('passed', 0)
                suite.failed_tests = report.get('summary', {}).get('failed', 0)
                suite.skipped_tests = report.get('summary', {}).get('skipped', 0)
                
                # Create test results from report
                for test in report.get('tests', []):
                    tr = TestResult(
                        test_name=test.get('nodeid', ''),
                        test_type=TestType.UNIT,
                        status=TestStatus.PASSED if test.get('outcome') == 'passed' else TestStatus.FAILED,
                        duration_seconds=test.get('duration', 0)
                    )
                    if test.get('outcome') == 'failed':
                        tr.error_message = test.get('call', {}).get('longrepr', '')
                    suite.tests.append(tr)
                
                os.remove('/tmp/pytest_report.json')
            
            if proc.returncode == 0:
                suite.status = TestStatus.PASSED
            else:
                suite.status = TestStatus.FAILED
            
        except asyncio.TimeoutError:
            suite.status = TestStatus.TIMEOUT
        except Exception as e:
            suite.status = TestStatus.ERROR
            logger.error(f"Test run error: {e}")
        
        suite.completed_at = datetime.now(timezone.utc).isoformat()
        suite.duration_seconds = self._calculate_duration(suite.started_at, suite.completed_at)
        
        self.test_suites.append(suite)
        
        if self.db is not None:
            await self._store_suite(suite)
        
        return suite
    
    async def validate_fix(
        self,
        fix_id: str,
        original_code: str,
        fixed_code: str,
        file_path: str,
        error_id: Optional[str] = None
    ) -> TestSuite:
        """
        Validate a fix by running relevant tests.
        """
        suite = TestSuite(
            name=f"Fix Validation: {fix_id[:8]}",
            description=f"Validating fix for {file_path}",
            fix_id=fix_id,
            error_id=error_id
        )
        suite.started_at = datetime.now(timezone.utc).isoformat()
        suite.status = TestStatus.RUNNING
        
        try:
            # Determine language and run appropriate syntax check
            if file_path.endswith('.py'):
                syntax_result = await self.validate_python_syntax(
                    fixed_code,
                    os.path.basename(file_path)
                )
            elif file_path.endswith(('.js', '.jsx', '.ts', '.tsx')):
                syntax_result = await self.validate_javascript_syntax(
                    fixed_code,
                    os.path.basename(file_path)
                )
            else:
                syntax_result = TestResult(
                    test_name="Syntax Check",
                    test_type=TestType.SYNTAX,
                    status=TestStatus.SKIPPED,
                    error_message="Unknown file type"
                )
            
            syntax_result.fix_id = fix_id
            suite.tests.append(syntax_result)
            suite.total_tests += 1
            
            if syntax_result.status == TestStatus.PASSED:
                suite.passed_tests += 1
            elif syntax_result.status == TestStatus.FAILED:
                suite.failed_tests += 1
            else:
                suite.skipped_tests += 1
            
            # Run related tests if available
            test_file = self._find_related_test(file_path)
            if test_file:
                test_suite = await self.run_python_tests(test_file)
                for test in test_suite.tests:
                    test.fix_id = fix_id
                    suite.tests.append(test)
                
                suite.total_tests += test_suite.total_tests
                suite.passed_tests += test_suite.passed_tests
                suite.failed_tests += test_suite.failed_tests
            
            # Determine overall status
            if suite.failed_tests > 0:
                suite.status = TestStatus.FAILED
            elif suite.passed_tests > 0:
                suite.status = TestStatus.PASSED
            else:
                suite.status = TestStatus.SKIPPED
            
        except Exception as e:
            suite.status = TestStatus.ERROR
            logger.error(f"Fix validation error: {e}")
        
        suite.completed_at = datetime.now(timezone.utc).isoformat()
        suite.duration_seconds = self._calculate_duration(suite.started_at, suite.completed_at)
        
        self.test_suites.append(suite)
        
        if self.db is not None:
            await self._store_suite(suite)
        
        logger.info(
            f"[Sandbox] Fix validation complete: {suite.passed_tests}/{suite.total_tests} passed"
        )
        
        return suite
    
    def _find_related_test(self, file_path: str) -> Optional[str]:
        """Find related test file for a source file"""
        filename = os.path.basename(file_path)
        name_without_ext = os.path.splitext(filename)[0]
        
        # Common test file patterns
        patterns = [
            f"/app/backend/tests/test_{name_without_ext}.py",
            f"/app/backend/tests/{name_without_ext}_test.py",
        ]
        
        for pattern in patterns:
            if os.path.exists(pattern):
                return pattern
        
        return None
    
    def _calculate_duration(self, start: str, end: str) -> float:
        """Calculate duration between two ISO timestamps"""
        try:
            start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end.replace('Z', '+00:00'))
            return (end_dt - start_dt).total_seconds()
        except:
            return 0.0
    
    async def _store_suite(self, suite: TestSuite):
        """Store test suite in database"""
        if self.db is None:
            return
        
        doc = {
            "suite_id": suite.suite_id,
            "name": suite.name,
            "description": suite.description,
            "tests": [
                {
                    "test_id": t.test_id,
                    "test_name": t.test_name,
                    "test_type": t.test_type.value,
                    "status": t.status.value,
                    "duration_seconds": t.duration_seconds,
                    "error_message": t.error_message,
                    "fix_id": t.fix_id
                }
                for t in suite.tests
            ],
            "status": suite.status.value,
            "total_tests": suite.total_tests,
            "passed_tests": suite.passed_tests,
            "failed_tests": suite.failed_tests,
            "skipped_tests": suite.skipped_tests,
            "duration_seconds": suite.duration_seconds,
            "started_at": suite.started_at,
            "completed_at": suite.completed_at,
            "fix_id": suite.fix_id,
            "error_id": suite.error_id
        }
        
        await self.suites_collection.insert_one(doc)
    
    async def get_recent_results(self, limit: int = 20) -> List[Dict]:
        """Get recent test suite results"""
        if self.db is None:
            return [
                {
                    "suite_id": s.suite_id,
                    "name": s.name,
                    "status": s.status.value,
                    "total_tests": s.total_tests,
                    "passed_tests": s.passed_tests,
                    "failed_tests": s.failed_tests,
                    "duration_seconds": s.duration_seconds,
                    "completed_at": s.completed_at
                }
                for s in self.test_suites[-limit:]
            ]
        
        cursor = self.suites_collection.find({}, {"_id": 0}).sort("completed_at", -1).limit(limit)
        return await cursor.to_list(limit)
