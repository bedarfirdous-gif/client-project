"""
Settings Routes Module

Handles all settings-related operations:
- Store settings
- Business profile
- Tax settings
- Payment settings
- Notification settings

Permission key: settings
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Settings"])

from utils.deps import get_db, get_current_user, get_tenant_id, require_permission


# ============== STORE SETTINGS ==============

@router.get("/settings/stores")
async def list_stores(user: dict = Depends(require_permission("settings"))):
    """List all stores"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    stores = await db.stores.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    return stores


@router.post("/settings/stores")
async def create_store(request: Request, user: dict = Depends(require_permission("settings"))):
    """Create a new store"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    store = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "name": data.get("name"),
        "code": data.get("code", ""),
        "address": data.get("address", ""),
        "city": data.get("city", ""),
        "state": data.get("state", ""),
        "pincode": data.get("pincode", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "gstin": data.get("gstin", ""),
        "is_active": True,
        "is_default": data.get("is_default", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stores.insert_one(store)
    store.pop("_id", None)
    
    return {"message": "Store created", "store": store}


@router.put("/settings/stores/{store_id}")
async def update_store(
    store_id: str,
    request: Request,
    user: dict = Depends(require_permission("settings"))
):
    """Update a store"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field in ["name", "code", "address", "city", "state", "pincode", "phone", "email", "gstin", "is_active", "is_default"]:
        if field in data:
            update_data[field] = data[field]
    
    result = await db.stores.update_one(
        {"id": store_id, "tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Store not found")
    
    return {"message": "Store updated"}


@router.delete("/settings/stores/{store_id}")
async def delete_store(store_id: str, user: dict = Depends(require_permission("settings"))):
    """Delete a store"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    # Check if store has inventory or sales
    inventory_count = await db.inventory.count_documents({"store_id": store_id})
    if inventory_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete store with existing inventory")
    
    result = await db.stores.delete_one({"id": store_id, "tenant_id": tenant_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Store not found")
    
    return {"message": "Store deleted"}


# ============== BUSINESS PROFILE ==============

@router.get("/settings/business")
async def get_business_profile(user: dict = Depends(require_permission("settings"))):
    """Get business profile"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    profile = await db.business_profiles.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not profile:
        return {}
    return profile


@router.put("/settings/business")
async def update_business_profile(request: Request, user: dict = Depends(require_permission("settings"))):
    """Update business profile"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    profile_data = {
        "tenant_id": tenant_id,
        "business_name": data.get("business_name", ""),
        "legal_name": data.get("legal_name", ""),
        "business_type": data.get("business_type", ""),
        "gstin": data.get("gstin", ""),
        "pan": data.get("pan", ""),
        "address": data.get("address", ""),
        "city": data.get("city", ""),
        "state": data.get("state", ""),
        "pincode": data.get("pincode", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "website": data.get("website", ""),
        "logo_url": data.get("logo_url", ""),
        "bank_name": data.get("bank_name", ""),
        "bank_account": data.get("bank_account", ""),
        "bank_ifsc": data.get("bank_ifsc", ""),
        "upi_id": data.get("upi_id", ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.business_profiles.update_one(
        {"tenant_id": tenant_id},
        {"$set": profile_data},
        upsert=True
    )
    
    return {"message": "Business profile updated"}


# ============== TAX SETTINGS ==============

@router.get("/settings/tax")
async def get_tax_settings(user: dict = Depends(require_permission("settings"))):
    """Get tax settings"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    settings = await db.tax_settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not settings:
        return {
            "gst_enabled": True,
            "default_gst_rate": 18,
            "inclusive_tax": False
        }
    return settings


@router.put("/settings/tax")
async def update_tax_settings(request: Request, user: dict = Depends(require_permission("settings"))):
    """Update tax settings"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    settings = {
        "tenant_id": tenant_id,
        "gst_enabled": data.get("gst_enabled", True),
        "default_gst_rate": data.get("default_gst_rate", 18),
        "inclusive_tax": data.get("inclusive_tax", False),
        "cgst_rate": data.get("cgst_rate"),
        "sgst_rate": data.get("sgst_rate"),
        "igst_rate": data.get("igst_rate"),
        "cess_enabled": data.get("cess_enabled", False),
        "cess_rate": data.get("cess_rate", 0),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tax_settings.update_one(
        {"tenant_id": tenant_id},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Tax settings updated"}


# ============== PAYMENT SETTINGS ==============

@router.get("/settings/payment")
async def get_payment_settings(user: dict = Depends(require_permission("settings"))):
    """Get payment settings"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    settings = await db.payment_settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not settings:
        return {
            "payment_methods": ["cash", "card", "upi", "bank_transfer"],
            "default_method": "cash"
        }
    return settings


@router.put("/settings/payment")
async def update_payment_settings(request: Request, user: dict = Depends(require_permission("settings"))):
    """Update payment settings"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    settings = {
        "tenant_id": tenant_id,
        "payment_methods": data.get("payment_methods", ["cash", "card", "upi"]),
        "default_method": data.get("default_method", "cash"),
        "upi_id": data.get("upi_id", ""),
        "razorpay_enabled": data.get("razorpay_enabled", False),
        "razorpay_key": data.get("razorpay_key", ""),
        "stripe_enabled": data.get("stripe_enabled", False),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_settings.update_one(
        {"tenant_id": tenant_id},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Payment settings updated"}


# ============== NOTIFICATION SETTINGS ==============

@router.get("/settings/notifications")
async def get_notification_settings(user: dict = Depends(require_permission("settings"))):
    """Get notification settings"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    settings = await db.notification_settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not settings:
        return {
            "email_notifications": True,
            "sms_notifications": False,
            "low_stock_alerts": True,
            "order_notifications": True
        }
    return settings


@router.put("/settings/notifications")
async def update_notification_settings(request: Request, user: dict = Depends(require_permission("settings"))):
    """Update notification settings"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    settings = {
        "tenant_id": tenant_id,
        "email_notifications": data.get("email_notifications", True),
        "sms_notifications": data.get("sms_notifications", False),
        "whatsapp_notifications": data.get("whatsapp_notifications", False),
        "low_stock_alerts": data.get("low_stock_alerts", True),
        "order_notifications": data.get("order_notifications", True),
        "payment_reminders": data.get("payment_reminders", True),
        "daily_report_email": data.get("daily_report_email", False),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notification_settings.update_one(
        {"tenant_id": tenant_id},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Notification settings updated"}
