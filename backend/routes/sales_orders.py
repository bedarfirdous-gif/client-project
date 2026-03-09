"""
Sales Orders Routes Module

Handles all sales order operations:
- List orders
- Create orders
- Update orders
- Convert to invoices

Permission key: sales_orders
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Sales Orders"])

from utils.deps import get_db, get_current_user, get_tenant_id, require_permission


@router.get("/sales-orders")
async def list_sales_orders(
    status: str = "",
    customer_id: str = "",
    user: dict = Depends(require_permission("sales_orders"))
):
    """List all sales orders"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id}
    
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    
    orders = await db.sales_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@router.post("/sales-orders")
async def create_sales_order(request: Request, user: dict = Depends(require_permission("sales_orders"))):
    """Create a new sales order"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    # Generate order number
    count = await db.sales_orders.count_documents({"tenant_id": tenant_id})
    order_number = f"SO-{count + 1:05d}"
    
    items = data.get("items", [])
    subtotal = sum(item.get("quantity", 0) * item.get("price", 0) for item in items)
    discount = data.get("discount_amount", 0)
    tax = data.get("tax_amount", 0)
    total = subtotal - discount + tax
    
    order = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "order_number": order_number,
        "quotation_id": data.get("quotation_id"),
        "customer_id": data.get("customer_id"),
        "customer_name": data.get("customer_name", ""),
        "customer_phone": data.get("customer_phone", ""),
        "customer_email": data.get("customer_email", ""),
        "shipping_address": data.get("shipping_address", ""),
        "items": items,
        "subtotal": subtotal,
        "discount_amount": discount,
        "tax_amount": tax,
        "total_amount": total,
        "status": "pending",
        "delivery_date": data.get("delivery_date", ""),
        "notes": data.get("notes", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sales_orders.insert_one(order)
    order.pop("_id", None)
    
    return {"message": "Sales order created", "order": order}


@router.get("/sales-orders/{order_id}")
async def get_sales_order(order_id: str, user: dict = Depends(require_permission("sales_orders"))):
    """Get a single sales order"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    order = await db.sales_orders.find_one(
        {"id": order_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    return order


@router.put("/sales-orders/{order_id}")
async def update_sales_order(
    order_id: str,
    request: Request,
    user: dict = Depends(require_permission("sales_orders"))
):
    """Update a sales order"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    # Check if order exists and can be updated
    order = await db.sales_orders.find_one({"id": order_id, "tenant_id": tenant_id})
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    if order.get("status") in ["invoiced", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Cannot update {order.get('status')} order")
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user.get("id")
    }
    
    for field in ["items", "customer_id", "customer_name", "discount_amount", "tax_amount", "notes", "delivery_date", "shipping_address"]:
        if field in data:
            update_data[field] = data[field]
    
    if "items" in data:
        items = data["items"]
        subtotal = sum(item.get("quantity", 0) * item.get("price", 0) for item in items)
        update_data["subtotal"] = subtotal
        update_data["total_amount"] = subtotal - data.get("discount_amount", 0) + data.get("tax_amount", 0)
    
    await db.sales_orders.update_one(
        {"id": order_id, "tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    return {"message": "Sales order updated"}


@router.put("/sales-orders/{order_id}/status")
async def update_sales_order_status(
    order_id: str,
    request: Request,
    user: dict = Depends(require_permission("sales_orders"))
):
    """Update sales order status"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    status = data.get("status")
    
    valid_statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "invoiced", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.sales_orders.update_one(
        {"id": order_id, "tenant_id": tenant_id},
        {"$set": {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    return {"message": f"Sales order status updated to {status}"}


@router.delete("/sales-orders/{order_id}")
async def delete_sales_order(order_id: str, user: dict = Depends(require_permission("sales_orders"))):
    """Delete a sales order"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    order = await db.sales_orders.find_one({"id": order_id, "tenant_id": tenant_id})
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    if order.get("status") == "invoiced":
        raise HTTPException(status_code=400, detail="Cannot delete invoiced order")
    
    await db.sales_orders.delete_one({"id": order_id})
    return {"message": "Sales order deleted"}


@router.post("/sales-orders/{order_id}/convert-to-invoice")
async def convert_order_to_invoice(order_id: str, user: dict = Depends(require_permission("sales_orders"))):
    """Convert a sales order to an invoice"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    order = await db.sales_orders.find_one({"id": order_id, "tenant_id": tenant_id})
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    if order.get("status") == "invoiced":
        raise HTTPException(status_code=400, detail="Order already invoiced")
    
    # Generate invoice number
    count = await db.sales.count_documents({"tenant_id": tenant_id})
    invoice_number = f"INV-{count + 1:05d}"
    
    invoice_doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "invoice_number": invoice_number,
        "order_id": order_id,
        "order_number": order.get("order_number"),
        "customer_id": order.get("customer_id"),
        "customer_name": order.get("customer_name", ""),
        "customer_phone": order.get("customer_phone", ""),
        "customer_email": order.get("customer_email", ""),
        "items": order.get("items", []),
        "subtotal": order.get("subtotal", 0),
        "discount_amount": order.get("discount_amount", 0),
        "tax_amount": order.get("tax_amount", 0),
        "total_amount": order.get("total_amount", 0),
        "payment_method": "pending",
        "payment_status": "unpaid",
        "created_by": user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sales.insert_one(invoice_doc)
    await db.sales_orders.update_one(
        {"id": order_id},
        {"$set": {"status": "invoiced", "invoiced_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    invoice_doc.pop("_id", None)
    return {"message": "Order converted to invoice", "invoice": invoice_doc}

