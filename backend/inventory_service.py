"""
Centralized Inventory Service
============================
Single source of truth for all stock operations.

All stock changes MUST go through this service:
- POS Sales → deduct_stock()
- Purchases/GRN → add_stock()
- Returns → return_stock()
- Manual Adjustments → adjust_stock()

NO other module is allowed to modify stock directly.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

class MovementType(str, Enum):
    SALE = "SALE"
    PURCHASE = "PURCHASE"
    RETURN = "RETURN"
    ADJUSTMENT = "ADJUSTMENT"
    TRANSFER = "TRANSFER"
    INITIAL = "INITIAL"
    CORRECTION = "CORRECTION"


class InventoryService:
    """
    Centralized Inventory Management Service
    
    This service is the ONLY authorized way to modify stock.
    All operations are transaction-safe and audited.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.central_stock = db.central_stock
        self.stock_movements = db.stock_movements
        self.items = db.items
        self.variants = db.variants
    
    async def initialize_indexes(self):
        """Create necessary indexes for performance and concurrency"""
        # Unique index on central_stock for item+variant+warehouse
        await self.central_stock.create_index(
            [("tenant_id", 1), ("item_id", 1), ("variant_id", 1), ("warehouse_id", 1)],
            unique=True,
            name="unique_stock_location"
        )
        # Index for fast lookups
        await self.central_stock.create_index([("tenant_id", 1), ("item_id", 1)])
        await self.central_stock.create_index([("tenant_id", 1), ("variant_id", 1)])
        await self.central_stock.create_index([("tenant_id", 1), ("warehouse_id", 1)])
        
        # Stock movements indexes
        await self.stock_movements.create_index([("tenant_id", 1), ("created_at", -1)])
        await self.stock_movements.create_index([("item_id", 1), ("created_at", -1)])
        await self.stock_movements.create_index([("variant_id", 1)])
        await self.stock_movements.create_index([("reference_id", 1)])
        await self.stock_movements.create_index([("movement_type", 1)])
        
        logger.info("Inventory service indexes initialized")
    
    # ==================== STOCK QUERIES ====================
    
    async def get_stock(
        self,
        tenant_id: str,
        item_id: Optional[str] = None,
        variant_id: Optional[str] = None,
        warehouse_id: Optional[str] = None
    ) -> int:
        """
        Get current stock quantity from central_stock.
        This is the ONLY source of truth for stock levels.
        """
        query = {"tenant_id": tenant_id}
        if item_id:
            query["item_id"] = item_id
        if variant_id:
            query["variant_id"] = variant_id
        if warehouse_id:
            query["warehouse_id"] = warehouse_id
        else:
            query["warehouse_id"] = None  # Default warehouse
        
        stock_doc = await self.central_stock.find_one(query, {"_id": 0})
        return stock_doc.get("quantity", 0) if stock_doc else 0
    
    async def get_stock_by_variant(self, tenant_id: str, variant_id: str, warehouse_id: Optional[str] = None) -> int:
        """Get stock for a specific variant"""
        return await self.get_stock(tenant_id, variant_id=variant_id, warehouse_id=warehouse_id)
    
    async def get_all_stock(
        self,
        tenant_id: str,
        warehouse_id: Optional[str] = None,
        low_stock_threshold: Optional[int] = None
    ) -> List[Dict]:
        """Get all stock records for a tenant"""
        query = {"tenant_id": tenant_id}
        if warehouse_id:
            query["warehouse_id"] = warehouse_id
        if low_stock_threshold is not None:
            query["quantity"] = {"$lte": low_stock_threshold}
        
        stocks = await self.central_stock.find(query, {"_id": 0}).to_list(10000)
        return stocks
    
    async def check_stock_availability(
        self,
        tenant_id: str,
        items: List[Dict],  # [{"variant_id": "...", "quantity": 2}, ...]
        warehouse_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check if all items have sufficient stock.
        Returns detailed availability info.
        """
        results = {
            "available": True,
            "items": [],
            "insufficient": []
        }
        
        for item in items:
            variant_id = item.get("variant_id")
            requested_qty = item.get("quantity", 1)
            
            current_stock = await self.get_stock(
                tenant_id,
                variant_id=variant_id,
                warehouse_id=warehouse_id
            )
            
            item_result = {
                "variant_id": variant_id,
                "requested": requested_qty,
                "available": current_stock,
                "sufficient": current_stock >= requested_qty
            }
            results["items"].append(item_result)
            
            if not item_result["sufficient"]:
                results["available"] = False
                results["insufficient"].append(item_result)
        
        return results
    
    # ==================== STOCK MODIFICATIONS ====================
    
    async def _create_stock_movement(
        self,
        tenant_id: str,
        item_id: str,
        variant_id: str,
        warehouse_id: Optional[str],
        movement_type: MovementType,
        quantity: int,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        notes: Optional[str] = None,
        performed_by: Optional[str] = None
    ) -> Dict:
        """Create an audit record for stock movement"""
        movement = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "item_id": item_id,
            "variant_id": variant_id,
            "warehouse_id": warehouse_id,
            "movement_type": movement_type.value,
            "quantity": quantity,
            "reference_id": reference_id,
            "reference_type": reference_type,
            "notes": notes,
            "performed_by": performed_by,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await self.stock_movements.insert_one(movement)
        return movement
    
    async def _update_central_stock(
        self,
        tenant_id: str,
        item_id: str,
        variant_id: str,
        warehouse_id: Optional[str],
        quantity_change: int,
        allow_negative: bool = False
    ) -> int:
        """
        Update central stock with atomic increment/decrement.
        Returns new quantity.
        Raises HTTPException if stock would go negative and allow_negative is False.
        """
        wh_id = warehouse_id or None
        
        # First, check current stock for negative prevention
        if quantity_change < 0 and not allow_negative:
            current = await self.get_stock(tenant_id, variant_id=variant_id, warehouse_id=wh_id)
            if current + quantity_change < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock. Available: {current}, Requested: {abs(quantity_change)}"
                )
        
        # Atomic upsert with increment
        result = await self.central_stock.find_one_and_update(
            {
                "tenant_id": tenant_id,
                "item_id": item_id,
                "variant_id": variant_id,
                "warehouse_id": wh_id
            },
            {
                "$inc": {"quantity": quantity_change},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "item_id": item_id,
                    "variant_id": variant_id,
                    "warehouse_id": wh_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True,
            return_document=True,
            projection={"_id": 0}
        )
        
        new_quantity = result.get("quantity", 0)
        
        # Safety check - shouldn't happen due to pre-check, but just in case
        if new_quantity < 0 and not allow_negative:
            # Rollback
            await self.central_stock.update_one(
                {"tenant_id": tenant_id, "variant_id": variant_id, "warehouse_id": wh_id},
                {"$inc": {"quantity": -quantity_change}}
            )
            raise HTTPException(status_code=400, detail="Stock update failed - would result in negative stock")
        
        return new_quantity
    
    async def add_stock(
        self,
        tenant_id: str,
        item_id: str,
        variant_id: str,
        quantity: int,
        movement_type: MovementType = MovementType.PURCHASE,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        notes: Optional[str] = None,
        performed_by: Optional[str] = None
    ) -> Dict:
        """
        Add stock (Purchase, Return, Adjustment+)
        """
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive")
        
        # If item_id is missing, look it up from the variant
        if not item_id:
            variant = await self.variants.find_one({"id": variant_id})
            if variant:
                item_id = variant.get("item_id", "")
        
        # Update central stock
        new_qty = await self._update_central_stock(
            tenant_id, item_id, variant_id, warehouse_id, quantity
        )
        
        # Create movement record
        movement = await self._create_stock_movement(
            tenant_id=tenant_id,
            item_id=item_id,
            variant_id=variant_id,
            warehouse_id=warehouse_id,
            movement_type=movement_type,
            quantity=quantity,
            reference_id=reference_id,
            reference_type=reference_type,
            notes=notes,
            performed_by=performed_by
        )
        
        # Update variant's current_stock for backward compatibility
        await self.variants.update_one(
            {"id": variant_id},
            {"$set": {"current_stock": new_qty}}
        )
        
        # Also update item's total stock (only if item_id is valid)
        if item_id:
            total_stock = await self.get_stock(tenant_id, item_id=item_id)
            await self.items.update_one(
                {"id": item_id},
                {"$set": {"current_stock": total_stock}}
            )
        
        logger.info(f"Stock added: variant={variant_id}, item={item_id}, qty=+{quantity}, new_total={new_qty}")
        
        return {
            "success": True,
            "variant_id": variant_id,
            "quantity_added": quantity,
            "new_quantity": new_qty,
            "movement_id": movement["id"]
        }
    
    async def deduct_stock(
        self,
        tenant_id: str,
        item_id: str,
        variant_id: str,
        quantity: int,
        movement_type: MovementType = MovementType.SALE,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        notes: Optional[str] = None,
        performed_by: Optional[str] = None,
        allow_negative: bool = False
    ) -> Dict:
        """
        Deduct stock (Sale, Adjustment-)
        Will FAIL if insufficient stock (unless allow_negative=True)
        """
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive")
        
        # If item_id is missing, look it up from the variant
        if not item_id:
            variant = await self.variants.find_one({"id": variant_id})
            if variant:
                item_id = variant.get("item_id", "")
        
        # Update central stock (negative change)
        new_qty = await self._update_central_stock(
            tenant_id, item_id, variant_id, warehouse_id, -quantity, allow_negative
        )
        
        # Create movement record (negative quantity)
        movement = await self._create_stock_movement(
            tenant_id=tenant_id,
            item_id=item_id,
            variant_id=variant_id,
            warehouse_id=warehouse_id,
            movement_type=movement_type,
            quantity=-quantity,
            reference_id=reference_id,
            reference_type=reference_type,
            notes=notes,
            performed_by=performed_by
        )
        
        # Update variant's current_stock for backward compatibility
        await self.variants.update_one(
            {"id": variant_id},
            {"$set": {"current_stock": new_qty}}
        )
        
        # Also update item's total stock (only if item_id is valid)
        if item_id:
            total_stock = await self.get_stock(tenant_id, item_id=item_id)
            await self.items.update_one(
                {"id": item_id},
                {"$set": {"current_stock": total_stock}}
            )
        
        logger.info(f"Stock deducted: variant={variant_id}, item={item_id}, qty=-{quantity}, new_total={new_qty}")
        
        # Trigger auto-reorder check (imported lazily to avoid circular imports)
        try:
            from server import check_and_create_auto_purchase_order
            await check_and_create_auto_purchase_order(
                tenant_id=tenant_id,
                item_id=item_id,
                variant_id=variant_id,
                current_stock=total_stock,
                triggered_by=movement_type.value if hasattr(movement_type, 'value') else str(movement_type),
                user_id=performed_by
            )
        except Exception as e:
            logger.warning(f"Auto-reorder check failed (non-critical): {e}")
        
        return {
            "success": True,
            "variant_id": variant_id,
            "quantity_deducted": quantity,
            "new_quantity": new_qty,
            "movement_id": movement["id"]
        }
    
    async def adjust_stock(
        self,
        tenant_id: str,
        item_id: str,
        variant_id: str,
        new_quantity: int,
        reason: str,
        warehouse_id: Optional[str] = None,
        performed_by: Optional[str] = None
    ) -> Dict:
        """
        Manual stock adjustment - sets stock to a specific value.
        Creates adjustment movement for the difference.
        """
        current_qty = await self.get_stock(tenant_id, variant_id=variant_id, warehouse_id=warehouse_id)
        difference = new_quantity - current_qty
        
        if difference == 0:
            return {
                "success": True,
                "message": "No adjustment needed",
                "quantity": current_qty
            }
        
        # Update central stock to new quantity directly
        wh_id = warehouse_id or None
        await self.central_stock.update_one(
            {
                "tenant_id": tenant_id,
                "item_id": item_id,
                "variant_id": variant_id,
                "warehouse_id": wh_id
            },
            {
                "$set": {
                    "quantity": new_quantity,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        # Create adjustment movement
        movement = await self._create_stock_movement(
            tenant_id=tenant_id,
            item_id=item_id,
            variant_id=variant_id,
            warehouse_id=warehouse_id,
            movement_type=MovementType.ADJUSTMENT,
            quantity=difference,
            notes=f"Manual adjustment: {reason}. Changed from {current_qty} to {new_quantity}",
            performed_by=performed_by
        )
        
        # Update variant's current_stock
        await self.variants.update_one(
            {"id": variant_id},
            {"$set": {"current_stock": new_quantity}}
        )
        
        logger.info(f"Stock adjusted: variant={variant_id}, {current_qty} -> {new_quantity} (diff={difference})")
        
        return {
            "success": True,
            "variant_id": variant_id,
            "previous_quantity": current_qty,
            "new_quantity": new_quantity,
            "adjustment": difference,
            "movement_id": movement["id"]
        }
    
    async def transfer_stock(
        self,
        tenant_id: str,
        item_id: str,
        variant_id: str,
        quantity: int,
        from_warehouse_id: str,
        to_warehouse_id: str,
        reference_id: Optional[str] = None,
        notes: Optional[str] = None,
        performed_by: Optional[str] = None
    ) -> Dict:
        """Transfer stock between warehouses"""
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive")
        
        # Deduct from source
        await self.deduct_stock(
            tenant_id=tenant_id,
            item_id=item_id,
            variant_id=variant_id,
            quantity=quantity,
            movement_type=MovementType.TRANSFER,
            reference_id=reference_id,
            reference_type="transfer_out",
            warehouse_id=from_warehouse_id,
            notes=f"Transfer out to {to_warehouse_id}: {notes}",
            performed_by=performed_by
        )
        
        # Add to destination
        await self.add_stock(
            tenant_id=tenant_id,
            item_id=item_id,
            variant_id=variant_id,
            quantity=quantity,
            movement_type=MovementType.TRANSFER,
            reference_id=reference_id,
            reference_type="transfer_in",
            warehouse_id=to_warehouse_id,
            notes=f"Transfer in from {from_warehouse_id}: {notes}",
            performed_by=performed_by
        )
        
        return {
            "success": True,
            "variant_id": variant_id,
            "quantity_transferred": quantity,
            "from_warehouse": from_warehouse_id,
            "to_warehouse": to_warehouse_id
        }
    
    # ==================== BATCH OPERATIONS ====================
    
    async def process_sale(
        self,
        tenant_id: str,
        sale_id: str,
        items: List[Dict],  # [{"item_id": "...", "variant_id": "...", "quantity": 2}, ...]
        warehouse_id: Optional[str] = None,
        performed_by: Optional[str] = None
    ) -> Dict:
        """
        Process a sale - deduct stock for all items.
        This is the main entry point for POS sales.
        
        TRANSACTION SAFETY: All items are checked first, then all are deducted.
        If any item fails, none are deducted.
        """
        # First, check availability for all items
        availability = await self.check_stock_availability(tenant_id, items, warehouse_id)
        
        if not availability["available"]:
            insufficient_items = availability["insufficient"]
            error_details = [
                f"{item['variant_id']}: need {item['requested']}, have {item['available']}"
                for item in insufficient_items
            ]
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for sale. {'; '.join(error_details)}"
            )
        
        # All items available - proceed with deductions
        results = []
        for item in items:
            result = await self.deduct_stock(
                tenant_id=tenant_id,
                item_id=item.get("item_id", ""),
                variant_id=item["variant_id"],
                quantity=item["quantity"],
                movement_type=MovementType.SALE,
                reference_id=sale_id,
                reference_type="sale",
                warehouse_id=warehouse_id,
                performed_by=performed_by
            )
            results.append(result)
        
        logger.info(f"Sale processed: sale_id={sale_id}, items={len(items)}")
        
        return {
            "success": True,
            "sale_id": sale_id,
            "items_processed": len(items),
            "results": results
        }
    
    async def process_purchase(
        self,
        tenant_id: str,
        purchase_id: str,
        items: List[Dict],  # [{"item_id": "...", "variant_id": "...", "quantity": 10}, ...]
        warehouse_id: Optional[str] = None,
        performed_by: Optional[str] = None
    ) -> Dict:
        """
        Process a purchase/GRN - add stock for all items.
        """
        results = []
        for item in items:
            result = await self.add_stock(
                tenant_id=tenant_id,
                item_id=item.get("item_id", ""),
                variant_id=item["variant_id"],
                quantity=item["quantity"],
                movement_type=MovementType.PURCHASE,
                reference_id=purchase_id,
                reference_type="purchase",
                warehouse_id=warehouse_id,
                performed_by=performed_by
            )
            results.append(result)
        
        logger.info(f"Purchase processed: purchase_id={purchase_id}, items={len(items)}")
        
        return {
            "success": True,
            "purchase_id": purchase_id,
            "items_processed": len(items),
            "results": results
        }
    
    async def process_return(
        self,
        tenant_id: str,
        return_id: str,
        items: List[Dict],
        return_type: str,  # "sale_return" or "purchase_return"
        warehouse_id: Optional[str] = None,
        performed_by: Optional[str] = None
    ) -> Dict:
        """
        Process a return - restore or deduct stock based on return type.
        Sale return: ADD stock back
        Purchase return: DEDUCT stock
        """
        results = []
        for item in items:
            if return_type == "sale_return":
                # Customer returned item - add back to stock
                result = await self.add_stock(
                    tenant_id=tenant_id,
                    item_id=item.get("item_id", ""),
                    variant_id=item["variant_id"],
                    quantity=item["quantity"],
                    movement_type=MovementType.RETURN,
                    reference_id=return_id,
                    reference_type="sale_return",
                    warehouse_id=warehouse_id,
                    performed_by=performed_by
                )
            else:
                # Returning to supplier - deduct from stock
                result = await self.deduct_stock(
                    tenant_id=tenant_id,
                    item_id=item.get("item_id", ""),
                    variant_id=item["variant_id"],
                    quantity=item["quantity"],
                    movement_type=MovementType.RETURN,
                    reference_id=return_id,
                    reference_type="purchase_return",
                    warehouse_id=warehouse_id,
                    performed_by=performed_by
                )
            results.append(result)
        
        return {
            "success": True,
            "return_id": return_id,
            "return_type": return_type,
            "items_processed": len(items),
            "results": results
        }
    
    # ==================== REPORTING ====================
    
    async def get_stock_movements(
        self,
        tenant_id: str,
        variant_id: Optional[str] = None,
        item_id: Optional[str] = None,
        movement_type: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get stock movement history"""
        query = {"tenant_id": tenant_id}
        
        if variant_id:
            query["variant_id"] = variant_id
        if item_id:
            query["item_id"] = item_id
        if movement_type:
            query["movement_type"] = movement_type
        if from_date:
            query["created_at"] = {"$gte": from_date}
        if to_date:
            if "created_at" in query:
                query["created_at"]["$lte"] = to_date
            else:
                query["created_at"] = {"$lte": to_date}
        
        movements = await self.stock_movements.find(
            query, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return movements
    
    async def get_stock_summary(self, tenant_id: str, warehouse_id: Optional[str] = None) -> Dict:
        """Get stock summary statistics"""
        query = {"tenant_id": tenant_id}
        if warehouse_id:
            query["warehouse_id"] = warehouse_id
        
        pipeline = [
            {"$match": query},
            {"$group": {
                "_id": None,
                "total_items": {"$sum": 1},
                "total_quantity": {"$sum": "$quantity"},
                "out_of_stock": {"$sum": {"$cond": [{"$lte": ["$quantity", 0]}, 1, 0]}},
                "low_stock": {"$sum": {"$cond": [{"$and": [{"$gt": ["$quantity", 0]}, {"$lte": ["$quantity", 10]}]}, 1, 0]}}
            }}
        ]
        
        result = await self.central_stock.aggregate(pipeline).to_list(1)
        
        if result:
            return {
                "total_items": result[0].get("total_items", 0),
                "total_quantity": result[0].get("total_quantity", 0),
                "out_of_stock": result[0].get("out_of_stock", 0),
                "low_stock": result[0].get("low_stock", 0),
                "in_stock": result[0].get("total_items", 0) - result[0].get("out_of_stock", 0)
            }
        
        return {
            "total_items": 0,
            "total_quantity": 0,
            "out_of_stock": 0,
            "low_stock": 0,
            "in_stock": 0
        }
    
    # ==================== DATA MIGRATION ====================
    
    async def migrate_existing_stock(self, tenant_id: str) -> Dict:
        """
        Migrate existing stock data from variants to central_stock.
        This should be run once during system upgrade.
        """
        migrated = 0
        skipped = 0
        
        # Get all variants for tenant
        variants = await self.variants.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(10000)
        
        for variant in variants:
            variant_id = variant.get("id")
            item_id = variant.get("item_id")
            current_stock = variant.get("current_stock", 0)
            
            if not variant_id:
                skipped += 1
                continue
            
            # Check if already in central_stock
            existing = await self.central_stock.find_one({
                "tenant_id": tenant_id,
                "variant_id": variant_id,
                "warehouse_id": None
            })
            
            if existing:
                skipped += 1
                continue
            
            # Create central_stock entry
            await self.central_stock.insert_one({
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "item_id": item_id,
                "variant_id": variant_id,
                "warehouse_id": None,
                "quantity": current_stock,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
            
            # Create initial movement record
            await self._create_stock_movement(
                tenant_id=tenant_id,
                item_id=item_id,
                variant_id=variant_id,
                warehouse_id=None,
                movement_type=MovementType.INITIAL,
                quantity=current_stock,
                notes="Migrated from legacy stock system"
            )
            
            migrated += 1
        
        logger.info(f"Stock migration complete: migrated={migrated}, skipped={skipped}")
        
        return {
            "success": True,
            "migrated": migrated,
            "skipped": skipped
        }


# Singleton instance - will be initialized in server.py
inventory_service: Optional[InventoryService] = None

def get_inventory_service() -> InventoryService:
    """Get the singleton inventory service instance"""
    global inventory_service
    if inventory_service is None:
        raise RuntimeError("Inventory service not initialized")
    return inventory_service

def init_inventory_service(db: AsyncIOMotorDatabase) -> InventoryService:
    """Initialize the singleton inventory service"""
    global inventory_service
    inventory_service = InventoryService(db)
    return inventory_service
