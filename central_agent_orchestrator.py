"""
Central Agent Orchestrator - Master AI Agent Controller
========================================================
Provides full orchestration of all AI agents with:
1. Auto-start all agents on deployment
2. Central error routing to best-suited agent
3. Agent-to-agent communication for cascading errors
4. Failure notifications when auto-fix fails
5. Unified status tracking

Author: Central Agent Orchestrator
Version: 1.0.0
"""

import os
import json
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorDatabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CentralOrchestrator")


class AgentStatus(Enum):
    """Status of individual agents"""
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    ERROR = "error"
    PAUSED = "paused"


class ErrorCategory(Enum):
    """Categories for error routing"""
    SYNTAX = "syntax"
    RUNTIME = "runtime"
    UI_BLINK = "ui_blink"
    PERFORMANCE = "performance"
    HTTP = "http"
    DATABASE = "database"
    API = "api"
    JAVASCRIPT = "javascript"
    REACT = "react"
    PYTHON = "python"
    UNKNOWN = "unknown"


class NotificationType(Enum):
    """Types of notifications"""
    AUTO_FIX_SUCCESS = "auto_fix_success"
    AUTO_FIX_FAILED = "auto_fix_failed"
    AGENT_STARTED = "agent_started"
    AGENT_STOPPED = "agent_stopped"
    AGENT_ERROR = "agent_error"
    CASCADE_HANDOFF = "cascade_handoff"
    CRITICAL_ERROR = "critical_error"
    LIVE_ERROR = "live_error"


class ErrorSeverity(Enum):
    """Severity levels for errors"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class LiveErrorEvent:
    """A live error event for real-time monitoring"""
    error_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    error_type: str = ""
    error_message: str = ""
    error_category: str = "unknown"
    severity: str = "medium"
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    stack_trace: Optional[str] = None
    source: str = "system"  # system, frontend, backend, user_reported
    status: str = "detected"  # detected, routing, fixing, fixed, failed
    assigned_agent: Optional[str] = None
    fix_attempts: int = 0
    fix_result: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    resolved_at: Optional[str] = None


@dataclass
class AgentInfo:
    """Information about a registered agent"""
    agent_id: str
    agent_name: str
    agent_type: str
    status: AgentStatus = AgentStatus.STOPPED
    capabilities: List[str] = field(default_factory=list)
    error_categories: List[ErrorCategory] = field(default_factory=list)
    priority: int = 5  # 1 = highest, 10 = lowest
    last_activity: Optional[str] = None
    errors_handled: int = 0
    fixes_applied: int = 0
    fix_success_rate: float = 0.0


@dataclass 
class OrchestratorNotification:
    """Notification from the orchestrator"""
    notification_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    notification_type: NotificationType = NotificationType.AUTO_FIX_FAILED
    title: str = ""
    message: str = ""
    severity: str = "info"  # info, warning, error, critical
    agent_id: Optional[str] = None
    error_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    read: bool = False
    dismissed: bool = False


# Agent routing configuration - maps error categories to best-suited agents
AGENT_ROUTING_CONFIG = {
    ErrorCategory.SYNTAX: {
        "primary": "syntax_autofix",
        "fallback": ["error_fix_52", "universal_fixer"],
        "priority_order": ["syntax_autofix", "error_fix_52", "universal_fixer"]
    },
    ErrorCategory.RUNTIME: {
        "primary": "runtime_autofix",
        "fallback": ["universal_fixer", "error_fix_52"],
        "priority_order": ["runtime_autofix", "universal_fixer", "error_fix_52"]
    },
    ErrorCategory.UI_BLINK: {
        "primary": "ui_blink_fix",
        "fallback": ["performance_agent"],
        "priority_order": ["ui_blink_fix", "performance_agent"]
    },
    ErrorCategory.PERFORMANCE: {
        "primary": "performance_agent",
        "fallback": ["ui_blink_fix"],
        "priority_order": ["performance_agent", "ui_blink_fix"]
    },
    ErrorCategory.HTTP: {
        "primary": "error_fix_52",
        "fallback": ["universal_fixer", "autoheal"],
        "priority_order": ["error_fix_52", "universal_fixer", "autoheal"]
    },
    ErrorCategory.DATABASE: {
        "primary": "error_fix_52",
        "fallback": ["autoheal", "universal_fixer"],
        "priority_order": ["error_fix_52", "autoheal", "universal_fixer"]
    },
    ErrorCategory.API: {
        "primary": "error_fix_52",
        "fallback": ["universal_fixer"],
        "priority_order": ["error_fix_52", "universal_fixer"]
    },
    ErrorCategory.JAVASCRIPT: {
        "primary": "syntax_autofix",
        "fallback": ["error_fix_52", "universal_fixer"],
        "priority_order": ["syntax_autofix", "error_fix_52", "universal_fixer"]
    },
    ErrorCategory.REACT: {
        "primary": "error_fix_52",
        "fallback": ["ui_blink_fix", "universal_fixer"],
        "priority_order": ["error_fix_52", "ui_blink_fix", "universal_fixer"]
    },
    ErrorCategory.PYTHON: {
        "primary": "syntax_autofix",
        "fallback": ["error_fix_52", "universal_fixer"],
        "priority_order": ["syntax_autofix", "error_fix_52", "universal_fixer"]
    },
    ErrorCategory.UNKNOWN: {
        "primary": "universal_fixer",
        "fallback": ["error_fix_52", "autoheal"],
        "priority_order": ["universal_fixer", "error_fix_52", "autoheal"]
    }
}


class CentralAgentOrchestrator:
    """
    Central coordinator for all AI agents.
    
    Responsibilities:
    1. Auto-start all agents on initialization
    2. Route errors to the most suitable agent
    3. Handle cascading errors across agents
    4. Generate notifications for failed auto-fixes
    5. Track unified status across all agents
    6. Real-time error monitoring and live feed
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.agents: Dict[str, AgentInfo] = {}
        self.agent_instances: Dict[str, Any] = {}
        self.is_running = False
        self.auto_monitor_task: Optional[asyncio.Task] = None
        self.monitor_interval = 30  # seconds
        
        # Live error tracking (in-memory for real-time performance)
        self.live_errors: List[Dict] = []
        self.max_live_errors = 100  # Keep last 100 errors in memory
        self.error_listeners: List[Callable] = []  # For WebSocket broadcasting
        
        # Collections
        self.notifications_collection = db.orchestrator_notifications
        self.routing_history_collection = db.error_routing_history
        self.agent_status_collection = db.agent_status_history
        self.live_errors_collection = db.live_error_events
        
        logger.info("Central Agent Orchestrator initialized with real-time monitoring")
    
    async def init_indexes(self):
        """Initialize database indexes"""
        await self.notifications_collection.create_index([("created_at", -1)])
        await self.notifications_collection.create_index([("read", 1)])
        await self.notifications_collection.create_index([("notification_type", 1)])
        await self.routing_history_collection.create_index([("created_at", -1)])
        await self.routing_history_collection.create_index([("error_category", 1)])
        await self.agent_status_collection.create_index([("recorded_at", -1)])
        await self.live_errors_collection.create_index([("created_at", -1)])
        await self.live_errors_collection.create_index([("status", 1)])
        await self.live_errors_collection.create_index([("severity", 1)])
        logger.info("Central Orchestrator indexes created")
    
    def register_agent(self, agent_id: str, agent_name: str, agent_type: str,
                       capabilities: List[str], error_categories: List[ErrorCategory],
                       priority: int = 5, instance: Any = None):
        """Register an agent with the orchestrator"""
        agent_info = AgentInfo(
            agent_id=agent_id,
            agent_name=agent_name,
            agent_type=agent_type,
            capabilities=capabilities,
            error_categories=error_categories,
            priority=priority
        )
        self.agents[agent_id] = agent_info
        if instance:
            self.agent_instances[agent_id] = instance
        logger.info(f"Registered agent: {agent_name} ({agent_id})")
    
    async def start_all_agents(self) -> Dict[str, Any]:
        """Auto-start all registered agents"""
        results = {
            "started": [],
            "failed": [],
            "already_running": [],
            "no_auto_start": []
        }
        
        for agent_id, agent_info in self.agents.items():
            try:
                if agent_info.status == AgentStatus.RUNNING:
                    results["already_running"].append(agent_id)
                    continue
                
                agent_info.status = AgentStatus.STARTING
                
                # Start monitoring for agents that support it
                instance = self.agent_instances.get(agent_id)
                if instance:
                    # Try different start methods
                    started = False
                    
                    # Method 1: start_monitoring() without args
                    if hasattr(instance, 'start_monitoring'):
                        import inspect
                        sig = inspect.signature(instance.start_monitoring)
                        params = sig.parameters
                        # Check if method requires args beyond self
                        required_params = [p for p in params.values() 
                                          if p.default == inspect.Parameter.empty 
                                          and p.name != 'self']
                        if not required_params:
                            await instance.start_monitoring()
                            started = True
                        else:
                            # Agent requires tenant_id or other params, skip auto-start
                            results["no_auto_start"].append({
                                "agent_id": agent_id,
                                "reason": "Requires tenant-specific initialization"
                            })
                            agent_info.status = AgentStatus.STOPPED
                            continue
                    
                    # Method 2: start() without args
                    elif hasattr(instance, 'start'):
                        await instance.start()
                        started = True
                    
                    if started:
                        agent_info.status = AgentStatus.RUNNING
                        agent_info.last_activity = datetime.now(timezone.utc).isoformat()
                        results["started"].append(agent_id)
                        
                        # Create notification
                        await self._create_notification(
                            NotificationType.AGENT_STARTED,
                            f"{agent_info.agent_name} Started",
                            f"Agent {agent_info.agent_name} has been auto-started and is now monitoring.",
                            "info",
                            agent_id=agent_id
                        )
                        
                        logger.info(f"Started agent: {agent_info.agent_name}")
                    else:
                        # No start method, just mark as ready
                        agent_info.status = AgentStatus.RUNNING
                        agent_info.last_activity = datetime.now(timezone.utc).isoformat()
                        results["started"].append(agent_id)
                        logger.info(f"Agent ready (no start method): {agent_info.agent_name}")
                else:
                    agent_info.status = AgentStatus.STOPPED
                    results["failed"].append({"agent_id": agent_id, "error": "No instance registered"})
                
            except Exception as e:
                agent_info.status = AgentStatus.ERROR
                results["failed"].append({"agent_id": agent_id, "error": str(e)})
                logger.error(f"Failed to start agent {agent_id}: {e}")
        
        self.is_running = True
        
        # Start background monitoring loop
        if not self.auto_monitor_task or self.auto_monitor_task.done():
            self.auto_monitor_task = asyncio.create_task(self._monitoring_loop())
        
        return results
    
    async def stop_all_agents(self) -> Dict[str, Any]:
        """Stop all agents"""
        results = {"stopped": [], "failed": []}
        
        for agent_id, agent_info in self.agents.items():
            try:
                instance = self.agent_instances.get(agent_id)
                if instance and hasattr(instance, 'stop_monitoring'):
                    await instance.stop_monitoring()
                
                agent_info.status = AgentStatus.STOPPED
                results["stopped"].append(agent_id)
                
            except Exception as e:
                results["failed"].append({"agent_id": agent_id, "error": str(e)})
        
        self.is_running = False
        if self.auto_monitor_task:
            self.auto_monitor_task.cancel()
        
        return results
    
    def categorize_error(self, error_type: str, error_message: str, 
                         file_path: Optional[str] = None) -> ErrorCategory:
        """Categorize an error to route it to the right agent"""
        error_type_lower = error_type.lower()
        error_msg_lower = error_message.lower()
        
        # Check file extension
        if file_path:
            if file_path.endswith(('.js', '.jsx', '.ts', '.tsx')):
                if 'syntax' in error_msg_lower or 'unexpected token' in error_msg_lower:
                    return ErrorCategory.SYNTAX
                if 'react' in error_msg_lower or 'hook' in error_msg_lower or 'component' in error_msg_lower:
                    return ErrorCategory.REACT
                return ErrorCategory.JAVASCRIPT
            elif file_path.endswith('.py'):
                if 'syntax' in error_msg_lower or 'indentation' in error_msg_lower:
                    return ErrorCategory.SYNTAX
                return ErrorCategory.PYTHON
        
        # Check error type keywords
        if any(x in error_type_lower for x in ['syntax', 'parse', 'unexpected']):
            return ErrorCategory.SYNTAX
        if any(x in error_type_lower for x in ['runtime', 'exception', 'crash']):
            return ErrorCategory.RUNTIME
        if any(x in error_type_lower for x in ['blink', 'flash', 'flicker', 'ui']):
            return ErrorCategory.UI_BLINK
        if any(x in error_type_lower for x in ['performance', 'slow', 'timeout', 'latency']):
            return ErrorCategory.PERFORMANCE
        if any(x in error_type_lower for x in ['http', '404', '500', '502', '503']):
            return ErrorCategory.HTTP
        if any(x in error_type_lower for x in ['database', 'mongo', 'query', 'connection']):
            return ErrorCategory.DATABASE
        if any(x in error_type_lower for x in ['api', 'endpoint', 'request', 'response']):
            return ErrorCategory.API
        
        # Check error message
        if 'react' in error_msg_lower or 'hook' in error_msg_lower:
            return ErrorCategory.REACT
        if 'import' in error_msg_lower or 'module' in error_msg_lower:
            return ErrorCategory.PYTHON if 'python' in error_msg_lower else ErrorCategory.JAVASCRIPT
        
        return ErrorCategory.UNKNOWN
    
    async def route_error(self, error_type: str, error_message: str,
                         file_path: Optional[str] = None,
                         context: Optional[Dict] = None) -> Dict[str, Any]:
        """Route an error to the most suitable agent for fixing"""
        category = self.categorize_error(error_type, error_message, file_path)
        routing_config = AGENT_ROUTING_CONFIG.get(category, AGENT_ROUTING_CONFIG[ErrorCategory.UNKNOWN])
        
        result = {
            "error_category": category.value,
            "routing_attempted": [],
            "fix_applied": False,
            "fix_result": None,
            "notifications_created": []
        }
        
        # Try agents in priority order
        for agent_id in routing_config["priority_order"]:
            if agent_id not in self.agents:
                continue
            
            agent_info = self.agents[agent_id]
            if agent_info.status != AgentStatus.RUNNING:
                continue
            
            result["routing_attempted"].append(agent_id)
            
            try:
                instance = self.agent_instances.get(agent_id)
                if not instance:
                    continue
                
                # Attempt to fix with this agent
                fix_result = await self._attempt_fix_with_agent(
                    instance, agent_id, error_type, error_message, file_path, context
                )
                
                if fix_result.get("success"):
                    agent_info.fixes_applied += 1
                    agent_info.errors_handled += 1
                    agent_info.last_activity = datetime.now(timezone.utc).isoformat()
                    
                    result["fix_applied"] = True
                    result["fix_result"] = fix_result
                    result["fixed_by_agent"] = agent_id
                    
                    # Success notification
                    notif = await self._create_notification(
                        NotificationType.AUTO_FIX_SUCCESS,
                        f"Auto-Fix Applied by {agent_info.agent_name}",
                        f"Error '{error_type}' was automatically fixed.",
                        "info",
                        agent_id=agent_id,
                        metadata={"error_type": error_type, "fix_result": fix_result}
                    )
                    result["notifications_created"].append(notif)
                    
                    # Log routing
                    await self._log_routing(category, agent_id, True, error_type)
                    
                    return result
                else:
                    # This agent couldn't fix, try next (cascade)
                    agent_info.errors_handled += 1
                    
                    # Cascade notification
                    notif = await self._create_notification(
                        NotificationType.CASCADE_HANDOFF,
                        f"Error Cascaded from {agent_info.agent_name}",
                        f"Agent could not fix '{error_type}', passing to next agent.",
                        "warning",
                        agent_id=agent_id,
                        metadata={"error_type": error_type, "reason": fix_result.get("reason", "Unknown")}
                    )
                    result["notifications_created"].append(notif)
                    
            except Exception as e:
                logger.error(f"Error attempting fix with {agent_id}: {e}")
                continue
        
        # All agents failed
        notif = await self._create_notification(
            NotificationType.AUTO_FIX_FAILED,
            "Auto-Fix Failed - Manual Intervention Required",
            f"All agents failed to fix error: {error_type}. Message: {error_message[:200]}",
            "error",
            metadata={
                "error_type": error_type,
                "error_message": error_message,
                "agents_tried": result["routing_attempted"]
            }
        )
        result["notifications_created"].append(notif)
        
        # Log failed routing
        await self._log_routing(category, None, False, error_type)
        
        return result
    
    async def _attempt_fix_with_agent(self, instance: Any, agent_id: str,
                                      error_type: str, error_message: str,
                                      file_path: Optional[str],
                                      context: Optional[Dict]) -> Dict[str, Any]:
        """Attempt to fix an error using a specific agent"""
        try:
            # Different agents have different fix methods
            if hasattr(instance, 'auto_fix_error'):
                return await instance.auto_fix_error(error_type, error_message, file_path, context)
            elif hasattr(instance, 'fix_error'):
                return await instance.fix_error(error_type, error_message)
            elif hasattr(instance, 'analyze_and_fix'):
                return await instance.analyze_and_fix(error_message)
            elif hasattr(instance, 'scan_and_fix'):
                result = await instance.scan_and_fix()
                return {"success": result.get("fixes_applied", 0) > 0, "result": result}
            else:
                return {"success": False, "reason": "Agent has no compatible fix method"}
        except Exception as e:
            return {"success": False, "reason": str(e)}
    
    async def _create_notification(self, notification_type: NotificationType,
                                   title: str, message: str, severity: str,
                                   agent_id: Optional[str] = None,
                                   error_id: Optional[str] = None,
                                   metadata: Optional[Dict] = None) -> Dict:
        """Create and store a notification"""
        notification = OrchestratorNotification(
            notification_type=notification_type,
            title=title,
            message=message,
            severity=severity,
            agent_id=agent_id,
            error_id=error_id,
            metadata=metadata or {}
        )
        
        doc = {
            "notification_id": notification.notification_id,
            "notification_type": notification.notification_type.value,
            "title": notification.title,
            "message": notification.message,
            "severity": notification.severity,
            "agent_id": notification.agent_id,
            "error_id": notification.error_id,
            "metadata": notification.metadata,
            "created_at": notification.created_at,
            "read": notification.read,
            "dismissed": notification.dismissed
        }
        
        await self.notifications_collection.insert_one(doc)
        logger.info(f"Notification created: {title}")
        
        return {"notification_id": notification.notification_id, "title": title}
    
    async def _log_routing(self, category: ErrorCategory, agent_id: Optional[str],
                          success: bool, error_type: str):
        """Log error routing for analytics"""
        await self.routing_history_collection.insert_one({
            "routing_id": str(uuid.uuid4()),
            "error_category": category.value,
            "routed_to_agent": agent_id,
            "success": success,
            "error_type": error_type,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    async def _monitoring_loop(self):
        """Background monitoring loop"""
        logger.info("Central Orchestrator monitoring loop started")
        
        while self.is_running:
            try:
                # Check agent health
                for agent_id, agent_info in self.agents.items():
                    if agent_info.status == AgentStatus.RUNNING:
                        instance = self.agent_instances.get(agent_id)
                        if instance and hasattr(instance, 'health_check'):
                            try:
                                health = await instance.health_check()
                                if not health.get("healthy", True):
                                    await self._create_notification(
                                        NotificationType.AGENT_ERROR,
                                        f"{agent_info.agent_name} Health Issue",
                                        f"Agent reported unhealthy status: {health.get('reason', 'Unknown')}",
                                        "warning",
                                        agent_id=agent_id
                                    )
                            except Exception as e:
                                logger.error(f"Health check failed for {agent_id}: {e}")
                
                # Record status snapshot
                await self._record_status_snapshot()
                
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
            
            await asyncio.sleep(self.monitor_interval)
    
    async def _record_status_snapshot(self):
        """Record current status of all agents"""
        snapshot = {
            "snapshot_id": str(uuid.uuid4()),
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "orchestrator_running": self.is_running,
            "agents": {}
        }
        
        for agent_id, agent_info in self.agents.items():
            snapshot["agents"][agent_id] = {
                "name": agent_info.agent_name,
                "status": agent_info.status.value,
                "errors_handled": agent_info.errors_handled,
                "fixes_applied": agent_info.fixes_applied,
                "last_activity": agent_info.last_activity
            }
        
        await self.agent_status_collection.insert_one(snapshot)
    
    async def get_notifications(self, limit: int = 50, unread_only: bool = False) -> List[Dict]:
        """Get orchestrator notifications"""
        query = {"dismissed": False}
        if unread_only:
            query["read"] = False
        
        notifications = await self.notifications_collection.find(
            query, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return notifications
    
    async def mark_notification_read(self, notification_id: str) -> bool:
        """Mark a notification as read"""
        result = await self.notifications_collection.update_one(
            {"notification_id": notification_id},
            {"$set": {"read": True}}
        )
        return result.modified_count > 0
    
    async def dismiss_notification(self, notification_id: str) -> bool:
        """Dismiss a notification"""
        result = await self.notifications_collection.update_one(
            {"notification_id": notification_id},
            {"$set": {"dismissed": True}}
        )
        return result.modified_count > 0
    
    async def get_unified_status(self) -> Dict[str, Any]:
        """Get unified status of all agents"""
        # Get notification counts
        unread_count = await self.notifications_collection.count_documents({"read": False, "dismissed": False})
        failed_fixes = await self.notifications_collection.count_documents({
            "notification_type": NotificationType.AUTO_FIX_FAILED.value,
            "dismissed": False,
            "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
        })
        
        # Build agent status
        agents_status = []
        running_count = 0
        total_errors_handled = 0
        total_fixes_applied = 0
        
        for agent_id, agent_info in self.agents.items():
            if agent_info.status == AgentStatus.RUNNING:
                running_count += 1
            total_errors_handled += agent_info.errors_handled
            total_fixes_applied += agent_info.fixes_applied
            
            agents_status.append({
                "agent_id": agent_id,
                "agent_name": agent_info.agent_name,
                "agent_type": agent_info.agent_type,
                "status": agent_info.status.value,
                "capabilities": agent_info.capabilities,
                "errors_handled": agent_info.errors_handled,
                "fixes_applied": agent_info.fixes_applied,
                "last_activity": agent_info.last_activity
            })
        
        return {
            "orchestrator_running": self.is_running,
            "monitor_interval": self.monitor_interval,
            "total_agents": len(self.agents),
            "running_agents": running_count,
            "stopped_agents": len(self.agents) - running_count,
            "total_errors_handled": total_errors_handled,
            "total_fixes_applied": total_fixes_applied,
            "unread_notifications": unread_count,
            "failed_fixes_24h": failed_fixes,
            "agents": agents_status
        }
    
    async def get_routing_analytics(self, hours: int = 24) -> Dict[str, Any]:
        """Get error routing analytics"""
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        pipeline = [
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {
                "_id": {
                    "category": "$error_category",
                    "agent": "$routed_to_agent",
                    "success": "$success"
                },
                "count": {"$sum": 1}
            }}
        ]
        
        results = await self.routing_history_collection.aggregate(pipeline).to_list(None)
        
        # Process results
        by_category = {}
        by_agent = {}
        total_routed = 0
        total_success = 0
        
        for r in results:
            category = r["_id"]["category"]
            agent = r["_id"]["agent"] or "none"
            success = r["_id"]["success"]
            count = r["count"]
            
            total_routed += count
            if success:
                total_success += count
            
            if category not in by_category:
                by_category[category] = {"total": 0, "success": 0}
            by_category[category]["total"] += count
            if success:
                by_category[category]["success"] += count
            
            if agent not in by_agent:
                by_agent[agent] = {"total": 0, "success": 0}
            by_agent[agent]["total"] += count
            if success:
                by_agent[agent]["success"] += count
        
        return {
            "period_hours": hours,
            "total_errors_routed": total_routed,
            "total_fixed": total_success,
            "overall_success_rate": round((total_success / max(total_routed, 1)) * 100, 1),
            "by_category": by_category,
            "by_agent": by_agent
        }
    
    # =============================================
    # REAL-TIME ERROR MONITORING
    # =============================================
    
    def _determine_severity(self, error_type: str, error_message: str) -> str:
        """Determine error severity based on type and message"""
        error_lower = (error_type + " " + error_message).lower()
        
        # Critical errors
        if any(x in error_lower for x in ['crash', 'fatal', 'critical', 'database down', 'server down', 'memory leak']):
            return "critical"
        
        # High severity
        if any(x in error_lower for x in ['500', '502', '503', 'timeout', 'connection refused', 'auth fail', 'security']):
            return "high"
        
        # Medium severity
        if any(x in error_lower for x in ['404', 'not found', 'validation', 'syntax', 'type error', 'reference error']):
            return "medium"
        
        # Low severity
        return "low"
    
    async def report_live_error(self, error_type: str, error_message: str,
                                file_path: Optional[str] = None,
                                line_number: Optional[int] = None,
                                stack_trace: Optional[str] = None,
                                source: str = "system",
                                auto_route: bool = True) -> Dict[str, Any]:
        """Report a live error for real-time monitoring"""
        
        # Determine category and severity
        category = self.categorize_error(error_type, error_message, file_path)
        severity = self._determine_severity(error_type, error_message)
        
        # Create live error event
        error_event = LiveErrorEvent(
            error_type=error_type,
            error_message=error_message[:500],  # Truncate long messages
            error_category=category.value,
            severity=severity,
            file_path=file_path,
            line_number=line_number,
            stack_trace=stack_trace[:2000] if stack_trace else None,
            source=source,
            status="detected"
        )
        
        # Convert to dict for storage
        error_dict = {
            "error_id": error_event.error_id,
            "error_type": error_event.error_type,
            "error_message": error_event.error_message,
            "error_category": error_event.error_category,
            "severity": error_event.severity,
            "file_path": error_event.file_path,
            "line_number": error_event.line_number,
            "stack_trace": error_event.stack_trace,
            "source": error_event.source,
            "status": error_event.status,
            "assigned_agent": error_event.assigned_agent,
            "fix_attempts": error_event.fix_attempts,
            "fix_result": error_event.fix_result,
            "created_at": error_event.created_at,
            "updated_at": error_event.updated_at,
            "resolved_at": error_event.resolved_at
        }
        
        # Store in database
        await self.live_errors_collection.insert_one(error_dict.copy())
        
        # Add to in-memory live feed (for fast polling)
        self.live_errors.insert(0, error_dict)
        if len(self.live_errors) > self.max_live_errors:
            self.live_errors = self.live_errors[:self.max_live_errors]
        
        # Create notification for critical/high severity
        if severity in ["critical", "high"]:
            await self._create_notification(
                NotificationType.LIVE_ERROR,
                f"{'🔴 CRITICAL' if severity == 'critical' else '🟠 HIGH'}: {error_type}",
                error_message[:200],
                severity,
                error_id=error_event.error_id,
                metadata={"category": category.value, "source": source}
            )
        
        # Auto-route to agent if enabled
        if auto_route and self.is_running:
            error_dict["status"] = "routing"
            await self._update_live_error(error_event.error_id, {"status": "routing"})
            
            # Route error asynchronously
            asyncio.create_task(self._auto_route_and_fix(error_event.error_id, error_type, error_message, file_path))
        
        logger.info(f"Live error reported: [{severity.upper()}] {error_type} - {error_message[:100]}")
        
        return {
            "error_id": error_event.error_id,
            "severity": severity,
            "category": category.value,
            "status": error_dict["status"],
            "auto_routing": auto_route
        }
    
    async def _auto_route_and_fix(self, error_id: str, error_type: str,
                                   error_message: str, file_path: Optional[str]):
        """Background task to route and fix an error"""
        try:
            result = await self.route_error(error_type, error_message, file_path)
            
            if result.get("fix_applied"):
                await self._update_live_error(error_id, {
                    "status": "fixed",
                    "assigned_agent": result.get("fixed_by_agent"),
                    "fix_result": "Auto-fixed successfully",
                    "resolved_at": datetime.now(timezone.utc).isoformat()
                })
            else:
                await self._update_live_error(error_id, {
                    "status": "failed",
                    "fix_attempts": len(result.get("routing_attempted", [])),
                    "fix_result": "All agents failed to fix"
                })
        except Exception as e:
            await self._update_live_error(error_id, {
                "status": "failed",
                "fix_result": f"Routing error: {str(e)}"
            })
    
    async def _update_live_error(self, error_id: str, updates: Dict):
        """Update a live error in both memory and database"""
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Update in database
        await self.live_errors_collection.update_one(
            {"error_id": error_id},
            {"$set": updates}
        )
        
        # Update in memory
        for error in self.live_errors:
            if error["error_id"] == error_id:
                error.update(updates)
                break
    
    async def get_live_errors(self, limit: int = 50, status: Optional[str] = None,
                              severity: Optional[str] = None,
                              since_minutes: int = 60) -> Dict[str, Any]:
        """Get live error feed with optional filters"""
        since = (datetime.now(timezone.utc) - timedelta(minutes=since_minutes)).isoformat()
        
        query = {"created_at": {"$gte": since}}
        if status:
            query["status"] = status
        if severity:
            query["severity"] = severity
        
        # Get from database for accuracy
        errors = await self.live_errors_collection.find(
            query, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        # Get stats
        total_errors = await self.live_errors_collection.count_documents({"created_at": {"$gte": since}})
        fixed_count = await self.live_errors_collection.count_documents({"created_at": {"$gte": since}, "status": "fixed"})
        failed_count = await self.live_errors_collection.count_documents({"created_at": {"$gte": since}, "status": "failed"})
        critical_count = await self.live_errors_collection.count_documents({"created_at": {"$gte": since}, "severity": "critical"})
        high_count = await self.live_errors_collection.count_documents({"created_at": {"$gte": since}, "severity": "high"})
        
        return {
            "errors": errors,
            "stats": {
                "total": total_errors,
                "fixed": fixed_count,
                "failed": failed_count,
                "pending": total_errors - fixed_count - failed_count,
                "critical": critical_count,
                "high": high_count,
                "fix_rate": round((fixed_count / max(total_errors, 1)) * 100, 1)
            },
            "period_minutes": since_minutes
        }
    
    async def get_error_by_id(self, error_id: str) -> Optional[Dict]:
        """Get a specific error by ID"""
        error = await self.live_errors_collection.find_one(
            {"error_id": error_id}, {"_id": 0}
        )
        return error
    
    async def acknowledge_error(self, error_id: str, acknowledged_by: str = "system") -> bool:
        """Acknowledge an error (mark as being handled)"""
        result = await self.live_errors_collection.update_one(
            {"error_id": error_id},
            {"$set": {
                "acknowledged": True,
                "acknowledged_by": acknowledged_by,
                "acknowledged_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return result.modified_count > 0
    
    async def resolve_error_manually(self, error_id: str, resolution: str,
                                     resolved_by: str = "user") -> bool:
        """Manually resolve an error"""
        updates = {
            "status": "fixed",
            "fix_result": f"Manual resolution: {resolution}",
            "resolved_by": resolved_by,
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self._update_live_error(error_id, updates)
        return True
    
    async def get_error_timeline(self, hours: int = 24) -> List[Dict]:
        """Get error count timeline for charting"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        pipeline = [
            {"$match": {"created_at": {"$gte": since.isoformat()}}},
            {"$addFields": {
                "hour": {"$substr": ["$created_at", 0, 13]}
            }},
            {"$group": {
                "_id": "$hour",
                "total": {"$sum": 1},
                "fixed": {"$sum": {"$cond": [{"$eq": ["$status", "fixed"]}, 1, 0]}},
                "failed": {"$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}},
                "critical": {"$sum": {"$cond": [{"$eq": ["$severity", "critical"]}, 1, 0]}}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        results = await self.live_errors_collection.aggregate(pipeline).to_list(None)
        return results
    
    # =============================================
    # ERROR TREND ANALYTICS (ENHANCED)
    # =============================================
    
    async def get_error_trends_by_severity(self, hours: int = 24) -> Dict[str, Any]:
        """Get error distribution by severity for pie/donut charts"""
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        pipeline = [
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {
                "_id": "$severity",
                "count": {"$sum": 1},
                "fixed": {"$sum": {"$cond": [{"$eq": ["$status", "fixed"]}, 1, 0]}},
                "failed": {"$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}}
            }},
            {"$sort": {"count": -1}}
        ]
        
        results = await self.live_errors_collection.aggregate(pipeline).to_list(None)
        
        # Format for charts
        data = []
        total = 0
        for r in results:
            severity = r["_id"] or "unknown"
            count = r["count"]
            total += count
            data.append({
                "severity": severity,
                "count": count,
                "fixed": r["fixed"],
                "failed": r["failed"],
                "fix_rate": round((r["fixed"] / max(count, 1)) * 100, 1)
            })
        
        return {
            "period_hours": hours,
            "total_errors": total,
            "by_severity": data
        }
    
    async def get_error_trends_by_category(self, hours: int = 24) -> Dict[str, Any]:
        """Get error distribution by category for bar charts"""
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        pipeline = [
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {
                "_id": "$error_category",
                "count": {"$sum": 1},
                "fixed": {"$sum": {"$cond": [{"$eq": ["$status", "fixed"]}, 1, 0]}},
                "failed": {"$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}},
                "critical": {"$sum": {"$cond": [{"$eq": ["$severity", "critical"]}, 1, 0]}},
                "high": {"$sum": {"$cond": [{"$eq": ["$severity", "high"]}, 1, 0]}}
            }},
            {"$sort": {"count": -1}}
        ]
        
        results = await self.live_errors_collection.aggregate(pipeline).to_list(None)
        
        data = []
        total = 0
        for r in results:
            category = r["_id"] or "unknown"
            count = r["count"]
            total += count
            data.append({
                "category": category,
                "count": count,
                "fixed": r["fixed"],
                "failed": r["failed"],
                "critical": r["critical"],
                "high": r["high"],
                "fix_rate": round((r["fixed"] / max(count, 1)) * 100, 1)
            })
        
        return {
            "period_hours": hours,
            "total_errors": total,
            "by_category": data
        }
    
    async def get_error_trends_by_source(self, hours: int = 24) -> Dict[str, Any]:
        """Get error distribution by source (system, frontend, backend, user_reported)"""
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        pipeline = [
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {
                "_id": "$source",
                "count": {"$sum": 1},
                "fixed": {"$sum": {"$cond": [{"$eq": ["$status", "fixed"]}, 1, 0]}}
            }},
            {"$sort": {"count": -1}}
        ]
        
        results = await self.live_errors_collection.aggregate(pipeline).to_list(None)
        
        data = []
        for r in results:
            source = r["_id"] or "unknown"
            count = r["count"]
            data.append({
                "source": source,
                "count": count,
                "fixed": r["fixed"],
                "fix_rate": round((r["fixed"] / max(count, 1)) * 100, 1)
            })
        
        return {
            "period_hours": hours,
            "by_source": data
        }
    
    async def get_error_trends_by_agent(self, hours: int = 24) -> Dict[str, Any]:
        """Get error handling stats per agent"""
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        pipeline = [
            {"$match": {"created_at": {"$gte": since}, "assigned_agent": {"$ne": None}}},
            {"$group": {
                "_id": "$assigned_agent",
                "count": {"$sum": 1},
                "fixed": {"$sum": {"$cond": [{"$eq": ["$status", "fixed"]}, 1, 0]}},
                "failed": {"$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}}
            }},
            {"$sort": {"count": -1}}
        ]
        
        results = await self.live_errors_collection.aggregate(pipeline).to_list(None)
        
        data = []
        for r in results:
            agent = r["_id"] or "unassigned"
            count = r["count"]
            data.append({
                "agent": agent,
                "agent_name": self.agents.get(agent, AgentInfo(agent, agent, "unknown")).agent_name if agent in self.agents else agent,
                "count": count,
                "fixed": r["fixed"],
                "failed": r["failed"],
                "fix_rate": round((r["fixed"] / max(count, 1)) * 100, 1)
            })
        
        return {
            "period_hours": hours,
            "by_agent": data
        }
    
    async def get_hourly_error_trend(self, hours: int = 24) -> Dict[str, Any]:
        """Get hourly error trend for line charts"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        # Generate all hours in the range for a complete timeline
        all_hours = []
        for i in range(hours):
            hour = since + timedelta(hours=i)
            all_hours.append(hour.strftime("%Y-%m-%dT%H"))
        
        pipeline = [
            {"$match": {"created_at": {"$gte": since.isoformat()}}},
            {"$addFields": {
                "hour": {"$substr": ["$created_at", 0, 13]}
            }},
            {"$group": {
                "_id": "$hour",
                "total": {"$sum": 1},
                "fixed": {"$sum": {"$cond": [{"$eq": ["$status", "fixed"]}, 1, 0]}},
                "failed": {"$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}},
                "critical": {"$sum": {"$cond": [{"$eq": ["$severity", "critical"]}, 1, 0]}},
                "high": {"$sum": {"$cond": [{"$eq": ["$severity", "high"]}, 1, 0]}},
                "medium": {"$sum": {"$cond": [{"$eq": ["$severity", "medium"]}, 1, 0]}},
                "low": {"$sum": {"$cond": [{"$eq": ["$severity", "low"]}, 1, 0]}}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        results = await self.live_errors_collection.aggregate(pipeline).to_list(None)
        
        # Create a map of results
        results_map = {r["_id"]: r for r in results}
        
        # Fill in missing hours with zeros
        timeline = []
        for hour in all_hours:
            if hour in results_map:
                data = results_map[hour]
                timeline.append({
                    "hour": hour,
                    "display_hour": hour.split("T")[1] + ":00",
                    "total": data["total"],
                    "fixed": data["fixed"],
                    "failed": data["failed"],
                    "critical": data["critical"],
                    "high": data["high"],
                    "medium": data["medium"],
                    "low": data["low"]
                })
            else:
                timeline.append({
                    "hour": hour,
                    "display_hour": hour.split("T")[1] + ":00",
                    "total": 0,
                    "fixed": 0,
                    "failed": 0,
                    "critical": 0,
                    "high": 0,
                    "medium": 0,
                    "low": 0
                })
        
        return {
            "period_hours": hours,
            "timeline": timeline
        }
    
    async def get_comprehensive_analytics(self, hours: int = 24) -> Dict[str, Any]:
        """Get all analytics data in one call for the dashboard"""
        # Parallel fetch all analytics
        by_severity, by_category, by_source, by_agent, hourly = await asyncio.gather(
            self.get_error_trends_by_severity(hours),
            self.get_error_trends_by_category(hours),
            self.get_error_trends_by_source(hours),
            self.get_error_trends_by_agent(hours),
            self.get_hourly_error_trend(hours)
        )
        
        # Calculate overall metrics
        total_errors = by_severity.get("total_errors", 0)
        total_fixed = sum(s.get("fixed", 0) for s in by_severity.get("by_severity", []))
        total_critical = sum(1 for s in by_severity.get("by_severity", []) if s.get("severity") == "critical")
        
        return {
            "period_hours": hours,
            "summary": {
                "total_errors": total_errors,
                "total_fixed": total_fixed,
                "fix_rate": round((total_fixed / max(total_errors, 1)) * 100, 1),
                "critical_errors": total_critical
            },
            "by_severity": by_severity.get("by_severity", []),
            "by_category": by_category.get("by_category", []),
            "by_source": by_source.get("by_source", []),
            "by_agent": by_agent.get("by_agent", []),
            "hourly_trend": hourly.get("timeline", [])
        }
    
    # =============================================
    # INTER-AGENT COMMUNICATION SYSTEM
    # =============================================
    
    async def init_communication_indexes(self):
        """Initialize inter-agent communication indexes"""
        if not hasattr(self, 'agent_messages_collection'):
            self.agent_messages_collection = self.db.agent_communication_log
        await self.agent_messages_collection.create_index([("timestamp", -1)])
        await self.agent_messages_collection.create_index([("from_agent", 1)])
        await self.agent_messages_collection.create_index([("to_agent", 1)])
        await self.agent_messages_collection.create_index([("message_type", 1)])
        await self.agent_messages_collection.create_index([("error_id", 1)])
        logger.info("Inter-agent communication indexes created")
    
    async def send_inter_agent_message(
        self,
        from_agent: str,
        to_agent: str,
        message_type: str,
        content: Dict[str, Any],
        error_id: Optional[str] = None,
        priority: str = "normal"
    ) -> Dict[str, Any]:
        """
        Send a message from one agent to another.
        
        Message Types:
        - handoff: Passing an error to another agent
        - consultation: Asking for analysis/advice
        - response: Reply to a consultation
        - notification: One-way notification
        - escalation: Escalating to a more capable agent
        - collaboration_request: Requesting joint work
        - status_update: Progress update on shared work
        """
        if not hasattr(self, 'agent_messages_collection'):
            self.agent_messages_collection = self.db.agent_communication_log
        
        message_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Get agent names for display
        from_agent_name = self.agents.get(from_agent, AgentInfo(from_agent, from_agent, "unknown")).agent_name if from_agent in self.agents else from_agent
        to_agent_name = self.agents.get(to_agent, AgentInfo(to_agent, to_agent, "unknown")).agent_name if to_agent in self.agents else to_agent
        
        message_doc = {
            "message_id": message_id,
            "from_agent": from_agent,
            "from_agent_name": from_agent_name,
            "to_agent": to_agent,
            "to_agent_name": to_agent_name,
            "message_type": message_type,
            "content": content,
            "error_id": error_id,
            "priority": priority,
            "timestamp": timestamp,
            "status": "delivered",
            "read": False,
            "response_id": None
        }
        
        await self.agent_messages_collection.insert_one(message_doc)
        
        logger.info(f"Inter-agent message: [{message_type.upper()}] {from_agent_name} -> {to_agent_name}")
        
        # If this is a handoff, process it
        if message_type == "handoff" and error_id:
            await self._process_handoff(message_id, from_agent, to_agent, error_id, content)
        
        return {
            "message_id": message_id,
            "from": from_agent_name,
            "to": to_agent_name,
            "type": message_type,
            "timestamp": timestamp
        }
    
    async def _process_handoff(
        self,
        message_id: str,
        from_agent: str,
        to_agent: str,
        error_id: str,
        content: Dict[str, Any]
    ):
        """Process an error handoff between agents"""
        # Update error with handoff info
        await self._update_live_error(error_id, {
            "assigned_agent": to_agent,
            "handoff_from": from_agent,
            "handoff_reason": content.get("reason", "Cascading to more suitable agent"),
            "fix_attempts": content.get("previous_attempts", 0) + 1
        })
        
        # Create cascade notification
        from_name = self.agents.get(from_agent, AgentInfo(from_agent, from_agent, "unknown")).agent_name if from_agent in self.agents else from_agent
        to_name = self.agents.get(to_agent, AgentInfo(to_agent, to_agent, "unknown")).agent_name if to_agent in self.agents else to_agent
        
        await self._create_notification(
            NotificationType.CASCADE_HANDOFF,
            f"Error Handoff: {from_name} → {to_name}",
            content.get("reason", "Agent delegating error to specialist"),
            "info",
            agent_id=to_agent,
            error_id=error_id,
            metadata={
                "from_agent": from_agent,
                "to_agent": to_agent,
                "message_id": message_id
            }
        )
        
        # Try to fix with the new agent
        if to_agent in self.agent_instances:
            asyncio.create_task(self._attempt_fix_after_handoff(
                error_id, to_agent, content.get("error_type"), content.get("error_message")
            ))
    
    async def _attempt_fix_after_handoff(
        self,
        error_id: str,
        agent_id: str,
        error_type: Optional[str],
        error_message: Optional[str]
    ):
        """Attempt to fix an error after handoff to a new agent"""
        try:
            instance = self.agent_instances.get(agent_id)
            if not instance:
                return
            
            # Get error details if not provided
            if not error_type or not error_message:
                error = await self.get_error_by_id(error_id)
                if error:
                    error_type = error.get("error_type", "Unknown")
                    error_message = error.get("error_message", "")
            
            result = await self._attempt_fix_with_agent(
                instance, agent_id, error_type, error_message, None, None
            )
            
            if result.get("success"):
                await self._update_live_error(error_id, {
                    "status": "fixed",
                    "fix_result": f"Fixed by {agent_id} after handoff",
                    "resolved_at": datetime.now(timezone.utc).isoformat()
                })
                
                # Send success notification back
                await self.send_inter_agent_message(
                    agent_id,
                    "orchestrator",
                    "status_update",
                    {
                        "error_id": error_id,
                        "status": "fixed",
                        "message": "Successfully resolved error after handoff"
                    },
                    error_id=error_id
                )
            else:
                # Check if there are more agents to try
                error = await self.get_error_by_id(error_id)
                attempts = error.get("fix_attempts", 0) if error else 0
                
                if attempts >= 3:  # Max 3 handoffs
                    await self._update_live_error(error_id, {
                        "status": "failed",
                        "fix_result": f"All agents exhausted after {attempts} attempts"
                    })
                else:
                    # Try to find another agent
                    await self._cascade_to_next_agent(error_id, agent_id, error_type, error_message, attempts)
                    
        except Exception as e:
            logger.error(f"Error during post-handoff fix attempt: {e}")
    
    async def _cascade_to_next_agent(
        self,
        error_id: str,
        failed_agent: str,
        error_type: str,
        error_message: str,
        current_attempts: int
    ):
        """Cascade an error to the next available agent"""
        category = self.categorize_error(error_type, error_message, None)
        routing_config = AGENT_ROUTING_CONFIG.get(category, AGENT_ROUTING_CONFIG[ErrorCategory.UNKNOWN])
        
        # Find next agent in priority order
        tried_agents = await self._get_tried_agents(error_id)
        tried_agents.add(failed_agent)
        
        for agent_id in routing_config["priority_order"]:
            if agent_id not in tried_agents and agent_id in self.agents:
                agent_info = self.agents[agent_id]
                if agent_info.status == AgentStatus.RUNNING:
                    # Handoff to this agent
                    await self.send_inter_agent_message(
                        failed_agent,
                        agent_id,
                        "handoff",
                        {
                            "error_type": error_type,
                            "error_message": error_message,
                            "reason": f"Previous agent ({failed_agent}) could not resolve",
                            "previous_attempts": current_attempts
                        },
                        error_id=error_id,
                        priority="high"
                    )
                    return
        
        # No more agents available
        await self._update_live_error(error_id, {
            "status": "failed",
            "fix_result": "All suitable agents exhausted"
        })
    
    async def _get_tried_agents(self, error_id: str) -> set:
        """Get set of agents that have already tried to fix this error"""
        if not hasattr(self, 'agent_messages_collection'):
            return set()
        
        messages = await self.agent_messages_collection.find(
            {"error_id": error_id, "message_type": "handoff"},
            {"from_agent": 1, "to_agent": 1}
        ).to_list(None)
        
        tried = set()
        for msg in messages:
            tried.add(msg.get("from_agent"))
            tried.add(msg.get("to_agent"))
        return tried
    
    async def get_communication_log(
        self,
        limit: int = 100,
        error_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        message_type: Optional[str] = None,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get inter-agent communication log"""
        if not hasattr(self, 'agent_messages_collection'):
            self.agent_messages_collection = self.db.agent_communication_log
        
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        query = {"timestamp": {"$gte": since}}
        
        if error_id:
            query["error_id"] = error_id
        if agent_id:
            query["$or"] = [{"from_agent": agent_id}, {"to_agent": agent_id}]
        if message_type:
            query["message_type"] = message_type
        
        messages = await self.agent_messages_collection.find(
            query, {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        # Get stats
        total_messages = await self.agent_messages_collection.count_documents({"timestamp": {"$gte": since}})
        handoffs = await self.agent_messages_collection.count_documents({"timestamp": {"$gte": since}, "message_type": "handoff"})
        consultations = await self.agent_messages_collection.count_documents({"timestamp": {"$gte": since}, "message_type": "consultation"})
        escalations = await self.agent_messages_collection.count_documents({"timestamp": {"$gte": since}, "message_type": "escalation"})
        
        return {
            "messages": messages,
            "stats": {
                "total_messages": total_messages,
                "handoffs": handoffs,
                "consultations": consultations,
                "escalations": escalations
            },
            "period_hours": hours
        }
    
    async def get_agent_communication_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get communication statistics per agent"""
        if not hasattr(self, 'agent_messages_collection'):
            self.agent_messages_collection = self.db.agent_communication_log
        
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        # Sent messages
        sent_pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$group": {
                "_id": "$from_agent",
                "sent": {"$sum": 1},
                "handoffs_sent": {"$sum": {"$cond": [{"$eq": ["$message_type", "handoff"]}, 1, 0]}}
            }}
        ]
        
        # Received messages
        received_pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$group": {
                "_id": "$to_agent",
                "received": {"$sum": 1},
                "handoffs_received": {"$sum": {"$cond": [{"$eq": ["$message_type", "handoff"]}, 1, 0]}}
            }}
        ]
        
        sent_results = await self.agent_messages_collection.aggregate(sent_pipeline).to_list(None)
        received_results = await self.agent_messages_collection.aggregate(received_pipeline).to_list(None)
        
        # Merge results
        agent_stats = {}
        
        for r in sent_results:
            agent_id = r["_id"]
            if agent_id not in agent_stats:
                agent_stats[agent_id] = {
                    "agent_id": agent_id,
                    "agent_name": self.agents.get(agent_id, AgentInfo(agent_id, agent_id, "unknown")).agent_name if agent_id in self.agents else agent_id,
                    "sent": 0, "received": 0, "handoffs_sent": 0, "handoffs_received": 0
                }
            agent_stats[agent_id]["sent"] = r["sent"]
            agent_stats[agent_id]["handoffs_sent"] = r["handoffs_sent"]
        
        for r in received_results:
            agent_id = r["_id"]
            if agent_id not in agent_stats:
                agent_stats[agent_id] = {
                    "agent_id": agent_id,
                    "agent_name": self.agents.get(agent_id, AgentInfo(agent_id, agent_id, "unknown")).agent_name if agent_id in self.agents else agent_id,
                    "sent": 0, "received": 0, "handoffs_sent": 0, "handoffs_received": 0
                }
            agent_stats[agent_id]["received"] = r["received"]
            agent_stats[agent_id]["handoffs_received"] = r["handoffs_received"]
        
        return {
            "period_hours": hours,
            "agents": list(agent_stats.values())
        }
    
    async def request_agent_consultation(
        self,
        requesting_agent: str,
        target_agent: str,
        error_id: str,
        question: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Request a consultation from another agent about an error"""
        # Send consultation request
        message = await self.send_inter_agent_message(
            requesting_agent,
            target_agent,
            "consultation",
            {
                "question": question,
                "error_id": error_id,
                "context": context
            },
            error_id=error_id,
            priority="normal"
        )
        
        # If target agent has an analyze method, get analysis
        instance = self.agent_instances.get(target_agent)
        analysis = None
        
        if instance:
            if hasattr(instance, 'analyze_error'):
                try:
                    analysis = await instance.analyze_error(context.get("error_type"), context.get("error_message"))
                except Exception as e:
                    analysis = {"error": str(e)}
            elif hasattr(instance, 'get_recommendation'):
                try:
                    analysis = await instance.get_recommendation(context)
                except Exception as e:
                    analysis = {"error": str(e)}
        
        # Send response
        if analysis:
            await self.send_inter_agent_message(
                target_agent,
                requesting_agent,
                "response",
                {
                    "analysis": analysis,
                    "original_question": question,
                    "recommendation": analysis.get("recommendation", "No specific recommendation")
                },
                error_id=error_id
            )
        
        return {
            "consultation_id": message["message_id"],
            "analysis": analysis,
            "status": "completed" if analysis else "pending"
        }


# Global instance
_central_orchestrator: Optional[CentralAgentOrchestrator] = None


def get_central_orchestrator() -> Optional[CentralAgentOrchestrator]:
    """Get the global central orchestrator instance"""
    return _central_orchestrator


def initialize_central_orchestrator(db: AsyncIOMotorDatabase) -> CentralAgentOrchestrator:
    """Initialize the global central orchestrator"""
    global _central_orchestrator
    _central_orchestrator = CentralAgentOrchestrator(db)
    return _central_orchestrator
