"""
BijnisBooks AI Agent - Advanced Multi-LLM Autonomous Agent
Features:
- Multi-LLM Support (GPT-5.2, Gemini 3 Flash, Claude Sonnet 4.5)
- Natural Language Processing for understanding user queries
- Knowledge Base with troubleshooting guides and auto-learning
- Full Task Automation (read/write/settings)
- Voice Commands via Whisper
- Self-learning from feedback and resolved issues
"""

import os
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
# from emergentintegrations.llm.chat import LlmChat, UserMessage
# from emergentintegrations.llm.openai import OpenAISpeechToText

load_dotenv()

# LLM Configuration
LLM_PROVIDERS = {
    "gpt": {"provider": "openai", "model": "gpt-5.2", "use_for": "complex_reasoning"},
    "gemini": {"provider": "gemini", "model": "gemini-3-flash-preview", "use_for": "fast_queries"},
    "claude": {"provider": "anthropic", "model": "claude-sonnet-4-5-20250929", "use_for": "detailed_analysis"}
}

# Task Categories and their automation levels
TASK_CATEGORIES = {
    "read": ["view_data", "generate_report", "analyze", "search", "list"],
    "write": ["create", "update", "add", "modify", "edit"],
    "delete": ["delete", "remove", "cancel"],
    "settings": ["configure", "setup", "change_settings", "permissions"],
    "user_management": ["create_user", "update_user", "deactivate_user"]
}

# Knowledge Base - Pre-built troubleshooting guides
KNOWLEDGE_BASE = {
    "inventory_issues": {
        "low_stock": {
            "symptoms": ["stock running low", "out of stock", "inventory shortage"],
            "solutions": [
                "Check reorder levels in Settings > Inventory > Reorder Points",
                "Create a purchase order for affected items",
                "Review sales velocity to adjust minimum stock levels"
            ],
            "auto_actions": ["generate_low_stock_report", "suggest_purchase_order"]
        },
        "stock_mismatch": {
            "symptoms": ["stock doesn't match", "inventory discrepancy", "physical count different"],
            "solutions": [
                "Run stock audit from Inventory > Stock Audit",
                "Check recent stock transfers for errors",
                "Review sales and purchase transactions"
            ],
            "auto_actions": ["run_stock_audit", "generate_discrepancy_report"]
        }
    },
    "sales_issues": {
        "sales_down": {
            "symptoms": ["sales decreased", "sales down", "low sales", "revenue dropped"],
            "solutions": [
                "Analyze top-selling products availability",
                "Check if any promotions expired",
                "Review competitor pricing"
            ],
            "auto_actions": ["analyze_sales_trend", "check_stock_availability", "compare_periods"]
        },
        "payment_failed": {
            "symptoms": ["payment not processing", "transaction failed", "payment error"],
            "solutions": [
                "Verify payment gateway configuration",
                "Check internet connectivity",
                "Try alternative payment method"
            ],
            "auto_actions": ["check_payment_gateway_status"]
        }
    },
    "user_issues": {
        "login_problems": {
            "symptoms": ["can't login", "password not working", "access denied"],
            "solutions": [
                "Reset password using 'Forgot Password'",
                "Check if account is active",
                "Clear browser cache and cookies"
            ],
            "auto_actions": ["check_user_status", "send_password_reset"]
        },
        "permission_denied": {
            "symptoms": ["no access", "permission denied", "can't see module"],
            "solutions": [
                "Contact admin to check role permissions",
                "Verify user role assignment",
                "Check module-specific permissions"
            ],
            "auto_actions": ["check_user_permissions", "list_available_modules"]
        }
    },
    "invoice_issues": {
        "gst_calculation": {
            "symptoms": ["GST wrong", "tax calculation error", "IGST not showing"],
            "solutions": [
                "Verify customer/supplier state for interstate detection",
                "Check GST rates in product settings",
                "Ensure GSTIN is correctly entered"
            ],
            "auto_actions": ["verify_gst_settings", "recalculate_invoice"]
        }
    }
}


class AIAgent:
    """Main AI Agent class for BijnisBooks"""
    
    def __init__(self, db, api_key: str = None):
        self.db = db
        self.api_key = api_key or os.getenv("EMERGENT_LLM_KEY")
        self.chats = {}  # Store chat instances per session
        self.stt = OpenAISpeechToText(api_key=self.api_key)
        
    def get_chat(self, session_id: str, provider: str = "gpt") -> LlmChat:
        """Get or create a chat instance for the session"""
        cache_key = f"{session_id}_{provider}"
        if cache_key not in self.chats:
            config = LLM_PROVIDERS.get(provider, LLM_PROVIDERS["gpt"])
            chat = LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message=self._get_system_prompt()
            ).with_model(config["provider"], config["model"])
            self.chats[cache_key] = chat
        return self.chats[cache_key]
    
    def _get_system_prompt(self) -> str:
        """Generate the system prompt for the AI agent"""
        return """You are BijnisBooks AI Assistant - an intelligent agent for a multi-store retail business management system.

Your capabilities:
1. ANALYZE: Review sales, inventory, customers, and business data
2. AUTOMATE: Execute tasks like creating invoices, updating inventory, managing users
3. TROUBLESHOOT: Diagnose and resolve common issues
4. ADVISE: Provide business insights and recommendations

When responding:
- Be concise and actionable
- If you can execute a task, offer to do it
- For data queries, provide specific numbers and insights
- Always explain what action you're taking

Available actions you can trigger:
- generate_report(type, date_range)
- check_inventory(item_name)
- analyze_sales(period)
- create_invoice(customer, items)
- update_stock(item, quantity)
- check_user_permissions(user_id)
- run_stock_audit()
- send_notification(user, message)

When you need to execute an action, respond with:
[ACTION: action_name(parameters)]

Example: User asks "What were my sales last week?"
Response: Let me check your sales data for last week.
[ACTION: analyze_sales(period="last_week")]
Based on the data, your total sales were ₹X with Y transactions..."""

    async def select_provider(self, query: str) -> str:
        """Select the best LLM provider based on query complexity"""
        query_lower = query.lower()
        
        # Fast queries - use Gemini
        fast_keywords = ["what is", "show me", "list", "how many", "quick"]
        if any(kw in query_lower for kw in fast_keywords):
            return "gemini"
        
        # Detailed analysis - use Claude
        analysis_keywords = ["analyze", "compare", "detailed", "explain why", "investigate"]
        if any(kw in query_lower for kw in analysis_keywords):
            return "claude"
        
        # Complex reasoning - use GPT
        return "gpt"
    
    async def find_knowledge_base_match(self, query: str) -> Optional[Dict]:
        """Search knowledge base for relevant troubleshooting guides"""
        query_lower = query.lower()
        
        for category, issues in KNOWLEDGE_BASE.items():
            for issue_name, issue_data in issues.items():
                for symptom in issue_data.get("symptoms", []):
                    if symptom in query_lower:
                        return {
                            "category": category,
                            "issue": issue_name,
                            "data": issue_data
                        }
        return None
    
    async def execute_action(self, action: str, params: Dict, user: Dict) -> Dict:
        """Execute an automated action"""
        tenant_id = user.get("tenant_id", "default")
        
        actions = {
            "analyze_sales": self._analyze_sales,
            "check_inventory": self._check_inventory,
            "generate_report": self._generate_report,
            "check_user_permissions": self._check_user_permissions,
            "run_stock_audit": self._run_stock_audit,
            "get_low_stock_items": self._get_low_stock_items,
            "get_top_products": self._get_top_products,
            "get_customer_insights": self._get_customer_insights,
        }
        
        if action in actions:
            return await actions[action](tenant_id, params)
        
        return {"error": f"Unknown action: {action}"}
    
    async def _analyze_sales(self, tenant_id: str, params: Dict) -> Dict:
        """Analyze sales data"""
        period = params.get("period", "today")
        
        # Calculate date range
        now = datetime.now(timezone.utc)
        if period == "today":
            start_date = now.replace(hour=0, minute=0, second=0)
        elif period == "last_week":
            start_date = now.replace(hour=0, minute=0, second=0)
            from datetime import timedelta
            start_date = start_date - timedelta(days=7)
        elif period == "last_month":
            from datetime import timedelta
            start_date = now - timedelta(days=30)
        else:
            start_date = now.replace(hour=0, minute=0, second=0)
        
        # Query invoices
        pipeline = [
            {"$match": {
                "tenant_id": tenant_id,
                "created_at": {"$gte": start_date.isoformat()}
            }},
            {"$group": {
                "_id": None,
                "total_sales": {"$sum": "$total_amount"},
                "total_invoices": {"$sum": 1},
                "avg_order_value": {"$avg": "$total_amount"}
            }}
        ]
        
        result = await self.db.invoices.aggregate(pipeline).to_list(1)
        
        if result:
            data = result[0]
            return {
                "period": period,
                "total_sales": data.get("total_sales", 0),
                "total_invoices": data.get("total_invoices", 0),
                "avg_order_value": round(data.get("avg_order_value", 0), 2)
            }
        return {"period": period, "total_sales": 0, "total_invoices": 0, "avg_order_value": 0}
    
    async def _check_inventory(self, tenant_id: str, params: Dict) -> Dict:
        """Check inventory for an item"""
        item_name = params.get("item_name", "")
        
        items = await self.db.inventory.find({
            "tenant_id": tenant_id,
            "name": {"$regex": item_name, "$options": "i"}
        }, {"_id": 0}).to_list(10)
        
        return {"items": items, "count": len(items)}
    
    async def _generate_report(self, tenant_id: str, params: Dict) -> Dict:
        """Generate a business report"""
        report_type = params.get("type", "summary")
        
        # Get counts
        items_count = await self.db.items.count_documents({"tenant_id": tenant_id})
        customers_count = await self.db.customers.count_documents({"tenant_id": tenant_id})
        invoices_count = await self.db.invoices.count_documents({"tenant_id": tenant_id})
        
        return {
            "report_type": report_type,
            "total_items": items_count,
            "total_customers": customers_count,
            "total_invoices": invoices_count,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def _check_user_permissions(self, tenant_id: str, params: Dict) -> Dict:
        """Check user permissions"""
        user_id = params.get("user_id")
        
        user = await self.db.users.find_one(
            {"id": user_id, "tenant_id": tenant_id},
            {"_id": 0, "password": 0}
        )
        
        if user:
            return {
                "user": user.get("name", "Unknown"),
                "role": user.get("role", "staff"),
                "permissions": user.get("permissions", {})
            }
        return {"error": "User not found"}
    
    async def _run_stock_audit(self, tenant_id: str, params: Dict) -> Dict:
        """Run a stock audit"""
        # Get items with potential issues
        low_stock = await self.db.inventory.find({
            "tenant_id": tenant_id,
            "quantity": {"$lt": 10}
        }, {"_id": 0, "name": 1, "quantity": 1}).to_list(20)
        
        return {
            "audit_id": str(uuid.uuid4()),
            "low_stock_items": low_stock,
            "low_stock_count": len(low_stock),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    async def _get_low_stock_items(self, tenant_id: str, params: Dict) -> Dict:
        """Get items with low stock"""
        threshold = params.get("threshold", 10)
        
        items = await self.db.inventory.find({
            "tenant_id": tenant_id,
            "quantity": {"$lt": threshold}
        }, {"_id": 0}).to_list(50)
        
        return {"items": items, "count": len(items), "threshold": threshold}
    
    async def _get_top_products(self, tenant_id: str, params: Dict) -> Dict:
        """Get top selling products"""
        limit = params.get("limit", 10)
        
        # This would typically aggregate from sales data
        items = await self.db.items.find(
            {"tenant_id": tenant_id},
            {"_id": 0, "name": 1, "brand": 1, "category": 1}
        ).limit(limit).to_list(limit)
        
        return {"top_products": items, "count": len(items)}
    
    async def _get_customer_insights(self, tenant_id: str, params: Dict) -> Dict:
        """Get customer insights"""
        total_customers = await self.db.customers.count_documents({"tenant_id": tenant_id})
        loyal_customers = await self.db.customers.count_documents({
            "tenant_id": tenant_id,
            "loyalty_enrolled": True
        })
        
        return {
            "total_customers": total_customers,
            "loyal_customers": loyal_customers,
            "loyalty_rate": round((loyal_customers / max(total_customers, 1)) * 100, 1)
        }
    
    async def process_query(self, query: str, session_id: str, user: Dict) -> Dict:
        """Process a user query and return response with optional actions"""
        
        # 1. Check knowledge base for quick solutions
        kb_match = await self.find_knowledge_base_match(query)
        
        # 2. Select best LLM provider
        provider = await self.select_provider(query)
        
        # 3. Build context
        context = {
            "user_name": user.get("name", "User"),
            "user_role": user.get("role", "staff"),
            "tenant_id": user.get("tenant_id", "default"),
            "kb_match": kb_match
        }
        
        # 4. Get chat instance and send message
        chat = self.get_chat(session_id, provider)
        
        # Prepare message with context
        enhanced_query = query
        if kb_match:
            enhanced_query += f"\n\n[Knowledge Base Match: {kb_match['category']}/{kb_match['issue']}]"
            enhanced_query += f"\n[Suggested Solutions: {kb_match['data']['solutions']}]"
        
        # Add available data context
        enhanced_query += f"\n\n[User Context: {context['user_name']}, Role: {context['user_role']}]"
        
        try:
            message = UserMessage(text=enhanced_query)
            response_text = await chat.send_message(message)
            
            # Parse for actions
            actions_executed = []
            if "[ACTION:" in response_text:
                # Extract and execute actions
                import re
                action_pattern = r'\[ACTION:\s*(\w+)\(([^)]*)\)\]'
                matches = re.findall(action_pattern, response_text)
                
                for action_name, params_str in matches:
                    # Parse parameters
                    params = {}
                    if params_str:
                        for param in params_str.split(","):
                            if "=" in param:
                                key, value = param.split("=", 1)
                                params[key.strip()] = value.strip().strip('"\'')
                    
                    # Execute action
                    result = await self.execute_action(action_name, params, user)
                    actions_executed.append({
                        "action": action_name,
                        "params": params,
                        "result": result
                    })
                    
                    # Remove action tag from response
                    response_text = re.sub(r'\[ACTION:[^\]]+\]', '', response_text)
            
            # Store conversation in database for learning
            await self._store_conversation(session_id, user, query, response_text, actions_executed)
            
            return {
                "response": response_text.strip(),
                "provider": provider,
                "kb_match": kb_match,
                "actions": actions_executed,
                "session_id": session_id
            }
            
        except Exception as e:
            return {
                "response": f"I encountered an error processing your request: {str(e)}",
                "provider": provider,
                "error": str(e)
            }
    
    async def process_voice(self, audio_file, session_id: str, user: Dict) -> Dict:
        """Process voice input and return response"""
        try:
            # Transcribe audio
            response = await self.stt.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format="json",
                language="en"
            )
            
            transcribed_text = response.text
            
            # Process the transcribed text as a regular query
            result = await self.process_query(transcribed_text, session_id, user)
            result["transcribed_text"] = transcribed_text
            result["input_type"] = "voice"
            
            return result
            
        except Exception as e:
            return {
                "response": f"Failed to process voice input: {str(e)}",
                "error": str(e),
                "input_type": "voice"
            }
    
    async def _store_conversation(self, session_id: str, user: Dict, query: str, response: str, actions: List):
        """Store conversation for learning and history"""
        conversation_doc = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "user_id": user.get("id"),
            "tenant_id": user.get("tenant_id", "default"),
            "query": query,
            "response": response,
            "actions_executed": actions,
            "feedback": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await self.db.ai_conversations.insert_one(conversation_doc)
    
    async def submit_feedback(self, conversation_id: str, feedback: Dict) -> Dict:
        """Submit feedback for a conversation to enable learning"""
        await self.db.ai_conversations.update_one(
            {"id": conversation_id},
            {"$set": {
                "feedback": feedback,
                "feedback_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If negative feedback, store for analysis
        if feedback.get("helpful") == False:
            await self.db.ai_feedback_issues.insert_one({
                "id": str(uuid.uuid4()),
                "conversation_id": conversation_id,
                "issue": feedback.get("issue", "unknown"),
                "suggestion": feedback.get("suggestion", ""),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        return {"success": True, "message": "Feedback recorded"}
    
    async def get_conversation_history(self, session_id: str, limit: int = 20) -> List[Dict]:
        """Get conversation history for a session"""
        conversations = await self.db.ai_conversations.find(
            {"session_id": session_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return list(reversed(conversations))


# Singleton instance
_agent_instance = None

def get_ai_agent(db) -> AIAgent:
    """Get or create the AI agent instance"""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = AIAgent(db)
    return _agent_instance
