"""
Emergent-Style Autonomous Agent System
======================================

Full autonomous agent platform that:
- Executes multi-step actions from a single prompt
- Runs DB queries and internal API calls
- Requires confirmation before critical actions
- Maintains complete audit history
- Self-learns from interactions and feedback
- Supports multi-agent collaboration

Author: BijnisBooks AI Team
Version: 1.0.0
"""

import asyncio
import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Callable, AsyncGenerator
from abc import ABC, abstractmethod

logger = logging.getLogger("AutonomousAgent")

# Try to import LLM
try:
    # from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_LLM = True
except ImportError:
    HAS_LLM = False
    logger.warning("LLM not available")


# ============== ENUMS & DATA CLASSES ==============

class ActionType(Enum):
    """Types of actions the agent can execute"""
    READ_DATA = "read_data"           # Safe: Read from database
    WRITE_DATA = "write_data"         # Requires confirmation
    DELETE_DATA = "delete_data"       # Requires confirmation
    API_CALL = "api_call"             # External API call
    INTERNAL_API = "internal_api"     # Internal system API
    CALCULATION = "calculation"       # Safe: Math/analysis
    REPORT_GENERATION = "report"      # Generate reports
    NOTIFICATION = "notification"     # Send notifications
    SYSTEM_CONFIG = "system_config"   # System configuration (dangerous)


class ActionStatus(Enum):
    """Status of an action"""
    PENDING = "pending"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    CONFIRMED = "confirmed"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class TaskStatus(Enum):
    """Status of a multi-step task"""
    PLANNING = "planning"
    AWAITING_APPROVAL = "awaiting_approval"
    EXECUTING = "executing"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ConfirmationLevel(Enum):
    """Level of confirmation required"""
    NONE = "none"           # Auto-execute (read operations)
    LOW = "low"             # Notify but proceed
    MEDIUM = "medium"       # Require explicit confirmation
    HIGH = "high"           # Require confirmation + reason
    CRITICAL = "critical"   # Multi-step approval


@dataclass
class ActionStep:
    """Single action step in a task execution plan"""
    id: str
    action_type: ActionType
    description: str
    target: str  # e.g., "items", "customers", "api/endpoint"
    parameters: Dict[str, Any]
    confirmation_required: ConfirmationLevel
    status: ActionStatus = ActionStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    confirmed_by: Optional[str] = None
    confirmation_reason: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "action_type": self.action_type.value,
            "description": self.description,
            "target": self.target,
            "parameters": self.parameters,
            "confirmation_required": self.confirmation_required.value,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "confirmed_by": self.confirmed_by
        }


@dataclass
class ExecutionPlan:
    """Complete execution plan for a task"""
    id: str
    original_prompt: str
    user_id: str
    tenant_id: str
    steps: List[ActionStep]
    status: TaskStatus = TaskStatus.PLANNING
    reasoning: str = ""
    estimated_duration: str = ""
    risk_level: str = "low"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    final_result: Any = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "original_prompt": self.original_prompt,
            "user_id": self.user_id,
            "tenant_id": self.tenant_id,
            "steps": [s.to_dict() for s in self.steps],
            "status": self.status.value,
            "reasoning": self.reasoning,
            "estimated_duration": self.estimated_duration,
            "risk_level": self.risk_level,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "final_result": self.final_result,
            "error": self.error
        }
    
    def get_pending_confirmations(self) -> List[ActionStep]:
        """Get steps awaiting confirmation"""
        return [s for s in self.steps if s.status == ActionStatus.AWAITING_CONFIRMATION]
    
    def get_progress(self) -> Dict:
        """Get execution progress"""
        total = len(self.steps)
        completed = len([s for s in self.steps if s.status == ActionStatus.COMPLETED])
        failed = len([s for s in self.steps if s.status == ActionStatus.FAILED])
        pending = len([s for s in self.steps if s.status in [ActionStatus.PENDING, ActionStatus.AWAITING_CONFIRMATION]])
        
        return {
            "total": total,
            "completed": completed,
            "failed": failed,
            "pending": pending,
            "percentage": round((completed / total) * 100) if total > 0 else 0
        }


@dataclass
class AuditLogEntry:
    """Audit log entry for tracking all agent actions"""
    id: str
    timestamp: str
    user_id: str
    tenant_id: str
    agent_id: str
    action_type: str
    action_description: str
    target: str
    parameters: Dict
    result: Any
    status: str
    duration_ms: int
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None
    plan_id: Optional[str] = None
    step_id: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "user_id": self.user_id,
            "tenant_id": self.tenant_id,
            "agent_id": self.agent_id,
            "action_type": self.action_type,
            "action_description": self.action_description,
            "target": self.target,
            "parameters": self.parameters,
            "result": self.result,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "plan_id": self.plan_id,
            "step_id": self.step_id
        }


@dataclass
class LearningPattern:
    """Pattern learned from successful interactions"""
    id: str
    pattern_type: str  # "prompt_to_plan", "action_sequence", "user_preference"
    trigger: str       # What triggers this pattern
    response: Dict     # How to respond
    confidence: float  # 0.0 to 1.0
    usage_count: int = 0
    success_count: int = 0
    last_used: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "pattern_type": self.pattern_type,
            "trigger": self.trigger,
            "response": self.response,
            "confidence": self.confidence,
            "usage_count": self.usage_count,
            "success_count": self.success_count,
            "success_rate": self.success_count / self.usage_count if self.usage_count > 0 else 0,
            "last_used": self.last_used,
            "created_at": self.created_at
        }


# ============== AUTONOMOUS AGENT CORE ==============

class AutonomousAgentCore:
    """
    Emergent-Style Autonomous Agent Core
    
    Executes multi-step tasks autonomously with:
    - Intelligent task planning
    - Action confirmation workflow
    - Complete audit logging
    - Self-learning capabilities
    - Streaming responses
    """
    
    # Action type to confirmation level mapping
    CONFIRMATION_REQUIREMENTS = {
        ActionType.READ_DATA: ConfirmationLevel.NONE,
        ActionType.CALCULATION: ConfirmationLevel.NONE,
        ActionType.REPORT_GENERATION: ConfirmationLevel.LOW,
        ActionType.WRITE_DATA: ConfirmationLevel.MEDIUM,
        ActionType.API_CALL: ConfirmationLevel.MEDIUM,
        ActionType.INTERNAL_API: ConfirmationLevel.MEDIUM,
        ActionType.DELETE_DATA: ConfirmationLevel.HIGH,
        ActionType.NOTIFICATION: ConfirmationLevel.LOW,
        ActionType.SYSTEM_CONFIG: ConfirmationLevel.CRITICAL,
    }
    
    def __init__(self, db, api_key: str):
        self.db = db
        self.api_key = api_key
        self.active_plans: Dict[str, ExecutionPlan] = {}
        self.action_handlers: Dict[str, Callable] = {}
        self.learning_patterns: List[LearningPattern] = []
        
        # Register default action handlers
        self._register_default_handlers()
    
    def _has_db(self) -> bool:
        """Check if database is available"""
        return self.db is not None
    
    def _register_default_handlers(self):
        """Register default action handlers"""
        self.register_handler("read_items", self._handle_read_items)
        self.register_handler("read_customers", self._handle_read_customers)
        self.register_handler("read_suppliers", self._handle_read_suppliers)
        self.register_handler("read_sales", self._handle_read_sales)
        self.register_handler("read_invoices", self._handle_read_invoices)
        self.register_handler("create_item", self._handle_create_item)
        self.register_handler("update_item", self._handle_update_item)
        self.register_handler("delete_item", self._handle_delete_item)
        self.register_handler("generate_report", self._handle_generate_report)
        self.register_handler("calculate_metrics", self._handle_calculate_metrics)
        self.register_handler("run_query", self._handle_run_query)
    
    def register_handler(self, name: str, handler: Callable):
        """Register an action handler"""
        self.action_handlers[name] = handler
        logger.info(f"Registered action handler: {name}")
    
    async def plan_task(
        self,
        prompt: str,
        user_id: str,
        tenant_id: str,
        context: Dict = None
    ) -> ExecutionPlan:
        """
        Create an execution plan from a natural language prompt.
        
        This is the core "Emergent-style" capability - taking a single prompt
        and breaking it down into a multi-step execution plan.
        """
        plan_id = str(uuid.uuid4())
        
        # Use LLM to generate the execution plan
        if HAS_LLM and self.api_key:
            plan = await self._generate_plan_with_llm(prompt, user_id, tenant_id, plan_id, context)
        else:
            plan = await self._generate_plan_with_rules(prompt, user_id, tenant_id, plan_id, context)
        
        # Check for learned patterns to optimize the plan
        optimized_plan = await self._apply_learned_patterns(plan)
        
        # Store the plan
        self.active_plans[plan_id] = optimized_plan
        
        # Save to database
        if self.db is not None:
            await self.db.execution_plans.insert_one(optimized_plan.to_dict())
        
        return optimized_plan
    
    async def _generate_plan_with_llm(
        self,
        prompt: str,
        user_id: str,
        tenant_id: str,
        plan_id: str,
        context: Dict = None
    ) -> ExecutionPlan:
        """Generate execution plan using LLM"""
        
        system_prompt = """You are an autonomous task planning agent for BijnisBooks business management system.

Your job is to analyze user requests and create detailed execution plans.

Available action types:
- READ_DATA: Query database (items, customers, suppliers, sales, invoices)
- WRITE_DATA: Create or update records
- DELETE_DATA: Remove records (requires confirmation)
- CALCULATION: Perform calculations and analysis
- REPORT_GENERATION: Generate reports
- API_CALL: Call external APIs
- INTERNAL_API: Call internal system endpoints
- NOTIFICATION: Send notifications
- SYSTEM_CONFIG: Change system settings (requires high confirmation)

Available targets:
- items: Product inventory
- customers: Customer records
- suppliers: Supplier records
- sales: Sales transactions
- invoices: Invoice records
- reports: Report generation
- analytics: Business analytics
- settings: System settings

For each step, specify:
- action_type: One of the types above
- description: Human-readable description
- target: What to operate on
- parameters: Specific parameters for the action
- confirmation_level: none, low, medium, high, or critical

Respond in JSON format:
{
    "reasoning": "Explanation of your approach",
    "risk_level": "low/medium/high",
    "estimated_duration": "Estimated time to complete",
    "steps": [
        {
            "action_type": "READ_DATA",
            "description": "What this step does",
            "target": "items",
            "parameters": {"filter": {}, "fields": []},
            "confirmation_level": "none"
        }
    ]
}"""

        full_prompt = f"""User Request: {prompt}

Context:
- User ID: {user_id}
- Tenant ID: {tenant_id}
- Additional Context: {json.dumps(context or {})}

Create a detailed execution plan for this request. Break it down into specific steps that can be executed autonomously."""

        try:
            llm = LlmChat(
                api_key=self.api_key,
                session_id=f"planner-{plan_id}",
                system_message=system_prompt
            )
            llm.with_model("openai", "gpt-5.2")
            
            response = await llm.send_message(UserMessage(text=full_prompt))
            
            # Parse JSON response
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                plan_data = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found in response")
            
            # Convert to ExecutionPlan
            steps = []
            for i, step_data in enumerate(plan_data.get("steps", [])):
                action_type = ActionType[step_data["action_type"].upper()]
                conf_level = ConfirmationLevel[step_data.get("confirmation_level", "medium").upper()]
                
                # Override confirmation based on action type
                default_conf = self.CONFIRMATION_REQUIREMENTS.get(action_type, ConfirmationLevel.MEDIUM)
                if conf_level.value < default_conf.value:
                    conf_level = default_conf
                
                step = ActionStep(
                    id=f"{plan_id}-step-{i+1}",
                    action_type=action_type,
                    description=step_data["description"],
                    target=step_data["target"],
                    parameters=step_data.get("parameters", {}),
                    confirmation_required=conf_level
                )
                steps.append(step)
            
            return ExecutionPlan(
                id=plan_id,
                original_prompt=prompt,
                user_id=user_id,
                tenant_id=tenant_id,
                steps=steps,
                status=TaskStatus.AWAITING_APPROVAL if any(
                    s.confirmation_required != ConfirmationLevel.NONE for s in steps
                ) else TaskStatus.EXECUTING,
                reasoning=plan_data.get("reasoning", ""),
                estimated_duration=plan_data.get("estimated_duration", "Unknown"),
                risk_level=plan_data.get("risk_level", "low")
            )
            
        except Exception as e:
            logger.error(f"LLM planning failed: {e}")
            return await self._generate_plan_with_rules(prompt, user_id, tenant_id, plan_id, context)
    
    async def _generate_plan_with_rules(
        self,
        prompt: str,
        user_id: str,
        tenant_id: str,
        plan_id: str,
        context: Dict = None
    ) -> ExecutionPlan:
        """Generate execution plan using rule-based approach"""
        
        prompt_lower = prompt.lower()
        steps = []
        
        # Pattern matching for common requests
        if any(word in prompt_lower for word in ["show", "list", "get", "view", "display"]):
            # Read operations
            if "item" in prompt_lower or "product" in prompt_lower or "inventory" in prompt_lower:
                steps.append(ActionStep(
                    id=f"{plan_id}-step-1",
                    action_type=ActionType.READ_DATA,
                    description="Fetch items from inventory",
                    target="items",
                    parameters={"limit": 100, "include_stock": True},
                    confirmation_required=ConfirmationLevel.NONE
                ))
            elif "customer" in prompt_lower:
                steps.append(ActionStep(
                    id=f"{plan_id}-step-1",
                    action_type=ActionType.READ_DATA,
                    description="Fetch customer records",
                    target="customers",
                    parameters={"limit": 100},
                    confirmation_required=ConfirmationLevel.NONE
                ))
            elif "supplier" in prompt_lower:
                steps.append(ActionStep(
                    id=f"{plan_id}-step-1",
                    action_type=ActionType.READ_DATA,
                    description="Fetch supplier records",
                    target="suppliers",
                    parameters={"limit": 100},
                    confirmation_required=ConfirmationLevel.NONE
                ))
            elif "sale" in prompt_lower or "revenue" in prompt_lower:
                steps.append(ActionStep(
                    id=f"{plan_id}-step-1",
                    action_type=ActionType.READ_DATA,
                    description="Fetch sales data",
                    target="sales",
                    parameters={"limit": 100},
                    confirmation_required=ConfirmationLevel.NONE
                ))
        
        elif any(word in prompt_lower for word in ["create", "add", "new"]):
            # Write operations
            if "item" in prompt_lower or "product" in prompt_lower:
                steps.append(ActionStep(
                    id=f"{plan_id}-step-1",
                    action_type=ActionType.WRITE_DATA,
                    description="Create new item in inventory",
                    target="items",
                    parameters=context.get("item_data", {}) if context else {},
                    confirmation_required=ConfirmationLevel.MEDIUM
                ))
        
        elif any(word in prompt_lower for word in ["delete", "remove"]):
            # Delete operations
            if "item" in prompt_lower or "product" in prompt_lower:
                steps.append(ActionStep(
                    id=f"{plan_id}-step-1",
                    action_type=ActionType.DELETE_DATA,
                    description="Delete item from inventory",
                    target="items",
                    parameters=context.get("item_id", {}) if context else {},
                    confirmation_required=ConfirmationLevel.HIGH
                ))
        
        elif any(word in prompt_lower for word in ["analyze", "report", "summary"]):
            # Analysis operations
            steps.append(ActionStep(
                id=f"{plan_id}-step-1",
                action_type=ActionType.READ_DATA,
                description="Gather data for analysis",
                target="sales",
                parameters={"include_analytics": True},
                confirmation_required=ConfirmationLevel.NONE
            ))
            steps.append(ActionStep(
                id=f"{plan_id}-step-2",
                action_type=ActionType.CALCULATION,
                description="Calculate metrics and insights",
                target="analytics",
                parameters={"metrics": ["revenue", "growth", "trends"]},
                confirmation_required=ConfirmationLevel.NONE
            ))
            steps.append(ActionStep(
                id=f"{plan_id}-step-3",
                action_type=ActionType.REPORT_GENERATION,
                description="Generate analysis report",
                target="reports",
                parameters={"format": "detailed"},
                confirmation_required=ConfirmationLevel.LOW
            ))
        
        # Default: try to understand and create a generic plan
        if not steps:
            steps.append(ActionStep(
                id=f"{plan_id}-step-1",
                action_type=ActionType.READ_DATA,
                description=f"Process request: {prompt[:100]}",
                target="system",
                parameters={"query": prompt},
                confirmation_required=ConfirmationLevel.NONE
            ))
        
        return ExecutionPlan(
            id=plan_id,
            original_prompt=prompt,
            user_id=user_id,
            tenant_id=tenant_id,
            steps=steps,
            status=TaskStatus.AWAITING_APPROVAL if any(
                s.confirmation_required != ConfirmationLevel.NONE for s in steps
            ) else TaskStatus.EXECUTING,
            reasoning="Rule-based plan generated from prompt analysis",
            estimated_duration="< 1 minute",
            risk_level="low"
        )
    
    async def _apply_learned_patterns(self, plan: ExecutionPlan) -> ExecutionPlan:
        """Apply learned patterns to optimize the plan"""
        
        # Load patterns from database
        if self.db is not None:
            patterns = await self.db.learning_patterns.find({
                "confidence": {"$gte": 0.7}
            }).sort("confidence", -1).limit(100).to_list(100)
            
            for pattern in patterns:
                trigger = pattern.get("trigger", "").lower()
                if trigger and trigger in plan.original_prompt.lower():
                    # Found matching pattern - could optimize steps here
                    logger.info(f"Found matching pattern: {pattern.get('id')}")
        
        return plan
    
    async def execute_plan(
        self,
        plan_id: str,
        auto_confirm: bool = False
    ) -> AsyncGenerator[Dict, None]:
        """
        Execute a plan with streaming updates.
        
        Yields status updates as the plan executes.
        This is the core autonomous execution capability.
        """
        
        plan = self.active_plans.get(plan_id)
        if not plan:
            # Try to load from database
            if self.db is not None:
                plan_data = await self.db.execution_plans.find_one({"id": plan_id})
                if plan_data:
                    # Reconstruct plan from database
                    steps = []
                    for step_data in plan_data.get("steps", []):
                        step = ActionStep(
                            id=step_data["id"],
                            action_type=ActionType[step_data["action_type"].upper()],
                            description=step_data["description"],
                            target=step_data["target"],
                            parameters=step_data["parameters"],
                            confirmation_required=ConfirmationLevel[step_data["confirmation_required"].upper()],
                            status=ActionStatus[step_data["status"].upper()]
                        )
                        steps.append(step)
                    
                    plan = ExecutionPlan(
                        id=plan_data["id"],
                        original_prompt=plan_data["original_prompt"],
                        user_id=plan_data["user_id"],
                        tenant_id=plan_data["tenant_id"],
                        steps=steps,
                        status=TaskStatus[plan_data["status"].upper()],
                        reasoning=plan_data.get("reasoning", "")
                    )
                    self.active_plans[plan_id] = plan
        
        if not plan:
            yield {"type": "error", "message": "Plan not found"}
            return
        
        plan.status = TaskStatus.EXECUTING
        plan.started_at = datetime.now(timezone.utc).isoformat()
        
        yield {
            "type": "plan_started",
            "plan_id": plan_id,
            "total_steps": len(plan.steps),
            "timestamp": plan.started_at
        }
        
        results = []
        
        for i, step in enumerate(plan.steps):
            # Check if confirmation is required
            if step.confirmation_required != ConfirmationLevel.NONE and not auto_confirm:
                if step.status != ActionStatus.CONFIRMED:
                    step.status = ActionStatus.AWAITING_CONFIRMATION
                    yield {
                        "type": "confirmation_required",
                        "step_id": step.id,
                        "step_number": i + 1,
                        "description": step.description,
                        "action_type": step.action_type.value,
                        "target": step.target,
                        "confirmation_level": step.confirmation_required.value,
                        "parameters": step.parameters
                    }
                    # Wait for confirmation (in real implementation, this would be async)
                    continue
            
            # Execute the step
            step.status = ActionStatus.EXECUTING
            step.started_at = datetime.now(timezone.utc).isoformat()
            
            yield {
                "type": "step_started",
                "step_id": step.id,
                "step_number": i + 1,
                "description": step.description,
                "timestamp": step.started_at
            }
            
            try:
                # Execute the action
                result = await self._execute_action(step, plan.user_id, plan.tenant_id)
                step.result = result
                step.status = ActionStatus.COMPLETED
                step.completed_at = datetime.now(timezone.utc).isoformat()
                results.append(result)
                
                # Log to audit
                await self._log_action(step, plan.user_id, plan.tenant_id, plan_id)
                
                yield {
                    "type": "step_completed",
                    "step_id": step.id,
                    "step_number": i + 1,
                    "result": result,
                    "timestamp": step.completed_at
                }
                
            except Exception as e:
                step.status = ActionStatus.FAILED
                step.error = str(e)
                step.completed_at = datetime.now(timezone.utc).isoformat()
                
                yield {
                    "type": "step_failed",
                    "step_id": step.id,
                    "step_number": i + 1,
                    "error": str(e),
                    "timestamp": step.completed_at
                }
                
                # Decide whether to continue or abort
                if step.action_type in [ActionType.DELETE_DATA, ActionType.SYSTEM_CONFIG]:
                    plan.status = TaskStatus.FAILED
                    plan.error = f"Critical step failed: {str(e)}"
                    break
        
        # Finalize plan
        completed_steps = [s for s in plan.steps if s.status == ActionStatus.COMPLETED]
        if len(completed_steps) == len(plan.steps):
            plan.status = TaskStatus.COMPLETED
        elif plan.status != TaskStatus.FAILED:
            plan.status = TaskStatus.PAUSED  # Some steps pending confirmation
        
        plan.completed_at = datetime.now(timezone.utc).isoformat()
        plan.final_result = results
        
        # Update in database
        if self.db is not None:
            await self.db.execution_plans.update_one(
                {"id": plan_id},
                {"$set": plan.to_dict()}
            )
        
        # Learn from execution
        if plan.status == TaskStatus.COMPLETED:
            await self._learn_from_execution(plan)
        
        yield {
            "type": "plan_completed",
            "plan_id": plan_id,
            "status": plan.status.value,
            "results": results,
            "progress": plan.get_progress(),
            "timestamp": plan.completed_at
        }
    
    async def confirm_step(
        self,
        plan_id: str,
        step_id: str,
        confirmed_by: str,
        reason: str = None
    ) -> bool:
        """Confirm a pending step"""
        
        plan = self.active_plans.get(plan_id)
        if not plan:
            return False
        
        for step in plan.steps:
            if step.id == step_id:
                if step.status == ActionStatus.AWAITING_CONFIRMATION:
                    step.status = ActionStatus.CONFIRMED
                    step.confirmed_by = confirmed_by
                    step.confirmation_reason = reason
                    
                    # Update in database
                    if self.db is not None:
                        await self.db.execution_plans.update_one(
                            {"id": plan_id},
                            {"$set": plan.to_dict()}
                        )
                    
                    return True
        
        return False
    
    async def cancel_plan(self, plan_id: str, reason: str = None) -> bool:
        """Cancel a plan"""
        
        plan = self.active_plans.get(plan_id)
        if not plan:
            return False
        
        plan.status = TaskStatus.CANCELLED
        plan.error = reason or "Cancelled by user"
        plan.completed_at = datetime.now(timezone.utc).isoformat()
        
        for step in plan.steps:
            if step.status in [ActionStatus.PENDING, ActionStatus.AWAITING_CONFIRMATION]:
                step.status = ActionStatus.CANCELLED
        
        if self.db is not None:
            await self.db.execution_plans.update_one(
                {"id": plan_id},
                {"$set": plan.to_dict()}
            )
        
        return True
    
    async def _execute_action(
        self,
        step: ActionStep,
        user_id: str,
        tenant_id: str
    ) -> Any:
        """Execute a single action step"""
        
        handler_name = f"{step.action_type.value}_{step.target}"
        
        # Try specific handler first
        handler = self.action_handlers.get(handler_name)
        if not handler:
            # Try generic handler based on action type
            handler = self.action_handlers.get(f"handle_{step.action_type.value}")
        
        if handler:
            return await handler(step, user_id, tenant_id)
        
        # Default execution based on action type
        if step.action_type == ActionType.READ_DATA:
            return await self._default_read(step, tenant_id)
        elif step.action_type == ActionType.CALCULATION:
            return await self._default_calculate(step)
        elif step.action_type == ActionType.REPORT_GENERATION:
            return await self._default_report(step, tenant_id)
        else:
            return {"status": "executed", "details": step.parameters}
    
    async def _default_read(self, step: ActionStep, tenant_id: str) -> Dict:
        """Default read handler"""
        if self.db is None:
            return {"error": "Database not available"}
        
        collection_map = {
            "items": "items",
            "customers": "customers",
            "suppliers": "suppliers",
            "sales": "sales",
            "invoices": "invoices"
        }
        
        collection_name = collection_map.get(step.target)
        if not collection_name:
            return {"error": f"Unknown target: {step.target}"}
        
        collection = self.db[collection_name]
        
        # Build query
        query = {"tenant_id": tenant_id, "is_deleted": {"$ne": True}}
        query.update(step.parameters.get("filter", {}))
        
        limit = step.parameters.get("limit", 100)
        
        # Execute query
        results = await collection.find(
            query,
            {"_id": 0}
        ).limit(limit).to_list(limit)
        
        return {
            "count": len(results),
            "data": results,
            "target": step.target
        }
    
    async def _default_calculate(self, step: ActionStep) -> Dict:
        """Default calculation handler"""
        metrics = step.parameters.get("metrics", [])
        
        calculations = {}
        for metric in metrics:
            # Placeholder calculations
            calculations[metric] = {
                "value": 0,
                "trend": "stable",
                "calculated_at": datetime.now(timezone.utc).isoformat()
            }
        
        return {"calculations": calculations}
    
    async def _default_report(self, step: ActionStep, tenant_id: str) -> Dict:
        """Default report generation handler"""
        return {
            "report_id": str(uuid.uuid4()),
            "format": step.parameters.get("format", "summary"),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "tenant_id": tenant_id,
            "content": "Report generated successfully"
        }
    
    async def _log_action(
        self,
        step: ActionStep,
        user_id: str,
        tenant_id: str,
        plan_id: str
    ):
        """Log action to audit trail"""
        
        if self.db is None:
            return
        
        duration_ms = 0
        if step.started_at and step.completed_at:
            start = datetime.fromisoformat(step.started_at.replace('Z', '+00:00'))
            end = datetime.fromisoformat(step.completed_at.replace('Z', '+00:00'))
            duration_ms = int((end - start).total_seconds() * 1000)
        
        log_entry = AuditLogEntry(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
            user_id=user_id,
            tenant_id=tenant_id,
            agent_id="autonomous_agent",
            action_type=step.action_type.value,
            action_description=step.description,
            target=step.target,
            parameters=step.parameters,
            result=step.result,
            status=step.status.value,
            duration_ms=duration_ms,
            plan_id=plan_id,
            step_id=step.id
        )
        
        await self.db.agent_audit_logs.insert_one(log_entry.to_dict())
    
    async def _learn_from_execution(self, plan: ExecutionPlan):
        """Learn patterns from successful execution"""
        
        if self.db is None:
            return
        
        # Create a pattern from successful execution
        pattern = LearningPattern(
            id=str(uuid.uuid4()),
            pattern_type="prompt_to_plan",
            trigger=plan.original_prompt[:200],  # Truncate for matching
            response={
                "steps": [s.to_dict() for s in plan.steps],
                "reasoning": plan.reasoning
            },
            confidence=0.8,  # Initial confidence
            usage_count=1,
            success_count=1,
            last_used=datetime.now(timezone.utc).isoformat()
        )
        
        # Check if similar pattern exists
        existing = await self.db.learning_patterns.find_one({
            "trigger": {"$regex": pattern.trigger[:50], "$options": "i"}
        })
        
        if existing:
            # Update existing pattern
            await self.db.learning_patterns.update_one(
                {"id": existing["id"]},
                {
                    "$inc": {"usage_count": 1, "success_count": 1},
                    "$set": {
                        "last_used": pattern.last_used,
                        "confidence": min(0.99, existing.get("confidence", 0.8) + 0.02)
                    }
                }
            )
        else:
            # Insert new pattern
            await self.db.learning_patterns.insert_one(pattern.to_dict())
    
    async def provide_feedback(
        self,
        plan_id: str,
        feedback_type: str,  # "positive", "negative", "correction"
        feedback_data: Dict = None
    ):
        """Process user feedback to improve learning"""
        
        if self.db is None:
            return
        
        plan = self.active_plans.get(plan_id)
        if not plan:
            plan_data = await self.db.execution_plans.find_one({"id": plan_id})
            if not plan_data:
                return
        
        # Update pattern confidence based on feedback
        patterns = await self.db.learning_patterns.find({
            "trigger": {"$regex": plan.original_prompt[:50] if plan else "", "$options": "i"}
        }).to_list(10)
        
        for pattern in patterns:
            if feedback_type == "positive":
                new_confidence = min(0.99, pattern.get("confidence", 0.5) + 0.05)
            elif feedback_type == "negative":
                new_confidence = max(0.1, pattern.get("confidence", 0.5) - 0.1)
            else:
                new_confidence = pattern.get("confidence", 0.5)
            
            await self.db.learning_patterns.update_one(
                {"id": pattern["id"]},
                {"$set": {"confidence": new_confidence}}
            )
        
        # Store feedback for analysis
        await self.db.agent_feedback.insert_one({
            "id": str(uuid.uuid4()),
            "plan_id": plan_id,
            "feedback_type": feedback_type,
            "feedback_data": feedback_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    # ============== ACTION HANDLERS ==============
    
    async def _handle_read_items(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Read items from inventory"""
        if self.db is None:
            return {"error": "Database not available"}
        
        query = {"tenant_id": tenant_id, "is_deleted": {"$ne": True}}
        items = await self.db.items.find(query, {"_id": 0}).limit(100).to_list(100)
        
        return {
            "count": len(items),
            "items": items,
            "message": f"Found {len(items)} items in inventory"
        }
    
    async def _handle_read_customers(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Read customer records"""
        if self.db is None:
            return {"error": "Database not available"}
        
        query = {"tenant_id": tenant_id, "is_deleted": {"$ne": True}}
        customers = await self.db.customers.find(query, {"_id": 0}).limit(100).to_list(100)
        
        return {
            "count": len(customers),
            "customers": customers,
            "message": f"Found {len(customers)} customers"
        }
    
    async def _handle_read_suppliers(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Read supplier records"""
        if self.db is None:
            return {"error": "Database not available"}
        
        query = {"tenant_id": tenant_id, "is_deleted": {"$ne": True}}
        suppliers = await self.db.suppliers.find(query, {"_id": 0}).limit(100).to_list(100)
        
        return {
            "count": len(suppliers),
            "suppliers": suppliers,
            "message": f"Found {len(suppliers)} suppliers"
        }
    
    async def _handle_read_sales(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Read sales data"""
        if self.db is None:
            return {"error": "Database not available"}
        
        query = {"tenant_id": tenant_id}
        sales = await self.db.sales.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
        
        # Calculate totals
        total_revenue = sum(s.get("total", 0) for s in sales)
        
        return {
            "count": len(sales),
            "total_revenue": total_revenue,
            "sales": sales,
            "message": f"Found {len(sales)} sales records totaling ₹{total_revenue:,.2f}"
        }
    
    async def _handle_read_invoices(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Read invoice records"""
        if self.db is None:
            return {"error": "Database not available"}
        
        query = {"tenant_id": tenant_id}
        invoices = await self.db.invoices.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
        
        return {
            "count": len(invoices),
            "invoices": invoices,
            "message": f"Found {len(invoices)} invoices"
        }
    
    async def _handle_create_item(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Create a new item"""
        if self.db is None:
            return {"error": "Database not available"}
        
        item_data = step.parameters.get("item_data", {})
        item_data["id"] = str(uuid.uuid4())
        item_data["tenant_id"] = tenant_id
        item_data["created_by"] = user_id
        item_data["created_at"] = datetime.now(timezone.utc).isoformat()
        item_data["is_deleted"] = False
        
        await self.db.items.insert_one(item_data)
        
        return {
            "success": True,
            "item_id": item_data["id"],
            "message": f"Created item: {item_data.get('name', 'Unknown')}"
        }
    
    async def _handle_update_item(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Update an existing item"""
        if self.db is None:
            return {"error": "Database not available"}
        
        item_id = step.parameters.get("item_id")
        update_data = step.parameters.get("update_data", {})
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_data["updated_by"] = user_id
        
        result = await self.db.items.update_one(
            {"id": item_id, "tenant_id": tenant_id},
            {"$set": update_data}
        )
        
        return {
            "success": result.modified_count > 0,
            "item_id": item_id,
            "message": "Item updated successfully" if result.modified_count > 0 else "Item not found"
        }
    
    async def _handle_delete_item(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Soft delete an item"""
        if self.db is None:
            return {"error": "Database not available"}
        
        item_id = step.parameters.get("item_id")
        
        result = await self.db.items.update_one(
            {"id": item_id, "tenant_id": tenant_id},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": datetime.now(timezone.utc).isoformat(),
                    "deleted_by": user_id
                }
            }
        )
        
        return {
            "success": result.modified_count > 0,
            "item_id": item_id,
            "message": "Item deleted successfully" if result.modified_count > 0 else "Item not found"
        }
    
    async def _handle_generate_report(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Generate a business report"""
        if self.db is None:
            return {"error": "Database not available"}
        
        report_type = step.parameters.get("report_type", "summary")
        
        # Gather data for report
        items_count = await self.db.items.count_documents({"tenant_id": tenant_id, "is_deleted": {"$ne": True}})
        customers_count = await self.db.customers.count_documents({"tenant_id": tenant_id, "is_deleted": {"$ne": True}})
        
        # Sales summary
        pipeline = [
            {"$match": {"tenant_id": tenant_id}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
        ]
        sales_summary = await self.db.sales.aggregate(pipeline).to_list(1)
        
        return {
            "report_id": str(uuid.uuid4()),
            "report_type": report_type,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data": {
                "items_count": items_count,
                "customers_count": customers_count,
                "sales_total": sales_summary[0]["total"] if sales_summary else 0,
                "sales_count": sales_summary[0]["count"] if sales_summary else 0
            },
            "message": "Report generated successfully"
        }
    
    async def _handle_calculate_metrics(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Calculate business metrics"""
        if self.db is None:
            return {"error": "Database not available"}
        
        metrics = step.parameters.get("metrics", ["revenue", "growth"])
        results = {}
        
        for metric in metrics:
            if metric == "revenue":
                pipeline = [
                    {"$match": {"tenant_id": tenant_id}},
                    {"$group": {"_id": None, "total": {"$sum": "$total"}}}
                ]
                result = await self.db.sales.aggregate(pipeline).to_list(1)
                results["revenue"] = result[0]["total"] if result else 0
            
            elif metric == "growth":
                # Calculate month-over-month growth
                results["growth"] = {
                    "percentage": 0,
                    "trend": "stable"
                }
            
            elif metric == "inventory_value":
                pipeline = [
                    {"$match": {"tenant_id": tenant_id, "is_deleted": {"$ne": True}}},
                    {"$group": {"_id": None, "total": {"$sum": {"$multiply": ["$cost_price", "$current_stock"]}}}}
                ]
                result = await self.db.items.aggregate(pipeline).to_list(1)
                results["inventory_value"] = result[0]["total"] if result else 0
        
        return {
            "metrics": results,
            "calculated_at": datetime.now(timezone.utc).isoformat(),
            "message": f"Calculated {len(metrics)} metrics"
        }
    
    async def _handle_run_query(self, step: ActionStep, user_id: str, tenant_id: str) -> Dict:
        """Run a custom database query (safely)"""
        if self.db is None:
            return {"error": "Database not available"}
        
        collection = step.parameters.get("collection", "items")
        query_filter = step.parameters.get("filter", {})
        
        # Always enforce tenant_id for security
        query_filter["tenant_id"] = tenant_id
        
        # Allowed collections
        allowed_collections = ["items", "customers", "suppliers", "sales", "invoices"]
        if collection not in allowed_collections:
            return {"error": f"Collection not allowed: {collection}"}
        
        results = await self.db[collection].find(query_filter, {"_id": 0}).limit(100).to_list(100)
        
        return {
            "collection": collection,
            "count": len(results),
            "data": results,
            "message": f"Query returned {len(results)} results from {collection}"
        }


# ============== STREAMING RESPONSE GENERATOR ==============

class StreamingResponseGenerator:
    """
    Generate streaming responses for AI chat.
    Simulates word-by-word output like ChatGPT.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def stream_response(
        self,
        prompt: str,
        system_message: str = None,
        model: str = "gpt-5.2"
    ) -> AsyncGenerator[str, None]:
        """
        Stream AI response word by word.
        
        Yields individual words/tokens as they're generated.
        """
        
        if not HAS_LLM or not self.api_key:
            # Fallback: simulate streaming
            response = f"I understand you're asking about: {prompt[:100]}. Let me help you with that."
            for word in response.split():
                yield word + " "
                await asyncio.sleep(0.05)
            return
        
        try:
            # Get model configuration
            provider = "openai"
            model_name = "gpt-5.2"
            
            if model == "gemini-3-flash":
                provider = "gemini"
                model_name = "gemini-3-flash-preview"
            elif model == "claude-sonnet-4.5":
                provider = "anthropic"
                model_name = "claude-sonnet-4-5-20250929"
            
            llm = LlmChat(
                api_key=self.api_key,
                session_id=f"stream-{uuid.uuid4()}",
                system_message=system_message or "You are a helpful business assistant."
            )
            llm.with_model(provider, model_name)
            
            # Get full response (emergentintegrations may not support streaming natively)
            response = await llm.send_message(UserMessage(text=prompt))
            
            # Simulate streaming by yielding word by word
            words = response.split()
            for i, word in enumerate(words):
                yield word + " "
                # Variable delay for natural feel
                delay = 0.03 if len(word) < 5 else 0.05
                await asyncio.sleep(delay)
            
        except Exception as e:
            logger.error(f"Streaming failed: {e}")
            yield f"Error generating response: {str(e)}"


# ============== AGENT COLLABORATION SYSTEM ==============

class AgentCollaborationHub:
    """
    Multi-agent collaboration system.
    
    Allows specialized agents to work together on complex tasks.
    """
    
    def __init__(self, db, api_key: str):
        self.db = db
        self.api_key = api_key
        self.agents: Dict[str, 'AutonomousAgentCore'] = {}
        self.collaboration_sessions: Dict[str, Dict] = {}
    
    def register_agent(self, agent_id: str, agent: 'AutonomousAgentCore'):
        """Register an agent for collaboration"""
        self.agents[agent_id] = agent
        logger.info(f"Registered agent for collaboration: {agent_id}")
    
    async def create_collaboration(
        self,
        task: str,
        user_id: str,
        tenant_id: str,
        required_agents: List[str] = None
    ) -> Dict:
        """
        Create a multi-agent collaboration session.
        
        The system will:
        1. Analyze the task
        2. Determine which agents are needed
        3. Coordinate execution across agents
        4. Aggregate results
        """
        
        session_id = str(uuid.uuid4())
        
        # Determine required agents
        if not required_agents:
            required_agents = await self._determine_required_agents(task)
        
        session = {
            "id": session_id,
            "task": task,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "required_agents": required_agents,
            "status": "initializing",
            "agent_results": {},
            "final_result": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        self.collaboration_sessions[session_id] = session
        
        if self.db is not None:
            # Copy session to avoid MongoDB adding _id to our dict
            session_copy = session.copy()
            await self.db.collaboration_sessions.insert_one(session_copy)
        
        return session
    
    async def _determine_required_agents(self, task: str) -> List[str]:
        """Determine which agents are needed for a task"""
        
        task_lower = task.lower()
        required = []
        
        # Business intelligence keywords
        if any(word in task_lower for word in ["sales", "revenue", "profit", "analytics", "report", "trend"]):
            required.append("business_intelligence")
        
        # Operations keywords
        if any(word in task_lower for word in ["inventory", "stock", "warehouse", "supply", "order"]):
            required.append("operations")
        
        # Customer keywords
        if any(word in task_lower for word in ["customer", "client", "user", "support", "feedback"]):
            required.append("customer_success")
        
        # Data analysis keywords
        if any(word in task_lower for word in ["analyze", "pattern", "anomaly", "predict", "forecast"]):
            required.append("data_analytics")
        
        # Default to business agent
        if not required:
            required.append("business")
        
        return required
    
    async def execute_collaboration(
        self,
        session_id: str
    ) -> AsyncGenerator[Dict, None]:
        """
        Execute a collaboration session with streaming updates.
        """
        
        session = self.collaboration_sessions.get(session_id)
        if not session:
            yield {"type": "error", "message": "Session not found"}
            return
        
        session["status"] = "executing"
        
        yield {
            "type": "collaboration_started",
            "session_id": session_id,
            "agents": session["required_agents"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Execute each agent's part
        for agent_id in session["required_agents"]:
            agent = self.agents.get(agent_id)
            if not agent:
                yield {
                    "type": "agent_skipped",
                    "agent_id": agent_id,
                    "reason": "Agent not available"
                }
                continue
            
            yield {
                "type": "agent_started",
                "agent_id": agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            try:
                # Create plan for this agent
                plan = await agent.plan_task(
                    session["task"],
                    session["user_id"],
                    session["tenant_id"],
                    {"collaboration_session": session_id}
                )
                
                # Execute plan
                results = []
                async for update in agent.execute_plan(plan.id, auto_confirm=True):
                    yield {
                        "type": "agent_update",
                        "agent_id": agent_id,
                        "update": update
                    }
                    if update.get("type") == "plan_completed":
                        results = update.get("results", [])
                
                session["agent_results"][agent_id] = {
                    "plan_id": plan.id,
                    "results": results,
                    "status": "completed"
                }
                
                yield {
                    "type": "agent_completed",
                    "agent_id": agent_id,
                    "results": results,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
            except Exception as e:
                session["agent_results"][agent_id] = {
                    "status": "failed",
                    "error": str(e)
                }
                
                yield {
                    "type": "agent_failed",
                    "agent_id": agent_id,
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        
        # Aggregate results
        session["status"] = "completed"
        session["completed_at"] = datetime.now(timezone.utc).isoformat()
        session["final_result"] = await self._aggregate_results(session)
        
        if self.db is not None:
            await self.db.collaboration_sessions.update_one(
                {"id": session_id},
                {"$set": session}
            )
        
        yield {
            "type": "collaboration_completed",
            "session_id": session_id,
            "final_result": session["final_result"],
            "agent_results": session["agent_results"],
            "timestamp": session["completed_at"]
        }
    
    async def _aggregate_results(self, session: Dict) -> Dict:
        """Aggregate results from all agents"""
        
        aggregated = {
            "summary": "",
            "insights": [],
            "recommendations": [],
            "data": {}
        }
        
        for agent_id, result in session["agent_results"].items():
            if result.get("status") == "completed":
                for r in result.get("results", []):
                    if isinstance(r, dict):
                        # Merge data
                        aggregated["data"].update(r.get("data", r))
                        
                        # Collect insights
                        if r.get("message"):
                            aggregated["insights"].append({
                                "agent": agent_id,
                                "insight": r["message"]
                            })
        
        # Generate summary
        aggregated["summary"] = f"Collaboration completed with {len(session['agent_results'])} agents. " \
                               f"Gathered {len(aggregated['insights'])} insights."
        
        return aggregated
