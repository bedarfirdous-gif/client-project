"""
Customers (CRM) Routes Module

This module handles customer CRUD operations and related CRM functionality.

Routes:
- GET /customers - List all customers
- POST /customers - Create new customer
- GET /customers/{id} - Get customer details
- PUT /customers/{id} - Update customer
- DELETE /customers/{id} - Delete customer
- GET /customers/{id}/loyalty-card - Get loyalty card data
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timezone
import uuid

# Create router
router = APIRouter(prefix="/customers", tags=["Customers"])

# Note: These dependencies need to be imported from server.py or a shared module
# For now, this is a template showing the target structure

"""
# Example of how to use this module once dependencies are resolved:

from fastapi import APIRouter, Depends
from utils.deps import get_current_user, require_permission, get_tenant_id
from utils.database import db

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.get("")
async def list_customers(
    search: str = "",
    customer_type: str = "",
    page: int = 1,
    limit: int = 50,
    user: dict = Depends(require_permission("customers"))
):
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    if customer_type:
        query["customer_type"] = customer_type
    
    skip = (page - 1) * limit
    customers = await db.customers.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.customers.count_documents(query)
    
    return {
        "customers": customers,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@router.post("")
async def create_customer(customer_data: dict, user: dict = Depends(require_permission("customers"))):
    tenant_id = get_tenant_id(user)
    
    customer = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        **customer_data,
        "loyalty_points": 0,
        "total_purchases": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id")
    }
    
    await db.customers.insert_one(customer)
    del customer["_id"]
    return customer

@router.get("/{customer_id}")
async def get_customer(customer_id: str, user: dict = Depends(require_permission("customers"))):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.put("/{customer_id}")
async def update_customer(customer_id: str, updates: dict, user: dict = Depends(require_permission("customers"))):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = user.get("id")
    
    result = await db.customers.update_one(
        {"id": customer_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return await db.customers.find_one({"id": customer_id}, {"_id": 0})

@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, user: dict = Depends(require_permission("customers"))):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}
"""

# Placeholder until full migration
__doc__ = """
Customer Routes - Ready for Migration

To enable this module:
1. Move dependencies (get_current_user, require_permission, db) to shared utils
2. Uncomment the route implementations above
3. Include router in server.py: app.include_router(customer_router, prefix="/api")
4. Remove corresponding routes from server.py
"""
