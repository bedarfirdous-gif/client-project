"""
Recycle Bin Routes Module - ACTUAL IMPLEMENTATION

This module handles soft-delete and restore functionality for various entities.
Routes are properly ordered to avoid FastAPI path parameter conflicts.

Routes (in correct order):
1. DELETE /recycle-bin/empty - Empty the recycle bin (static path FIRST)
2. GET /recycle-bin/auto-delete/status - Auto-delete job status (static path)
3. POST /recycle-bin/auto-delete/run - Run auto-delete job (static path)
4. GET /recycle-bin - Get all items in recycle bin
5. POST /recycle-bin/{item_id}/restore - Restore an item (dynamic path LAST)
6. DELETE /recycle-bin/{item_id} - Permanently delete an item (dynamic path LAST)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
import uuid

# This will be set by server.py when the router is included
db = None
get_tenant_id = None
require_permission = None
get_auto_delete_status = None

router = APIRouter(prefix="/recycle-bin", tags=["Recycle Bin"])


def init_dependencies(database, tenant_func, permission_func, auto_delete_func=None):
    """Initialize dependencies from server.py"""
    global db, get_tenant_id, require_permission, get_auto_delete_status
    db = database
    get_tenant_id = tenant_func
    require_permission = permission_func
    get_auto_delete_status = auto_delete_func


# IMPORTANT: Static paths MUST come before dynamic {item_id} paths
# This prevents "/empty" from being matched as an item_id


@router.delete("/empty")
async def empty_recycle_bin(user: dict = Depends(lambda: require_permission("settings"))):
    """Empty all items in recycle bin (permanent delete)"""
    tenant_id = get_tenant_id(user)
    
    # Get all items to delete
    items = await db.recycle_bin.find(
        {"tenant_id": tenant_id, "is_permanently_deleted": False},
        {"_id": 0}
    ).to_list(1000)
    
    # Permanently delete original records
    for item in items:
        if item["item_type"] == "employee":
            await db.employees.delete_one({"id": item["original_id"], "tenant_id": tenant_id})
        elif item["item_type"] == "customer":
            await db.customers.delete_one({"id": item["original_id"], "tenant_id": tenant_id})
        elif item["item_type"] == "item":
            await db.items.delete_one({"id": item["original_id"], "tenant_id": tenant_id})
            await db.variants.delete_many({"item_id": item["original_id"]})
            await db.inventory.delete_many({"item_id": item["original_id"]})
        elif item["item_type"] == "invoice":
            await db.invoices.delete_one({"id": item["original_id"], "tenant_id": tenant_id})
        elif item["item_type"] == "purchase":
            await db.purchase_invoices.delete_one({"id": item["original_id"], "tenant_id": tenant_id})
    
    # Mark all as permanently deleted
    await db.recycle_bin.update_many(
        {"tenant_id": tenant_id, "is_permanently_deleted": False},
        {"$set": {
            "is_permanently_deleted": True,
            "permanently_deleted_at": datetime.now(timezone.utc).isoformat(),
            "permanently_deleted_by": user.get("id")
        }}
    )
    
    return {"message": f"Permanently deleted {len(items)} items"}


@router.get("/auto-delete/status")
async def get_auto_delete_job_status(user: dict = Depends(lambda: require_permission("settings"))):
    """Get status of the auto-delete background job"""
    if get_auto_delete_status:
        return get_auto_delete_status()
    return {"enabled": False, "message": "Auto-delete not configured"}


@router.post("/auto-delete/run")
async def run_auto_delete_job(user: dict = Depends(lambda: require_permission("settings"))):
    """Manually trigger the auto-delete job"""
    tenant_id = get_tenant_id(user)
    now = datetime.now(timezone.utc).isoformat()
    
    # Find items past their auto_delete_at date
    result = await db.recycle_bin.update_many(
        {"tenant_id": tenant_id, "is_permanently_deleted": False, "auto_delete_at": {"$lte": now}},
        {"$set": {
            "is_permanently_deleted": True,
            "permanently_deleted_at": now,
            "permanently_deleted_by": "system_auto_delete"
        }}
    )
    
    return {"message": "Auto-delete job executed", "result": {"modified": result.modified_count}}


@router.get("")
async def get_recycle_bin(
    item_type: str = "",
    user: dict = Depends(lambda: require_permission("settings"))
):
    """Get items in recycle bin"""
    tenant_id = get_tenant_id(user)
    
    query = {
        "tenant_id": tenant_id,
        "is_permanently_deleted": False
    }
    
    if item_type:
        query["item_type"] = item_type
    
    items = await db.recycle_bin.find(query, {"_id": 0}).sort("deleted_at", -1).to_list(100)
    
    return {"items": items, "count": len(items)}


# Dynamic path routes MUST come AFTER static paths
@router.post("/{item_id}/restore")
async def restore_from_recycle_bin(
    item_id: str,
    user: dict = Depends(lambda: require_permission("settings"))
):
    """Restore an item from recycle bin"""
    tenant_id = get_tenant_id(user)
    
    # Find the item in recycle bin
    item = await db.recycle_bin.find_one(
        {"id": item_id, "tenant_id": tenant_id, "is_permanently_deleted": False},
        {"_id": 0}
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in Recycle Bin")
    
    # Restore to original collection based on type
    original_data = item.get("item_data", {})
    original_data["is_deleted"] = False
    original_data.pop("deleted_at", None)
    original_data.pop("deleted_by", None)
    
    if item["item_type"] == "employee":
        await db.employees.update_one(
            {"id": item["original_id"]},
            {"$set": original_data},
            upsert=True
        )
    elif item["item_type"] == "customer":
        await db.customers.update_one(
            {"id": item["original_id"]},
            {"$set": original_data},
            upsert=True
        )
    elif item["item_type"] == "item":
        await db.items.update_one(
            {"id": item["original_id"]},
            {"$set": original_data},
            upsert=True
        )
    elif item["item_type"] == "invoice":
        await db.invoices.update_one(
            {"id": item["original_id"]},
            {"$set": original_data},
            upsert=True
        )
    elif item["item_type"] == "purchase":
        await db.purchase_invoices.update_one(
            {"id": item["original_id"]},
            {"$set": original_data},
            upsert=True
        )
    
    # Remove from recycle bin
    await db.recycle_bin.delete_one({"id": item_id, "tenant_id": tenant_id})
    
    return {"message": f"{item['item_type'].title()} restored successfully"}


@router.delete("/{item_id}")
async def permanently_delete_item(
    item_id: str,
    user: dict = Depends(lambda: require_permission("settings"))
):
    """Permanently delete an item from recycle bin"""
    tenant_id = get_tenant_id(user)
    
    # Find the item
    item = await db.recycle_bin.find_one(
        {"id": item_id, "tenant_id": tenant_id, "is_permanently_deleted": False},
        {"_id": 0}
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in Recycle Bin")
    
    # Permanently delete from original collection
    if item["item_type"] == "employee":
        await db.employees.delete_one({"id": item["original_id"], "tenant_id": tenant_id})
    elif item["item_type"] == "customer":
        await db.customers.delete_one({"id": item["original_id"], "tenant_id": tenant_id})
    elif item["item_type"] == "item":
        await db.items.delete_one({"id": item["original_id"], "tenant_id": tenant_id})
        await db.variants.delete_many({"item_id": item["original_id"]})
        await db.inventory.delete_many({"item_id": item["original_id"]})
    elif item["item_type"] == "invoice":
        await db.invoices.delete_one({"id": item["original_id"], "tenant_id": tenant_id})
    elif item["item_type"] == "purchase":
        await db.purchase_invoices.delete_one({"id": item["original_id"], "tenant_id": tenant_id})
    
    # Mark as permanently deleted
    await db.recycle_bin.update_one(
        {"id": item_id, "tenant_id": tenant_id},
        {"$set": {
            "is_permanently_deleted": True,
            "permanently_deleted_at": datetime.now(timezone.utc).isoformat(),
            "permanently_deleted_by": user.get("id")
        }}
    )
    
    return {"message": f"{item['item_type'].title()} permanently deleted"}
