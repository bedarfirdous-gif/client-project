"""
Embedded AI Agent Orchestration System
======================================
Fully self-contained emergent AI system with swarm intelligence capabilities.

Architecture:
1. Application Layer - UI/API/Services
2. Internal Agent Runtime - Emergent AI Core Layer  
3. Decision + Planning AI - LLM/Policy/Planner
4. Memory + Knowledge Store - Vector DB/State Graph
5. Execution + Tool Layer - Functions/OS/APIs
"""

import os
import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Callable, Union
from enum import Enum
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase
## from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

# ============== ENUMS & CONSTANTS ==============

class AgentType(str, Enum):
    ORCHESTRATOR = "orchestrator"      # Main coordinator
    BUSINESS = "business"              # Business automation
    ASSISTANT = "assistant"            # User assistance
    OPERATIONS = "operations"          # System operations
    ANALYTICS = "analytics"            # Data analysis
    AUTOMATION = "automation"          # Task automation

class AgentStatus(str, Enum):
    IDLE = "idle"
    THINKING = "thinking"
    EXECUTING = "executing"
    WAITING = "waiting"
    COMPLETED = "completed"
    ERROR = "error"

class TaskPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class MessageType(str, Enum):
    TASK = "task"
    RESPONSE = "response"
    BROADCAST = "broadcast"
    QUERY = "query"
    DELEGATE = "delegate"

# ============== DATA MODELS ==============

class AgentMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: MessageType
    sender: str
    receiver: Optional[str] = None  # None = broadcast
    content: Dict[str, Any]
    priority: TaskPriority = TaskPriority.MEDIUM
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    requires_response: bool = False
    correlation_id: Optional[str] = None

class AgentTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    agent_type: AgentType
    priority: TaskPriority = TaskPriority.MEDIUM
    input_data: Dict[str, Any] = {}
    status: str = "pending"
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    parent_task_id: Optional[str] = None
    subtasks: List[str] = []

class AgentMemory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    memory_type: str  # "short_term", "long_term", "episodic", "semantic"
    key: str
    value: Any
    importance: float = 0.5  # 0-1 scale
    access_count: int = 0
    last_accessed: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: Optional[str] = None
    embedding: Optional[List[float]] = None  # For vector search

class ConversationMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str  # "user", "assistant", "system"
    content: str
    agent_type: Optional[AgentType] = None
    metadata: Dict[str, Any] = {}
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AgentState(BaseModel):
    agent_id: str
    agent_type: AgentType
    status: AgentStatus = AgentStatus.IDLE
    current_task: Optional[str] = None
    capabilities: List[str] = []
    performance_score: float = 1.0
    tasks_completed: int = 0
    tasks_failed: int = 0
    last_active: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ============== TOOL REGISTRY ==============

class ToolRegistry:
    """Registry for tools that agents can execute"""
    
    def __init__(self):
        self.tools: Dict[str, Dict[str, Any]] = {}
    
    def register(self, name: str, func: Callable, description: str, 
                 parameters: Dict[str, Any], agent_types: List[AgentType] = None):
        """Register a tool that agents can use"""
        self.tools[name] = {
            "function": func,
            "description": description,
            "parameters": parameters,
            "agent_types": agent_types or list(AgentType)
        }
    
    def get_tools_for_agent(self, agent_type: AgentType) -> List[Dict[str, Any]]:
        """Get available tools for a specific agent type"""
        return [
            {"name": name, "description": tool["description"], "parameters": tool["parameters"]}
            for name, tool in self.tools.items()
            if agent_type in tool["agent_types"]
        ]
    
    async def execute(self, name: str, **kwargs) -> Any:
        """Execute a registered tool"""
        if name not in self.tools:
            raise ValueError(f"Tool '{name}' not found")
        
        func = self.tools[name]["function"]
        if asyncio.iscoroutinefunction(func):
            return await func(**kwargs)
        return func(**kwargs)

# ============== MEMORY STORE ==============

class MemoryStore:
    """Vector-enabled memory store for agent knowledge"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.agent_memories
    
    async def init_indexes(self):
        """Create indexes for efficient querying"""
        await self.collection.create_index([("agent_id", 1)])
        await self.collection.create_index([("memory_type", 1)])
        await self.collection.create_index([("key", "text"), ("value", "text")])
        await self.collection.create_index([("importance", -1)])
        await self.collection.create_index([("expires_at", 1)])
    
    async def store(self, memory: AgentMemory) -> str:
        """Store a memory"""
        await self.collection.insert_one(memory.model_dump())
        return memory.id
    
    async def retrieve(self, agent_id: str, key: str = None, 
                      memory_type: str = None, limit: int = 10) -> List[Dict]:
        """Retrieve memories"""
        query = {"agent_id": agent_id}
        if key:
            query["key"] = key
        if memory_type:
            query["memory_type"] = memory_type
        
        # Update access count and last accessed
        memories = await self.collection.find(query, {"_id": 0}).sort(
            [("importance", -1), ("last_accessed", -1)]
        ).limit(limit).to_list(limit)
        
        for mem in memories:
            await self.collection.update_one(
                {"id": mem["id"]},
                {"$inc": {"access_count": 1}, 
                 "$set": {"last_accessed": datetime.now(timezone.utc).isoformat()}}
            )
        
        return memories
    
    async def search(self, query: str, agent_id: str = None, limit: int = 10) -> List[Dict]:
        """Semantic search across memories"""
        search_query = {"$text": {"$search": query}}
        if agent_id:
            search_query["agent_id"] = agent_id
        
        return await self.collection.find(
            search_query, {"_id": 0, "score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).limit(limit).to_list(limit)
    
    async def forget(self, agent_id: str, key: str = None, older_than: datetime = None):
        """Remove memories"""
        query = {"agent_id": agent_id}
        if key:
            query["key"] = key
        if older_than:
            query["created_at"] = {"$lt": older_than.isoformat()}
        
        await self.collection.delete_many(query)
    
    async def consolidate(self, agent_id: str):
        """Consolidate short-term memories into long-term"""
        # Find high-importance short-term memories
        memories = await self.collection.find({
            "agent_id": agent_id,
            "memory_type": "short_term",
            "importance": {"$gte": 0.7}
        }, {"_id": 0}).to_list(100)
        
        for mem in memories:
            await self.collection.update_one(
                {"id": mem["id"]},
                {"$set": {"memory_type": "long_term"}}
            )

# ============== BASE AGENT ==============

class BaseAgent:
    """Base class for all agents"""
    
    def __init__(self, agent_id: str, agent_type: AgentType, 
                 db: AsyncIOMotorDatabase, api_key: str,
                 tool_registry: ToolRegistry, memory_store: MemoryStore):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.db = db
        self.api_key = api_key
        self.tool_registry = tool_registry
        self.memory_store = memory_store
        self.status = AgentStatus.IDLE
        self.current_task = None
        self.message_queue: asyncio.Queue = asyncio.Queue()
        self.capabilities = self._define_capabilities()
    
    def _define_capabilities(self) -> List[str]:
        """Define what this agent can do - override in subclasses"""
        return []
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for this agent - override in subclasses"""
        return "You are a helpful AI assistant."
    
    async def think(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Use LLM to think about how to handle a task"""
        tools = self.tool_registry.get_tools_for_agent(self.agent_type)
        
        # Get relevant memories
        memories = await self.memory_store.retrieve(self.agent_id, limit=5)
        memory_context = "\n".join([f"- {m['key']}: {m['value']}" for m in memories])
        
        system_prompt = f"""{self._get_system_prompt()}

Available Tools:
{json.dumps(tools, indent=2)}

Relevant Memories:
{memory_context}

Respond in JSON format with:
{{
    "reasoning": "your step-by-step reasoning",
    "action": "tool_name or 'respond' or 'delegate'",
    "action_params": {{}},
    "delegate_to": "agent_type if delegating",
    "response": "direct response if action is 'respond'",
    "memory_update": {{"key": "value"}} // optional memories to store
}}
"""
        
        chat = LlmChat(
            api_key=self.api_key,
            session_id=f"agent-{self.agent_id}-{datetime.now().timestamp()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        message = UserMessage(text=json.dumps(context))
        response = await chat.send_message(message)
        
        # Parse response
        try:
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            return json.loads(response_text)
        except json.JSONDecodeError:
            return {"action": "respond", "response": response, "reasoning": "Direct response"}
    
    async def execute_action(self, action: str, params: Dict[str, Any]) -> Any:
        """Execute an action using registered tools"""
        if action == "respond":
            return params.get("response", "")
        
        try:
            result = await self.tool_registry.execute(action, **params)
            return result
        except Exception as e:
            logger.error(f"Agent {self.agent_id} failed to execute {action}: {e}")
            return {"error": str(e)}
    
    async def process_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        """Process an incoming message"""
        self.status = AgentStatus.THINKING
        
        try:
            # Think about how to handle this
            thought = await self.think({
                "message_type": message.type.value,
                "content": message.content,
                "sender": message.sender,
                "priority": message.priority.value
            })
            
            # Store any memory updates
            if thought.get("memory_update"):
                for key, value in thought["memory_update"].items():
                    memory = AgentMemory(
                        agent_id=self.agent_id,
                        memory_type="short_term",
                        key=key,
                        value=value,
                        importance=0.6
                    )
                    await self.memory_store.store(memory)
            
            # Execute the action
            self.status = AgentStatus.EXECUTING
            action = thought.get("action", "respond")
            
            if action == "delegate":
                # Return delegation request
                return AgentMessage(
                    type=MessageType.DELEGATE,
                    sender=self.agent_id,
                    receiver=thought.get("delegate_to"),
                    content={
                        "original_message": message.content,
                        "reason": thought.get("reasoning")
                    },
                    correlation_id=message.id
                )
            else:
                result = await self.execute_action(action, thought.get("action_params", {}))
                
                if message.requires_response:
                    return AgentMessage(
                        type=MessageType.RESPONSE,
                        sender=self.agent_id,
                        receiver=message.sender,
                        content={
                            "result": result,
                            "reasoning": thought.get("reasoning"),
                            "response": thought.get("response")
                        },
                        correlation_id=message.id
                    )
            
            self.status = AgentStatus.COMPLETED
            return None
            
        except Exception as e:
            self.status = AgentStatus.ERROR
            logger.error(f"Agent {self.agent_id} error: {e}")
            if message.requires_response:
                return AgentMessage(
                    type=MessageType.RESPONSE,
                    sender=self.agent_id,
                    receiver=message.sender,
                    content={"error": str(e)},
                    correlation_id=message.id
                )
            return None
        finally:
            self.status = AgentStatus.IDLE
    
    async def run(self):
        """Main agent loop"""
        while True:
            try:
                message = await asyncio.wait_for(self.message_queue.get(), timeout=1.0)
                response = await self.process_message(message)
                if response:
                    # Put response back to orchestrator
                    pass
            except asyncio.TimeoutError:
                # No messages, continue
                pass
            except Exception as e:
                logger.error(f"Agent {self.agent_id} run error: {e}")
                await asyncio.sleep(1)

# ============== SPECIALIZED AGENTS ==============

class BusinessAgent(BaseAgent):
    """Agent for business automation tasks"""
    
    def _define_capabilities(self) -> List[str]:
        return [
            "generate_reports", "analyze_sales", "inventory_alerts",
            "customer_insights", "revenue_forecasting", "trend_analysis"
        ]
    
    def _get_system_prompt(self) -> str:
        return """You are a Business Intelligence Agent specialized in:
- Generating business reports and insights
- Analyzing sales patterns and trends
- Managing inventory alerts and predictions
- Customer behavior analysis
- Revenue forecasting

Always provide data-driven, actionable insights."""

class AssistantAgent(BaseAgent):
    """Agent for user assistance"""
    
    def _define_capabilities(self) -> List[str]:
        return [
            "answer_questions", "guide_navigation", "suggest_actions",
            "explain_features", "troubleshoot_issues"
        ]
    
    def _get_system_prompt(self) -> str:
        return """You are a helpful User Assistant Agent for BijnisBooks business management software.
You can help users with:
- Navigating the application
- Understanding features
- Performing common tasks
- Troubleshooting issues
- Suggesting best practices

Be friendly, concise, and helpful."""

class OperationsAgent(BaseAgent):
    """Agent for system operations"""
    
    def _define_capabilities(self) -> List[str]:
        return [
            "monitor_system", "auto_fix_errors", "optimize_performance",
            "manage_data", "health_check", "backup_operations"
        ]
    
    def _get_system_prompt(self) -> str:
        return """You are a System Operations Agent responsible for:
- Monitoring system health
- Auto-fixing common errors
- Optimizing performance
- Managing data integrity
- Running health checks
- Coordinating backups

Prioritize system stability and data integrity."""

class AnalyticsAgent(BaseAgent):
    """Agent for data analytics"""
    
    def _define_capabilities(self) -> List[str]:
        return [
            "analyze_data", "generate_charts", "find_patterns",
            "predict_trends", "compare_metrics", "segment_customers"
        ]
    
    def _get_system_prompt(self) -> str:
        return """You are a Data Analytics Agent specialized in:
- Deep data analysis
- Pattern recognition
- Trend prediction
- Statistical analysis
- Customer segmentation
- Performance metrics

Provide accurate, insightful analysis with clear explanations."""

# ============== SWARM ORCHESTRATOR ==============

class SwarmOrchestrator:
    """
    Central orchestrator for agent swarm intelligence.
    Manages agent lifecycle, task distribution, and collaboration.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, api_key: str):
        self.db = db
        self.api_key = api_key
        self.agents: Dict[str, BaseAgent] = {}
        self.agent_states: Dict[str, AgentState] = {}
        self.tool_registry = ToolRegistry()
        self.memory_store = MemoryStore(db)
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self.conversations = db.agent_conversations
        self.tasks = db.agent_tasks
        self.running = False
        
        # Initialize agents
        self._initialize_agents()
        self._register_default_tools()
    
    def _initialize_agents(self):
        """Create the agent swarm"""
        agent_configs = [
            ("business-agent", AgentType.BUSINESS, BusinessAgent),
            ("assistant-agent", AgentType.ASSISTANT, AssistantAgent),
            ("operations-agent", AgentType.OPERATIONS, OperationsAgent),
            ("analytics-agent", AgentType.ANALYTICS, AnalyticsAgent),
        ]
        
        for agent_id, agent_type, agent_class in agent_configs:
            agent = agent_class(
                agent_id=agent_id,
                agent_type=agent_type,
                db=self.db,
                api_key=self.api_key,
                tool_registry=self.tool_registry,
                memory_store=self.memory_store
            )
            self.agents[agent_id] = agent
            self.agent_states[agent_id] = AgentState(
                agent_id=agent_id,
                agent_type=agent_type,
                capabilities=agent.capabilities
            )
    
    def _register_default_tools(self):
        """Register default tools for agents"""
        
        # Business tools
        self.tool_registry.register(
            name="get_sales_summary",
            func=self._tool_get_sales_summary,
            description="Get sales summary for a time period",
            parameters={"period": "string (day/week/month/year)"},
            agent_types=[AgentType.BUSINESS, AgentType.ANALYTICS]
        )
        
        self.tool_registry.register(
            name="get_inventory_status",
            func=self._tool_get_inventory_status,
            description="Get current inventory status and alerts",
            parameters={"low_stock_threshold": "number (optional)"},
            agent_types=[AgentType.BUSINESS, AgentType.OPERATIONS]
        )
        
        self.tool_registry.register(
            name="get_customer_insights",
            func=self._tool_get_customer_insights,
            description="Get customer behavior insights",
            parameters={"segment": "string (optional)"},
            agent_types=[AgentType.BUSINESS, AgentType.ANALYTICS]
        )
        
        # Operations tools
        self.tool_registry.register(
            name="check_system_health",
            func=self._tool_check_system_health,
            description="Check overall system health",
            parameters={},
            agent_types=[AgentType.OPERATIONS]
        )
        
        self.tool_registry.register(
            name="get_error_summary",
            func=self._tool_get_error_summary,
            description="Get summary of recent errors",
            parameters={"hours": "number (default 24)"},
            agent_types=[AgentType.OPERATIONS]
        )
    
    # Tool implementations
    async def _tool_get_sales_summary(self, period: str = "day") -> Dict:
        """Get sales summary"""
        periods = {"day": 1, "week": 7, "month": 30, "year": 365}
        days = periods.get(period, 1)
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        
        pipeline = [
            {"$match": {"created_at": {"$gte": cutoff}}},
            {"$group": {
                "_id": None,
                "total_sales": {"$sum": "$total_amount"},
                "order_count": {"$sum": 1},
                "avg_order_value": {"$avg": "$total_amount"}
            }}
        ]
        
        result = await self.db.sales.aggregate(pipeline).to_list(1)
        return result[0] if result else {"total_sales": 0, "order_count": 0, "avg_order_value": 0}
    
    async def _tool_get_inventory_status(self, low_stock_threshold: int = 10) -> Dict:
        """Get inventory status"""
        low_stock = await self.db.items.count_documents({"stock": {"$lt": low_stock_threshold}})
        out_of_stock = await self.db.items.count_documents({"stock": 0})
        total_items = await self.db.items.count_documents({})
        
        return {
            "total_items": total_items,
            "low_stock_count": low_stock,
            "out_of_stock_count": out_of_stock,
            "low_stock_threshold": low_stock_threshold
        }
    
    async def _tool_get_customer_insights(self, segment: str = None) -> Dict:
        """Get customer insights"""
        total_customers = await self.db.customers.count_documents({})
        
        # Get top customers by purchase value
        pipeline = [
            {"$group": {"_id": "$customer_id", "total_spent": {"$sum": "$total_amount"}}},
            {"$sort": {"total_spent": -1}},
            {"$limit": 5}
        ]
        top_customers = await self.db.sales.aggregate(pipeline).to_list(5)
        
        return {
            "total_customers": total_customers,
            "top_customers": top_customers
        }
    
    async def _tool_check_system_health(self) -> Dict:
        """Check system health"""
        try:
            # Check database
            await self.db.command("ping")
            db_status = "healthy"
        except:
            db_status = "error"
        
        # Get error count from last hour
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        recent_errors = await self.db.error_logs.count_documents({
            "first_seen": {"$gte": cutoff},
            "severity": {"$in": ["critical", "high"]}
        })
        
        return {
            "database": db_status,
            "recent_critical_errors": recent_errors,
            "agent_count": len(self.agents),
            "status": "healthy" if db_status == "healthy" and recent_errors == 0 else "degraded"
        }
    
    async def _tool_get_error_summary(self, hours: int = 24) -> Dict:
        """Get error summary"""
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        pipeline = [
            {"$match": {"first_seen": {"$gte": cutoff}}},
            {"$group": {
                "_id": "$severity",
                "count": {"$sum": 1}
            }}
        ]
        
        by_severity = await self.db.error_logs.aggregate(pipeline).to_list(10)
        total = sum(item["count"] for item in by_severity)
        
        return {
            "total_errors": total,
            "by_severity": {item["_id"]: item["count"] for item in by_severity},
            "period_hours": hours
        }
    
    async def init_indexes(self):
        """Initialize database indexes"""
        await self.memory_store.init_indexes()
        await self.conversations.create_index([("session_id", 1)])
        await self.conversations.create_index([("timestamp", -1)])
        await self.tasks.create_index([("status", 1)])
        await self.tasks.create_index([("created_at", -1)])
    
    def select_agent(self, task_type: str, context: Dict[str, Any]) -> str:
        """Select the best agent for a task using swarm intelligence"""
        # Score each agent based on capabilities and current load
        scores = {}
        
        for agent_id, state in self.agent_states.items():
            score = 0
            
            # Check if agent has relevant capabilities
            for cap in state.capabilities:
                if cap.lower() in task_type.lower() or task_type.lower() in cap.lower():
                    score += 10
            
            # Prefer idle agents
            if state.status == AgentStatus.IDLE:
                score += 5
            
            # Consider performance history
            score *= state.performance_score
            
            scores[agent_id] = score
        
        # Return agent with highest score
        if scores:
            return max(scores, key=scores.get)
        
        # Default to assistant agent
        return "assistant-agent"
    
    async def process_user_message(self, session_id: str, user_message: str, 
                                   user_id: str = None) -> Dict[str, Any]:
        """Process a user message through the swarm"""
        
        # Store user message
        user_msg = ConversationMessage(
            session_id=session_id,
            role="user",
            content=user_message,
            metadata={"user_id": user_id}
        )
        await self.conversations.insert_one(user_msg.model_dump())
        
        # Get conversation history
        history = await self.conversations.find(
            {"session_id": session_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(10).to_list(10)
        history.reverse()
        
        # Create orchestrator prompt
        orchestrator_prompt = f"""You are the Orchestrator of an AI Agent Swarm for BijnisBooks business management software.

Available Agents:
{json.dumps([{"id": aid, "type": state.agent_type.value, "capabilities": state.capabilities, "status": state.status.value} for aid, state in self.agent_states.items()], indent=2)}

Conversation History:
{json.dumps([{"role": m.get("role"), "content": m.get("content")[:200]} for m in history], indent=2)}

Current User Message: {user_message}

Analyze the user's request and decide:
1. Which agent(s) should handle this?
2. What specific task should be assigned?
3. Should multiple agents collaborate?

Respond in JSON:
{{
    "understanding": "what the user wants",
    "primary_agent": "agent-id",
    "task_type": "type of task",
    "task_description": "detailed task description",
    "collaborators": ["other-agent-ids if needed"],
    "direct_response": "if you can respond directly without agents",
    "requires_agents": true/false
}}
"""
        
        # Use LLM to orchestrate
        chat = LlmChat(
            api_key=self.api_key,
            session_id=f"orchestrator-{session_id}",
            system_message=orchestrator_prompt
        ).with_model("openai", "gpt-4o")
        
        orchestrator_response = await chat.send_message(UserMessage(text=user_message))
        
        # Parse orchestrator decision
        try:
            response_text = orchestrator_response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            decision = json.loads(response_text)
        except json.JSONDecodeError:
            decision = {
                "direct_response": orchestrator_response,
                "requires_agents": False
            }
        
        # Handle direct response
        if not decision.get("requires_agents", True) and decision.get("direct_response"):
            assistant_msg = ConversationMessage(
                session_id=session_id,
                role="assistant",
                content=decision["direct_response"],
                agent_type=AgentType.ORCHESTRATOR,
                metadata={"decision": decision}
            )
            await self.conversations.insert_one(assistant_msg.model_dump())
            
            return {
                "response": decision["direct_response"],
                "agent": "orchestrator",
                "decision": decision
            }
        
        # Delegate to appropriate agent
        primary_agent_id = decision.get("primary_agent", "assistant-agent")
        if primary_agent_id not in self.agents:
            primary_agent_id = "assistant-agent"
        
        primary_agent = self.agents[primary_agent_id]
        
        # Create task message
        task_message = AgentMessage(
            type=MessageType.TASK,
            sender="orchestrator",
            receiver=primary_agent_id,
            content={
                "user_message": user_message,
                "task_type": decision.get("task_type", "general"),
                "task_description": decision.get("task_description", user_message),
                "context": {"history": history[-3:] if history else []}
            },
            priority=TaskPriority.HIGH,
            requires_response=True
        )
        
        # Process through agent
        response_message = await primary_agent.process_message(task_message)
        
        # Extract response
        if response_message:
            # First check if there's a formatted response
            response_content = response_message.content.get("response")
            
            # If no formatted response but we have a result, format it nicely
            if not response_content and response_message.content.get("result"):
                result = response_message.content.get("result")
                reasoning = response_message.content.get("reasoning", "")
                
                # Convert tool results to natural language
                if isinstance(result, dict):
                    response_content = await self._format_tool_result(
                        result, 
                        decision.get("task_type", "general"),
                        reasoning
                    )
                else:
                    response_content = str(result)
            
            # Fallback to string representation
            if not response_content:
                response_content = str(response_message.content)
        else:
            response_content = "I've processed your request."
        
        # Store assistant response
        assistant_msg = ConversationMessage(
            session_id=session_id,
            role="assistant",
            content=response_content if isinstance(response_content, str) else json.dumps(response_content),
            agent_type=primary_agent.agent_type,
            metadata={
                "decision": decision,
                "agent_reasoning": response_message.content.get("reasoning") if response_message else None
            }
        )
        await self.conversations.insert_one(assistant_msg.model_dump())
        
        return {
            "response": response_content,
            "agent": primary_agent_id,
            "agent_type": primary_agent.agent_type.value,
            "decision": decision,
            "collaborators": decision.get("collaborators", [])
        }
    
    async def _format_tool_result(self, result: Dict, task_type: str, reasoning: str = "") -> str:
        """Format tool results into natural language using LLM"""
        try:
            format_prompt = f"""Convert this tool output into a clear, helpful response for the user.
            
Task Type: {task_type}
Tool Result: {json.dumps(result, indent=2)}
Agent Reasoning: {reasoning}

Provide a natural language response that:
1. Summarizes the key findings
2. Highlights any issues or warnings
3. Suggests next steps if appropriate
4. Is conversational and helpful

Respond directly without any JSON or markdown formatting."""

            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"format-{datetime.now().timestamp()}",
                system_message="You are a helpful assistant that converts technical data into clear, user-friendly responses."
            ).with_model("openai", "gpt-4o-mini")
            
            response = await chat.send_message(UserMessage(text=format_prompt))
            return response.strip()
        except Exception as e:
            logger.error(f"Error formatting tool result: {e}")
            # Fallback to simple formatting
            return self._simple_format_result(result, task_type)
    
    def _simple_format_result(self, result: Dict, task_type: str) -> str:
        """Simple formatting fallback for tool results"""
        lines = []
        
        if task_type == "health_check":
            status = result.get("status", "unknown")
            lines.append(f"**System Health Check**\n")
            lines.append(f"• Overall Status: {status.upper()}")
            lines.append(f"• Database: {result.get('database', 'unknown')}")
            lines.append(f"• Active Agents: {result.get('agent_count', 0)}")
            if result.get("recent_critical_errors", 0) > 0:
                lines.append(f"• ⚠️ Critical Errors: {result.get('recent_critical_errors')}")
        elif "error" in task_type:
            lines.append(f"**Error Summary**\n")
            lines.append(f"• Total Errors: {result.get('total_errors', 0)}")
            by_severity = result.get("by_severity", {})
            for severity, count in by_severity.items():
                lines.append(f"• {severity.title()}: {count}")
        else:
            # Generic formatting
            for key, value in result.items():
                lines.append(f"• {key.replace('_', ' ').title()}: {value}")
        
        return "\n".join(lines)
    
    async def get_conversation_history(self, session_id: str, limit: int = 50) -> List[Dict]:
        """Get conversation history for a session"""
        return await self.conversations.find(
            {"session_id": session_id},
            {"_id": 0}
        ).sort("timestamp", 1).limit(limit).to_list(limit)
    
    async def get_agent_status(self) -> Dict[str, Any]:
        """Get status of all agents"""
        return {
            agent_id: {
                "type": state.agent_type.value,
                "status": state.status.value,
                "capabilities": state.capabilities,
                "performance_score": state.performance_score,
                "tasks_completed": state.tasks_completed,
                "tasks_failed": state.tasks_failed,
                "last_active": state.last_active
            }
            for agent_id, state in self.agent_states.items()
        }
    
    async def run_background_tasks(self):
        """Run periodic background tasks"""
        while self.running:
            try:
                # Consolidate memories periodically
                for agent_id in self.agents:
                    await self.memory_store.consolidate(agent_id)
                
                # Update agent states
                for agent_id, agent in self.agents.items():
                    self.agent_states[agent_id].status = agent.status
                    self.agent_states[agent_id].last_active = datetime.now(timezone.utc).isoformat()
                
                await asyncio.sleep(300)  # Every 5 minutes
            except Exception as e:
                logger.error(f"Background task error: {e}")
                await asyncio.sleep(60)
    
    def start(self):
        """Start the orchestrator"""
        self.running = True
        asyncio.create_task(self.run_background_tasks())
    
    def stop(self):
        """Stop the orchestrator"""
        self.running = False
