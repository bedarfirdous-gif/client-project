"""
Quotations Routes Module

Handles all quotation-related operations:
- List quotations
- Create quotations
- Update quotations
- Convert to orders

Permission key: quotations
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Quotations"])

from utils.deps import get_db, get_current_user, get_tenant_id, require_permission


@router.get("/quotations")
async def list_quotations(
    status: str = "",
    customer_id: str = "",
    user: dict = Depends(require_permission("quotations"))
):
    """List all quotations"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id}
    
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    
    quotations = await db.quotations.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return quotations


@router.post("/quotations")
async def create_quotation(request: Request, user: dict = Depends(require_permission("quotations"))):
    """Create a new quotation"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    # Generate quotation number
    count = await db.quotations.count_documents({"tenant_id": tenant_id})
    quotation_number = f"QT-{count + 1:05d}"
    
    items = data.get("items", [])
    subtotal = sum(item.get("quantity", 0) * item.get("price", 0) for item in items)
    discount = data.get("discount_amount", 0)
    tax = data.get("tax_amount", 0)
    total = subtotal - discount + tax
    
    quotation = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "quotation_number": quotation_number,
        "customer_id": data.get("customer_id"),
        "customer_name": data.get("customer_name", ""),
        "customer_phone": data.get("customer_phone", ""),
        "customer_email": data.get("customer_email", ""),
        "items": items,
        "subtotal": subtotal,
        "discount_amount": discount,
        "tax_amount": tax,
        "total_amount": total,
        "status": "draft",
        "valid_until": data.get("valid_until", ""),
        "notes": data.get("notes", ""),
        "terms": data.get("terms", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.quotations.insert_one(quotation)
    quotation.pop("_id", None)
    
    return {"message": "Quotation created", "quotation": quotation}


@router.get("/quotations/{quotation_id}")
async def get_quotation(quotation_id: str, user: dict = Depends(require_permission("quotations"))):
    """Get a single quotation"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    quotation = await db.quotations.find_one(
        {"id": quotation_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return quotation


@router.put("/quotations/{quotation_id}")
async def update_quotation(
    quotation_id: str,
    request: Request,
    user: dict = Depends(require_permission("quotations"))
):
    """Update a quotation"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user.get("id")
    }
    
    # Update allowed fields
    for field in ["items", "customer_id", "customer_name", "discount_amount", "tax_amount", "notes", "terms", "valid_until"]:
        if field in data:
            update_data[field] = data[field]
    
    # Recalculate totals if items changed
    if "items" in data:
        items = data["items"]
        subtotal = sum(item.get("quantity", 0) * item.get("price", 0) for item in items)
        update_data["subtotal"] = subtotal
        update_data["total_amount"] = subtotal - data.get("discount_amount", 0) + data.get("tax_amount", 0)
    
    result = await db.quotations.update_one(
        {"id": quotation_id, "tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    return {"message": "Quotation updated"}


@router.put("/quotations/{quotation_id}/status")
async def update_quotation_status(
    quotation_id: str,
    request: Request,
    user: dict = Depends(require_permission("quotations"))
):
    """Update quotation status"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    status = data.get("status")
    
    valid_statuses = ["draft", "sent", "accepted", "rejected", "expired", "converted"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.quotations.update_one(
        {"id": quotation_id, "tenant_id": tenant_id},
        {"$set": {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    return {"message": f"Quotation status updated to {status}"}


@router.delete("/quotations/{quotation_id}")
async def delete_quotation(quotation_id: str, user: dict = Depends(require_permission("quotations"))):
    """Delete a quotation"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    quotation = await db.quotations.find_one({"id": quotation_id, "tenant_id": tenant_id})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    if quotation.get("status") == "converted":
        raise HTTPException(status_code=400, detail="Cannot delete converted quotation")
    
    await db.quotations.delete_one({"id": quotation_id})
    return {"message": "Quotation deleted"}


@router.post("/quotations/{quotation_id}/convert-to-order")
async def convert_quotation_to_order(quotation_id: str, user: dict = Depends(require_permission("quotations"))):
    """Convert a quotation to a sales order"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    quotation = await db.quotations.find_one({"id": quotation_id, "tenant_id": tenant_id})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    if quotation.get("status") == "converted":
        raise HTTPException(status_code=400, detail="Quotation already converted")
    
    # Generate order number
    count = await db.sales_orders.count_documents({"tenant_id": tenant_id})
    order_number = f"SO-{count + 1:05d}"
    
    order_doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "order_number": order_number,
        "quotation_id": quotation_id,
        "quotation_number": quotation.get("quotation_number"),
        "customer_id": quotation.get("customer_id"),
        "customer_name": quotation.get("customer_name", ""),
        "customer_phone": quotation.get("customer_phone", ""),
        "customer_email": quotation.get("customer_email", ""),
        "items": quotation.get("items", []),
        "subtotal": quotation.get("subtotal", 0),
        "discount_amount": quotation.get("discount_amount", 0),
        "tax_amount": quotation.get("tax_amount", 0),
        "total_amount": quotation.get("total_amount", 0),
        "status": "pending",
        "created_by": user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sales_orders.insert_one(order_doc)
    await db.quotations.update_one(
        {"id": quotation_id},
        {"$set": {"status": "converted", "converted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    order_doc.pop("_id", None)
    return {"message": "Quotation converted to order", "order": order_doc}
