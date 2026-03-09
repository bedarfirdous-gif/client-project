"""
AI Business Agent System
=========================
A dedicated AI agent for business analysis, poster generation, and strategic advice.

Features:
- Multi-model support (GPT-5.2, Gemini 3 Flash)
- Image generation (Gemini Nano Banana, OpenAI GPT Image 1)
- Business analysis and loophole identification
- Poster and catalogue generation
- Persistent chat history with sessions
- AI-powered insights dashboard
"""

import os
import uuid
import base64
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum
from dotenv import load_dotenv

load_dotenv()

# Import LLM integrations
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
    EMERGENT_AVAILABLE = True
except ImportError:
    EMERGENT_AVAILABLE = False

# ============== ENUMS ==============

class AIModel(str, Enum):
    GPT_5_2 = "gpt-5.2"
    GEMINI_3_FLASH = "gemini-3-flash-preview"

class ImageModel(str, Enum):
    NANO_BANANA = "gemini-3-pro-image-preview"
    GPT_IMAGE_1 = "gpt-image-1"

class ChatType(str, Enum):
    GENERAL = "general"
    BUSINESS_ANALYSIS = "business_analysis"
    POSTER_GENERATION = "poster_generation"
    STRATEGY = "strategy"

class InsightType(str, Enum):
    LOOPHOLE = "loophole"
    OPPORTUNITY = "opportunity"
    RECOMMENDATION = "recommendation"
    WARNING = "warning"

# ============== PYDANTIC MODELS ==============

class ChatMessage(BaseModel):
    """Single chat message"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    chat_type: ChatType = ChatType.GENERAL
    model_used: Optional[str] = None
    metadata: Dict[str, Any] = {}

class ChatSession(BaseModel):
    """Chat session with history"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    user_id: str
    title: str = "New Chat"
    chat_type: ChatType = ChatType.GENERAL
    messages: List[ChatMessage] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_active: bool = True

class ChatRequest(BaseModel):
    """Request to send a chat message"""
    session_id: Optional[str] = None
    message: str
    chat_type: ChatType = ChatType.GENERAL
    model: AIModel = AIModel.GPT_5_2
    include_context: bool = True  # Include business context

class PosterGenerationRequest(BaseModel):
    """Request to generate a poster"""
    prompt: str
    style: str = "professional"  # professional, vibrant, minimal, festive
    format: str = "instagram_post"  # instagram_post, instagram_story, facebook_post, whatsapp_status
    image_model: ImageModel = ImageModel.NANO_BANANA
    include_business_name: bool = True
    colors: List[str] = []

class BusinessInsight(BaseModel):
    """AI-generated business insight"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    insight_type: InsightType
    title: str
    description: str
    impact: str  # "high", "medium", "low"
    category: str  # "sales", "inventory", "customers", "operations", "marketing"
    recommendations: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_read: bool = False
    is_dismissed: bool = False

# ============== FORMAT DIMENSIONS ==============

FORMAT_DIMENSIONS = {
    "instagram_post": {"width": 1080, "height": 1080},
    "instagram_story": {"width": 1080, "height": 1920},
    "facebook_post": {"width": 1200, "height": 630},
    "whatsapp_status": {"width": 1080, "height": 1920},
    "catalogue": {"width": 1200, "height": 1600}
}

# ============== SYSTEM PROMPTS ==============

BUSINESS_ANALYST_PROMPT = """You are an expert AI Business Analyst for retail and commerce businesses. Your role is to:

1. **Analyze Business Data**: Identify patterns, trends, and anomalies in sales, inventory, and customer data.

2. **Identify Loopholes**: Find operational inefficiencies, revenue leaks, inventory issues, pricing problems, and process gaps.

3. **Provide Strategic Advice**: Offer actionable recommendations to improve revenue, reduce costs, and optimize operations.

4. **Marketing Insights**: Suggest marketing strategies, campaigns, and customer engagement tactics.

When responding:
- Be specific and actionable
- Use data-driven insights when available
- Prioritize high-impact recommendations
- Consider the Indian retail market context
- Format responses clearly with headers and bullet points

Current Business Context:
{business_context}
"""

POSTER_CREATOR_PROMPT = """You are a creative marketing poster designer. Create compelling image descriptions for retail marketing posters.

When creating poster descriptions:
- Focus on eye-catching visuals
- Include brand elements
- Consider the target audience (Indian retail customers)
- Make it suitable for social media
- Ensure the design is professional yet appealing

Format: {format}
Style: {style}
Business: {business_name}
"""

# ============== AI AGENT SYSTEM CLASS ==============

class AIAgentSystem:
    """Main AI Agent System for business analysis and content generation"""
    
    def __init__(self, db, emergent_api_key: str = None):
        self.db = db
        self.api_key = emergent_api_key or os.environ.get('EMERGENT_LLM_KEY')
        
    async def get_business_context(self, tenant_id: str) -> Dict[str, Any]:
        """Fetch relevant business data for AI context"""
        context = {
            "tenant_id": tenant_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            # Get store count
            stores = await self.db.stores.count_documents({"tenant_id": tenant_id})
            context["total_stores"] = stores
            
            # Get product count
            products = await self.db.items.count_documents({"tenant_id": tenant_id, "active": True})
            context["total_products"] = products
            
            # Get customer count
            customers = await self.db.customers.count_documents({"tenant_id": tenant_id})
            context["total_customers"] = customers
            
            # Get today's sales
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            today_sales = await self.db.sales.find(
                {"tenant_id": tenant_id, "created_at": {"$regex": f"^{today}"}}
            ).to_list(1000)
            context["today_sales_count"] = len(today_sales)
            context["today_revenue"] = sum(s.get("total_amount", 0) for s in today_sales)
            
            # Get low stock items
            low_stock = await self.db.items.count_documents({
                "tenant_id": tenant_id,
                "active": True,
                "$expr": {"$lte": ["$current_stock", "$min_stock_alert"]}
            })
            context["low_stock_items"] = low_stock
            
            # Get recent sales trends (last 7 days)
            week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            weekly_sales = await self.db.sales.find({
                "tenant_id": tenant_id,
                "created_at": {"$gte": week_ago}
            }).to_list(5000)
            context["weekly_sales_count"] = len(weekly_sales)
            context["weekly_revenue"] = sum(s.get("total_amount", 0) for s in weekly_sales)
            
            # Get top selling products
            sales_by_item = {}
            for sale in weekly_sales:
                for item in sale.get("items", []):
                    item_id = item.get("item_id", "unknown")
                    if item_id not in sales_by_item:
                        sales_by_item[item_id] = {"quantity": 0, "revenue": 0}
                    sales_by_item[item_id]["quantity"] += item.get("quantity", 0)
                    sales_by_item[item_id]["revenue"] += item.get("total", 0)
            
            top_products = sorted(sales_by_item.items(), key=lambda x: x[1]["revenue"], reverse=True)[:5]
            context["top_products"] = top_products
            
            # Get employee count
            employees = await self.db.employees.count_documents({"tenant_id": tenant_id, "is_active": True})
            context["total_employees"] = employees
            
            # Get subscription info
            subscription = await self.db.subscriptions.find_one({"tenant_id": tenant_id, "status": "active"})
            if subscription:
                context["current_plan"] = subscription.get("plan_code", "free")
            else:
                context["current_plan"] = "free"
                
        except Exception as e:
            context["error"] = str(e)
            
        return context
    
    async def create_chat_session(self, tenant_id: str, user_id: str, chat_type: ChatType = ChatType.GENERAL) -> Dict[str, Any]:
        """Create a new chat session"""
        session = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "title": f"New {chat_type.value.replace('_', ' ').title()} Chat",
            "chat_type": chat_type.value,
            "messages": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True
        }
        
        await self.db.ai_chat_sessions.insert_one(session)
        session.pop("_id", None)
        return session
    
    async def get_chat_session(self, session_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get an existing chat session"""
        session = await self.db.ai_chat_sessions.find_one(
            {"id": session_id, "tenant_id": tenant_id},
            {"_id": 0}
        )
        return session
    
    async def list_chat_sessions(self, tenant_id: str, user_id: str = None, limit: int = 20) -> List[Dict[str, Any]]:
        """List chat sessions for a user"""
        query = {"tenant_id": tenant_id, "is_active": True}
        if user_id:
            query["user_id"] = user_id
            
        sessions = await self.db.ai_chat_sessions.find(
            query,
            {"_id": 0, "messages": 0}  # Exclude messages for list view
        ).sort("updated_at", -1).limit(limit).to_list(limit)
        
        return sessions
    
    async def send_message(
        self, 
        tenant_id: str, 
        user_id: str,
        request: ChatRequest
    ) -> Dict[str, Any]:
        """Send a message and get AI response"""
        
        if not EMERGENT_AVAILABLE:
            return {
                "error": "AI integration not available. Please install emergentintegrations library.",
                "response": "AI features are currently unavailable."
            }
        
        # Get or create session
        session_id = request.session_id
        if not session_id:
            session = await self.create_chat_session(tenant_id, user_id, request.chat_type)
            session_id = session["id"]
        else:
            session = await self.get_chat_session(session_id, tenant_id)
            if not session:
                session = await self.create_chat_session(tenant_id, user_id, request.chat_type)
                session_id = session["id"]
        
        # Get business context if needed
        business_context = ""
        if request.include_context:
            context_data = await self.get_business_context(tenant_id)
            business_context = f"""
Business Overview:
- Stores: {context_data.get('total_stores', 0)}
- Products: {context_data.get('total_products', 0)}
- Customers: {context_data.get('total_customers', 0)}
- Employees: {context_data.get('total_employees', 0)}
- Current Plan: {context_data.get('current_plan', 'free')}

Today's Performance:
- Sales: {context_data.get('today_sales_count', 0)} orders
- Revenue: ₹{context_data.get('today_revenue', 0):,.2f}

Weekly Performance:
- Sales: {context_data.get('weekly_sales_count', 0)} orders
- Revenue: ₹{context_data.get('weekly_revenue', 0):,.2f}

Alerts:
- Low Stock Items: {context_data.get('low_stock_items', 0)}
"""
        
        # Build system prompt
        system_prompt = BUSINESS_ANALYST_PROMPT.format(business_context=business_context)
        
        try:
            # Initialize LLM Chat
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"{tenant_id}_{session_id}",
                system_message=system_prompt
            )
            
            # Set the model based on request
            if request.model == AIModel.GPT_5_2:
                chat.with_model("openai", "gpt-5.2")
            else:
                chat.with_model("gemini", "gemini-3-flash-preview")
            
            # Create user message
            user_message = UserMessage(text=request.message)
            
            # Send message and get response
            response = await chat.send_message(user_message)
            
            # Create message records
            user_msg = {
                "id": str(uuid.uuid4()),
                "role": "user",
                "content": request.message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "chat_type": request.chat_type.value
            }
            
            assistant_msg = {
                "id": str(uuid.uuid4()),
                "role": "assistant",
                "content": response,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "chat_type": request.chat_type.value,
                "model_used": request.model.value
            }
            
            # Update session with new messages
            await self.db.ai_chat_sessions.update_one(
                {"id": session_id},
                {
                    "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
                    "$set": {
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "title": request.message[:50] + "..." if len(request.message) > 50 else request.message
                    }
                }
            )
            
            return {
                "session_id": session_id,
                "user_message": user_msg,
                "assistant_message": assistant_msg,
                "model_used": request.model.value
            }
            
        except Exception as e:
            # Return error response
            error_msg = {
                "id": str(uuid.uuid4()),
                "role": "assistant",
                "content": f"I apologize, but I encountered an error: {str(e)}. Please try again.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "chat_type": request.chat_type.value,
                "error": True
            }
            
            return {
                "session_id": session_id,
                "assistant_message": error_msg,
                "error": str(e)
            }
    
    async def generate_poster_image(
        self, 
        tenant_id: str,
        request: PosterGenerationRequest
    ) -> Dict[str, Any]:
        """Generate a marketing poster using AI"""
        
        if not EMERGENT_AVAILABLE:
            return {
                "error": "AI integration not available",
                "success": False
            }
        
        # Get business name
        tenant = await self.db.users.find_one({"tenant_id": tenant_id, "role": "admin"})
        business_name = tenant.get("name", "Your Business") if tenant else "Your Business"
        
        # Get format dimensions
        dimensions = FORMAT_DIMENSIONS.get(request.format, FORMAT_DIMENSIONS["instagram_post"])
        
        # Build enhanced prompt
        enhanced_prompt = f"""Create a professional marketing poster with the following specifications:

Theme: {request.prompt}
Style: {request.style}
Dimensions: {dimensions['width']}x{dimensions['height']} pixels
{"Business Name to include: " + business_name if request.include_business_name else ""}
{"Color scheme: " + ", ".join(request.colors) if request.colors else "Use vibrant, eye-catching colors"}

Design requirements:
- High-quality, professional marketing poster
- Clear, readable text
- Modern design aesthetic
- Suitable for {request.format.replace('_', ' ')}
- Appealing to Indian retail customers
- Include call-to-action elements
"""
        
        try:
            if request.image_model == ImageModel.NANO_BANANA:
                # Use Gemini Nano Banana
                chat = LlmChat(
                    api_key=self.api_key,
                    session_id=f"poster_{tenant_id}_{uuid.uuid4()}",
                    system_message="You are a professional graphic designer creating marketing materials."
                )
                chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
                
                msg = UserMessage(text=enhanced_prompt)
                text_response, images = await chat.send_message_multimodal_response(msg)
                
                if images and len(images) > 0:
                    image_data = images[0]
                    return {
                        "success": True,
                        "image_base64": image_data.get("data"),
                        "mime_type": image_data.get("mime_type", "image/png"),
                        "text_response": text_response,
                        "model_used": "gemini-3-pro-image-preview",
                        "format": request.format
                    }
                else:
                    return {
                        "success": False,
                        "error": "No image was generated",
                        "text_response": text_response
                    }
                    
            else:
                # Use OpenAI GPT Image 1
                image_gen = OpenAIImageGeneration(api_key=self.api_key)
                images = await image_gen.generate_images(
                    prompt=enhanced_prompt,
                    model="gpt-image-1",
                    number_of_images=1
                )
                
                if images and len(images) > 0:
                    image_base64 = base64.b64encode(images[0]).decode('utf-8')
                    return {
                        "success": True,
                        "image_base64": image_base64,
                        "mime_type": "image/png",
                        "model_used": "gpt-image-1",
                        "format": request.format
                    }
                else:
                    return {
                        "success": False,
                        "error": "No image was generated"
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def generate_business_insights(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Generate AI-powered business insights"""
        
        # Get business context
        context = await self.get_business_context(tenant_id)
        
        insights = []
        
        # Low stock alert
        if context.get("low_stock_items", 0) > 0:
            insights.append({
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "insight_type": "warning",
                "title": "Low Stock Alert",
                "description": f"You have {context['low_stock_items']} items running low on stock. This could lead to lost sales.",
                "impact": "high",
                "category": "inventory",
                "recommendations": [
                    "Review low stock items and reorder immediately",
                    "Set up automatic reorder points for critical items",
                    "Consider bulk ordering to reduce costs"
                ],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "is_read": False,
                "is_dismissed": False
            })
        
        # Sales trend analysis
        if context.get("weekly_revenue", 0) > 0:
            daily_avg = context["weekly_revenue"] / 7
            today_revenue = context.get("today_revenue", 0)
            
            if today_revenue < daily_avg * 0.5:
                insights.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "insight_type": "warning",
                    "title": "Sales Below Average",
                    "description": f"Today's sales (₹{today_revenue:,.0f}) are significantly below your daily average (₹{daily_avg:,.0f}).",
                    "impact": "medium",
                    "category": "sales",
                    "recommendations": [
                        "Consider running a flash sale or promotion",
                        "Check if there are any operational issues",
                        "Review competitor pricing"
                    ],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "is_read": False,
                    "is_dismissed": False
                })
            elif today_revenue > daily_avg * 1.5:
                insights.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "insight_type": "opportunity",
                    "title": "Strong Sales Day",
                    "description": f"Today's sales (₹{today_revenue:,.0f}) are exceeding your daily average by {((today_revenue/daily_avg)-1)*100:.0f}%!",
                    "impact": "medium",
                    "category": "sales",
                    "recommendations": [
                        "Analyze what's driving the increase",
                        "Consider extending successful promotions",
                        "Ensure adequate stock levels"
                    ],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "is_read": False,
                    "is_dismissed": False
                })
        
        # Growth opportunities
        if context.get("total_customers", 0) > 0 and context.get("weekly_sales_count", 0) > 0:
            customer_engagement = context["weekly_sales_count"] / context["total_customers"]
            if customer_engagement < 0.1:
                insights.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "insight_type": "opportunity",
                    "title": "Customer Engagement Opportunity",
                    "description": f"Only {customer_engagement*100:.1f}% of your customers made a purchase this week. There's potential to re-engage dormant customers.",
                    "impact": "high",
                    "category": "customers",
                    "recommendations": [
                        "Launch a customer re-engagement campaign",
                        "Send personalized offers to inactive customers",
                        "Consider a loyalty program to increase repeat purchases"
                    ],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "is_read": False,
                    "is_dismissed": False
                })
        
        # Operational insights
        if context.get("total_products", 0) > 500 and context.get("total_stores", 0) == 1:
            insights.append({
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "insight_type": "recommendation",
                "title": "Consider Multi-Store Expansion",
                "description": f"You have {context['total_products']} products but only 1 store. Consider expanding to reach more customers.",
                "impact": "low",
                "category": "operations",
                "recommendations": [
                    "Evaluate potential locations for a second store",
                    "Consider an online store to expand reach",
                    "Upgrade your plan to support more stores"
                ],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "is_read": False,
                "is_dismissed": False
            })
        
        # Save insights to database
        if insights:
            # Make a copy of insights before inserting to avoid mutating the returned list with _id
            await self.db.ai_insights.insert_many([dict(i) for i in insights])
        
        return insights
    
    async def get_dashboard_data(self, tenant_id: str) -> Dict[str, Any]:
        """Get AI Agent dashboard data"""
        
        # Get recent insights
        recent_insights = await self.db.ai_insights.find(
            {"tenant_id": tenant_id, "is_dismissed": False},
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        # Get chat statistics
        total_chats = await self.db.ai_chat_sessions.count_documents({"tenant_id": tenant_id})
        active_chats = await self.db.ai_chat_sessions.count_documents({"tenant_id": tenant_id, "is_active": True})
        
        # Get recent sessions
        recent_sessions = await self.db.ai_chat_sessions.find(
            {"tenant_id": tenant_id, "is_active": True},
            {"_id": 0, "messages": 0}
        ).sort("updated_at", -1).limit(5).to_list(5)
        
        # Get insight counts by type
        insight_counts = {
            "loopholes": await self.db.ai_insights.count_documents({"tenant_id": tenant_id, "insight_type": "loophole", "is_dismissed": False}),
            "opportunities": await self.db.ai_insights.count_documents({"tenant_id": tenant_id, "insight_type": "opportunity", "is_dismissed": False}),
            "recommendations": await self.db.ai_insights.count_documents({"tenant_id": tenant_id, "insight_type": "recommendation", "is_dismissed": False}),
            "warnings": await self.db.ai_insights.count_documents({"tenant_id": tenant_id, "insight_type": "warning", "is_dismissed": False})
        }
        
        # Get business context for quick stats
        context = await self.get_business_context(tenant_id)
        
        return {
            "insights": recent_insights,
            "insight_counts": insight_counts,
            "chat_stats": {
                "total_chats": total_chats,
                "active_chats": active_chats
            },
            "recent_sessions": recent_sessions,
            "business_overview": {
                "today_revenue": context.get("today_revenue", 0),
                "weekly_revenue": context.get("weekly_revenue", 0),
                "low_stock_items": context.get("low_stock_items", 0),
                "total_customers": context.get("total_customers", 0)
            }
        }
    
    async def dismiss_insight(self, insight_id: str, tenant_id: str) -> bool:
        """Dismiss an insight"""
        result = await self.db.ai_insights.update_one(
            {"id": insight_id, "tenant_id": tenant_id},
            {"$set": {"is_dismissed": True}}
        )
        return result.modified_count > 0
    
    async def mark_insight_read(self, insight_id: str, tenant_id: str) -> bool:
        """Mark an insight as read"""
        result = await self.db.ai_insights.update_one(
            {"id": insight_id, "tenant_id": tenant_id},
            {"$set": {"is_read": True}}
        )
        return result.modified_count > 0
    
    async def delete_chat_session(self, session_id: str, tenant_id: str) -> bool:
        """Delete (soft) a chat session"""
        result = await self.db.ai_chat_sessions.update_one(
            {"id": session_id, "tenant_id": tenant_id},
            {"$set": {"is_active": False}}
        )
        return result.modified_count > 0
