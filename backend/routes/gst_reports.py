"""
GST Reports Routes Module

Handles all GST-related reports:
- GSTR-1 (Outward supplies)
- GSTR-3B (Summary return)
- HSN Summary
- GST Reconciliation

Permission key: reports, gst
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gst", tags=["GST Reports"])

from utils.deps import get_db, get_current_user, get_tenant_id, require_permission


@router.get("/reports/gstr1")
async def get_gstr1_report(
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
    user: dict = Depends(require_permission("reports"))
):
    """
    Generate GSTR-1 report (Outward Supplies)
    Returns data for B2B, B2C, Exports, Advances, etc.
    """
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    # Get all sales invoices in period
    sales = await db.sales.find({
        "tenant_id": tenant_id,
        "created_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
    }, {"_id": 0}).to_list(10000)
    
    # Categorize invoices
    b2b = []  # Business to Business (with GSTIN)
    b2c_large = []  # B2C > 2.5L
    b2c_small = []  # B2C <= 2.5L
    
    for sale in sales:
        invoice_data = {
            "invoice_number": sale.get("invoice_number", ""),
            "invoice_date": sale.get("created_at", "")[:10],
            "customer_name": sale.get("customer_name", ""),
            "customer_gstin": sale.get("customer_gstin", ""),
            "taxable_value": sale.get("subtotal", 0),
            "cgst": sale.get("cgst_amount", 0),
            "sgst": sale.get("sgst_amount", 0),
            "igst": sale.get("igst_amount", 0),
            "total": sale.get("total_amount", 0)
        }
        
        if sale.get("customer_gstin"):
            b2b.append(invoice_data)
        elif sale.get("total_amount", 0) > 250000:
            b2c_large.append(invoice_data)
        else:
            b2c_small.append(invoice_data)
    
    # Calculate totals
    def calc_totals(invoices):
        return {
            "count": len(invoices),
            "taxable_value": sum(i["taxable_value"] for i in invoices),
            "cgst": sum(i["cgst"] for i in invoices),
            "sgst": sum(i["sgst"] for i in invoices),
            "igst": sum(i["igst"] for i in invoices),
            "total": sum(i["total"] for i in invoices)
        }
    
    return {
        "period": {"start": start_date, "end": end_date},
        "b2b": {
            "invoices": b2b,
            "summary": calc_totals(b2b)
        },
        "b2c_large": {
            "invoices": b2c_large,
            "summary": calc_totals(b2c_large)
        },
        "b2c_small": {
            "invoices": b2c_small,
            "summary": calc_totals(b2c_small)
        },
        "total_outward_supplies": calc_totals(b2b + b2c_large + b2c_small)
    }


@router.get("/reports/gstr3b")
async def get_gstr3b_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    user: dict = Depends(require_permission("reports"))
):
    """
    Generate GSTR-3B summary report
    Monthly summary of all GST transactions
    """
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    # Calculate date range for the month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    # Get outward supplies (sales)
    sales = await db.sales.find({
        "tenant_id": tenant_id,
        "created_at": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(10000)
    
    # Get inward supplies (purchases)
    purchases = await db.purchase_invoices.find({
        "tenant_id": tenant_id,
        "invoice_date": {"$gte": start_date, "$lt": end_date},
        "is_deleted": {"$ne": True}
    }, {"_id": 0}).to_list(10000)
    
    # Calculate output tax
    output_cgst = sum(s.get("cgst_amount", 0) for s in sales)
    output_sgst = sum(s.get("sgst_amount", 0) for s in sales)
    output_igst = sum(s.get("igst_amount", 0) for s in sales)
    output_total = output_cgst + output_sgst + output_igst
    
    # Calculate input tax credit
    input_cgst = sum(p.get("cgst_amount", 0) for p in purchases)
    input_sgst = sum(p.get("sgst_amount", 0) for p in purchases)
    input_igst = sum(p.get("igst_amount", 0) for p in purchases)
    input_total = input_cgst + input_sgst + input_igst
    
    # Net tax payable
    net_cgst = output_cgst - input_cgst
    net_sgst = output_sgst - input_sgst
    net_igst = output_igst - input_igst
    
    return {
        "period": {"month": month, "year": year},
        "outward_supplies": {
            "taxable_value": sum(s.get("subtotal", 0) for s in sales),
            "cgst": output_cgst,
            "sgst": output_sgst,
            "igst": output_igst,
            "total_tax": output_total
        },
        "inward_supplies": {
            "taxable_value": sum(p.get("subtotal", 0) for p in purchases),
            "cgst": input_cgst,
            "sgst": input_sgst,
            "igst": input_igst,
            "total_itc": input_total
        },
        "tax_payable": {
            "cgst": max(0, net_cgst),
            "sgst": max(0, net_sgst),
            "igst": max(0, net_igst),
            "total": max(0, net_cgst) + max(0, net_sgst) + max(0, net_igst)
        },
        "itc_available": {
            "cgst": input_cgst,
            "sgst": input_sgst,
            "igst": input_igst,
            "total": input_total
        }
    }


@router.get("/reports/hsn-summary")
async def get_hsn_summary(
    start_date: str = "",
    end_date: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get HSN-wise summary of sales"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    if not start_date:
        start_date = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get all sales in period
    sales = await db.sales.find({
        "tenant_id": tenant_id,
        "created_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
    }, {"_id": 0}).to_list(10000)
    
    # Aggregate by HSN code
    hsn_summary = {}
    for sale in sales:
        for item in sale.get("items", []):
            hsn = item.get("hsn_code", "0000")
            if hsn not in hsn_summary:
                hsn_summary[hsn] = {
                    "hsn_code": hsn,
                    "description": item.get("name", ""),
                    "quantity": 0,
                    "taxable_value": 0,
                    "cgst": 0,
                    "sgst": 0,
                    "igst": 0,
                    "total_value": 0
                }
            
            qty = item.get("quantity", 0)
            value = item.get("total", item.get("price", 0) * qty)
            tax_rate = item.get("gst_rate", 18)
            tax = value * tax_rate / (100 + tax_rate)
            
            hsn_summary[hsn]["quantity"] += qty
            hsn_summary[hsn]["taxable_value"] += value - tax
            hsn_summary[hsn]["cgst"] += tax / 2
            hsn_summary[hsn]["sgst"] += tax / 2
            hsn_summary[hsn]["total_value"] += value
    
    return {
        "period": {"start": start_date, "end": end_date},
        "hsn_items": list(hsn_summary.values()),
        "summary": {
            "total_taxable_value": sum(h["taxable_value"] for h in hsn_summary.values()),
            "total_tax": sum(h["cgst"] + h["sgst"] + h["igst"] for h in hsn_summary.values()),
            "total_value": sum(h["total_value"] for h in hsn_summary.values())
        }
    }


@router.get("/reports/reconciliation")
async def get_gst_reconciliation(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    user: dict = Depends(require_permission("reports"))
):
    """
    Get GST reconciliation report
    Compares books vs GSTR returns
    """
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    # Calculate date range
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    # Get sales from books
    sales = await db.sales.find({
        "tenant_id": tenant_id,
        "created_at": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(10000)
    
    # Get purchases from books
    purchases = await db.purchase_invoices.find({
        "tenant_id": tenant_id,
        "invoice_date": {"$gte": start_date, "$lt": end_date},
        "is_deleted": {"$ne": True}
    }, {"_id": 0}).to_list(10000)
    
    books_output = sum(s.get("tax_amount", 0) for s in sales)
    books_input = sum(p.get("tax_amount", 0) for p in purchases)
    
    # Note: In production, this would compare against actual GSTR filings
    # For now, we return books data
    
    return {
        "period": {"month": month, "year": year},
        "books": {
            "output_tax": books_output,
            "input_tax": books_input,
            "sales_count": len(sales),
            "purchase_count": len(purchases)
        },
        "gstr": {
            "output_tax": 0,  # Would come from GSTR portal
            "input_tax": 0,
            "status": "Not filed/fetched"
        },
        "variance": {
            "output_tax": books_output,
            "input_tax": books_input,
            "needs_attention": True
        }
    }
