"""
Self-Healing System Orchestrator
=================================
Main coordinator that ties together all self-healing components.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import uuid

from .error_detection import ErrorDetectionEngine, DetectedError, ErrorSeverity, ErrorSource, ErrorCategory
from .sandbox_tester import SandboxTester, TestStatus
from .canary_deployer import CanaryDeployer, RolloutStrategy
from .rollback_manager import RollbackManager, RollbackReason
from .critical_guard import CriticalModuleGuard, ProtectionLevel
from .learning_engine import LearningEngine, FixOutcome
from .health_monitor import HealthMonitor, ServiceStatus

# Import WebSocket broadcast functions for real-time notifications
try:
    from websocket_manager import (
        broadcast_self_heal_error_detected,
        broadcast_self_heal_fix_generating,
        broadcast_self_heal_fix_testing,
        broadcast_self_heal_deploying,
        broadcast_self_heal_completed,
        broadcast_self_heal_failed,
        broadcast_self_heal_rollback,
        broadcast_self_heal_blocked,
        broadcast_self_heal_health_update
    )
    WS_ENABLED = True
except ImportError:
    WS_ENABLED = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SelfHealingOrchestrator")


class HealingStatus(Enum):
    """Status of a healing operation"""
    DETECTED = "detected"
    ANALYZING = "analyzing"
    GENERATING_FIX = "generating_fix"
    TESTING = "testing"
    DEPLOYING = "deploying"
    MONITORING = "monitoring"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"  # Blocked by critical guard
    MANUAL_REQUIRED = "manual_required"


@dataclass
class HealingOperation:
    """A complete healing operation from detection to resolution"""
    operation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    error_id: str = ""
    error_type: str = ""
    error_message: str = ""
    
    # Status
    status: HealingStatus = HealingStatus.DETECTED
    current_step: str = ""
    
    # Fix details
    fix_id: Optional[str] = None
    fix_description: str = ""
    fix_file_path: Optional[str] = None
    fix_content: Optional[str] = None
    
    # Testing
    test_suite_id: Optional[str] = None
    tests_passed: bool = False
    
    # Deployment
    deployment_id: Optional[str] = None
    deployed: bool = False
    
    # Protection
    protection_blocked: bool = False
    protection_reason: Optional[str] = None
    
    # Confidence
    confidence_score: float = 0.0
    
    # Timing
    started_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    
    # Notes
    notes: List[str] = field(default_factory=list)


class SelfHealingOrchestrator:
    """
    Master orchestrator for the self-healing system.
    
    Workflow:
    1. Error Detection -> Detect and fingerprint error
    2. Critical Guard Check -> Ensure auto-fix is allowed
    3. Fix Generation -> Generate fix (AI-powered or pattern-matched)
    4. Sandbox Testing -> Test fix in isolation
    5. Canary Deployment -> Deploy with monitoring
    6. Learning -> Record outcome for future improvements
    
    Features:
    - Fully automated healing pipeline
    - Protection for critical modules
    - Learning from outcomes
    - Comprehensive monitoring
    """
    
    def __init__(self, db=None, llm_key: str = None):
        self.db = db
        self.llm_key = llm_key
        
        # Initialize components
        self.error_detection = ErrorDetectionEngine(db)
        self.sandbox_tester = SandboxTester(db)
        self.canary_deployer = CanaryDeployer(db)
        self.rollback_manager = RollbackManager(db)
        self.critical_guard = CriticalModuleGuard(db)
        self.learning_engine = LearningEngine(db)
        self.health_monitor = HealthMonitor(db)
        
        # Operations tracking
        self.operations: Dict[str, HealingOperation] = {}
        self.is_running = False
        self.auto_heal_enabled = True
        
        # Collections
        if db is not None:
            self.operations_collection = db.healing_operations
        
        logger.info("SelfHealingOrchestrator initialized")
    
    async def start(self):
        """Start the self-healing system"""
        if self.is_running:
            return
        
        self.is_running = True
        
        # Initialize critical guard
        await self.critical_guard.init_db()
        
        # Start health monitoring
        await self.health_monitor.start_monitoring()
        
        # Register health alert handler
        self.health_monitor.register_alert_callback(self._handle_health_alert)
        
        logger.info("Self-Healing System started")
    
    async def stop(self):
        """Stop the self-healing system"""
        self.is_running = False
        await self.health_monitor.stop_monitoring()
        logger.info("Self-Healing System stopped")
    
    async def handle_error(
        self,
        error_type: str,
        error_message: str,
        source: str = "backend",
        file_path: Optional[str] = None,
        function_name: Optional[str] = None,
        line_number: Optional[int] = None,
        stack_trace: Optional[str] = None,
        auto_fix: bool = True
    ) -> HealingOperation:
        """
        Handle an error through the complete healing pipeline.
        """
        operation = HealingOperation(
            error_type=error_type,
            error_message=error_message
        )
        operation.notes.append(f"Error detected: {error_type}")
        
        try:
            # Step 1: Detect and fingerprint error
            operation.status = HealingStatus.DETECTED
            operation.current_step = "Detecting error"
            
            error_source = ErrorSource[source.upper()] if source.upper() in ErrorSource.__members__ else ErrorSource.BACKEND
            
            detected_error = await self.error_detection.detect_error(
                error_type=error_type,
                error_message=error_message,
                source=error_source,
                file_path=file_path,
                function_name=function_name,
                line_number=line_number,
                stack_trace=stack_trace
            )
            
            operation.error_id = detected_error.error_id
            operation.notes.append(f"Error fingerprinted: {detected_error.fingerprint.fingerprint_id[:12] if detected_error.fingerprint else 'N/A'}")
            
            # Broadcast error detected via WebSocket
            if WS_ENABLED:
                try:
                    await broadcast_self_heal_error_detected({
                        "operation_id": operation.operation_id,
                        "error_id": operation.error_id,
                        "error_type": error_type,
                        "error_message": error_message[:200],
                        "file_path": file_path,
                        "fingerprint": detected_error.fingerprint.fingerprint_id[:12] if detected_error.fingerprint else None
                    })
                except Exception as e:
                    logger.debug(f"WebSocket broadcast failed: {e}")
            
            if not auto_fix or not self.auto_heal_enabled:
                operation.status = HealingStatus.MANUAL_REQUIRED
                operation.notes.append("Auto-fix disabled or not requested")
                return operation
            
            # Step 2: Check critical guard
            operation.status = HealingStatus.ANALYZING
            operation.current_step = "Checking protection"
            
            can_fix, protected_module, message = await self.critical_guard.can_auto_fix(
                file_path=file_path,
                function_name=function_name
            )
            
            if not can_fix:
                operation.status = HealingStatus.BLOCKED
                operation.protection_blocked = True
                operation.protection_reason = message
                operation.notes.append(f"Blocked by critical guard: {message}")
                logger.info(f"[SelfHeal] Auto-fix blocked: {message}")
                
                # Broadcast blocked via WebSocket
                if WS_ENABLED:
                    try:
                        await broadcast_self_heal_blocked({
                            "operation_id": operation.operation_id,
                            "error_type": error_type,
                            "file_path": file_path,
                            "reason": message,
                            "module": protected_module
                        })
                    except Exception as e:
                        logger.debug(f"WebSocket broadcast failed: {e}")
                
                return operation
            
            # Step 3: Check learning confidence
            operation.current_step = "Checking confidence"
            
            if detected_error.matched_pattern_id:
                should_fix, confidence, reason = await self.learning_engine.should_auto_fix(
                    detected_error.matched_pattern_id,
                    detected_error.fingerprint.fingerprint_id if detected_error.fingerprint else ""
                )
                
                operation.confidence_score = confidence
                
                if not should_fix and confidence < 0.3:
                    operation.status = HealingStatus.MANUAL_REQUIRED
                    operation.notes.append(f"Low confidence ({confidence:.2f}): {reason}")
                    return operation
            
            # Step 4: Generate fix
            operation.status = HealingStatus.GENERATING_FIX
            operation.current_step = "Generating fix"
            
            # Broadcast fix generating via WebSocket
            if WS_ENABLED:
                try:
                    await broadcast_self_heal_fix_generating({
                        "operation_id": operation.operation_id,
                        "error_type": error_type,
                        "using_ai": bool(self.llm_key),
                        "confidence": operation.confidence_score
                    })
                except Exception as e:
                    logger.debug(f"WebSocket broadcast failed: {e}")
            
            fix_result = await self._generate_fix(detected_error, file_path)
            
            if not fix_result.get("success"):
                operation.status = HealingStatus.FAILED
                operation.notes.append(f"Fix generation failed: {fix_result.get('reason')}")
                
                # Broadcast failure via WebSocket
                if WS_ENABLED:
                    try:
                        await broadcast_self_heal_failed({
                            "operation_id": operation.operation_id,
                            "error_type": error_type,
                            "reason": fix_result.get('reason'),
                            "step": "fix_generation"
                        })
                    except Exception as e:
                        logger.debug(f"WebSocket broadcast failed: {e}")
                
                return operation
            
            operation.fix_id = fix_result.get("fix_id")
            operation.fix_description = fix_result.get("description", "")
            operation.fix_file_path = fix_result.get("file_path")
            operation.fix_content = fix_result.get("fixed_content")
            operation.notes.append(f"Fix generated: {operation.fix_description}")
            
            # Step 5: Create backup
            if operation.fix_file_path:
                await self.rollback_manager.create_backup(
                    operation.fix_id,
                    operation.fix_file_path
                )
            
            # Step 6: Sandbox test
            operation.status = HealingStatus.TESTING
            operation.current_step = "Testing in sandbox"
            
            # Broadcast testing via WebSocket
            if WS_ENABLED:
                try:
                    await broadcast_self_heal_fix_testing({
                        "operation_id": operation.operation_id,
                        "fix_id": operation.fix_id,
                        "fix_description": operation.fix_description
                    })
                except Exception as e:
                    logger.debug(f"WebSocket broadcast failed: {e}")
            
            if operation.fix_content and operation.fix_file_path:
                test_suite = await self.sandbox_tester.validate_fix(
                    fix_id=operation.fix_id,
                    original_code=fix_result.get("original_content", ""),
                    fixed_code=operation.fix_content,
                    file_path=operation.fix_file_path,
                    error_id=operation.error_id
                )
                
                operation.test_suite_id = test_suite.suite_id
                operation.tests_passed = test_suite.status == TestStatus.PASSED
                
                if not operation.tests_passed:
                    operation.status = HealingStatus.FAILED
                    operation.notes.append(f"Tests failed: {test_suite.failed_tests} failures")
                    
                    # Record failure for learning
                    await self.learning_engine.record_fix_outcome(
                        error_id=operation.error_id,
                        error_fingerprint_id=detected_error.fingerprint.fingerprint_id if detected_error.fingerprint else "",
                        pattern_id=detected_error.matched_pattern_id or "",
                        fix_type=fix_result.get("fix_type", "unknown"),
                        outcome=FixOutcome.FAILURE
                    )
                    
                    # Broadcast test failure via WebSocket
                    if WS_ENABLED:
                        try:
                            await broadcast_self_heal_failed({
                                "operation_id": operation.operation_id,
                                "error_type": error_type,
                                "reason": f"Tests failed: {test_suite.failed_tests} failures",
                                "step": "sandbox_testing"
                            })
                        except Exception as e:
                            logger.debug(f"WebSocket broadcast failed: {e}")
                    
                    return operation
            
            operation.notes.append("Sandbox tests passed")
            
            # Step 7: Deploy
            operation.status = HealingStatus.DEPLOYING
            operation.current_step = "Deploying fix"
            
            # Broadcast deploying via WebSocket
            if WS_ENABLED:
                try:
                    await broadcast_self_heal_deploying({
                        "operation_id": operation.operation_id,
                        "fix_id": operation.fix_id,
                        "fix_description": operation.fix_description,
                        "file_path": operation.fix_file_path
                    })
                except Exception as e:
                    logger.debug(f"WebSocket broadcast failed: {e}")
            
            deployment = await self.canary_deployer.create_deployment(
                fix_id=operation.fix_id,
                file_path=operation.fix_file_path,
                original_content=fix_result.get("original_content", ""),
                new_content=operation.fix_content,
                error_id=operation.error_id
            )
            
            operation.deployment_id = deployment.deployment_id
            await self.canary_deployer.start_deployment(deployment.deployment_id)
            
            # Wait for deployment to complete
            for _ in range(60):  # Max 60 seconds
                await asyncio.sleep(1)
                dep_status = await self.canary_deployer.get_deployment(deployment.deployment_id)
                if dep_status and dep_status.get("status") in ["completed", "failed", "rolled_back"]:
                    break
            
            if dep_status and dep_status.get("success"):
                operation.deployed = True
                operation.status = HealingStatus.COMPLETED
                operation.notes.append("Fix deployed successfully")
                
                # Record success for learning
                await self.learning_engine.record_fix_outcome(
                    error_id=operation.error_id,
                    error_fingerprint_id=detected_error.fingerprint.fingerprint_id if detected_error.fingerprint else "",
                    pattern_id=detected_error.matched_pattern_id or "",
                    fix_type=fix_result.get("fix_type", "unknown"),
                    outcome=FixOutcome.SUCCESS
                )
                
                # Broadcast success via WebSocket
                if WS_ENABLED:
                    try:
                        await broadcast_self_heal_completed({
                            "operation_id": operation.operation_id,
                            "error_type": error_type,
                            "fix_description": operation.fix_description,
                            "deployed": True,
                            "confidence": operation.confidence_score
                        })
                    except Exception as e:
                        logger.debug(f"WebSocket broadcast failed: {e}")
            else:
                operation.status = HealingStatus.FAILED
                operation.notes.append("Deployment failed or rolled back")
                
                # Record failure for learning
                await self.learning_engine.record_fix_outcome(
                    error_id=operation.error_id,
                    error_fingerprint_id=detected_error.fingerprint.fingerprint_id if detected_error.fingerprint else "",
                    pattern_id=detected_error.matched_pattern_id or "",
                    fix_type=fix_result.get("fix_type", "unknown"),
                    outcome=FixOutcome.REVERTED
                )
                
                # Broadcast failure via WebSocket
                if WS_ENABLED:
                    try:
                        await broadcast_self_heal_failed({
                            "operation_id": operation.operation_id,
                            "error_type": error_type,
                            "reason": "Deployment failed or rolled back",
                            "step": "deployment"
                        })
                    except Exception as e:
                        logger.debug(f"WebSocket broadcast failed: {e}")
            
        except Exception as e:
            operation.status = HealingStatus.FAILED
            operation.notes.append(f"Error during healing: {str(e)}")
            logger.error(f"[SelfHeal] Error: {e}")
        
        finally:
            operation.completed_at = datetime.now(timezone.utc).isoformat()
            self.operations[operation.operation_id] = operation
            
            if self.db is not None:
                await self._store_operation(operation)
        
        return operation
    
    async def _generate_fix(
        self,
        error: DetectedError,
        file_path: Optional[str]
    ) -> Dict[str, Any]:
        """
        Generate a fix for an error.
        Uses pattern matching first, then AI if available.
        """
        fix_id = str(uuid.uuid4())
        
        # Try pattern-based fix first
        if error.matched_pattern_id:
            # TODO: Implement pattern-based fix lookup
            pass
        
        # Read original content
        original_content = ""
        if file_path and os.path.exists(file_path):
            try:
                with open(file_path, 'r') as f:
                    original_content = f.read()
            except Exception:
                pass
        
        # Use AI for fix generation if available
        if self.llm_key and error.error_message:
            try:
                fixed_content, description = await self._ai_generate_fix(
                    error.error_type,
                    error.error_message,
                    original_content,
                    file_path
                )
                
                if fixed_content:
                    return {
                        "success": True,
                        "fix_id": fix_id,
                        "fix_type": "ai_generated",
                        "description": description,
                        "file_path": file_path,
                        "original_content": original_content,
                        "fixed_content": fixed_content
                    }
            except Exception as e:
                logger.error(f"AI fix generation failed: {e}")
        
        return {
            "success": False,
            "reason": "Could not generate fix"
        }
    
    async def _ai_generate_fix(
        self,
        error_type: str,
        error_message: str,
        original_code: str,
        file_path: Optional[str]
    ) -> tuple[Optional[str], str]:
        """
        Use AI (GPT-5.2) to generate a fix for the error.
        """
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            
            # Create system prompt for code fixing
            system_prompt = """You are an expert software engineer specializing in debugging and fixing code errors.
Your task is to analyze errors and provide precise, minimal fixes that:
1. Resolve the specific error without breaking existing functionality
2. Follow best practices and maintain code style
3. Include only the necessary changes

IMPORTANT: Respond ONLY with the corrected code. No explanations, no markdown formatting, just the raw fixed code."""
            
            # Create user message with error details
            user_prompt = f"""Fix this error:

Error Type: {error_type}
Error Message: {error_message}
File: {file_path or 'Unknown'}

Original Code:
{original_code[:4000]}

Provide ONLY the corrected code:"""
            
            # Initialize chat with GPT-5.2
            chat = LlmChat(
                api_key=self.llm_key,
                session_id=f"autofix-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                system_message=system_prompt
            ).with_model("openai", "gpt-5.2")
            
            # Send message and get response
            user_message = UserMessage(text=user_prompt)
            response = await chat.send_message(user_message)
            
            # Extract code from response
            fixed_code = response.strip()
            
            # Remove markdown code blocks if present
            if fixed_code.startswith("```"):
                lines = fixed_code.split('\n')
                # Find the end of the code block
                end_idx = len(lines) - 1
                for i in range(len(lines) - 1, 0, -1):
                    if lines[i].strip() == '```':
                        end_idx = i
                        break
                # Get content between code block markers
                fixed_code = '\n'.join(lines[1:end_idx])
            
            logger.info(f"[AI AutoFix] Generated fix for {error_type} using GPT-5.2")
            return fixed_code, f"AI-generated fix for {error_type} (GPT-5.2)"
            
        except Exception as e:
            logger.error(f"AI fix generation error: {e}")
            return None, ""
    
    async def _handle_health_alert(self, alert: Dict):
        """Handle health alerts from the monitor"""
        logger.warning(f"[SelfHeal] Health alert: {alert}")
        
        # Check if we need to trigger rollback
        if alert.get("threshold_type") == "critical":
            # Find recent deployments and consider rollback
            active = await self.canary_deployer.get_active_deployments()
            for dep in active:
                if dep:
                    await self.rollback_manager.check_triggers(
                        error_rate=1.0 if alert.get("status") == "unhealthy" else 0.0,
                        service_status=0 if alert.get("status") == "unhealthy" else 1,
                        fix_id=dep.get("fix_id")
                    )
    
    async def _store_operation(self, operation: HealingOperation):
        """Store operation in database"""
        if self.db is None:
            return
        
        doc = {
            "operation_id": operation.operation_id,
            "error_id": operation.error_id,
            "error_type": operation.error_type,
            "error_message": operation.error_message[:500],
            "status": operation.status.value,
            "current_step": operation.current_step,
            "fix_id": operation.fix_id,
            "fix_description": operation.fix_description,
            "fix_file_path": operation.fix_file_path,
            "test_suite_id": operation.test_suite_id,
            "tests_passed": operation.tests_passed,
            "deployment_id": operation.deployment_id,
            "deployed": operation.deployed,
            "protection_blocked": operation.protection_blocked,
            "protection_reason": operation.protection_reason,
            "confidence_score": operation.confidence_score,
            "started_at": operation.started_at,
            "completed_at": operation.completed_at,
            "notes": operation.notes
        }
        
        await self.operations_collection.replace_one(
            {"operation_id": operation.operation_id},
            doc,
            upsert=True
        )
    
    async def get_operation(self, operation_id: str) -> Optional[Dict]:
        """Get operation by ID"""
        if operation_id in self.operations:
            op = self.operations[operation_id]
            return {
                "operation_id": op.operation_id,
                "error_type": op.error_type,
                "status": op.status.value,
                "fix_description": op.fix_description,
                "tests_passed": op.tests_passed,
                "deployed": op.deployed,
                "confidence_score": op.confidence_score,
                "notes": op.notes,
                "started_at": op.started_at,
                "completed_at": op.completed_at
            }
        return None
    
    async def get_dashboard(self) -> Dict[str, Any]:
        """Get comprehensive dashboard data"""
        # Health summary
        health = await self.health_monitor.get_health_summary()
        
        # Error stats
        error_stats = await self.error_detection.get_error_stats(24)
        
        # Learning stats
        learning_stats = await self.learning_engine.get_learning_stats(24)
        
        # Rollback stats
        rollback_stats = await self.rollback_manager.get_stats()
        
        # Recent operations
        recent_ops = [
            {
                "operation_id": op.operation_id,
                "status": op.status.value,
                "error_type": op.error_type,
                "deployed": op.deployed
            }
            for op in list(self.operations.values())[-10:]
        ]
        
        # Protected modules
        protected_modules = await self.critical_guard.get_modules()
        
        return {
            "system_health": health,
            "error_stats": error_stats,
            "learning_stats": learning_stats,
            "rollback_stats": rollback_stats,
            "recent_operations": recent_ops,
            "protected_modules_count": len([m for m in protected_modules if m.get("is_active")]),
            "auto_heal_enabled": self.auto_heal_enabled,
            "is_running": self.is_running
        }
    
    async def set_auto_heal(self, enabled: bool):
        """Enable or disable auto-healing"""
        self.auto_heal_enabled = enabled
        logger.info(f"[SelfHeal] Auto-heal {'enabled' if enabled else 'disabled'}")


# Singleton instance
_orchestrator: Optional[SelfHealingOrchestrator] = None

def get_self_healing_orchestrator(db=None, llm_key: str = None) -> SelfHealingOrchestrator:
    """Get or create singleton orchestrator"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = SelfHealingOrchestrator(db=db, llm_key=llm_key)
    return _orchestrator
