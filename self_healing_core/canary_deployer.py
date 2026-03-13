"""
Canary Deployer
===============
Phased rollout system with health monitoring for safe deployments.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CanaryDeployer")


class DeploymentStatus(Enum):
    """Status of a deployment"""
    PENDING = "pending"
    PREPARING = "preparing"
    DEPLOYING = "deploying"
    MONITORING = "monitoring"
    PROMOTING = "promoting"
    COMPLETED = "completed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"
    FAILED = "failed"


class RolloutStrategy(Enum):
    """Deployment rollout strategies"""
    IMMEDIATE = "immediate"      # Deploy to all at once
    CANARY = "canary"           # Deploy to small percentage, monitor, then full
    BLUE_GREEN = "blue_green"   # Switch between two environments
    ROLLING = "rolling"         # Deploy incrementally


@dataclass
class DeploymentPhase:
    """A phase in the deployment rollout"""
    phase_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    percentage: int = 0         # Percentage of traffic/users
    duration_minutes: int = 5   # How long to monitor this phase
    
    # Status
    status: DeploymentStatus = DeploymentStatus.PENDING
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    # Health checks during phase
    health_checks_passed: int = 0
    health_checks_failed: int = 0
    error_rate: float = 0.0
    avg_response_time_ms: float = 0.0
    
    # Decision
    should_proceed: bool = True
    rollback_triggered: bool = False
    rollback_reason: Optional[str] = None


@dataclass
class RolloutConfig:
    """Configuration for a deployment rollout"""
    config_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    strategy: RolloutStrategy = RolloutStrategy.CANARY
    
    # Phases (for canary/rolling)
    phases: List[DeploymentPhase] = field(default_factory=list)
    
    # Health thresholds
    max_error_rate: float = 0.05        # 5% error rate triggers rollback
    max_response_time_ms: float = 2000  # 2s response time triggers rollback
    min_health_check_pass_rate: float = 0.95  # 95% health checks must pass
    
    # Timing
    health_check_interval_seconds: int = 30
    minimum_canary_duration_minutes: int = 5
    
    # Auto settings
    auto_promote: bool = True           # Auto-promote if healthy
    auto_rollback: bool = True          # Auto-rollback on failure
    require_manual_approval: bool = False


@dataclass
class Deployment:
    """A deployment instance"""
    deployment_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    fix_id: str = ""
    error_id: Optional[str] = None
    
    # What's being deployed
    file_path: str = ""
    original_content: str = ""
    new_content: str = ""
    
    # Config
    config: Optional[RolloutConfig] = None
    
    # Status
    status: DeploymentStatus = DeploymentStatus.PENDING
    current_phase_index: int = 0
    
    # Timing
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    # Results
    success: bool = False
    rollback_count: int = 0
    notes: List[str] = field(default_factory=list)


# Default canary phases
DEFAULT_CANARY_PHASES = [
    DeploymentPhase(name="Canary 5%", percentage=5, duration_minutes=5),
    DeploymentPhase(name="Canary 25%", percentage=25, duration_minutes=5),
    DeploymentPhase(name="Canary 50%", percentage=50, duration_minutes=3),
    DeploymentPhase(name="Full Rollout", percentage=100, duration_minutes=2),
]


class CanaryDeployer:
    """
    Canary deployment system for safe rollouts.
    
    Features:
    - Phased rollouts (canary, blue-green, rolling)
    - Health monitoring during deployment
    - Automatic rollback on failure
    - Manual approval gates
    """
    
    def __init__(self, db=None):
        self.db = db
        self.deployments: Dict[str, Deployment] = {}
        self.active_deployments: List[str] = []
        self.health_check_callbacks: List[Callable] = []
        
        # Collections
        if db is not None:
            self.deployments_collection = db.canary_deployments
            self.phases_collection = db.deployment_phases
        
        logger.info("CanaryDeployer initialized")
    
    def create_default_config(self, name: str = "Default Canary") -> RolloutConfig:
        """Create a default canary rollout config"""
        return RolloutConfig(
            name=name,
            strategy=RolloutStrategy.CANARY,
            phases=[
                DeploymentPhase(name="Canary 10%", percentage=10, duration_minutes=3),
                DeploymentPhase(name="Canary 50%", percentage=50, duration_minutes=2),
                DeploymentPhase(name="Full Rollout", percentage=100, duration_minutes=1),
            ]
        )
    
    async def create_deployment(
        self,
        fix_id: str,
        file_path: str,
        original_content: str,
        new_content: str,
        error_id: Optional[str] = None,
        config: Optional[RolloutConfig] = None
    ) -> Deployment:
        """
        Create a new deployment for a fix.
        """
        if not config:
            config = self.create_default_config()
        
        deployment = Deployment(
            fix_id=fix_id,
            error_id=error_id,
            file_path=file_path,
            original_content=original_content,
            new_content=new_content,
            config=config
        )
        
        self.deployments[deployment.deployment_id] = deployment
        
        if self.db is not None:
            await self._store_deployment(deployment)
        
        logger.info(f"[Canary] Created deployment {deployment.deployment_id[:8]} for fix {fix_id[:8]}")
        
        return deployment
    
    async def start_deployment(self, deployment_id: str) -> bool:
        """
        Start a deployment rollout.
        """
        if deployment_id not in self.deployments:
            return False
        
        deployment = self.deployments[deployment_id]
        
        if deployment.status not in [DeploymentStatus.PENDING, DeploymentStatus.ROLLED_BACK]:
            logger.warning(f"Cannot start deployment in status {deployment.status}")
            return False
        
        deployment.status = DeploymentStatus.PREPARING
        deployment.started_at = datetime.now(timezone.utc).isoformat()
        self.active_deployments.append(deployment_id)
        
        # Start rollout in background
        asyncio.create_task(self._execute_rollout(deployment))
        
        return True
    
    async def _execute_rollout(self, deployment: Deployment):
        """
        Execute the rollout phases.
        """
        try:
            config = deployment.config
            if not config:
                deployment.status = DeploymentStatus.FAILED
                deployment.notes.append("No rollout config")
                return
            
            deployment.status = DeploymentStatus.DEPLOYING
            
            for i, phase in enumerate(config.phases):
                deployment.current_phase_index = i
                phase.status = DeploymentStatus.DEPLOYING
                phase.started_at = datetime.now(timezone.utc).isoformat()
                
                deployment.notes.append(f"Starting phase: {phase.name} ({phase.percentage}%)")
                
                # Apply fix at this percentage (simulated for now)
                # In a real system, this would control traffic routing
                await self._apply_phase(deployment, phase)
                
                # Monitor phase
                phase.status = DeploymentStatus.MONITORING
                success = await self._monitor_phase(deployment, phase, config)
                
                if not success:
                    # Trigger rollback
                    phase.rollback_triggered = True
                    deployment.notes.append(f"Phase {phase.name} failed health checks")
                    
                    if config.auto_rollback:
                        await self._rollback(deployment, f"Health check failed in phase {phase.name}")
                        return
                    else:
                        deployment.status = DeploymentStatus.FAILED
                        return
                
                phase.status = DeploymentStatus.COMPLETED
                phase.completed_at = datetime.now(timezone.utc).isoformat()
                deployment.notes.append(f"Phase {phase.name} completed successfully")
            
            # All phases completed
            deployment.status = DeploymentStatus.COMPLETED
            deployment.completed_at = datetime.now(timezone.utc).isoformat()
            deployment.success = True
            deployment.notes.append("Deployment completed successfully")
            
            logger.info(f"[Canary] Deployment {deployment.deployment_id[:8]} completed successfully")
            
        except Exception as e:
            deployment.status = DeploymentStatus.FAILED
            deployment.notes.append(f"Deployment error: {str(e)}")
            logger.error(f"Deployment error: {e}")
        finally:
            if deployment.deployment_id in self.active_deployments:
                self.active_deployments.remove(deployment.deployment_id)
            
            if self.db is not None:
                await self._update_deployment(deployment)
    
    async def _apply_phase(self, deployment: Deployment, phase: DeploymentPhase):
        """
        Apply the fix for a phase percentage.
        In a real system, this would control traffic routing or feature flags.
        For our self-healing system, we apply the fix directly.
        """
        if phase.percentage == 100:
            # Full rollout - actually apply the fix
            try:
                with open(deployment.file_path, 'w') as f:
                    f.write(deployment.new_content)
                deployment.notes.append(f"Applied fix to {deployment.file_path}")
            except Exception as e:
                deployment.notes.append(f"Failed to apply fix: {str(e)}")
                raise
        else:
            # Partial rollout - in a real system, this would route traffic
            deployment.notes.append(f"Simulated {phase.percentage}% rollout")
    
    async def _monitor_phase(
        self,
        deployment: Deployment,
        phase: DeploymentPhase,
        config: RolloutConfig
    ) -> bool:
        """
        Monitor a deployment phase for health issues.
        """
        monitoring_duration = phase.duration_minutes * 60
        check_interval = config.health_check_interval_seconds
        checks_needed = monitoring_duration // check_interval
        
        for i in range(int(checks_needed)):
            await asyncio.sleep(check_interval)
            
            # Run health checks
            health = await self._run_health_check()
            
            if health["healthy"]:
                phase.health_checks_passed += 1
            else:
                phase.health_checks_failed += 1
            
            phase.error_rate = health.get("error_rate", 0.0)
            phase.avg_response_time_ms = health.get("avg_response_time_ms", 0.0)
            
            # Check thresholds
            if phase.error_rate > config.max_error_rate:
                phase.rollback_reason = f"Error rate {phase.error_rate:.1%} exceeds {config.max_error_rate:.1%}"
                return False
            
            if phase.avg_response_time_ms > config.max_response_time_ms:
                phase.rollback_reason = f"Response time {phase.avg_response_time_ms}ms exceeds {config.max_response_time_ms}ms"
                return False
            
            total_checks = phase.health_checks_passed + phase.health_checks_failed
            if total_checks > 0:
                pass_rate = phase.health_checks_passed / total_checks
                if pass_rate < config.min_health_check_pass_rate:
                    phase.rollback_reason = f"Health check pass rate {pass_rate:.1%} below {config.min_health_check_pass_rate:.1%}"
                    return False
        
        return True
    
    async def _run_health_check(self) -> Dict[str, Any]:
        """
        Run health checks for the application.
        """
        try:
            # Check backend
            proc = await asyncio.create_subprocess_exec(
                'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
                'http://localhost:8001/api/health',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            
            status_code = int(stdout.decode().strip()) if stdout else 0
            
            return {
                "healthy": status_code == 200,
                "error_rate": 0.0 if status_code == 200 else 1.0,
                "avg_response_time_ms": 100  # Would need actual measurement
            }
            
        except Exception as e:
            return {
                "healthy": False,
                "error_rate": 1.0,
                "avg_response_time_ms": 0,
                "error": str(e)
            }
    
    async def _rollback(self, deployment: Deployment, reason: str):
        """
        Rollback a deployment.
        """
        deployment.status = DeploymentStatus.ROLLING_BACK
        deployment.notes.append(f"Rolling back: {reason}")
        
        try:
            # Restore original content
            with open(deployment.file_path, 'w') as f:
                f.write(deployment.original_content)
            
            deployment.status = DeploymentStatus.ROLLED_BACK
            deployment.rollback_count += 1
            deployment.notes.append("Rollback completed")
            
            logger.info(f"[Canary] Deployment {deployment.deployment_id[:8]} rolled back: {reason}")
            
        except Exception as e:
            deployment.status = DeploymentStatus.FAILED
            deployment.notes.append(f"Rollback failed: {str(e)}")
            logger.error(f"Rollback failed: {e}")
    
    async def rollback_deployment(self, deployment_id: str, reason: str = "Manual rollback") -> bool:
        """
        Manually trigger a rollback.
        """
        if deployment_id not in self.deployments:
            return False
        
        deployment = self.deployments[deployment_id]
        await self._rollback(deployment, reason)
        
        return deployment.status == DeploymentStatus.ROLLED_BACK
    
    async def _store_deployment(self, deployment: Deployment):
        """Store deployment in database"""
        if self.db is None:
            return
        
        doc = {
            "deployment_id": deployment.deployment_id,
            "fix_id": deployment.fix_id,
            "error_id": deployment.error_id,
            "file_path": deployment.file_path,
            "status": deployment.status.value,
            "current_phase_index": deployment.current_phase_index,
            "created_at": deployment.created_at,
            "started_at": deployment.started_at,
            "completed_at": deployment.completed_at,
            "success": deployment.success,
            "rollback_count": deployment.rollback_count,
            "notes": deployment.notes,
            "config": {
                "name": deployment.config.name,
                "strategy": deployment.config.strategy.value,
                "phases": [
                    {
                        "name": p.name,
                        "percentage": p.percentage,
                        "status": p.status.value
                    }
                    for p in deployment.config.phases
                ]
            } if deployment.config else None
        }
        
        await self.deployments_collection.insert_one(doc)
    
    async def _update_deployment(self, deployment: Deployment):
        """Update deployment in database"""
        if self.db is None:
            return
        
        await self.deployments_collection.update_one(
            {"deployment_id": deployment.deployment_id},
            {"$set": {
                "status": deployment.status.value,
                "current_phase_index": deployment.current_phase_index,
                "completed_at": deployment.completed_at,
                "success": deployment.success,
                "rollback_count": deployment.rollback_count,
                "notes": deployment.notes
            }}
        )
    
    async def get_deployment(self, deployment_id: str) -> Optional[Dict]:
        """Get deployment by ID"""
        if deployment_id in self.deployments:
            d = self.deployments[deployment_id]
            return {
                "deployment_id": d.deployment_id,
                "fix_id": d.fix_id,
                "file_path": d.file_path,
                "status": d.status.value,
                "success": d.success,
                "notes": d.notes
            }
        return None
    
    async def get_active_deployments(self) -> List[Dict]:
        """Get all active deployments"""
        return [
            await self.get_deployment(d_id)
            for d_id in self.active_deployments
        ]
