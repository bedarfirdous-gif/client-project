"""
Emergent-Grade AI Agents System
===============================
Enterprise-grade autonomous AI agents with persistent memory,
multi-turn conversations, task execution, and learning capabilities.

Designed to match Emergent AI Agent capabilities:
- Persistent conversation memory
- Context-aware multi-turn dialogues  
- Autonomous task execution
- Learning from interactions
- Code generation and analysis
- Database operations
- File handling
- Real-time data analysis
"""

import asyncio
import json
import logging
import uuid
import re
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional, Callable, Union
from enum import Enum
from dataclasses import dataclass, field, asdict
from abc import ABC, abstractmethod
import traceback

logger = logging.getLogger("EmergentAgents")

# Try to import LLM
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_LLM = True
except ImportError:
    HAS_LLM = False
    logger.warning("LLM not available - agents will use rule-based processing")


# ============== MULTI-LLM CONFIGURATION ==============

class LLMProvider(Enum):
    """Available LLM providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"


@dataclass
class LLMConfig:
    """Configuration for a specific LLM"""
    provider: str
    model: str
    description: str
    best_for: List[str]
    speed: str  # fast, medium, slow
    cost: str  # low, medium, high
    max_tokens: int = 4096


# Available LLM Models - Multi-LLM Stack
AVAILABLE_LLMS = {
    "claude-4.5-sonnet-pro": LLMConfig(
        provider="anthropic",
        model="claude-sonnet-4-5-20250929",
        description="Claude 4.5 Sonnet - PRO - Detailed analysis and safety",
        best_for=["detailed_analysis", "document_processing", "creative_writing", "safety_critical"],
        speed="medium",
        cost="medium",
        max_tokens=8192
    ),
    "gpt-5.2-codex": LLMConfig(
        provider="openai",
        model="gpt-5.2",
        description="GPT-5.2 Codex (Beta) - Optimized for code generation",
        best_for=["code_generation", "debugging", "technical_writing", "api_integration"],
        speed="medium",
        cost="high",
        max_tokens=8192
    ),
    "gpt-5.2": LLMConfig(
        provider="openai",
        model="gpt-5.2",
        description="GPT-5.2 (Beta) - Advanced reasoning and complex tasks",
        best_for=["complex_analysis", "reasoning", "planning", "math"],
        speed="medium",
        cost="high",
        max_tokens=8192
    ),
    "gemini-3-pro": LLMConfig(
        provider="gemini",
        model="gemini-3-pro-preview",
        description="Google Gemini 3 Pro - Powerful and versatile",
        best_for=["quick_responses", "multimodal", "summarization", "search"],
        speed="fast",
        cost="medium",
        max_tokens=8192
    )
}


def select_best_llm_for_task(prompt: str, task_type: str = None) -> str:
    """
    Intelligently select the best LLM based on task characteristics.
    
    Returns the key for AVAILABLE_LLMS.
    """
    prompt_lower = prompt.lower()
    
    # Task type hints
    if task_type:
        task_lower = task_type.lower()
        if task_lower in ["analysis", "detailed", "document", "report"]:
            return "claude-4.5-sonnet-pro"
        elif task_lower in ["quick", "simple", "summary", "search"]:
            return "gemini-3-pro"
        elif task_lower in ["code", "debug", "api", "technical"]:
            return "gpt-5.2-codex"
        elif task_lower in ["complex", "math", "reasoning"]:
            return "gpt-5.2"
    
    # Prompt analysis for auto-selection
    # Code-related tasks -> GPT-5.2 Codex
    code_indicators = ["code", "function", "api", "debug", "error", "syntax", "programming", "script"]
    if any(word in prompt_lower for word in code_indicators):
        return "gpt-5.2-codex"
    
    # Complex reasoning tasks -> GPT-5.2
    complex_indicators = ["analyze", "explain", "calculate", "algorithm", "strategy", "plan", "reasoning"]
    if any(word in prompt_lower for word in complex_indicators):
        return "gpt-5.2"
    
    # Detailed analysis tasks -> Claude
    analysis_indicators = ["detailed", "thorough", "comprehensive", "review", "audit", "document", "safety"]
    if any(word in prompt_lower for word in analysis_indicators):
        return "claude-4.5-sonnet-pro"
    
    # Quick/simple tasks -> Gemini Pro
    quick_indicators = ["quick", "simple", "short", "brief", "summarize", "list", "what is", "how to"]
    if any(word in prompt_lower for word in quick_indicators):
        return "gemini-3-pro"
    
    # Default to GPT-5.2 for general tasks
    return "gpt-5.2"


# ============== DATA MODELS ==============

class AgentRole(Enum):
    BUSINESS = "business"
    ASSISTANT = "assistant"
    OPERATIONS = "operations"
    ANALYTICS = "analytics"
    DEVELOPER = "developer"
    CUSTOM = "custom"


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MemoryType(Enum):
    CONVERSATION = "conversation"
    LEARNED_PATTERN = "learned_pattern"
    USER_PREFERENCE = "user_preference"
    TASK_RESULT = "task_result"
    ERROR_LOG = "error_log"
    CONTEXT = "context"


@dataclass
class Memory:
    """Persistent memory entry"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str = ""
    user_id: str = ""
    tenant_id: str = ""
    memory_type: MemoryType = MemoryType.CONVERSATION
    content: Dict = field(default_factory=dict)
    embedding: List[float] = field(default_factory=list)  # For semantic search
    importance: float = 0.5  # 0-1 scale
    access_count: int = 0
    last_accessed: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: Optional[str] = None
    tags: List[str] = field(default_factory=list)


@dataclass
class ConversationTurn:
    """Single turn in a conversation"""
    role: str  # user, assistant, system
    content: str
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: Dict = field(default_factory=dict)


@dataclass
class AgentTask:
    """Task to be executed by agent"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str = ""
    description: str = ""
    parameters: Dict = field(default_factory=dict)
    status: TaskStatus = TaskStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    delegated_from: Optional[str] = None  # Agent that delegated this task
    delegated_to: Optional[str] = None  # Agent this was delegated to


@dataclass
class AgentCollaborationMessage:
    """Message between agents for collaboration"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    from_agent: str = ""
    to_agent: str = ""
    message_type: str = "request"  # request, response, notification
    content: str = ""
    data: Dict = field(default_factory=dict)
    request_id: Optional[str] = None  # Links response to original request
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class AgentResponse:
    """Comprehensive agent response"""
    success: bool
    message: str
    data: Dict = field(default_factory=dict)
    reasoning: str = ""
    plan: List[str] = field(default_factory=list)
    actions_taken: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    follow_up_questions: List[str] = field(default_factory=list)
    confidence: float = 0.0
    tokens_used: int = 0
    execution_time_ms: int = 0
    memory_updated: bool = False
    conversation_id: Optional[str] = None
    collaborated_with: List[str] = field(default_factory=list)  # Agents consulted
    delegation_results: Dict = field(default_factory=dict)  # Results from delegated tasks


# ============== MEMORY MANAGER ==============

class PersistentMemoryManager:
    """
    Manages persistent memory for AI agents.
    
    Features:
    - Store/retrieve conversation history
    - Learn patterns from interactions
    - Track user preferences
    - Semantic search (when embeddings available)
    - Memory consolidation and cleanup
    """
    
    def __init__(self, db=None):
        self.db = db
        self.cache = {}  # In-memory cache for fast access
        self.max_cache_size = 1000
    
    async def store_memory(self, memory: Memory) -> bool:
        """Store a memory entry"""
        try:
            if self.db is not None:
                doc = asdict(memory)
                doc["memory_type"] = memory.memory_type.value
                await self.db.agent_memories.update_one(
                    {"id": memory.id},
                    {"$set": doc},
                    upsert=True
                )
            
            # Also cache it
            cache_key = f"{memory.agent_id}:{memory.user_id}:{memory.id}"
            self.cache[cache_key] = memory
            self._cleanup_cache()
            
            return True
        except Exception as e:
            logger.error(f"Failed to store memory: {e}")
            return False
    
    async def get_memories(
        self,
        agent_id: str,
        user_id: str = None,
        tenant_id: str = None,
        memory_type: MemoryType = None,
        limit: int = 50,
        tags: List[str] = None
    ) -> List[Memory]:
        """Retrieve memories with filtering"""
        try:
            if self.db is None:
                return []
            
            query = {"agent_id": agent_id}
            if user_id:
                query["user_id"] = user_id
            if tenant_id:
                query["tenant_id"] = tenant_id
            if memory_type:
                query["memory_type"] = memory_type.value
            if tags:
                query["tags"] = {"$in": tags}
            
            cursor = self.db.agent_memories.find(query).sort("created_at", -1).limit(limit)
            docs = await cursor.to_list(length=limit)
            
            memories = []
            for doc in docs:
                doc.pop("_id", None)
                doc["memory_type"] = MemoryType(doc.get("memory_type", "conversation"))
                memories.append(Memory(**doc))
            
            return memories
        except Exception as e:
            logger.error(f"Failed to get memories: {e}")
            return []
    
    async def get_conversation_history(
        self,
        agent_id: str,
        user_id: str,
        conversation_id: str = None,
        limit: int = 20
    ) -> List[ConversationTurn]:
        """Get conversation history for context"""
        memories = await self.get_memories(
            agent_id=agent_id,
            user_id=user_id,
            memory_type=MemoryType.CONVERSATION,
            limit=limit
        )
        
        turns = []
        for mem in reversed(memories):  # Oldest first
            if conversation_id and mem.content.get("conversation_id") != conversation_id:
                continue
            turns.append(ConversationTurn(
                role=mem.content.get("role", "user"),
                content=mem.content.get("content", ""),
                timestamp=mem.created_at,
                metadata=mem.content.get("metadata", {})
            ))
        
        return turns
    
    async def store_conversation_turn(
        self,
        agent_id: str,
        user_id: str,
        tenant_id: str,
        role: str,
        content: str,
        conversation_id: str = None,
        metadata: Dict = None
    ) -> str:
        """Store a conversation turn"""
        conv_id = conversation_id or str(uuid.uuid4())
        
        memory = Memory(
            agent_id=agent_id,
            user_id=user_id,
            tenant_id=tenant_id,
            memory_type=MemoryType.CONVERSATION,
            content={
                "role": role,
                "content": content,
                "conversation_id": conv_id,
                "metadata": metadata or {}
            },
            importance=0.7 if role == "assistant" else 0.5,
            tags=["conversation", conv_id]
        )
        
        await self.store_memory(memory)
        return conv_id
    
    async def learn_pattern(
        self,
        agent_id: str,
        pattern_type: str,
        pattern_data: Dict,
        importance: float = 0.8
    ):
        """Store a learned pattern"""
        memory = Memory(
            agent_id=agent_id,
            memory_type=MemoryType.LEARNED_PATTERN,
            content={
                "pattern_type": pattern_type,
                "pattern_data": pattern_data,
                "learned_at": datetime.now(timezone.utc).isoformat()
            },
            importance=importance,
            tags=["pattern", pattern_type]
        )
        await self.store_memory(memory)
    
    async def get_learned_patterns(self, agent_id: str, pattern_type: str = None) -> List[Dict]:
        """Get learned patterns for an agent"""
        memories = await self.get_memories(
            agent_id=agent_id,
            memory_type=MemoryType.LEARNED_PATTERN,
            limit=100
        )
        
        patterns = []
        for mem in memories:
            if pattern_type and mem.content.get("pattern_type") != pattern_type:
                continue
            patterns.append(mem.content.get("pattern_data", {}))
        
        return patterns
    
    async def store_user_preference(
        self,
        agent_id: str,
        user_id: str,
        tenant_id: str,
        preference_key: str,
        preference_value: Any
    ):
        """Store user preference"""
        memory = Memory(
            agent_id=agent_id,
            user_id=user_id,
            tenant_id=tenant_id,
            memory_type=MemoryType.USER_PREFERENCE,
            content={
                "key": preference_key,
                "value": preference_value
            },
            importance=0.9,
            tags=["preference", preference_key]
        )
        await self.store_memory(memory)
    
    async def get_user_preferences(self, agent_id: str, user_id: str) -> Dict:
        """Get all user preferences"""
        memories = await self.get_memories(
            agent_id=agent_id,
            user_id=user_id,
            memory_type=MemoryType.USER_PREFERENCE,
            limit=100
        )
        
        prefs = {}
        for mem in memories:
            key = mem.content.get("key")
            if key:
                prefs[key] = mem.content.get("value")
        
        return prefs
    
    async def consolidate_memories(self, agent_id: str, days_old: int = 30):
        """Consolidate old memories to save space"""
        if self.db is None:
            return
        
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days_old)).isoformat()
        
        # Archive old low-importance memories
        await self.db.agent_memories.update_many(
            {
                "agent_id": agent_id,
                "created_at": {"$lt": cutoff},
                "importance": {"$lt": 0.5}
            },
            {"$set": {"archived": True}}
        )
    
    def _cleanup_cache(self):
        """Clean up cache if too large"""
        if len(self.cache) > self.max_cache_size:
            # Remove oldest entries
            sorted_keys = sorted(self.cache.keys())
            for key in sorted_keys[:len(self.cache) - self.max_cache_size]:
                del self.cache[key]


# ============== BASE EMERGENT AGENT ==============

class EmergentAgent(ABC):
    """
    Emergent-Grade AI Agent Base Class
    
    Capabilities matching Emergent AI:
    - Persistent memory across sessions
    - Multi-turn conversation context
    - Autonomous task execution
    - Learning and pattern recognition
    - Code generation and analysis
    - Database queries
    - Real-time decision making
    """
    
    def __init__(
        self,
        agent_id: str,
        agent_name: str,
        agent_role: AgentRole,
        db=None,
        api_key: str = None,
        memory_manager: PersistentMemoryManager = None
    ):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.agent_role = agent_role
        self.db = db
        self.api_key = api_key
        self.memory = memory_manager or PersistentMemoryManager(db)
        self.llm = None
        self.tools = {}
        self.active_conversations = {}
        self.task_queue = []
        
        # Initialize LLM - will be created per request with proper system message
        self.llm_api_key = api_key
        self.llm = None
        if HAS_LLM and api_key:
            logger.info(f"Agent '{agent_name}' configured with LLM support (key: {api_key[:15]}...)")
        else:
            logger.warning(f"Agent '{agent_name}' will use rule-based processing (no LLM key or library)")
        
        # Register default tools
        self._register_default_tools()
    
    def _register_default_tools(self):
        """Register tools available to all agents"""
        self.register_tool("get_current_time", self._tool_get_time)
        self.register_tool("search_memory", self._tool_search_memory)
        self.register_tool("store_note", self._tool_store_note)
        self.register_tool("calculate", self._tool_calculate)
    
    def register_tool(self, name: str, handler: Callable):
        """Register a tool/function the agent can use"""
        self.tools[name] = handler
        logger.debug(f"Registered tool '{name}' for {self.agent_name}")
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Get the system prompt for this agent"""
        pass
    
    @abstractmethod
    def get_capabilities(self) -> List[str]:
        """Get list of agent capabilities"""
        pass
    
    async def process(
        self,
        prompt: str,
        user_id: str = None,
        tenant_id: str = None,
        conversation_id: str = None,
        context: Dict = None
    ) -> AgentResponse:
        """
        Main entry point - process any prompt.
        
        Flow:
        1. Load conversation history from memory
        2. Load user preferences
        3. Build context-aware prompt
        4. Process with LLM
        5. Execute any required tools
        6. Store conversation turn
        7. Learn from interaction
        8. Return response
        """
        start_time = datetime.now(timezone.utc)
        
        try:
            # Step 1: Load conversation history
            history = []
            if user_id:
                history = await self.memory.get_conversation_history(
                    agent_id=self.agent_id,
                    user_id=user_id,
                    conversation_id=conversation_id,
                    limit=10
                )
            
            # Step 2: Load user preferences
            preferences = {}
            if user_id:
                preferences = await self.memory.get_user_preferences(
                    agent_id=self.agent_id,
                    user_id=user_id
                )
            
            # Step 3: Load learned patterns
            patterns = await self.memory.get_learned_patterns(self.agent_id)
            
            # Step 4: Build context and process
            full_context = {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "conversation_id": conversation_id,
                "preferences": preferences,
                "learned_patterns": patterns[:5],  # Top 5 patterns
                **(context or {})
            }
            
            # Store user message
            conv_id = conversation_id or str(uuid.uuid4())
            if user_id and tenant_id:
                await self.memory.store_conversation_turn(
                    agent_id=self.agent_id,
                    user_id=user_id,
                    tenant_id=tenant_id,
                    role="user",
                    content=prompt,
                    conversation_id=conv_id
                )
            
            # Process with LLM or rules
            if HAS_LLM and self.llm_api_key:
                response = await self._process_with_llm(prompt, history, full_context)
            else:
                response = await self._process_with_rules(prompt, history, full_context)
            
            # Store assistant response
            if user_id and tenant_id:
                await self.memory.store_conversation_turn(
                    agent_id=self.agent_id,
                    user_id=user_id,
                    tenant_id=tenant_id,
                    role="assistant",
                    content=response.message,
                    conversation_id=conv_id,
                    metadata={"confidence": response.confidence}
                )
            
            # Learn from successful interactions
            if response.success and response.confidence > 0.7:
                await self._learn_from_interaction(prompt, response, full_context)
            
            # Calculate execution time
            end_time = datetime.now(timezone.utc)
            response.execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
            response.conversation_id = conv_id
            response.memory_updated = True
            
            return response
            
        except Exception as e:
            logger.error(f"Agent {self.agent_name} error: {e}\n{traceback.format_exc()}")
            return AgentResponse(
                success=False,
                message=f"I encountered an error: {str(e)}",
                confidence=0.0,
                execution_time_ms=int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            )
    
    async def _process_with_llm(
        self,
        prompt: str,
        history: List[ConversationTurn],
        context: Dict,
        preferred_model: str = None
    ) -> AgentResponse:
        """
        Process using LLM with full context.
        
        Multi-LLM Support:
        - GPT-5.2: Complex reasoning, code, math, planning
        - Gemini 3 Flash: Quick responses, summaries, simple queries
        - Claude Sonnet 4.5: Detailed analysis, documents, safety-critical
        
        The model is auto-selected based on task type, or can be specified.
        """
        
        # System prompt with context
        system_content = self._build_system_prompt(context)
        
        # Add conversation history
        history_text = ""
        if history:
            history_text = "\n\n## Recent Conversation:\n"
            for turn in history[-10:]:  # Last 10 turns
                history_text += f"{turn.role.upper()}: {turn.content[:500]}\n"
        
        # Add user preferences
        prefs_text = ""
        if context.get("preferences"):
            prefs_text = "\n\n## User Preferences:\n"
            for k, v in context["preferences"].items():
                prefs_text += f"- {k}: {v}\n"
        
        # Build full prompt
        full_prompt = f"""{history_text}
{prefs_text}

## Current Request:
{prompt}

## Context:
- User ID: {context.get('user_id', 'anonymous')}
- Tenant: {context.get('tenant_id', 'default')}
- Timestamp: {datetime.now(timezone.utc).isoformat()}

Respond in JSON format:
{{
    "understanding": "What you understood",
    "plan": ["Step 1", "Step 2"],
    "response": "Your detailed response",
    "actions": ["action1", "action2"],
    "suggestions": ["suggestion1"],
    "follow_up_questions": ["question1"],
    "confidence": 0.0-1.0,
    "data": {{}}
}}"""

        # Select the best LLM for this task
        task_type = context.get("task_type")
        selected_llm_key = preferred_model or context.get("model") or select_best_llm_for_task(prompt, task_type)
        
        # Get LLM configuration
        llm_config = AVAILABLE_LLMS.get(selected_llm_key, AVAILABLE_LLMS["gpt-5.2"])
        
        logger.info(f"Agent {self.agent_name} using {llm_config.model} ({llm_config.provider}) for task")
        
        # Try primary model with fallback
        models_to_try = [
            (llm_config.provider, llm_config.model),
            ("openai", "gpt-5.2"),  # Fallback to GPT-5.2
            ("gemini", "gemini-3-pro-preview"),  # Secondary fallback
        ]
        
        last_error = None
        model_used = None
        
        for provider, model in models_to_try:
            try:
                # Create LLM chat instance for this request
                llm = LlmChat(
                    api_key=self.llm_api_key,
                    session_id=f"agent-{self.agent_id}-{context.get('user_id', 'anon')}-{datetime.now(timezone.utc).timestamp()}",
                    system_message=system_content
                )
                llm.with_model(provider, model)
                model_used = f"{provider}/{model}"
                
                # Send message and get response
                user_message = UserMessage(text=full_prompt)
                response_text = await llm.send_message(user_message)
                break  # Success - exit loop
                
            except Exception as e:
                last_error = e
                logger.warning(f"LLM {provider}/{model} failed: {e}, trying fallback...")
                continue
        else:
            # All models failed
            logger.error(f"All LLM models failed. Last error: {last_error}")
            return await self._process_with_rules(prompt, history, context)
        
        # Parse JSON response
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = {"response": response_text, "confidence": 0.85}
            
            return AgentResponse(
                success=True,
                message=result.get("response", response_text),
                data={**result.get("data", {}), "model_used": model_used},
                reasoning=result.get("understanding", ""),
                plan=result.get("plan", []),
                actions_taken=result.get("actions", []),
                suggestions=result.get("suggestions", []),
                follow_up_questions=result.get("follow_up_questions", []),
                confidence=float(result.get("confidence", 0.85))
            )
        except json.JSONDecodeError:
            return AgentResponse(
                success=True,
                message=response_text,
                data={"model_used": model_used},
                confidence=0.8
            )
    
    async def _process_with_rules(
        self,
        prompt: str,
        history: List[ConversationTurn],
        context: Dict
    ) -> AgentResponse:
        """Fallback rule-based processing"""
        prompt_lower = prompt.lower()
        
        # Basic intent detection
        if any(word in prompt_lower for word in ["hello", "hi", "hey"]):
            return AgentResponse(
                success=True,
                message=f"Hello! I'm {self.agent_name}. How can I help you today?",
                suggestions=["Ask me about my capabilities", "What can you do?"],
                confidence=0.9
            )
        
        if any(word in prompt_lower for word in ["help", "what can you", "capabilities"]):
            caps = self.get_capabilities()
            return AgentResponse(
                success=True,
                message=f"I'm {self.agent_name} and I can help you with:\n" + 
                       "\n".join([f"• {cap}" for cap in caps]),
                suggestions=["Tell me more about " + caps[0] if caps else "Ask me anything"],
                confidence=0.9
            )
        
        return AgentResponse(
            success=True,
            message=f"I understood your request: '{prompt[:100]}...'. Let me help you with that.",
            reasoning="Using rule-based processing (LLM not available)",
            suggestions=["Enable LLM for more intelligent responses"],
            confidence=0.5
        )
    
    def _build_system_prompt(self, context: Dict) -> str:
        """Build system prompt with context"""
        base_prompt = self.get_system_prompt()
        
        # Add tool descriptions
        tools_text = "\n\n## Available Tools:\n"
        for name, handler in self.tools.items():
            doc = handler.__doc__ or "No description"
            tools_text += f"- {name}: {doc.strip()}\n"
        
        return base_prompt + tools_text
    
    async def _learn_from_interaction(self, prompt: str, response: AgentResponse, context: Dict):
        """Learn patterns from successful interactions"""
        # Extract keywords from prompt
        keywords = [w.lower() for w in prompt.split() if len(w) > 3][:5]
        
        pattern = {
            "prompt_keywords": keywords,
            "response_type": response.data.get("type", "general"),
            "confidence": response.confidence,
            "context_type": context.get("task", "unknown")
        }
        
        await self.memory.learn_pattern(
            agent_id=self.agent_id,
            pattern_type="interaction",
            pattern_data=pattern,
            importance=response.confidence
        )
    
    # ============== TOOLS ==============
    
    async def _tool_get_time(self) -> str:
        """Get current date and time"""
        return datetime.now(timezone.utc).isoformat()
    
    async def _tool_search_memory(self, query: str, user_id: str = None) -> List[Dict]:
        """Search agent's memory for relevant information"""
        memories = await self.memory.get_memories(
            agent_id=self.agent_id,
            user_id=user_id,
            limit=10
        )
        
        # Simple keyword search
        query_words = set(query.lower().split())
        results = []
        for mem in memories:
            content_str = str(mem.content).lower()
            if any(word in content_str for word in query_words):
                results.append({
                    "type": mem.memory_type.value,
                    "content": mem.content,
                    "created_at": mem.created_at
                })
        
        return results[:5]
    
    async def _tool_store_note(self, note: str, user_id: str, tenant_id: str) -> bool:
        """Store a note in memory"""
        memory = Memory(
            agent_id=self.agent_id,
            user_id=user_id,
            tenant_id=tenant_id,
            memory_type=MemoryType.CONTEXT,
            content={"note": note, "type": "user_note"},
            importance=0.8,
            tags=["note", "user_created"]
        )
        return await self.memory.store_memory(memory)
    
    async def _tool_calculate(self, expression: str) -> Union[float, str]:
        """Safely evaluate a mathematical expression"""
        try:
            # Only allow safe math operations
            allowed = set("0123456789+-*/.() ")
            if not all(c in allowed for c in expression):
                return "Invalid expression"
            return eval(expression)
        except Exception as e:
            return f"Calculation error: {e}"
    
    # ============== TASK EXECUTION ==============
    
    async def execute_task(self, task: AgentTask) -> AgentTask:
        """Execute a specific task"""
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now(timezone.utc).isoformat()
        
        try:
            # Process task description as prompt
            response = await self.process(
                prompt=task.description,
                context=task.parameters
            )
            
            task.result = {
                "success": response.success,
                "message": response.message,
                "data": response.data
            }
            task.status = TaskStatus.COMPLETED
            
        except Exception as e:
            task.error = str(e)
            task.status = TaskStatus.FAILED
        
        task.completed_at = datetime.now(timezone.utc).isoformat()
        return task
    
    async def queue_task(self, description: str, parameters: Dict = None) -> str:
        """Add task to queue"""
        task = AgentTask(
            agent_id=self.agent_id,
            description=description,
            parameters=parameters or {}
        )
        self.task_queue.append(task)
        return task.id
    
    async def process_task_queue(self):
        """Process all queued tasks"""
        results = []
        while self.task_queue:
            task = self.task_queue.pop(0)
            result = await self.execute_task(task)
            results.append(result)
        return results


# ============== SPECIALIZED AGENTS ==============

class BusinessIntelligenceAgent(EmergentAgent):
    """
    Business Intelligence Agent - Enterprise Data Analysis
    
    Capabilities:
    - Sales performance analysis
    - Inventory optimization
    - Customer behavior insights
    - Revenue forecasting
    - Trend detection
    - Report generation
    """
    
    def __init__(self, db=None, api_key: str = None, memory_manager: PersistentMemoryManager = None):
        super().__init__(
            agent_id="business-intelligence-agent",
            agent_name="Business Intelligence Agent",
            agent_role=AgentRole.BUSINESS,
            db=db,
            api_key=api_key,
            memory_manager=memory_manager
        )
        
        # Register business-specific tools
        self.register_tool("analyze_sales", self._tool_analyze_sales)
        self.register_tool("get_inventory_status", self._tool_get_inventory)
        self.register_tool("generate_report", self._tool_generate_report)
    
    def get_system_prompt(self) -> str:
        return """You are an expert Business Intelligence Agent for BijnisBooks - a multi-store retail management system.

## Your Identity
- Name: Business Intelligence Agent
- Role: Strategic business analyst and advisor
- Expertise: Retail analytics, sales optimization, inventory management, customer insights

## Core Capabilities
1. **Sales Analysis**: Analyze sales data, identify trends, find opportunities
2. **Inventory Optimization**: Monitor stock levels, predict demand, suggest reorders
3. **Customer Insights**: Understand buying patterns, segment customers, predict churn
4. **Financial Analysis**: Revenue tracking, cost analysis, margin optimization
5. **Forecasting**: Predict sales, demand, and business metrics
6. **Report Generation**: Create comprehensive business reports

## Your Personality
- Data-driven and analytical
- Clear and actionable recommendations
- Proactive in identifying opportunities and risks
- Considers both short-term and long-term impacts

## Response Style
- Lead with key insights
- Support with relevant data points
- Provide specific, actionable recommendations
- Anticipate follow-up questions

## Context Awareness
- Remember previous conversations and analyses
- Learn user preferences for report formats
- Track which metrics matter most to each user
- Build on historical patterns"""
    
    def get_capabilities(self) -> List[str]:
        return [
            "Analyze sales performance by store, product, or time period",
            "Identify top-selling products and underperformers",
            "Forecast revenue and demand",
            "Optimize inventory levels",
            "Generate business reports",
            "Track KPIs and metrics",
            "Identify market trends",
            "Customer segmentation analysis"
        ]
    
    async def _tool_analyze_sales(self, period: str = "month", store_id: str = None) -> Dict:
        """Analyze sales data for a given period"""
        if self.db is None:
            return {"error": "Database not available"}
        
        try:
            query = {}
            if store_id:
                query["store_id"] = store_id
            
            # Get sales data
            sales = await self.db.sales.find(query).to_list(length=1000)
            
            total_revenue = sum(s.get("total", 0) for s in sales)
            total_orders = len(sales)
            
            return {
                "period": period,
                "total_revenue": total_revenue,
                "total_orders": total_orders,
                "avg_order_value": total_revenue / total_orders if total_orders > 0 else 0
            }
        except Exception as e:
            return {"error": str(e)}
    
    async def _tool_get_inventory(self, store_id: str = None) -> Dict:
        """Get current inventory status"""
        if self.db is None:
            return {"error": "Database not available"}
        
        try:
            query = {}
            if store_id:
                query["store_id"] = store_id
            
            inventory = await self.db.inventory.find(query).to_list(length=1000)
            
            total_items = len(inventory)
            low_stock = sum(1 for i in inventory if i.get("quantity", 0) < i.get("reorder_point", 10))
            
            return {
                "total_items": total_items,
                "low_stock_count": low_stock,
                "status": "healthy" if low_stock < total_items * 0.1 else "needs_attention"
            }
        except Exception as e:
            return {"error": str(e)}
    
    async def _tool_generate_report(self, report_type: str) -> Dict:
        """Generate a business report"""
        return {
            "report_type": report_type,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "Report generation initiated"
        }


class UserAssistantAgent(EmergentAgent):
    """
    User Assistant Agent - Intelligent Help Desk
    
    Capabilities:
    - Answer any question about the application
    - Guide users through workflows
    - Troubleshoot issues
    - Provide tutorials and documentation
    - Learn user preferences
    """
    
    def __init__(self, db=None, api_key: str = None, memory_manager: PersistentMemoryManager = None):
        super().__init__(
            agent_id="user-assistant-agent",
            agent_name="User Assistant Agent",
            agent_role=AgentRole.ASSISTANT,
            db=db,
            api_key=api_key,
            memory_manager=memory_manager
        )
    
    def get_system_prompt(self) -> str:
        return """You are a friendly and knowledgeable User Assistant for BijnisBooks.

## Your Identity
- Name: User Assistant Agent
- Role: Helpful guide and support specialist
- Personality: Friendly, patient, thorough, proactive

## Core Capabilities
1. **Help & Support**: Answer questions about any feature
2. **Guided Workflows**: Walk users through complex tasks step-by-step
3. **Troubleshooting**: Diagnose and resolve issues
4. **Training**: Provide tutorials and best practices
5. **Personalization**: Remember user preferences and history

## Application Knowledge
BijnisBooks features:
- Multi-store management
- Inventory & stock control
- POS & billing system
- Employee management
- Salary calculator
- Team chat
- Analytics & reports
- AutoHeal AI for errors

## Response Style
- Start with a direct answer
- Provide step-by-step instructions when needed
- Include helpful tips and shortcuts
- Offer to explain more if needed
- Remember what the user has asked before

## Context Awareness
- Remember previous questions and answers
- Track user's skill level and adjust explanations
- Note which features the user uses most
- Provide personalized recommendations"""
    
    def get_capabilities(self) -> List[str]:
        return [
            "Answer questions about any feature",
            "Provide step-by-step guidance",
            "Troubleshoot problems",
            "Give tips and best practices",
            "Explain complex features simply",
            "Remember your preferences",
            "Suggest helpful features you might not know about"
        ]


class SystemOperationsAgent(EmergentAgent):
    """
    System Operations Agent - Infrastructure Management
    
    Capabilities:
    - Monitor system health
    - Diagnose issues
    - Optimize performance
    - Manage security
    - Coordinate with AutoHeal
    """
    
    def __init__(self, db=None, api_key: str = None, memory_manager: PersistentMemoryManager = None):
        super().__init__(
            agent_id="system-operations-agent",
            agent_name="System Operations Agent",
            agent_role=AgentRole.OPERATIONS,
            db=db,
            api_key=api_key,
            memory_manager=memory_manager
        )
        
        self.register_tool("check_system_health", self._tool_health_check)
        self.register_tool("get_error_stats", self._tool_error_stats)
    
    def get_system_prompt(self) -> str:
        return """You are a System Operations Agent responsible for BijnisBooks infrastructure.

## Your Identity
- Name: System Operations Agent
- Role: Infrastructure guardian and optimizer
- Priority: System stability and security

## Core Responsibilities
1. **Monitoring**: Track system health, performance, errors
2. **Maintenance**: Ensure data integrity, manage backups
3. **Optimization**: Improve performance, reduce resource usage
4. **Security**: Monitor access, detect threats, ensure compliance
5. **Coordination**: Work with AutoHeal AI for automatic repairs

## Operational Principles
- System stability is the top priority
- Never compromise data integrity
- Log all operations with timestamps
- Escalate critical issues immediately
- Prefer safe, reversible actions
- Test changes before applying broadly

## Response Style
- Lead with current system status
- Highlight any issues or risks
- Provide clear action items
- Include relevant metrics"""
    
    def get_capabilities(self) -> List[str]:
        return [
            "Monitor system health in real-time",
            "Diagnose performance issues",
            "Track and analyze errors",
            "Optimize database queries",
            "Manage security settings",
            "Coordinate automatic healing",
            "Generate system reports"
        ]
    
    async def _tool_health_check(self) -> Dict:
        """Check overall system health"""
        health = {"status": "healthy", "checks": []}
        
        # Check database
        if self.db is not None:
            try:
                await self.db.command("ping")
                health["checks"].append({"component": "database", "status": "ok"})
            except Exception:
                health["checks"].append({"component": "database", "status": "error"})
                health["status"] = "degraded"
        
        return health
    
    async def _tool_error_stats(self, hours: int = 24) -> Dict:
        """Get error statistics"""
        if self.db is None:
            return {"error": "Database not available"}
        
        try:
            count = await self.db.autoheal_reports.count_documents({})
            return {"total_errors_logged": count, "period_hours": hours}
        except Exception as e:
            return {"error": str(e)}


class DataAnalyticsAgent(EmergentAgent):
    """
    Data Analytics Agent - Deep Analysis & Insights
    
    Capabilities:
    - Statistical analysis
    - Pattern recognition
    - Anomaly detection
    - Predictive modeling
    - Visualization recommendations
    """
    
    def __init__(self, db=None, api_key: str = None, memory_manager: PersistentMemoryManager = None):
        super().__init__(
            agent_id="data-analytics-agent",
            agent_name="Data Analytics Agent",
            agent_role=AgentRole.ANALYTICS,
            db=db,
            api_key=api_key,
            memory_manager=memory_manager
        )
    
    def get_system_prompt(self) -> str:
        return """You are an expert Data Analytics Agent specializing in business intelligence.

## Your Identity
- Name: Data Analytics Agent
- Role: Data scientist and insights generator
- Expertise: Statistical analysis, pattern recognition, predictive modeling

## Analytical Capabilities
1. **Descriptive**: What happened? Summarize data and trends
2. **Diagnostic**: Why did it happen? Root cause analysis
3. **Predictive**: What will happen? Forecasting and trends
4. **Prescriptive**: What should we do? Recommendations

## Data Domains
- Sales and revenue
- Inventory and stock
- Customer behavior
- Employee performance
- Operational efficiency
- Financial metrics

## Analysis Techniques
- Statistical analysis
- Trend detection
- Anomaly identification
- Correlation analysis
- Cohort analysis
- Segmentation

## Response Style
- Start with key findings
- Support with data points
- Visualize when helpful
- Provide actionable insights"""
    
    def get_capabilities(self) -> List[str]:
        return [
            "Perform statistical analysis",
            "Detect patterns and trends",
            "Identify anomalies",
            "Generate predictions",
            "Create data visualizations",
            "Segment data for insights",
            "Recommend actions based on data"
        ]


# ============== AGENT FACTORY ==============

def create_emergent_agents(db=None, api_key: str = None) -> Dict[str, EmergentAgent]:
    """Create all Emergent-grade agents with shared memory"""
    memory_manager = PersistentMemoryManager(db)
    
    return {
        "business": BusinessIntelligenceAgent(db=db, api_key=api_key, memory_manager=memory_manager),
        "assistant": UserAssistantAgent(db=db, api_key=api_key, memory_manager=memory_manager),
        "operations": SystemOperationsAgent(db=db, api_key=api_key, memory_manager=memory_manager),
        "analytics": DataAnalyticsAgent(db=db, api_key=api_key, memory_manager=memory_manager)
    }


# ============== SINGLETON ==============

_agents_instance = None
_memory_manager_instance = None

def get_emergent_agents(db=None, api_key: str = None) -> Dict[str, EmergentAgent]:
    """Get or create singleton agent instances"""
    global _agents_instance, _memory_manager_instance
    
    if _agents_instance is None:
        _memory_manager_instance = PersistentMemoryManager(db)
        _agents_instance = {
            "business": BusinessIntelligenceAgent(db=db, api_key=api_key, memory_manager=_memory_manager_instance),
            "assistant": UserAssistantAgent(db=db, api_key=api_key, memory_manager=_memory_manager_instance),
            "operations": SystemOperationsAgent(db=db, api_key=api_key, memory_manager=_memory_manager_instance),
            "analytics": DataAnalyticsAgent(db=db, api_key=api_key, memory_manager=_memory_manager_instance)
        }
    
    return _agents_instance

def get_memory_manager() -> PersistentMemoryManager:
    """Get the shared memory manager"""
    global _memory_manager_instance
    return _memory_manager_instance


# ============== AGENT COLLABORATION HUB ==============

class AgentCollaborationHub:
    """
    Central hub for agent-to-agent communication and collaboration.
    
    Features:
    - Agent-to-agent messaging
    - Task delegation
    - Collaborative problem solving
    - Cross-agent memory sharing
    - Workflow orchestration
    """
    
    def __init__(self, agents: Dict[str, 'EmergentAgent'] = None, db=None):
        self.agents = agents or {}
        self.db = db
        self.message_queue = []
        self.collaboration_history = []
        self.active_collaborations = {}
        logger.info(f"Collaboration Hub initialized with {len(self.agents)} agents")
    
    def register_agent(self, agent_id: str, agent: 'EmergentAgent'):
        """Register an agent with the collaboration hub"""
        self.agents[agent_id] = agent
        logger.debug(f"Agent '{agent_id}' registered with Collaboration Hub")
    
    async def send_message(
        self,
        from_agent_id: str,
        to_agent_id: str,
        content: str,
        message_type: str = "request",
        data: Dict = None,
        request_id: str = None
    ) -> AgentCollaborationMessage:
        """Send a message from one agent to another"""
        if to_agent_id not in self.agents:
            raise ValueError(f"Target agent '{to_agent_id}' not found")
        
        message = AgentCollaborationMessage(
            from_agent=from_agent_id,
            to_agent=to_agent_id,
            message_type=message_type,
            content=content,
            data=data or {},
            request_id=request_id
        )
        
        self.message_queue.append(message)
        
        # Store in database
        if self.db is not None:
            await self.db.agent_collaboration_messages.insert_one(asdict(message))
        
        return message
    
    async def delegate_task(
        self,
        from_agent_id: str,
        to_agent_id: str,
        task_description: str,
        parameters: Dict = None,
        user_id: str = None,
        tenant_id: str = None
    ) -> AgentResponse:
        """
        Delegate a task from one agent to another.
        
        Returns the response from the delegated agent.
        """
        if to_agent_id not in self.agents:
            return AgentResponse(
                success=False,
                message=f"Cannot delegate: Agent '{to_agent_id}' not found",
                confidence=0.0
            )
        
        target_agent = self.agents[to_agent_id]
        
        # Create delegation record
        delegation_id = str(uuid.uuid4())
        
        # Send delegation message
        await self.send_message(
            from_agent_id=from_agent_id,
            to_agent_id=to_agent_id,
            content=task_description,
            message_type="delegation",
            data={
                "delegation_id": delegation_id,
                "parameters": parameters or {},
                "from_agent": from_agent_id
            }
        )
        
        # Process task with target agent
        context = {
            "delegated_from": from_agent_id,
            "delegation_id": delegation_id,
            **(parameters or {})
        }
        
        response = await target_agent.process(
            prompt=f"[Delegated from {from_agent_id}] {task_description}",
            user_id=user_id,
            tenant_id=tenant_id,
            context=context
        )
        
        # Record collaboration
        self.collaboration_history.append({
            "delegation_id": delegation_id,
            "from_agent": from_agent_id,
            "to_agent": to_agent_id,
            "task": task_description,
            "success": response.success,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        response.collaborated_with = [to_agent_id]
        
        return response
    
    async def collaborate(
        self,
        lead_agent_id: str,
        prompt: str,
        involved_agents: List[str] = None,
        user_id: str = None,
        tenant_id: str = None
    ) -> AgentResponse:
        """
        Multi-agent collaboration on a complex task.
        
        The lead agent coordinates with other agents to solve the problem.
        """
        if lead_agent_id not in self.agents:
            return AgentResponse(
                success=False,
                message=f"Lead agent '{lead_agent_id}' not found",
                confidence=0.0
            )
        
        lead_agent = self.agents[lead_agent_id]
        collaboration_id = str(uuid.uuid4())
        
        # Determine which agents to involve
        if involved_agents is None:
            # Auto-select based on prompt keywords
            involved_agents = self._select_relevant_agents(prompt, exclude=lead_agent_id)
        
        # Store active collaboration
        self.active_collaborations[collaboration_id] = {
            "lead": lead_agent_id,
            "involved": involved_agents,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        
        # Gather input from involved agents
        agent_inputs = {}
        for agent_id in involved_agents[:3]:  # Limit to 3 for efficiency
            if agent_id in self.agents:
                agent = self.agents[agent_id]
                try:
                    input_response = await agent.process(
                        prompt=f"[Collaboration request from {lead_agent_id}] Provide your expertise on: {prompt}",
                        user_id=user_id,
                        tenant_id=tenant_id,
                        context={"collaboration_id": collaboration_id, "role": "contributor"}
                    )
                    agent_inputs[agent_id] = {
                        "message": input_response.message,
                        "data": input_response.data,
                        "confidence": input_response.confidence
                    }
                except Exception as e:
                    logger.error(f"Agent {agent_id} failed to contribute: {e}")
        
        # Lead agent synthesizes responses
        synthesis_prompt = f"""Original request: {prompt}

Input from collaborating agents:
{json.dumps(agent_inputs, indent=2)}

Synthesize these inputs into a comprehensive response."""
        
        final_response = await lead_agent.process(
            prompt=synthesis_prompt,
            user_id=user_id,
            tenant_id=tenant_id,
            context={
                "collaboration_id": collaboration_id,
                "role": "lead",
                "agent_inputs": agent_inputs
            }
        )
        
        # Update collaboration record
        self.active_collaborations[collaboration_id]["status"] = "completed"
        self.active_collaborations[collaboration_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        final_response.collaborated_with = list(agent_inputs.keys())
        final_response.delegation_results = agent_inputs
        
        return final_response
    
    def _select_relevant_agents(self, prompt: str, exclude: str = None) -> List[str]:
        """Auto-select relevant agents based on prompt keywords"""
        prompt_lower = prompt.lower()
        relevant = []
        
        # Keyword-based selection
        keywords_map = {
            "business": ["sales", "revenue", "forecast", "business", "profit", "loss", "report"],
            "analytics": ["analyze", "data", "pattern", "trend", "anomaly", "statistics"],
            "operations": ["system", "health", "error", "performance", "security", "monitor"],
            "assistant": ["help", "how", "what", "guide", "explain", "tutorial"]
        }
        
        for agent_id, keywords in keywords_map.items():
            if agent_id != exclude and any(kw in prompt_lower for kw in keywords):
                relevant.append(agent_id)
        
        # If no specific match, include all except excluded
        if not relevant:
            relevant = [aid for aid in self.agents.keys() if aid != exclude]
        
        return relevant[:3]  # Max 3 agents
    
    async def get_collaboration_history(self, limit: int = 50) -> List[Dict]:
        """Get recent collaboration history"""
        return self.collaboration_history[-limit:]
    
    async def get_active_collaborations(self) -> Dict:
        """Get currently active collaborations"""
        return {
            cid: data for cid, data in self.active_collaborations.items()
            if data.get("status") == "active"
        }


# ============== COLLABORATION HUB SINGLETON ==============

_collaboration_hub_instance = None

def get_collaboration_hub(agents: Dict[str, EmergentAgent] = None, db=None) -> AgentCollaborationHub:
    """Get or create singleton collaboration hub"""
    global _collaboration_hub_instance
    
    if _collaboration_hub_instance is None:
        _collaboration_hub_instance = AgentCollaborationHub(agents=agents, db=db)
    elif agents:
        # Update agents if provided
        for agent_id, agent in agents.items():
            _collaboration_hub_instance.register_agent(agent_id, agent)
    
    return _collaboration_hub_instance
