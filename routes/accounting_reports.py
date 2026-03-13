"""
Accounting Reports Routes Module

Handles all accounting report operations:
- Trial Balance
- Balance Sheet
- Profit & Loss Statement
- Cash Flow Statement
- General Ledger Reports
- Day Book
- Journal Register

Permission key: reports, accounting
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accounting", tags=["Accounting Reports"])

from utils.deps import get_db, get_current_user, get_tenant_id, require_permission


@router.get("/reports/trial-balance")
async def get_trial_balance(
    as_of_date: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get Trial Balance report"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    if not as_of_date:
        as_of_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get all ledger accounts with their balances
    accounts = await db.ledger_accounts.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Get transactions up to as_of_date
    transactions = await db.central_ledger.find({
        "tenant_id": tenant_id,
        "date": {"$lte": as_of_date + "T23:59:59"}
    }, {"_id": 0}).to_list(50000)
    
    # Calculate balances
    account_balances = {}
    for txn in transactions:
        acc_name = txn.get("account", "Unknown")
        if acc_name not in account_balances:
            account_balances[acc_name] = {"debit": 0, "credit": 0}
        account_balances[acc_name]["debit"] += txn.get("debit", 0)
        account_balances[acc_name]["credit"] += txn.get("credit", 0)
    
    # Build trial balance
    trial_balance = []
    total_debit = 0
    total_credit = 0
    
    for acc_name, balances in account_balances.items():
        debit = balances["debit"]
        credit = balances["credit"]
        net = debit - credit
        
        row = {
            "account": acc_name,
            "debit": debit if net >= 0 else 0,
            "credit": abs(net) if net < 0 else 0
        }
        trial_balance.append(row)
        total_debit += row["debit"]
        total_credit += row["credit"]
    
    return {
        "as_of_date": as_of_date,
        "accounts": trial_balance,
        "totals": {
            "debit": total_debit,
            "credit": total_credit,
            "balanced": abs(total_debit - total_credit) < 0.01
        }
    }


@router.get("/reports/balance-sheet")
async def get_balance_sheet(
    as_of_date: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get Balance Sheet report"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    if not as_of_date:
        as_of_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get transactions up to date
    transactions = await db.central_ledger.find({
        "tenant_id": tenant_id,
        "date": {"$lte": as_of_date + "T23:59:59"}
    }, {"_id": 0}).to_list(50000)
    
    # Classify accounts
    assets = {}
    liabilities = {}
    equity = {}
    
    asset_keywords = ["cash", "bank", "receivable", "inventory", "asset", "equipment", "prepaid"]
    liability_keywords = ["payable", "liability", "loan", "credit", "accrued"]
    equity_keywords = ["capital", "equity", "retained", "reserve", "drawing"]
    
    for txn in transactions:
        acc_name = txn.get("account", "").lower()
        amount = txn.get("debit", 0) - txn.get("credit", 0)
        original_name = txn.get("account", "Unknown")
        
        # Classify based on keywords
        if any(kw in acc_name for kw in asset_keywords):
            assets[original_name] = assets.get(original_name, 0) + amount
        elif any(kw in acc_name for kw in liability_keywords):
            liabilities[original_name] = liabilities.get(original_name, 0) - amount
        elif any(kw in acc_name for kw in equity_keywords):
            equity[original_name] = equity.get(original_name, 0) - amount
    
    total_assets = sum(assets.values())
    total_liabilities = sum(liabilities.values())
    total_equity = sum(equity.values())
    
    return {
        "as_of_date": as_of_date,
        "assets": {
            "accounts": [{"name": k, "balance": v} for k, v in assets.items()],
            "total": total_assets
        },
        "liabilities": {
            "accounts": [{"name": k, "balance": v} for k, v in liabilities.items()],
            "total": total_liabilities
        },
        "equity": {
            "accounts": [{"name": k, "balance": v} for k, v in equity.items()],
            "total": total_equity
        },
        "balanced": abs(total_assets - (total_liabilities + total_equity)) < 0.01
    }


@router.get("/reports/profit-loss")
async def get_profit_loss_statement(
    start_date: str = "",
    end_date: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get Profit & Loss Statement"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    # Default to current month
    if not start_date:
        start_date = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get transactions in period
    transactions = await db.central_ledger.find({
        "tenant_id": tenant_id,
        "date": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
    }, {"_id": 0}).to_list(50000)
    
    # Classify into revenue and expenses
    revenue = {}
    expenses = {}
    
    revenue_keywords = ["sales", "income", "revenue", "service", "fee", "interest income"]
    expense_keywords = ["expense", "cost", "salary", "rent", "utility", "purchase", "cogs"]
    
    for txn in transactions:
        acc_name = txn.get("account", "").lower()
        credit = txn.get("credit", 0)
        debit = txn.get("debit", 0)
        original_name = txn.get("account", "Unknown")
        
        if any(kw in acc_name for kw in revenue_keywords):
            revenue[original_name] = revenue.get(original_name, 0) + credit - debit
        elif any(kw in acc_name for kw in expense_keywords):
            expenses[original_name] = expenses.get(original_name, 0) + debit - credit
    
    total_revenue = sum(revenue.values())
    total_expenses = sum(expenses.values())
    net_profit = total_revenue - total_expenses
    
    return {
        "period": {"start": start_date, "end": end_date},
        "revenue": {
            "accounts": [{"name": k, "amount": v} for k, v in revenue.items()],
            "total": total_revenue
        },
        "expenses": {
            "accounts": [{"name": k, "amount": v} for k, v in expenses.items()],
            "total": total_expenses
        },
        "net_profit": net_profit,
        "profit_margin": (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    }


@router.get("/reports/cash-flow")
async def get_cash_flow_statement(
    start_date: str = "",
    end_date: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get Cash Flow Statement"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    if not start_date:
        start_date = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get cash/bank transactions
    cash_accounts = ["cash", "bank", "petty cash"]
    
    transactions = await db.central_ledger.find({
        "tenant_id": tenant_id,
        "date": {"$gte": start_date, "$lte": end_date + "T23:59:59"},
        "$or": [
            {"account": {"$regex": "|".join(cash_accounts), "$options": "i"}}
        ]
    }, {"_id": 0}).to_list(10000)
    
    # Categorize cash flows
    operating = []
    investing = []
    financing = []
    
    for txn in transactions:
        narrative = txn.get("narrative", "").lower()
        amount = txn.get("debit", 0) - txn.get("credit", 0)
        
        flow_item = {
            "description": txn.get("narrative", ""),
            "amount": amount,
            "date": txn.get("date", "")
        }
        
        if "loan" in narrative or "capital" in narrative or "dividend" in narrative:
            financing.append(flow_item)
        elif "asset" in narrative or "equipment" in narrative or "investment" in narrative:
            investing.append(flow_item)
        else:
            operating.append(flow_item)
    
    return {
        "period": {"start": start_date, "end": end_date},
        "operating_activities": {
            "items": operating[:50],
            "total": sum(i["amount"] for i in operating)
        },
        "investing_activities": {
            "items": investing[:50],
            "total": sum(i["amount"] for i in investing)
        },
        "financing_activities": {
            "items": financing[:50],
            "total": sum(i["amount"] for i in financing)
        },
        "net_cash_flow": sum(i["amount"] for i in operating + investing + financing)
    }


@router.get("/reports/day-book")
async def get_day_book(
    date: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get Day Book - all transactions for a specific day"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    transactions = await db.central_ledger.find({
        "tenant_id": tenant_id,
        "date": {"$regex": f"^{date}"}
    }, {"_id": 0}).sort("date", 1).to_list(1000)
    
    # Group by voucher/transaction
    total_debit = sum(t.get("debit", 0) for t in transactions)
    total_credit = sum(t.get("credit", 0) for t in transactions)
    
    return {
        "date": date,
        "entries": transactions,
        "summary": {
            "total_entries": len(transactions),
            "total_debit": total_debit,
            "total_credit": total_credit
        }
    }


@router.get("/reports/ledger/{account_name}")
async def get_account_ledger(
    account_name: str,
    start_date: str = "",
    end_date: str = "",
    user: dict = Depends(require_permission("reports"))
):
    """Get ledger report for a specific account"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    query = {
        "tenant_id": tenant_id,
        "account": {"$regex": account_name, "$options": "i"}
    }
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date + "T23:59:59"
        else:
            query["date"] = {"$lte": end_date + "T23:59:59"}
    
    transactions = await db.central_ledger.find(query, {"_id": 0}).sort("date", 1).to_list(5000)
    
    # Calculate running balance
    running_balance = 0
    for txn in transactions:
        running_balance += txn.get("debit", 0) - txn.get("credit", 0)
        txn["running_balance"] = running_balance
    
    return {
        "account": account_name,
        "period": {"start": start_date or "all", "end": end_date or "all"},
        "transactions": transactions,
        "closing_balance": running_balance
    }
