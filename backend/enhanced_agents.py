"""
Enhanced AI Agents System
=========================
Powerful AI agents designed to match Emergent AI Agent capabilities.
Each agent can handle complex prompts, learn from interactions,
and execute tasks autonomously.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from enum import Enum
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Try to import LLM
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_LLM = True
except ImportError:
    HAS_LLM = False
    logger.warning("LLM not available for enhanced agents")


class AgentCapability(Enum):
    """Define what agents can do"""
    ANALYZE = "analyze"
    GENERATE = "generate"
    EXECUTE = "execute"
    LEARN = "learn"
    DELEGATE = "delegate"
    MONITOR = "monitor"
    OPTIMIZE = "optimize"
    REPORT = "report"


@dataclass
class AgentResponse:
    """Standardized agent response"""
    success: bool
    message: str
    data: Dict = field(default_factory=dict)
    reasoning: str = ""
    suggestions: List[str] = field(default_factory=list)
    confidence: float = 0.0
    execution_time_ms: int = 0


class EnhancedBaseAgent:
    """
    Enhanced Base Agent with full autonomous capabilities.
    
    Features:
    - Natural language understanding for any prompt
    - Context-aware responses
    - Learning from interactions
    - Multi-step task execution
    - Error handling and recovery
    """
    
    def __init__(self, agent_id: str, agent_name: str, db=None, api_key: str = None):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.db = db
        self.api_key = api_key
        self.llm = None
        self.conversation_history = []
        self.learned_patterns = {}
        
        if HAS_LLM and api_key:
            try:
                self.llm = LlmChat(api_key=api_key, model="gpt-4o")
                logger.info(f"Enhanced Agent '{agent_name}' initialized with GPT-4o")
            except Exception as e:
                logger.warning(f"Failed to initialize LLM for {agent_name}: {e}")
    
    def get_system_prompt(self) -> str:
        """Override in subclasses for specialized behavior"""
        return f"""You are {self.agent_name}, an advanced AI agent capable of:
- Understanding complex natural language requests
- Breaking down tasks into actionable steps
- Providing detailed, accurate responses
- Learning from interactions
- Suggesting improvements and optimizations

Always respond in a structured JSON format:
{{
    "understanding": "What you understood from the request",
    "plan": ["Step 1", "Step 2", ...],
    "response": "Your detailed response",
    "data": {{}},
    "suggestions": ["Suggestion 1", ...],
    "confidence": 0.0-1.0
}}"""
    
    async def process(self, prompt: str, context: Dict = None) -> AgentResponse:
        """Process any prompt with AI-powered understanding"""
        start_time = datetime.now(timezone.utc)
        
        try:
            if self.llm:
                response = await self._process_with_llm(prompt, context)
            else:
                response = await self._process_with_rules(prompt, context)
            
            end_time = datetime.now(timezone.utc)
            response.execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
            
            # Store interaction for learning
            await self._learn_from_interaction(prompt, response)
            
            return response
            
        except Exception as e:
            logger.error(f"Agent {self.agent_name} error: {e}")
            return AgentResponse(
                success=False,
                message=f"Error processing request: {str(e)}",
                confidence=0.0
            )
    
    async def _process_with_llm(self, prompt: str, context: Dict = None) -> AgentResponse:
        """Process using LLM for intelligent responses"""
        system_prompt = self.get_system_prompt()
        
        # Add context if provided
        full_prompt = prompt
        if context:
            full_prompt = f"Context: {json.dumps(context)}\n\nRequest: {prompt}"
        
        # Add conversation history for continuity
        history_context = ""
        if self.conversation_history:
            recent = self.conversation_history[-5:]
            history_context = "\n\nRecent conversation:\n" + "\n".join([
                f"User: {h['prompt'][:100]}...\nAgent: {h['response'][:100]}..."
                for h in recent
            ])
        
        try:
            response = await self.llm.chat([
                UserMessage(content=f"{system_prompt}\n{history_context}\n\n{full_prompt}")
            ])
            
            # Parse JSON response
            try:
                result = json.loads(response.content)
                return AgentResponse(
                    success=True,
                    message=result.get("response", response.content),
                    data=result.get("data", {}),
                    reasoning=result.get("understanding", ""),
                    suggestions=result.get("suggestions", []),
                    confidence=result.get("confidence", 0.8)
                )
            except json.JSONDecodeError:
                return AgentResponse(
                    success=True,
                    message=response.content,
                    confidence=0.7
                )
                
        except Exception as e:
            logger.error(f"LLM processing failed: {e}")
            return await self._process_with_rules(prompt, context)
    
    async def _process_with_rules(self, prompt: str, context: Dict = None) -> AgentResponse:
        """Fallback rule-based processing"""
        return AgentResponse(
            success=True,
            message=f"Processed your request: {prompt[:100]}",
            reasoning="Used rule-based processing",
            suggestions=["Enable LLM for enhanced responses"],
            confidence=0.5
        )
    
    async def _learn_from_interaction(self, prompt: str, response: AgentResponse):
        """Store interaction for future learning"""
        self.conversation_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "prompt": prompt,
            "response": response.message,
            "success": response.success
        })
        
        # Keep only last 50 interactions
        if len(self.conversation_history) > 50:
            self.conversation_history = self.conversation_history[-50:]
        
        # Store in database for persistence
        if self.db and response.success:
            await self.db.agent_interactions.insert_one({
                "id": str(uuid.uuid4()),
                "agent_id": self.agent_id,
                "agent_name": self.agent_name,
                "prompt_hash": hash(prompt[:100]),
                "response_quality": response.confidence,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })


class EnhancedBusinessAgent(EnhancedBaseAgent):
    """
    Enhanced Business Intelligence Agent
    
    Capabilities:
    - Generate comprehensive business reports
    - Analyze sales patterns and trends
    - Forecast revenue and inventory
    - Provide strategic recommendations
    - Automate business workflows
    """
    
    def __init__(self, db=None, api_key: str = None):
        super().__init__(
            agent_id="business-agent-1",
            agent_name="Business Intelligence Agent",
            db=db,
            api_key=api_key
        )
    
    def get_system_prompt(self) -> str:
        return """You are an Expert Business Intelligence Agent for BijnisBooks.

CAPABILITIES:
1. ANALYZE: Sales data, customer behavior, inventory trends, financial metrics
2. GENERATE: Reports, forecasts, insights, recommendations
3. EXECUTE: Automated workflows, alerts, notifications
4. OPTIMIZE: Inventory levels, pricing, marketing strategies

EXPERTISE:
- Retail and multi-store management
- Inventory optimization
- Customer segmentation
- Revenue forecasting
- Trend analysis

When given a prompt, you will:
1. Understand the business context
2. Analyze relevant data points
3. Generate actionable insights
4. Provide specific recommendations

Respond in JSON format:
{
    "analysis_type": "sales|inventory|customer|financial|operational",
    "findings": ["Key finding 1", "Key finding 2"],
    "metrics": {"metric_name": value},
    "recommendations": ["Action 1", "Action 2"],
    "forecast": {"period": "next_month", "prediction": {}},
    "confidence": 0.0-1.0,
    "response": "Natural language summary"
}"""
    
    async def analyze_sales(self, period: str = "month", store_id: str = None) -> AgentResponse:
        """Analyze sales performance"""
        prompt = f"Analyze sales performance for {period}"
        if store_id:
            prompt += f" for store {store_id}"
        return await self.process(prompt, {"task": "sales_analysis", "period": period, "store_id": store_id})
    
    async def generate_report(self, report_type: str, parameters: Dict = None) -> AgentResponse:
        """Generate business report"""
        prompt = f"Generate a {report_type} report"
        return await self.process(prompt, {"task": "report_generation", "type": report_type, **(parameters or {})})
    
    async def forecast(self, metric: str, period: str = "30d") -> AgentResponse:
        """Forecast business metric"""
        prompt = f"Forecast {metric} for the next {period}"
        return await self.process(prompt, {"task": "forecasting", "metric": metric, "period": period})


class EnhancedAssistantAgent(EnhancedBaseAgent):
    """
    Enhanced User Assistant Agent
    
    Capabilities:
    - Answer any question about the application
    - Guide users through complex workflows
    - Troubleshoot issues
    - Provide personalized recommendations
    - Learn user preferences
    """
    
    def __init__(self, db=None, api_key: str = None):
        super().__init__(
            agent_id="assistant-agent-1",
            agent_name="User Assistant Agent",
            db=db,
            api_key=api_key
        )
    
    def get_system_prompt(self) -> str:
        return """You are a friendly and knowledgeable User Assistant for BijnisBooks.

YOUR ROLE:
- Help users accomplish any task in the application
- Answer questions clearly and concisely
- Provide step-by-step guidance
- Troubleshoot issues
- Suggest best practices

APPLICATION FEATURES:
- Multi-store management
- Inventory & stock control
- POS & billing
- Employee management
- Salary calculator
- Team chat
- Analytics & reports
- AutoHeal AI for error fixing

COMMUNICATION STYLE:
- Be friendly and professional
- Use simple language
- Provide examples when helpful
- Offer alternatives if something isn't possible
- Be proactive with suggestions

Respond in JSON format:
{
    "understanding": "What user is asking",
    "answer": "Direct answer to the question",
    "steps": ["Step 1", "Step 2"] // if applicable
    "tips": ["Helpful tip 1", "Tip 2"],
    "related_features": ["Feature that might help"],
    "confidence": 0.0-1.0
}"""
    
    async def help(self, question: str, user_context: Dict = None) -> AgentResponse:
        """Answer user questions"""
        return await self.process(question, {"task": "help", **(user_context or {})})
    
    async def guide(self, task: str) -> AgentResponse:
        """Provide step-by-step guidance"""
        prompt = f"Guide me through: {task}"
        return await self.process(prompt, {"task": "guidance"})
    
    async def troubleshoot(self, issue: str) -> AgentResponse:
        """Troubleshoot an issue"""
        prompt = f"Help me fix this issue: {issue}"
        return await self.process(prompt, {"task": "troubleshooting"})


class EnhancedOperationsAgent(EnhancedBaseAgent):
    """
    Enhanced System Operations Agent
    
    Capabilities:
    - Monitor system health
    - Auto-fix common errors
    - Optimize performance
    - Manage data integrity
    - Coordinate backups
    - Security monitoring
    """
    
    def __init__(self, db=None, api_key: str = None):
        super().__init__(
            agent_id="operations-agent-1",
            agent_name="System Operations Agent",
            db=db,
            api_key=api_key
        )
    
    def get_system_prompt(self) -> str:
        return """You are a System Operations Agent responsible for BijnisBooks infrastructure.

RESPONSIBILITIES:
1. MONITOR: System health, performance, errors, security
2. MAINTAIN: Data integrity, backups, cleanup
3. OPTIMIZE: Performance, resource usage, queries
4. SECURE: Access control, audit logs, threat detection
5. AUTOMATE: Routine tasks, maintenance, healing

CAPABILITIES:
- Real-time system monitoring
- Automatic error detection and healing (works with AutoHeal AI)
- Performance optimization suggestions
- Backup and recovery coordination
- Security audit and compliance

PRINCIPLES:
- System stability is top priority
- Never compromise data integrity
- Log all operations
- Escalate critical issues immediately
- Prefer safe, reversible actions

Respond in JSON format:
{
    "system_status": "healthy|degraded|critical",
    "issues_detected": [{"type": "", "severity": "", "description": ""}],
    "actions_taken": ["Action 1"],
    "recommendations": ["Recommendation 1"],
    "metrics": {"cpu": 0, "memory": 0, "errors_24h": 0},
    "confidence": 0.0-1.0
}"""
    
    async def health_check(self) -> AgentResponse:
        """Perform system health check"""
        return await self.process("Perform comprehensive system health check", {"task": "health_check"})
    
    async def optimize(self, target: str = "all") -> AgentResponse:
        """Optimize system performance"""
        return await self.process(f"Optimize {target} performance", {"task": "optimization", "target": target})
    
    async def audit(self, scope: str = "security") -> AgentResponse:
        """Perform system audit"""
        return await self.process(f"Perform {scope} audit", {"task": "audit", "scope": scope})


class EnhancedAnalyticsAgent(EnhancedBaseAgent):
    """
    Enhanced Data Analytics Agent
    
    Capabilities:
    - Deep data analysis
    - Pattern recognition
    - Predictive modeling
    - Custom report generation
    - Data visualization suggestions
    - Anomaly detection
    """
    
    def __init__(self, db=None, api_key: str = None):
        super().__init__(
            agent_id="analytics-agent-1",
            agent_name="Data Analytics Agent",
            db=db,
            api_key=api_key
        )
    
    def get_system_prompt(self) -> str:
        return """You are an Expert Data Analytics Agent specializing in business intelligence.

ANALYTICAL CAPABILITIES:
1. DESCRIPTIVE: What happened? Summarize data and trends
2. DIAGNOSTIC: Why did it happen? Root cause analysis
3. PREDICTIVE: What will happen? Forecasting and trends
4. PRESCRIPTIVE: What should we do? Recommendations

DATA DOMAINS:
- Sales and revenue
- Inventory and stock
- Customer behavior
- Employee performance
- Operational efficiency
- Financial metrics

TECHNIQUES:
- Statistical analysis
- Trend detection
- Anomaly identification
- Correlation analysis
- Cohort analysis
- Segmentation

OUTPUT FORMATS:
- Natural language summaries
- Key metrics and KPIs
- Visualizable data structures
- Actionable insights

Respond in JSON format:
{
    "analysis_summary": "High-level findings",
    "key_metrics": {"metric": value},
    "trends": [{"name": "", "direction": "up|down|stable", "significance": ""}],
    "anomalies": [{"description": "", "severity": ""}],
    "insights": ["Insight 1", "Insight 2"],
    "recommendations": ["Action 1"],
    "visualization_suggestions": [{"type": "chart_type", "data_fields": []}],
    "confidence": 0.0-1.0
}"""
    
    async def analyze(self, data_type: str, query: str = None) -> AgentResponse:
        """Perform data analysis"""
        prompt = f"Analyze {data_type} data"
        if query:
            prompt += f": {query}"
        return await self.process(prompt, {"task": "analysis", "data_type": data_type})
    
    async def detect_anomalies(self, data_source: str) -> AgentResponse:
        """Detect anomalies in data"""
        return await self.process(f"Detect anomalies in {data_source}", {"task": "anomaly_detection"})
    
    async def generate_insights(self, topic: str) -> AgentResponse:
        """Generate insights on a topic"""
        return await self.process(f"Generate insights about {topic}", {"task": "insight_generation"})


# Factory function to create all agents
def create_enhanced_agents(db=None, api_key: str = None) -> Dict[str, EnhancedBaseAgent]:
    """Create all enhanced agents"""
    return {
        "business": EnhancedBusinessAgent(db=db, api_key=api_key),
        "assistant": EnhancedAssistantAgent(db=db, api_key=api_key),
        "operations": EnhancedOperationsAgent(db=db, api_key=api_key),
        "analytics": EnhancedAnalyticsAgent(db=db, api_key=api_key)
    }
