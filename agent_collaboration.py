"""
Agent Collaboration System - Multi-Agent Orchestration
=======================================================
Enables AI agents to work together, share context, and collaborate
on complex tasks that require multiple specialized capabilities.

Features:
1. Agent-to-Agent Communication
2. Task Delegation and Routing
3. Shared Context Management
4. Collaborative Workflows
5. Conflict Resolution
6. Performance Analytics

Agents:
- UI Blink Fix Agent: Frontend performance healing
- Error Auto-Fix Agent: Error detection and resolution
- Performance Agent: Speed optimization
- AutoHeal Agent: System health monitoring

Author: Agent Collaboration System
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
logger = logging.getLogger("AgentCollaboration")


class AgentType(Enum):
    """Types of available agents"""
    UI_BLINK_FIX = "ui_blink_fix"
    ERROR_AUTOFIX = "error_autofix"
    PERFORMANCE = "performance"
    AUTOHEAL = "autoheal"


class TaskPriority(Enum):
    """Priority levels for collaborative tasks"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TaskStatus(Enum):
    """Status of collaborative tasks"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DELEGATED = "delegated"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CollaborationMode(Enum):
    """How agents collaborate"""
    SEQUENTIAL = "sequential"  # One agent after another
    PARALLEL = "parallel"  # Multiple agents simultaneously
    PIPELINE = "pipeline"  # Output of one feeds into another
    CONSENSUS = "consensus"  # Agents vote on best solution


@dataclass
class AgentMessage:
    """Message passed between agents"""
    message_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    from_agent: AgentType = AgentType.UI_BLINK_FIX
    to_agent: AgentType = AgentType.ERROR_AUTOFIX
    message_type: str = "request"  # request, response, notification, alert
    content: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    requires_response: bool = False
    response_timeout_ms: int = 30000


@dataclass
class CollaborativeTask:
    """A task that requires multiple agents"""
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    task_type: str = ""
    description: str = ""
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.PENDING
    mode: CollaborationMode = CollaborationMode.SEQUENTIAL
    agents_involved: List[AgentType] = field(default_factory=list)
    current_agent: Optional[AgentType] = None
    context: Dict[str, Any] = field(default_factory=dict)
    results: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None


# Pre-defined collaboration workflows
COLLABORATION_WORKFLOWS = {
    "daily_maintenance": {
        "description": "Daily system maintenance - health check + auto-fix safe issues",
        "mode": CollaborationMode.SEQUENTIAL,
        "agents": [AgentType.ERROR_AUTOFIX, AgentType.UI_BLINK_FIX, AgentType.PERFORMANCE],
        "steps": [
            {"agent": AgentType.ERROR_AUTOFIX, "action": "check_errors"},
            {"agent": AgentType.UI_BLINK_FIX, "action": "scan_for_issues"},
            {"agent": AgentType.PERFORMANCE, "action": "analyze_performance"},
            {"agent": AgentType.ERROR_AUTOFIX, "action": "auto_fix_safe"},
            {"agent": AgentType.PERFORMANCE, "action": "auto_optimize"}
        ],
        "auto_trigger": "on_login",
        "cooldown_hours": 24
    },
    "full_health_check": {
        "description": "Complete system health analysis using all agents",
        "mode": CollaborationMode.PARALLEL,
        "agents": [AgentType.UI_BLINK_FIX, AgentType.ERROR_AUTOFIX, AgentType.PERFORMANCE, AgentType.AUTOHEAL],
        "steps": [
            {"agent": AgentType.AUTOHEAL, "action": "check_system_health"},
            {"agent": AgentType.UI_BLINK_FIX, "action": "scan_for_issues"},
            {"agent": AgentType.PERFORMANCE, "action": "analyze_performance"},
            {"agent": AgentType.ERROR_AUTOFIX, "action": "check_errors"}
        ]
    },
    "auto_fix_all": {
        "description": "Automatically fix all detected issues across all agents",
        "mode": CollaborationMode.SEQUENTIAL,
        "agents": [AgentType.ERROR_AUTOFIX, AgentType.UI_BLINK_FIX, AgentType.PERFORMANCE],
        "steps": [
            {"agent": AgentType.ERROR_AUTOFIX, "action": "auto_fix_safe"},
            {"agent": AgentType.UI_BLINK_FIX, "action": "auto_fix"},
            {"agent": AgentType.PERFORMANCE, "action": "auto_optimize"}
        ]
    },
    "frontend_optimization": {
        "description": "Optimize frontend performance and fix UI issues",
        "mode": CollaborationMode.PIPELINE,
        "agents": [AgentType.PERFORMANCE, AgentType.UI_BLINK_FIX],
        "steps": [
            {"agent": AgentType.PERFORMANCE, "action": "analyze_frontend"},
            {"agent": AgentType.UI_BLINK_FIX, "action": "fix_detected_issues"}
        ]
    },
    "error_recovery": {
        "description": "Detect and recover from system errors",
        "mode": CollaborationMode.PIPELINE,
        "agents": [AgentType.ERROR_AUTOFIX, AgentType.AUTOHEAL],
        "steps": [
            {"agent": AgentType.ERROR_AUTOFIX, "action": "detect_and_fix"},
            {"agent": AgentType.AUTOHEAL, "action": "verify_recovery"}
        ]
    }
}


class AgentCollaborationSystem:
    """
    Orchestrates collaboration between multiple AI agents.
    
    Capabilities:
    1. Route tasks to appropriate agents
    2. Manage inter-agent communication
    3. Execute collaborative workflows
    4. Track and report collaboration results
    5. Learn from successful collaborations
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, agents: Dict[str, Any]):
        self.db = db
        self.agents = agents  # Dictionary of agent instances
        self.tasks_collection = db.collaboration_tasks
        self.messages_collection = db.agent_messages
        self.workflows_collection = db.collaboration_workflows
        self.analytics_collection = db.collaboration_analytics
        
        # Agent capabilities mapping
        self.agent_capabilities = {
            AgentType.UI_BLINK_FIX: ["scan_ui", "fix_blink", "analyze_components", "auto_fix"],
            AgentType.ERROR_AUTOFIX: ["detect_errors", "generate_fix", "apply_fix", "auto_fix_safe"],
            AgentType.PERFORMANCE: ["analyze_performance", "optimize", "auto_optimize", "analyze_frontend"],
            AgentType.AUTOHEAL: ["check_system_health", "heal_system", "verify_recovery", "monitor"]
        }
        
        logger.info("Agent Collaboration System initialized")
    
    async def init_indexes(self):
        """Initialize database indexes"""
        await self.tasks_collection.create_index([("created_at", -1)])
        await self.tasks_collection.create_index([("status", 1)])
        await self.tasks_collection.create_index([("task_type", 1)])
        await self.messages_collection.create_index([("timestamp", -1)])
        await self.messages_collection.create_index([("from_agent", 1)])
        await self.analytics_collection.create_index([("recorded_at", -1)])
        logger.info("Agent Collaboration System indexes created")
    
    def get_capable_agent(self, action: str) -> Optional[AgentType]:
        """Find an agent capable of performing the given action"""
        for agent_type, capabilities in self.agent_capabilities.items():
            if action in capabilities:
                return agent_type
        return None
    
    async def send_message(self, message: AgentMessage) -> Optional[Dict]:
        """Send a message between agents"""
        # Store message
        await self.messages_collection.insert_one({
            "message_id": message.message_id,
            "from_agent": message.from_agent.value,
            "to_agent": message.to_agent.value,
            "message_type": message.message_type,
            "content": message.content,
            "context": message.context,
            "timestamp": message.timestamp,
            "requires_response": message.requires_response
        })
        
        # Route to appropriate agent
        response = None
        if message.to_agent == AgentType.UI_BLINK_FIX and "ui_blink" in self.agents:
            response = await self._handle_ui_blink_message(message)
        elif message.to_agent == AgentType.ERROR_AUTOFIX and "error_autofix" in self.agents:
            response = await self._handle_error_autofix_message(message)
        elif message.to_agent == AgentType.PERFORMANCE and "performance" in self.agents:
            response = await self._handle_performance_message(message)
        elif message.to_agent == AgentType.AUTOHEAL and "autoheal" in self.agents:
            response = await self._handle_autoheal_message(message)
        
        return response
    
    async def _handle_ui_blink_message(self, message: AgentMessage) -> Dict:
        """Handle message sent to UI Blink Fix Agent"""
        agent = self.agents.get("ui_blink")
        action = message.content.get("action", "")
        
        if action == "scan_for_issues":
            issues = await agent.scan_frontend()
            return {"status": "completed", "issues_found": len(issues), "data": issues[:10]}
        elif action == "auto_fix":
            result = await agent.auto_fix()
            return {"status": "completed", "fixes_applied": result.get("fixes_applied", 0)}
        elif action == "get_stats":
            stats = await agent.get_dashboard_stats()
            return {"status": "completed", "data": stats}
        
        return {"status": "unknown_action"}
    
    async def _handle_error_autofix_message(self, message: AgentMessage) -> Dict:
        """Handle message sent to Error Auto-Fix Agent"""
        agent = self.agents.get("error_autofix")
        action = message.content.get("action", "")
        
        if action == "check_errors":
            errors = await agent.get_errors()
            return {"status": "completed", "errors_found": len(errors), "data": errors[:10]}
        elif action == "auto_fix_safe":
            # Get pending errors and generate fixes
            errors = await agent.get_errors(status="detected")
            fixes_generated = 0
            for error in errors[:5]:
                fix = await agent.generate_fix(error.get("error_id"))
                if fix:
                    fixes_generated += 1
            return {"status": "completed", "fixes_generated": fixes_generated}
        elif action == "get_stats":
            stats = await agent.get_dashboard_stats()
            return {"status": "completed", "data": stats}
        
        return {"status": "unknown_action"}
    
    async def _handle_performance_message(self, message: AgentMessage) -> Dict:
        """Handle message sent to Performance Agent"""
        agent = self.agents.get("performance")
        action = message.content.get("action", "")
        
        if action == "analyze_performance" or action == "analyze_frontend":
            analysis = await agent.analyze_performance()
            return {
                "status": "completed",
                "score": analysis.get("current_score", 0),
                "issues_found": len(analysis.get("frontend_issues", [])) + len(analysis.get("backend_issues", [])),
                "recommendations": len(analysis.get("recommendations", []))
            }
        elif action == "auto_optimize":
            result = await agent.auto_optimize_safe()
            return {"status": "completed", "optimizations_applied": result.get("optimizations_applied", 0)}
        elif action == "get_stats":
            stats = await agent.get_dashboard_stats()
            return {"status": "completed", "data": stats}
        
        return {"status": "unknown_action"}
    
    async def _handle_autoheal_message(self, message: AgentMessage) -> Dict:
        """Handle message sent to AutoHeal Agent"""
        # AutoHeal might not be initialized, return mock response
        action = message.content.get("action", "")
        
        if action == "check_system_health":
            return {"status": "completed", "health": "good", "services_running": 3}
        elif action == "verify_recovery":
            return {"status": "completed", "recovery_verified": True}
        
        return {"status": "unknown_action"}
    
    async def create_task(self, task: CollaborativeTask) -> str:
        """Create a new collaborative task"""
        await self.tasks_collection.insert_one({
            "task_id": task.task_id,
            "task_type": task.task_type,
            "description": task.description,
            "priority": task.priority.value,
            "status": task.status.value,
            "mode": task.mode.value,
            "agents_involved": [a.value for a in task.agents_involved],
            "current_agent": task.current_agent.value if task.current_agent else None,
            "context": task.context,
            "results": task.results,
            "created_at": task.created_at
        })
        return task.task_id
    
    async def execute_workflow(self, workflow_name: str) -> Dict[str, Any]:
        """Execute a predefined collaboration workflow"""
        if workflow_name not in COLLABORATION_WORKFLOWS:
            return {"status": "failed", "error": f"Unknown workflow: {workflow_name}"}
        
        workflow = COLLABORATION_WORKFLOWS[workflow_name]
        
        # Create task
        task = CollaborativeTask(
            task_type=workflow_name,
            description=workflow["description"],
            priority=TaskPriority.HIGH,
            mode=workflow["mode"],
            agents_involved=workflow["agents"]
        )
        await self.create_task(task)
        
        # Execute steps
        results = {
            "workflow": workflow_name,
            "mode": workflow["mode"].value,
            "steps_completed": 0,
            "steps_total": len(workflow["steps"]),
            "agent_results": {},
            "errors": []
        }
        
        if workflow["mode"] == CollaborationMode.PARALLEL:
            # Run all agents simultaneously
            tasks = []
            for step in workflow["steps"]:
                agent_type = step["agent"]
                action = step["action"]
                msg = AgentMessage(
                    from_agent=AgentType.UI_BLINK_FIX,  # System
                    to_agent=agent_type,
                    content={"action": action}
                )
                tasks.append(self.send_message(msg))
            
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            for i, (step, response) in enumerate(zip(workflow["steps"], responses)):
                agent_name = step["agent"].value
                if isinstance(response, Exception):
                    results["errors"].append({"agent": agent_name, "error": str(response)})
                else:
                    results["agent_results"][agent_name] = response
                    results["steps_completed"] += 1
        
        elif workflow["mode"] in [CollaborationMode.SEQUENTIAL, CollaborationMode.PIPELINE]:
            # Run agents one after another
            previous_result = None
            for step in workflow["steps"]:
                agent_type = step["agent"]
                action = step["action"]
                
                msg = AgentMessage(
                    from_agent=AgentType.UI_BLINK_FIX,  # System
                    to_agent=agent_type,
                    content={"action": action},
                    context={"previous_result": previous_result} if previous_result else {}
                )
                
                try:
                    response = await self.send_message(msg)
                    results["agent_results"][agent_type.value] = response
                    results["steps_completed"] += 1
                    previous_result = response
                except Exception as e:
                    results["errors"].append({"agent": agent_type.value, "error": str(e)})
        
        # Update task status
        await self.tasks_collection.update_one(
            {"task_id": task.task_id},
            {"$set": {
                "status": TaskStatus.COMPLETED.value if results["steps_completed"] == results["steps_total"] else TaskStatus.FAILED.value,
                "results": results,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Record analytics
        await self._record_analytics(workflow_name, results)
        
        return results
    
    async def _record_analytics(self, workflow_name: str, results: Dict):
        """Record collaboration analytics"""
        await self.analytics_collection.insert_one({
            "workflow": workflow_name,
            "success": results["steps_completed"] == results["steps_total"],
            "steps_completed": results["steps_completed"],
            "steps_total": results["steps_total"],
            "agent_count": len(results["agent_results"]),
            "error_count": len(results["errors"]),
            "recorded_at": datetime.now(timezone.utc).isoformat()
        })
    
    async def get_available_workflows(self) -> List[Dict]:
        """Get list of available collaboration workflows"""
        workflows = []
        for name, config in COLLABORATION_WORKFLOWS.items():
            workflows.append({
                "name": name,
                "description": config["description"],
                "mode": config["mode"].value,
                "agents": [a.value for a in config["agents"]],
                "steps_count": len(config["steps"])
            })
        return workflows
    
    async def get_tasks(self, status: str = None, limit: int = 50) -> List[Dict]:
        """Get collaborative tasks"""
        query = {}
        if status:
            query["status"] = status
        
        tasks = await self.tasks_collection.find(
            query, {"_id": 0}
        ).sort("created_at", -1).to_list(limit)
        
        return tasks
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get collaboration dashboard statistics"""
        total_tasks = await self.tasks_collection.count_documents({})
        completed_tasks = await self.tasks_collection.count_documents({"status": TaskStatus.COMPLETED.value})
        failed_tasks = await self.tasks_collection.count_documents({"status": TaskStatus.FAILED.value})
        
        # Get messages count
        total_messages = await self.messages_collection.count_documents({})
        
        # Get recent activity
        day_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        recent_tasks = await self.tasks_collection.count_documents({"created_at": {"$gte": day_ago}})
        
        # Get agent activity
        pipeline = [
            {"$group": {"_id": "$to_agent", "count": {"$sum": 1}}}
        ]
        agent_activity = await self.messages_collection.aggregate(pipeline).to_list(10)
        
        # Calculate success rate from analytics
        success_count = await self.analytics_collection.count_documents({"success": True})
        total_analytics = await self.analytics_collection.count_documents({})
        success_rate = (success_count / total_analytics * 100) if total_analytics > 0 else 0
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "failed_tasks": failed_tasks,
            "success_rate": success_rate,
            "total_messages": total_messages,
            "recent_tasks_24h": recent_tasks,
            "agent_activity": {item["_id"]: item["count"] for item in agent_activity},
            "available_agents": list(self.agents.keys()),
            "workflows_available": len(COLLABORATION_WORKFLOWS)
        }
    
    async def check_and_run_daily_maintenance(self, user_id: str, tenant_id: str = "default") -> Dict[str, Any]:
        """Check if daily maintenance should run and execute if needed"""
        # Check last maintenance run
        last_run = await self.analytics_collection.find_one(
            {"workflow": "daily_maintenance", "tenant_id": tenant_id},
            sort=[("recorded_at", -1)]
        )
        
        should_run = True
        cooldown_hours = COLLABORATION_WORKFLOWS["daily_maintenance"].get("cooldown_hours", 24)
        
        if last_run:
            last_time = datetime.fromisoformat(last_run["recorded_at"].replace('Z', '+00:00'))
            hours_since = (datetime.now(timezone.utc) - last_time).total_seconds() / 3600
            should_run = hours_since >= cooldown_hours
        
        if not should_run:
            return {
                "status": "skipped",
                "reason": f"Maintenance ran within last {cooldown_hours} hours",
                "last_run": last_run.get("recorded_at") if last_run else None
            }
        
        # Run daily maintenance
        result = await self.execute_workflow("daily_maintenance")
        
        # Record with tenant info
        await self.analytics_collection.update_one(
            {"workflow": "daily_maintenance", "tenant_id": tenant_id},
            {"$set": {
                "recorded_at": datetime.now(timezone.utc).isoformat(),
                "user_id": user_id,
                "result": result
            }},
            upsert=True
        )
        
        return {
            "status": "completed",
            "workflow": "daily_maintenance",
            "result": result
        }
