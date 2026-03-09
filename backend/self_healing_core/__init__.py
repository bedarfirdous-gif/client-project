"""
Enterprise Self-Healing System Core
====================================
A production-grade autonomous error detection, analysis, testing,
fixing, deployment, and learning system for the SaaS ERP.

Components:
- ErrorDetectionEngine: Centralized logging, fingerprinting, pattern detection
- SandboxTester: Isolated environments for patch testing
- CanaryDeployer: Phased rollouts with health monitoring
- RollbackManager: Instant reversion based on triggers
- CriticalModuleGuard: Protection for financial/permission logic
- LearningEngine: Feedback loop for fix confidence improvement
- HealthMonitor: Real-time system health tracking
"""

from .error_detection import ErrorDetectionEngine, ErrorFingerprint, ErrorPattern
from .sandbox_tester import SandboxTester, TestResult, TestSuite
from .canary_deployer import CanaryDeployer, DeploymentPhase, RolloutConfig
from .rollback_manager import RollbackManager, RollbackTrigger, RollbackAction
from .critical_guard import CriticalModuleGuard, ProtectionLevel, CriticalModule
from .learning_engine import LearningEngine, FixConfidence, PatternMatch
from .health_monitor import HealthMonitor, ServiceHealth, HealthMetric

__all__ = [
    # Error Detection
    'ErrorDetectionEngine',
    'ErrorFingerprint', 
    'ErrorPattern',
    # Sandbox Testing
    'SandboxTester',
    'TestResult',
    'TestSuite',
    # Canary Deployments
    'CanaryDeployer',
    'DeploymentPhase',
    'RolloutConfig',
    # Rollback System
    'RollbackManager',
    'RollbackTrigger',
    'RollbackAction',
    # Critical Protection
    'CriticalModuleGuard',
    'ProtectionLevel',
    'CriticalModule',
    # Learning
    'LearningEngine',
    'FixConfidence',
    'PatternMatch',
    # Health Monitoring
    'HealthMonitor',
    'ServiceHealth',
    'HealthMetric'
]

__version__ = '1.0.0'
