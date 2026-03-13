"""
Stock Management Routes Module

Handles all stock-related operations:
- Stock transfers between stores
- Stock adjustments
- Stock alerts
- Stock audit trail

Permission keys: inventory, stock_transfer
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Stock Management"])

from utils.deps import get_db, get_current_user, get_tenant_id, require_permission


# ============== STOCK TRANSFERS ==============

@router.get("/stock-transfers")
async def list_stock_transfers(
    status: str = "",
    user: dict = Depends(require_permission("stock_transfer"))
):
    """List all stock transfers"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id}
    
    if status:
        query["status"] = status
    
    transfers = await db.stock_transfers.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return transfers


@router.post("/stock-transfers")
async def create_stock_transfer(request: Request, user: dict = Depends(require_permission("stock_transfer"))):
    """Create a new stock transfer"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    # Validate stores
    from_store_id = data.get("from_store_id")
    to_store_id = data.get("to_store_id")
    items = data.get("items", [])
    
    if not from_store_id or not to_store_id:
        raise HTTPException(status_code=400, detail="Source and destination stores are required")
    
    if from_store_id == to_store_id:
        raise HTTPException(status_code=400, detail="Source and destination stores must be different")
    
    if not items:
        raise HTTPException(status_code=400, detail="At least one item is required")
    
    # Generate transfer number
    count = await db.stock_transfers.count_documents({"tenant_id": tenant_id})
    transfer_number = f"ST-{count + 1:05d}"
    
    transfer = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "transfer_number": transfer_number,
        "from_store_id": from_store_id,
        "to_store_id": to_store_id,
        "items": items,
        "total_items": sum(item.get("quantity", 0) for item in items),
        "status": "pending",
        "notes": data.get("notes", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock_transfers.insert_one(transfer)
    transfer.pop("_id", None)
    
    return {"message": "Stock transfer created", "transfer": transfer}


@router.put("/stock-transfers/{transfer_id}/approve")
async def approve_stock_transfer(
    transfer_id: str,
    user: dict = Depends(require_permission("stock_transfer"))
):
    """Approve a stock transfer"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    transfer = await db.stock_transfers.find_one({"id": transfer_id, "tenant_id": tenant_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    
    if transfer.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending transfers can be approved")
    
    await db.stock_transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": user.get("id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Stock transfer approved"}


@router.put("/stock-transfers/{transfer_id}/reject")
async def reject_stock_transfer(
    transfer_id: str,
    request: Request,
    user: dict = Depends(require_permission("stock_transfer"))
):
    """Reject a stock transfer"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    transfer = await db.stock_transfers.find_one({"id": transfer_id, "tenant_id": tenant_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    
    if transfer.get("status") not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail="Only pending or approved transfers can be rejected")
    
    await db.stock_transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": data.get("reason", ""),
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejected_by": user.get("id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Stock transfer rejected"}


@router.put("/stock-transfers/{transfer_id}/complete")
async def complete_stock_transfer(
    transfer_id: str,
    user: dict = Depends(require_permission("stock_transfer"))
):
    """Complete a stock transfer - actually move the stock"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    transfer = await db.stock_transfers.find_one({"id": transfer_id, "tenant_id": tenant_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    
    if transfer.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Only approved transfers can be completed")
    
    # Update stock in source and destination stores
    for item in transfer.get("items", []):
        item_id = item.get("item_id")
        quantity = item.get("quantity", 0)
        
        # Decrease stock in source
        await db.central_stock.update_one(
            {"item_id": item_id, "store_id": transfer.get("from_store_id")},
            {"$inc": {"quantity": -quantity}}
        )
        
        # Increase stock in destination
        await db.central_stock.update_one(
            {"item_id": item_id, "store_id": transfer.get("to_store_id")},
            {"$inc": {"quantity": quantity}},
            upsert=True
        )
    
    await db.stock_transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "completed_by": user.get("id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Stock transfer completed"}


@router.delete("/stock-transfers/{transfer_id}")
async def delete_stock_transfer(transfer_id: str, user: dict = Depends(require_permission("stock_transfer"))):
    """Delete a stock transfer"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    transfer = await db.stock_transfers.find_one({"id": transfer_id, "tenant_id": tenant_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    
    if transfer.get("status") in ["completed", "in_transit"]:
        raise HTTPException(status_code=400, detail="Cannot delete completed or in-transit transfers")
    
    await db.stock_transfers.delete_one({"id": transfer_id})
    return {"message": "Stock transfer deleted"}


# ============== STOCK ALERTS ==============

@router.get("/stock-alerts")
async def list_stock_alerts(
    read: str = "",
    user: dict = Depends(require_permission("inventory"))
):
    """List stock alerts"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id}
    
    if read == "true":
        query["is_read"] = True
    elif read == "false":
        query["is_read"] = {"$ne": True}
    
    alerts = await db.stock_alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return alerts


@router.get("/stock-alerts/count")
async def get_stock_alerts_count(user: dict = Depends(require_permission("inventory"))):
    """Get unread stock alerts count"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    count = await db.stock_alerts.count_documents({
        "tenant_id": tenant_id,
        "is_read": {"$ne": True}
    })
    return {"count": count}


@router.put("/stock-alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str, user: dict = Depends(require_permission("inventory"))):
    """Mark a stock alert as read"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    result = await db.stock_alerts.update_one(
        {"id": alert_id, "tenant_id": tenant_id},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert marked as read"}


@router.put("/stock-alerts/read-all")
async def mark_all_alerts_read(user: dict = Depends(require_permission("inventory"))):
    """Mark all stock alerts as read"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    result = await db.stock_alerts.update_many(
        {"tenant_id": tenant_id, "is_read": {"$ne": True}},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Marked {result.modified_count} alerts as read"}


@router.delete("/stock-alerts/{alert_id}")
async def delete_alert(alert_id: str, user: dict = Depends(require_permission("inventory"))):
    """Delete a stock alert"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    result = await db.stock_alerts.delete_one({"id": alert_id, "tenant_id": tenant_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert deleted"}
