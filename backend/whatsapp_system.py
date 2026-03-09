"""
WhatsApp Business API Integration via AI Sensy
Supports individual messaging, bulk messaging, and automated triggers
"""

import httpx
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field, validator
from enum import Enum
import logging
import os

logger = logging.getLogger(__name__)

# ============== MODELS ==============

class MessageTemplateType(str, Enum):
    PAYMENT_REMINDER = "payment_reminder"
    ORDER_UPDATE = "order_update"
    PROMOTIONAL = "promotional"
    CUSTOM = "custom"

class MessageStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"

class TriggerType(str, Enum):
    PAYMENT_DUE = "payment_due"
    ORDER_STATUS = "order_status"
    BIRTHDAY = "birthday"
    FOLLOW_UP = "follow_up"
    CUSTOM = "custom"

class WhatsAppMessageCreate(BaseModel):
    customer_id: str
    phone_number: str
    customer_name: str
    campaign_name: str
    template_name: str
    template_params: List[str] = []
    tags: List[str] = []
    attributes: Dict[str, Any] = {}

class BulkMessageCreate(BaseModel):
    customer_ids: List[str]
    campaign_name: str
    template_name: str
    template_type: MessageTemplateType = MessageTemplateType.CUSTOM
    message_content: Optional[str] = None

class WhatsAppConfigUpdate(BaseModel):
    api_endpoint: Optional[str] = None
    api_key: Optional[str] = None
    default_campaign_name: Optional[str] = None
    is_enabled: bool = True

class AutomatedTriggerCreate(BaseModel):
    name: str
    trigger_type: TriggerType
    template_name: str
    campaign_name: str
    conditions: Dict[str, Any] = {}
    is_active: bool = True

# ============== WHATSAPP SYSTEM ==============

class WhatsAppSystem:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.messages_collection = db.whatsapp_messages
        self.config_collection = db.whatsapp_config
        self.triggers_collection = db.whatsapp_triggers
        self.templates_collection = db.whatsapp_templates

    async def get_config(self, tenant_id: str) -> Dict[str, Any]:
        """Get WhatsApp configuration for a tenant"""
        config = await self.config_collection.find_one({"tenant_id": tenant_id})
        if config:
            config["id"] = str(config["_id"])
            del config["_id"]
            # Mask API key for security
            if config.get("api_key"):
                config["api_key_masked"] = config["api_key"][:8] + "****"
            return config
        return {
            "tenant_id": tenant_id,
            "api_endpoint": "https://backend.aisensy.com/campaign/t1/api/v2",
            "api_key": "",
            "default_campaign_name": "",
            "is_enabled": False,
            "is_configured": False
        }

    async def update_config(self, tenant_id: str, config_data: WhatsAppConfigUpdate) -> Dict[str, Any]:
        """Update WhatsApp configuration"""
        update_data = {
            "tenant_id": tenant_id,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if config_data.api_endpoint:
            update_data["api_endpoint"] = config_data.api_endpoint
        if config_data.api_key:
            update_data["api_key"] = config_data.api_key
        if config_data.default_campaign_name:
            update_data["default_campaign_name"] = config_data.default_campaign_name
        update_data["is_enabled"] = config_data.is_enabled
        update_data["is_configured"] = bool(config_data.api_key)

        await self.config_collection.update_one(
            {"tenant_id": tenant_id},
            {"$set": update_data},
            upsert=True
        )

        return await self.get_config(tenant_id)

    async def test_connection(self, tenant_id: str) -> Dict[str, Any]:
        """Test WhatsApp API connection"""
        config = await self.config_collection.find_one({"tenant_id": tenant_id})
        
        if not config or not config.get("api_key"):
            return {
                "success": False,
                "error": "API key not configured"
            }

        # AI Sensy doesn't have a dedicated health check endpoint
        # We'll verify the API key format and endpoint accessibility
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Test endpoint accessibility
                await client.options(config.get("api_endpoint", "https://backend.aisensy.com/campaign/t1/api/v2"))
                return {
                    "success": True,
                    "message": "API endpoint is accessible. Send a test message to verify credentials."
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Connection failed: {str(e)}"
            }

    async def send_single_message(
        self,
        tenant_id: str,
        message_data: WhatsAppMessageCreate
    ) -> Dict[str, Any]:
        """Send a single WhatsApp message via AI Sensy API"""
        
        # Get config
        config = await self.config_collection.find_one({"tenant_id": tenant_id})
        
        if not config or not config.get("api_key"):
            return {
                "success": False,
                "error": "WhatsApp API not configured. Please add your AI Sensy API key in settings."
            }

        if not config.get("is_enabled"):
            return {
                "success": False,
                "error": "WhatsApp messaging is disabled. Enable it in settings."
            }

        # Prepare AI Sensy API payload
        payload = {
            "apiKey": config["api_key"],
            "campaignName": message_data.campaign_name or config.get("default_campaign_name", "crm_campaign"),
            "destination": message_data.phone_number,
            "userName": message_data.customer_name,
            "source": "CRM",
            "templateParams": message_data.template_params,
            "tags": message_data.tags,
            "attributes": message_data.attributes
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    config.get("api_endpoint", "https://backend.aisensy.com/campaign/t1/api/v2"),
                    json=payload
                )

            # Create message record
            message_record = {
                "tenant_id": tenant_id,
                "customer_id": message_data.customer_id,
                "phone_number": message_data.phone_number,
                "customer_name": message_data.customer_name,
                "campaign_name": message_data.campaign_name,
                "template_name": message_data.template_name,
                "template_params": message_data.template_params,
                "tags": message_data.tags,
                "attributes": message_data.attributes,
                "status": MessageStatus.SENT.value if response.status_code == 200 else MessageStatus.FAILED.value,
                "api_response": response.text[:500] if response.text else None,
                "sent_at": datetime.now(timezone.utc),
                "created_at": datetime.now(timezone.utc)
            }

            result = await self.messages_collection.insert_one(message_record)

            if response.status_code == 200:
                logger.info(f"WhatsApp message sent successfully to {message_data.phone_number}")
                return {
                    "success": True,
                    "message_id": str(result.inserted_id),
                    "status": "sent"
                }
            else:
                logger.error(f"WhatsApp message failed: {response.text}")
                return {
                    "success": False,
                    "error": f"API Error: {response.text}",
                    "status_code": response.status_code
                }

        except httpx.TimeoutException:
            return {
                "success": False,
                "error": "Request timed out. Please try again."
            }
        except Exception as e:
            logger.error(f"WhatsApp send error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def send_bulk_messages(
        self,
        tenant_id: str,
        bulk_data: BulkMessageCreate,
        customers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Send WhatsApp messages to multiple customers"""
        
        results = {
            "total": len(customers),
            "successful": 0,
            "failed": 0,
            "messages": []
        }

        # Process messages concurrently (with a limit to avoid rate limiting)
        semaphore = asyncio.Semaphore(5)  # Max 5 concurrent requests

        async def send_with_semaphore(customer):
            async with semaphore:
                message_data = WhatsAppMessageCreate(
                    customer_id=str(customer.get("id", customer.get("_id", ""))),
                    phone_number=customer.get("phone", ""),
                    customer_name=customer.get("name", ""),
                    campaign_name=bulk_data.campaign_name,
                    template_name=bulk_data.template_name,
                    template_params=[],
                    tags=[bulk_data.template_type.value],
                    attributes={"bulk_send": True}
                )
                return await self.send_single_message(tenant_id, message_data)

        # Filter customers with valid phone numbers
        valid_customers = [c for c in customers if c.get("phone")]

        if not valid_customers:
            return {
                "success": False,
                "error": "No customers with valid phone numbers found"
            }

        # Execute all sends concurrently
        tasks = [send_with_semaphore(customer) for customer in valid_customers]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        for i, response in enumerate(responses):
            if isinstance(response, Exception):
                results["failed"] += 1
                results["messages"].append({
                    "customer": valid_customers[i].get("name"),
                    "success": False,
                    "error": str(response)
                })
            elif response.get("success"):
                results["successful"] += 1
                results["messages"].append({
                    "customer": valid_customers[i].get("name"),
                    "success": True,
                    "message_id": response.get("message_id")
                })
            else:
                results["failed"] += 1
                results["messages"].append({
                    "customer": valid_customers[i].get("name"),
                    "success": False,
                    "error": response.get("error")
                })

        return results

    async def get_message_history(
        self,
        tenant_id: str,
        customer_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get message history with filters"""
        query = {"tenant_id": tenant_id}
        
        if customer_id:
            query["customer_id"] = customer_id
        if status:
            query["status"] = status

        cursor = self.messages_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        
        messages = []
        async for msg in cursor:
            msg["id"] = str(msg["_id"])
            del msg["_id"]
            messages.append(msg)

        return messages

    async def get_message_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Get messaging statistics"""
        pipeline = [
            {"$match": {"tenant_id": tenant_id}},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]

        stats = {
            "total": 0,
            "sent": 0,
            "delivered": 0,
            "failed": 0,
            "pending": 0
        }

        async for doc in self.messages_collection.aggregate(pipeline):
            status = doc["_id"]
            count = doc["count"]
            stats["total"] += count
            if status in stats:
                stats[status] = count

        # Get today's count
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        stats["today"] = await self.messages_collection.count_documents({
            "tenant_id": tenant_id,
            "created_at": {"$gte": today_start}
        })

        return stats

    # ============== MESSAGE TEMPLATES ==============

    async def get_templates(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Get saved message templates"""
        cursor = self.templates_collection.find({"tenant_id": tenant_id}).sort("created_at", -1)
        
        templates = []
        async for template in cursor:
            template["id"] = str(template["_id"])
            del template["_id"]
            templates.append(template)

        # Add default templates if none exist
        if not templates:
            default_templates = [
                {
                    "name": "Payment Reminder",
                    "template_type": MessageTemplateType.PAYMENT_REMINDER.value,
                    "campaign_name": "payment_reminder",
                    "template_name": "payment_reminder_template",
                    "description": "Remind customers about pending payments",
                    "is_default": True
                },
                {
                    "name": "Order Update",
                    "template_type": MessageTemplateType.ORDER_UPDATE.value,
                    "campaign_name": "order_update",
                    "template_name": "order_status_template",
                    "description": "Update customers about their order status",
                    "is_default": True
                },
                {
                    "name": "Promotional Offer",
                    "template_type": MessageTemplateType.PROMOTIONAL.value,
                    "campaign_name": "promotional",
                    "template_name": "promo_offer_template",
                    "description": "Send promotional offers and discounts",
                    "is_default": True
                },
                {
                    "name": "Custom Message",
                    "template_type": MessageTemplateType.CUSTOM.value,
                    "campaign_name": "custom_campaign",
                    "template_name": "custom_template",
                    "description": "Send custom messages",
                    "is_default": True
                }
            ]
            templates = default_templates

        return templates

    async def create_template(self, tenant_id: str, template_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new message template"""
        template = {
            "tenant_id": tenant_id,
            "name": template_data.get("name"),
            "template_type": template_data.get("template_type", MessageTemplateType.CUSTOM.value),
            "campaign_name": template_data.get("campaign_name"),
            "template_name": template_data.get("template_name"),
            "description": template_data.get("description", ""),
            "is_default": False,
            "created_at": datetime.now(timezone.utc)
        }

        result = await self.templates_collection.insert_one(template)
        template["id"] = str(result.inserted_id)
        if "_id" in template:
            del template["_id"]

        return template

    # ============== AUTOMATED TRIGGERS ==============

    async def get_triggers(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Get automated message triggers"""
        cursor = self.triggers_collection.find({"tenant_id": tenant_id}).sort("created_at", -1)
        
        triggers = []
        async for trigger in cursor:
            trigger["id"] = str(trigger["_id"])
            del trigger["_id"]
            triggers.append(trigger)

        return triggers

    async def create_trigger(self, tenant_id: str, trigger_data: AutomatedTriggerCreate) -> Dict[str, Any]:
        """Create an automated message trigger"""
        trigger = {
            "tenant_id": tenant_id,
            "name": trigger_data.name,
            "trigger_type": trigger_data.trigger_type.value,
            "template_name": trigger_data.template_name,
            "campaign_name": trigger_data.campaign_name,
            "conditions": trigger_data.conditions,
            "is_active": trigger_data.is_active,
            "created_at": datetime.now(timezone.utc)
        }

        result = await self.triggers_collection.insert_one(trigger)
        trigger["id"] = str(result.inserted_id)
        
        return trigger

    async def update_trigger(self, tenant_id: str, trigger_id: str, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an automated trigger"""
        from bson import ObjectId
        
        update_data = {
            "updated_at": datetime.now(timezone.utc)
        }
        
        for key in ["name", "trigger_type", "template_name", "campaign_name", "conditions", "is_active"]:
            if key in trigger_data:
                update_data[key] = trigger_data[key]

        await self.triggers_collection.update_one(
            {"_id": ObjectId(trigger_id), "tenant_id": tenant_id},
            {"$set": update_data}
        )

        trigger = await self.triggers_collection.find_one({"_id": ObjectId(trigger_id)})
        if trigger:
            trigger["id"] = str(trigger["_id"])
            del trigger["_id"]
            return trigger
        return None

    async def delete_trigger(self, tenant_id: str, trigger_id: str) -> bool:
        """Delete an automated trigger"""
        from bson import ObjectId
        
        result = await self.triggers_collection.delete_one({
            "_id": ObjectId(trigger_id),
            "tenant_id": tenant_id
        })
        return result.deleted_count > 0

    async def execute_due_triggers(self, tenant_id: str) -> Dict[str, Any]:
        """
        Execute triggers that are due (called by a background task)
        This checks for payment_due triggers, birthday triggers, etc.
        """
        results = {
            "executed": 0,
            "failed": 0,
            "details": []
        }

        # Get active triggers
        triggers = await self.triggers_collection.find({
            "tenant_id": tenant_id,
            "is_active": True
        }).to_list(100)

        for trigger in triggers:
            try:
                if trigger["trigger_type"] == TriggerType.PAYMENT_DUE.value:
                    # Find customers with due payments
                    # This would integrate with your sales/invoice system
                    pass
                elif trigger["trigger_type"] == TriggerType.BIRTHDAY.value:
                    # Find customers with birthdays today
                    today = datetime.now(timezone.utc).strftime("%m-%d")
                    customers = await self.db.customers.find({
                        "tenant_id": tenant_id,
                        "birthday": {"$regex": f".*-{today}$"}
                    }).to_list(100)
                    
                    if customers:
                        bulk_data = BulkMessageCreate(
                            customer_ids=[str(c["_id"]) for c in customers],
                            campaign_name=trigger["campaign_name"],
                            template_name=trigger["template_name"],
                            template_type=MessageTemplateType.CUSTOM
                        )
                        await self.send_bulk_messages(tenant_id, bulk_data, customers)
                        results["executed"] += len(customers)

            except Exception as e:
                results["failed"] += 1
                results["details"].append({
                    "trigger": trigger.get("name"),
                    "error": str(e)
                })

        return results
