"""
Reports Routes Module

Handles all reporting operations:
- Sales reports
- Purchase reports  
- Inventory reports
- Financial reports

Permission key: reports
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Reports"])

from utils.deps import get_db, get_current_user, get_tenant_id, require_permission


# ============== SALES REPORTS ==============

@router.get("/reports/sales/summary")
async def sales_summary_report(
    start_date: str = "",
    end_date: str = "",
    store_id: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get sales summary report"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id}
    
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    if store_id:
        query["store_id"] = store_id
    
    # Get sales data
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    
    total_sales = len(sales)
    total_revenue = sum(s.get("total_amount", 0) for s in sales)
    total_discount = sum(s.get("discount_amount", 0) for s in sales)
    total_tax = sum(s.get("tax_amount", 0) for s in sales)
    
    # Payment breakdown
    payment_breakdown = {}
    for sale in sales:
        pm = sale.get("payment_method", "cash")
        if pm not in payment_breakdown:
            payment_breakdown[pm] = {"count": 0, "amount": 0}
        payment_breakdown[pm]["count"] += 1
        payment_breakdown[pm]["amount"] += sale.get("total_amount", 0)
    
    return {
        "summary": {
            "total_sales": total_sales,
            "total_revenue": total_revenue,
            "total_discount": total_discount,
            "total_tax": total_tax,
            "average_sale": total_revenue / total_sales if total_sales > 0 else 0
        },
        "payment_breakdown": payment_breakdown,
        "period": {
            "start": start_date or "all",
            "end": end_date or "all"
        }
    }


@router.get("/reports/sales/daily")
async def daily_sales_report(
    date: str = "",
    store_id: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get daily sales report"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    query = {
        "tenant_id": tenant_id,
        "created_at": {"$regex": f"^{date}"}
    }
    
    if store_id:
        query["store_id"] = store_id
    
    sales = await db.sales.find(query, {"_id": 0}).to_list(1000)
    
    # Hourly breakdown
    hourly = {}
    for sale in sales:
        hour = sale.get("created_at", "")[:13]  # YYYY-MM-DDTHH
        if hour not in hourly:
            hourly[hour] = {"count": 0, "amount": 0}
        hourly[hour]["count"] += 1
        hourly[hour]["amount"] += sale.get("total_amount", 0)
    
    return {
        "date": date,
        "total_sales": len(sales),
        "total_revenue": sum(s.get("total_amount", 0) for s in sales),
        "hourly_breakdown": hourly,
        "sales": sales[:50]  # Limit to 50 for response size
    }


# ============== PURCHASE REPORTS ==============

@router.get("/reports/purchases/summary")
async def purchase_summary_report(
    start_date: str = "",
    end_date: str = "",
    supplier_id: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get purchase summary report"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id, "is_deleted": {"$ne": True}}
    
    if start_date:
        query["invoice_date"] = {"$gte": start_date}
    if end_date:
        if "invoice_date" in query:
            query["invoice_date"]["$lte"] = end_date
        else:
            query["invoice_date"] = {"$lte": end_date}
    if supplier_id:
        query["supplier_id"] = supplier_id
    
    purchases = await db.purchase_invoices.find(query, {"_id": 0}).to_list(10000)
    
    total_purchases = len(purchases)
    total_amount = sum(p.get("total_amount", 0) for p in purchases)
    total_paid = sum(p.get("amount_paid", 0) for p in purchases)
    total_due = total_amount - total_paid
    
    # Supplier breakdown
    by_supplier = {}
    for p in purchases:
        sid = p.get("supplier_id", "unknown")
        sname = p.get("supplier_name", "Unknown")
        if sid not in by_supplier:
            by_supplier[sid] = {"name": sname, "count": 0, "amount": 0}
        by_supplier[sid]["count"] += 1
        by_supplier[sid]["amount"] += p.get("total_amount", 0)
    
    return {
        "summary": {
            "total_purchases": total_purchases,
            "total_amount": total_amount,
            "total_paid": total_paid,
            "total_due": total_due
        },
        "by_supplier": list(by_supplier.values()),
        "period": {
            "start": start_date or "all",
            "end": end_date or "all"
        }
    }


# ============== INVENTORY REPORTS ==============

@router.get("/reports/inventory/stock-levels")
async def stock_levels_report(
    store_id: str = "",
    category_id: str = "",
    low_stock_only: bool = False,
    user: dict = Depends(require_permission("reports"))
):
    """Get stock levels report"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id, "is_deleted": {"$ne": True}}
    
    if store_id:
        query["store_id"] = store_id
    if category_id:
        query["category_id"] = category_id
    
    items = await db.items.find(query, {"_id": 0}).to_list(5000)
    
    # Filter low stock if requested
    if low_stock_only:
        items = [i for i in items if i.get("current_stock", 0) <= i.get("reorder_point", 10)]
    
    # Calculate totals
    total_items = len(items)
    total_stock_value = sum(
        i.get("current_stock", 0) * i.get("cost_price", 0) 
        for i in items
    )
    low_stock_count = sum(
        1 for i in items 
        if i.get("current_stock", 0) <= i.get("reorder_point", 10)
    )
    out_of_stock = sum(1 for i in items if i.get("current_stock", 0) == 0)
    
    return {
        "summary": {
            "total_items": total_items,
            "total_stock_value": total_stock_value,
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock
        },
        "items": items[:100]  # Limit for response size
    }


@router.get("/reports/inventory/movement")
async def stock_movement_report(
    start_date: str = "",
    end_date: str = "",
    item_id: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get stock movement report"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id}
    
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": end_date + "T23:59:59"}
    if item_id:
        query["item_id"] = item_id
    
    movements = await db.stock_audit_trail.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Group by type
    by_type = {}
    for m in movements:
        mtype = m.get("type", "other")
        if mtype not in by_type:
            by_type[mtype] = {"count": 0, "quantity": 0}
        by_type[mtype]["count"] += 1
        by_type[mtype]["quantity"] += abs(m.get("quantity_change", 0))
    
    return {
        "summary": {
            "total_movements": len(movements),
            "by_type": by_type
        },
        "movements": movements[:100]
    }


# ============== FINANCIAL REPORTS ==============

@router.get("/reports/financial/profit-loss")
async def profit_loss_report(
    start_date: str = "",
    end_date: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get profit/loss report"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    # Date range query
    date_query = {}
    if start_date:
        date_query["$gte"] = start_date
    if end_date:
        date_query["$lte"] = end_date + "T23:59:59"
    
    # Sales revenue
    sales_query = {"tenant_id": tenant_id}
    if date_query:
        sales_query["created_at"] = date_query
    
    sales = await db.sales.find(sales_query, {"_id": 0}).to_list(10000)
    total_revenue = sum(s.get("total_amount", 0) for s in sales)
    cogs = sum(
        sum(item.get("cost_price", 0) * item.get("quantity", 0) for item in s.get("items", []))
        for s in sales
    )
    
    # Purchase expenses
    purchase_query = {"tenant_id": tenant_id, "is_deleted": {"$ne": True}}
    if date_query:
        purchase_query["invoice_date"] = date_query if start_date else {}
    
    purchases = await db.purchase_invoices.find(purchase_query, {"_id": 0}).to_list(10000)
    total_purchases = sum(p.get("total_amount", 0) for p in purchases)
    
    # Calculate profit
    gross_profit = total_revenue - cogs
    net_profit = gross_profit  # Simplified - would include other expenses in full implementation
    
    return {
        "period": {
            "start": start_date or "all",
            "end": end_date or "all"
        },
        "revenue": {
            "total_sales": total_revenue,
            "sales_count": len(sales)
        },
        "expenses": {
            "cost_of_goods_sold": cogs,
            "purchases": total_purchases
        },
        "profit": {
            "gross_profit": gross_profit,
            "gross_margin_percent": (gross_profit / total_revenue * 100) if total_revenue > 0 else 0,
            "net_profit": net_profit
        }
    }
