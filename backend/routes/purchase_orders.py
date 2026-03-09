"""
Purchase Orders Routes Module

This module handles all purchase order related operations including:
- Listing purchase orders
- Creating purchase orders (manual and auto-generated)
- Updating purchase order status
- Converting purchase orders to invoices
- Deleting purchase orders

Permission key: purchase_orders
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Purchase Orders"])

# Import dependencies from utils
from utils.deps import get_db, get_current_user, get_tenant_id, require_permission


@router.get("/purchase-orders")
async def list_purchase_orders(
    status: str = "",
    is_auto: str = "",
    user: dict = Depends(require_permission("purchase_orders"))
):
    """List all purchase orders"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id}
    
    if status:
        query["status"] = status
    if is_auto == "true":
        query["is_auto_generated"] = True
    elif is_auto == "false":
        query["is_auto_generated"] = {"$ne": True}
    
    orders = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@router.post("/purchase-orders")
async def create_purchase_order(
    request: Request,
    user: dict = Depends(require_permission("purchase_orders"))
):
    """Manually create a purchase order"""
    db = get_db()
    data = await request.json()
    supplier_id = data.get("supplier_id", "")
    store_id = data.get("store_id", "")
    items = data.get("items", [])
    notes = data.get("notes", "")
    expected_date = data.get("expected_date", "")
    
    if not items:
        raise HTTPException(status_code=400, detail="Items are required")
    
    tenant_id = get_tenant_id(user)
    
    # Get supplier info if provided
    supplier_name = ""
    if supplier_id:
        supplier = await db.suppliers.find_one({"id": supplier_id, "tenant_id": tenant_id})
        if supplier:
            supplier_name = supplier.get("name", "")
    
    # Generate PO number
    count = await db.purchase_orders.count_documents({"tenant_id": tenant_id})
    po_number = f"PO-{count + 1:05d}"
    
    # Calculate totals
    total_amount = sum(item.get("quantity", 0) * item.get("cost_price", 0) for item in items)
    total_items = sum(item.get("quantity", 0) for item in items)
    
    po_doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "po_number": po_number,
        "supplier_id": supplier_id,
        "supplier_name": supplier_name,
        "store_id": store_id,
        "items": items,
        "total_amount": total_amount,
        "total_items": total_items,
        "status": "draft",
        "is_auto_generated": False,
        "notes": notes,
        "expected_date": expected_date,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.purchase_orders.insert_one(po_doc)
    
    # Remove MongoDB _id before returning
    po_doc.pop("_id", None)
    
    return {
        "message": "Purchase order created successfully",
        "purchase_order": po_doc
    }


@router.put("/purchase-orders/{po_id}/status")
async def update_purchase_order_status(
    po_id: str,
    status: str = Query(..., description="draft, pending, approved, received, cancelled"),
    user: dict = Depends(require_permission("purchase_orders"))
):
    """Update purchase order status"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    valid_statuses = ["draft", "pending", "approved", "received", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.purchase_orders.update_one(
        {"id": po_id, "tenant_id": tenant_id},
        {"$set": {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user.get("id")
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    return {"message": f"Purchase order status updated to {status}"}


@router.delete("/purchase-orders/{po_id}")
async def delete_purchase_order(
    po_id: str, 
    user: dict = Depends(require_permission("purchase_orders"))
):
    """Delete a purchase order (only draft or cancelled)"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    po = await db.purchase_orders.find_one({"id": po_id, "tenant_id": tenant_id})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po.get("status") not in ["draft", "cancelled"]:
        raise HTTPException(status_code=400, detail="Only draft or cancelled purchase orders can be deleted")
    
    await db.purchase_orders.delete_one({"id": po_id})
    return {"message": "Purchase order deleted"}


@router.get("/purchase-orders/{po_id}")
async def get_purchase_order(
    po_id: str,
    user: dict = Depends(require_permission("purchase_orders"))
):
    """Get a single purchase order by ID"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    po = await db.purchase_orders.find_one(
        {"id": po_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    return po
