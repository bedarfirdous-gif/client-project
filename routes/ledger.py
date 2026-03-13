"""
Receipt & Payment Ledger Routes
================================
Comprehensive accounting module for managing receipts and payments.

Features:
- Auto-generated voucher numbers (RCP/PMT prefix)
- Running balance calculation
- Opening balance management
- Multi-mode payments (Cash/Bank/UPI/Cheque)
- Role-based access (Admin/Accountant/Viewer)
- Filters and exports (PDF/Excel)
- Reports: Monthly summary, Cash Book, Bank Book, Day-wise

Optimized for 20L+ transactions with indexed queries.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone
from bson import ObjectId
import uuid

router = APIRouter(prefix="/api/ledger", tags=["Ledger"])

# ============== MODELS ==============

class LedgerHeadCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    head_type: str = Field(..., pattern="^(income|expense|asset|liability)$")
    description: Optional[str] = None
    parent_id: Optional[str] = None
    opening_balance: float = 0.0
    is_active: bool = True

class LedgerHeadResponse(BaseModel):
    id: str
    name: str
    head_type: str
    description: Optional[str]
    parent_id: Optional[str]
    opening_balance: float
    current_balance: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

class LedgerEntryCreate(BaseModel):
    date: str  # YYYY-MM-DD format
    particulars: str = Field(..., min_length=1, max_length=500)
    ledger_head_id: str
    entry_type: str = Field(..., pattern="^(receipt|payment)$")
    amount: float = Field(..., gt=0)
    payment_mode: str = Field(..., pattern="^(cash|bank|upi|cheque)$")
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
    
    @validator('date')
    def validate_date(cls, v):
        try:
            entry_date = datetime.strptime(v, '%Y-%m-%d').date()
            if entry_date > date.today():
                raise ValueError('Date cannot be in the future')
            return v
        except ValueError as e:
            if 'future' in str(e):
                raise
            raise ValueError('Invalid date format. Use YYYY-MM-DD')
    
    @validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('Amount must be positive')
        return round(v, 2)

class LedgerEntryUpdate(BaseModel):
    particulars: Optional[str] = None
    ledger_head_id: Optional[str] = None
    amount: Optional[float] = None
    payment_mode: Optional[str] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
    status: Optional[str] = None  # pending_approval, approved, rejected

class LedgerEntryResponse(BaseModel):
    id: str
    voucher_number: str
    date: str
    particulars: str
    ledger_head_id: str
    ledger_head_name: str
    entry_type: str
    receipt_amount: float
    payment_amount: float
    payment_mode: str
    reference_number: Optional[str]
    running_balance: float
    remarks: Optional[str]
    status: str
    created_by: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime

class OpeningBalanceUpdate(BaseModel):
    opening_balance: float
    effective_date: str  # YYYY-MM-DD

# ============== HELPER FUNCTIONS ==============

def get_db():
    """Get database connection - will be injected from main server"""
    from server import db
    return db

async def generate_voucher_number(db, entry_type: str, entry_date: str) -> str:
    """Generate unique voucher number: RCP-YYYYMMDD-XXXX or PMT-YYYYMMDD-XXXX"""
    prefix = "RCP" if entry_type == "receipt" else "PMT"
    date_part = entry_date.replace("-", "")
    
    # Get count for this date and type
    count = await db.ledger_entries.count_documents({
        "entry_type": entry_type,
        "date": entry_date,
        "tenant_id": {"$exists": True}
    })
    
    sequence = str(count + 1).zfill(4)
    return f"{prefix}-{date_part}-{sequence}"

async def calculate_running_balance(db, tenant_id: str, entry_date: str, opening_balance: float = 0) -> float:
    """Calculate running balance up to a specific date"""
    pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "date": {"$lte": entry_date},
                "status": "approved"
            }
        },
        {
            "$group": {
                "_id": None,
                "total_receipts": {
                    "$sum": {
                        "$cond": [{"$eq": ["$entry_type", "receipt"]}, "$amount", 0]
                    }
                },
                "total_payments": {
                    "$sum": {
                        "$cond": [{"$eq": ["$entry_type", "payment"]}, "$amount", 0]
                    }
                }
            }
        }
    ]
    
    result = await db.ledger_entries.aggregate(pipeline).to_list(1)
    
    if result:
        return opening_balance + result[0]["total_receipts"] - result[0]["total_payments"]
    return opening_balance

async def recalculate_running_balances(db, tenant_id: str):
    """Recalculate all running balances for a tenant (background task)"""
    # Get opening balance
    settings = await db.ledger_settings.find_one({"tenant_id": tenant_id})
    opening_balance = settings.get("opening_balance", 0) if settings else 0
    
    # Get all entries sorted by date and created_at
    entries = await db.ledger_entries.find(
        {"tenant_id": tenant_id, "status": "approved"}
    ).sort([("date", 1), ("created_at", 1)]).to_list(None)
    
    running_balance = opening_balance
    
    for entry in entries:
        if entry["entry_type"] == "receipt":
            running_balance += entry["amount"]
        else:
            running_balance -= entry["amount"]
        
        await db.ledger_entries.update_one(
            {"_id": entry["_id"]},
            {"$set": {"running_balance": running_balance}}
        )

# ============== LEDGER HEAD ROUTES ==============

@router.post("/heads", response_model=dict)
async def create_ledger_head(
    head: LedgerHeadCreate,
    current_user: dict = None,  # Will be injected
    db = None  # Will be injected
):
    """Create a new ledger head"""
    if db is None:
        db = get_db()
    
    # Check for duplicate name
    existing = await db.ledger_heads.find_one({
        "tenant_id": current_user.get("tenant_id"),
        "name": {"$regex": f"^{head.name}$", "$options": "i"}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Ledger head with this name already exists")
    
    head_doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": current_user.get("tenant_id"),
        "name": head.name,
        "head_type": head.head_type,
        "description": head.description,
        "parent_id": head.parent_id,
        "opening_balance": head.opening_balance,
        "current_balance": head.opening_balance,
        "is_active": head.is_active,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.ledger_heads.insert_one(head_doc)
    
    return {"success": True, "id": head_doc["id"], "message": "Ledger head created successfully"}

@router.get("/heads", response_model=List[dict])
async def get_ledger_heads(
    head_type: Optional[str] = None,
    is_active: bool = True,
    current_user: dict = None,
    db = None
):
    """Get all ledger heads for tenant"""
    if db is None:
        db = get_db()
    
    query = {"tenant_id": current_user.get("tenant_id")}
    
    if head_type:
        query["head_type"] = head_type
    if is_active is not None:
        query["is_active"] = is_active
    
    heads = await db.ledger_heads.find(query, {"_id": 0}).sort("name", 1).to_list(None)
    return heads

@router.put("/heads/{head_id}", response_model=dict)
async def update_ledger_head(
    head_id: str,
    head: LedgerHeadCreate,
    current_user: dict = None,
    db = None
):
    """Update a ledger head"""
    if db is None:
        db = get_db()
    
    result = await db.ledger_heads.update_one(
        {"id": head_id, "tenant_id": current_user.get("tenant_id")},
        {
            "$set": {
                "name": head.name,
                "head_type": head.head_type,
                "description": head.description,
                "is_active": head.is_active,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ledger head not found")
    
    return {"success": True, "message": "Ledger head updated successfully"}

# ============== LEDGER ENTRY ROUTES ==============

@router.post("/entries", response_model=dict)
async def create_ledger_entry(
    entry: LedgerEntryCreate,
    current_user: dict = None,
    db = None
):
    """Create a new ledger entry (receipt or payment)"""
    if db is None:
        db = get_db()
    
    tenant_id = current_user.get("tenant_id")
    
    # Validate ledger head exists
    ledger_head = await db.ledger_heads.find_one({
        "id": entry.ledger_head_id,
        "tenant_id": tenant_id
    })
    
    if not ledger_head:
        raise HTTPException(status_code=400, detail="Invalid ledger head")
    
    # Generate voucher number
    voucher_number = await generate_voucher_number(db, entry.entry_type, entry.date)
    
    # Check voucher uniqueness
    existing = await db.ledger_entries.find_one({
        "voucher_number": voucher_number,
        "tenant_id": tenant_id
    })
    
    if existing:
        # Regenerate with timestamp suffix
        voucher_number = f"{voucher_number}-{int(datetime.now().timestamp())}"
    
    # Get opening balance
    settings = await db.ledger_settings.find_one({"tenant_id": tenant_id})
    opening_balance = settings.get("opening_balance", 0) if settings else 0
    
    # Calculate running balance
    prev_balance = await calculate_running_balance(db, tenant_id, entry.date, opening_balance)
    
    if entry.entry_type == "receipt":
        running_balance = prev_balance + entry.amount
        receipt_amount = entry.amount
        payment_amount = 0
    else:
        running_balance = prev_balance - entry.amount
        receipt_amount = 0
        payment_amount = entry.amount
    
    # Determine initial status based on role
    user_role = current_user.get("role", "viewer")
    initial_status = "approved" if user_role in ["superadmin", "admin"] else "pending_approval"
    
    entry_doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "voucher_number": voucher_number,
        "date": entry.date,
        "particulars": entry.particulars,
        "ledger_head_id": entry.ledger_head_id,
        "ledger_head_name": ledger_head["name"],
        "entry_type": entry.entry_type,
        "amount": entry.amount,
        "receipt_amount": receipt_amount,
        "payment_amount": payment_amount,
        "payment_mode": entry.payment_mode,
        "reference_number": entry.reference_number,
        "running_balance": running_balance,
        "remarks": entry.remarks,
        "status": initial_status,
        "created_by": current_user.get("id"),
        "created_by_name": current_user.get("name", "Unknown"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.ledger_entries.insert_one(entry_doc)
    
    # Update ledger head current balance
    balance_change = entry.amount if entry.entry_type == "receipt" else -entry.amount
    await db.ledger_heads.update_one(
        {"id": entry.ledger_head_id},
        {"$inc": {"current_balance": balance_change}}
    )
    
    return {
        "success": True,
        "id": entry_doc["id"],
        "voucher_number": voucher_number,
        "running_balance": running_balance,
        "status": initial_status,
        "message": "Entry created successfully"
    }

@router.get("/entries", response_model=dict)
async def get_ledger_entries(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    ledger_head_id: Optional[str] = None,
    payment_mode: Optional[str] = None,
    entry_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = None,
    db = None
):
    """Get ledger entries with filters and pagination"""
    if db is None:
        db = get_db()
    
    tenant_id = current_user.get("tenant_id")
    query = {"tenant_id": tenant_id}
    
    # Apply filters
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    if ledger_head_id:
        query["ledger_head_id"] = ledger_head_id
    if payment_mode:
        query["payment_mode"] = payment_mode
    if entry_type:
        query["entry_type"] = entry_type
    if status:
        query["status"] = status
    
    if search:
        query["$or"] = [
            {"voucher_number": {"$regex": search, "$options": "i"}},
            {"particulars": {"$regex": search, "$options": "i"}},
            {"reference_number": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db.ledger_entries.count_documents(query)
    
    # Get paginated entries
    skip = (page - 1) * limit
    entries = await db.ledger_entries.find(
        query, {"_id": 0}
    ).sort([("date", -1), ("created_at", -1)]).skip(skip).limit(limit).to_list(None)
    
    # Get summary stats
    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": None,
                "total_receipts": {"$sum": "$receipt_amount"},
                "total_payments": {"$sum": "$payment_amount"}
            }
        }
    ]
    
    summary_result = await db.ledger_entries.aggregate(pipeline).to_list(1)
    summary = summary_result[0] if summary_result else {"total_receipts": 0, "total_payments": 0}
    
    # Get opening balance
    settings = await db.ledger_settings.find_one({"tenant_id": tenant_id})
    opening_balance = settings.get("opening_balance", 0) if settings else 0
    
    return {
        "entries": entries,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        },
        "summary": {
            "opening_balance": opening_balance,
            "total_receipts": summary.get("total_receipts", 0),
            "total_payments": summary.get("total_payments", 0),
            "closing_balance": opening_balance + summary.get("total_receipts", 0) - summary.get("total_payments", 0)
        }
    }

@router.get("/entries/{entry_id}", response_model=dict)
async def get_ledger_entry(
    entry_id: str,
    current_user: dict = None,
    db = None
):
    """Get a single ledger entry"""
    if db is None:
        db = get_db()
    
    entry = await db.ledger_entries.find_one(
        {"id": entry_id, "tenant_id": current_user.get("tenant_id")},
        {"_id": 0}
    )
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return entry

@router.put("/entries/{entry_id}", response_model=dict)
async def update_ledger_entry(
    entry_id: str,
    update: LedgerEntryUpdate,
    current_user: dict = None,
    db = None
):
    """Update a ledger entry (requires admin approval for non-admins)"""
    if db is None:
        db = get_db()
    
    tenant_id = current_user.get("tenant_id")
    user_role = current_user.get("role", "viewer")
    
    # Get existing entry
    existing = await db.ledger_entries.find_one({
        "id": entry_id,
        "tenant_id": tenant_id
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if update.particulars:
        update_data["particulars"] = update.particulars
    if update.reference_number:
        update_data["reference_number"] = update.reference_number
    if update.remarks:
        update_data["remarks"] = update.remarks
    
    # Handle amount changes (admin only)
    if update.amount and user_role in ["superadmin", "admin"]:
        old_amount = existing["amount"]
        amount_diff = update.amount - old_amount
        
        update_data["amount"] = update.amount
        if existing["entry_type"] == "receipt":
            update_data["receipt_amount"] = update.amount
        else:
            update_data["payment_amount"] = update.amount
        
        # Update ledger head balance
        balance_change = amount_diff if existing["entry_type"] == "receipt" else -amount_diff
        await db.ledger_heads.update_one(
            {"id": existing["ledger_head_id"]},
            {"$inc": {"current_balance": balance_change}}
        )
    
    # Handle status changes (admin only)
    if update.status and user_role in ["superadmin", "admin"]:
        update_data["status"] = update.status
        update_data["approved_by"] = current_user.get("id")
        update_data["approved_at"] = datetime.now(timezone.utc)
    
    # For non-admins, mark as pending approval
    if user_role not in ["superadmin", "admin"]:
        update_data["status"] = "pending_approval"
    
    await db.ledger_entries.update_one(
        {"id": entry_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Entry updated successfully"}

@router.delete("/entries/{entry_id}", response_model=dict)
async def delete_ledger_entry(
    entry_id: str,
    current_user: dict = None,
    db = None
):
    """Delete a ledger entry (admin only, marks as deleted)"""
    if db is None:
        db = get_db()
    
    user_role = current_user.get("role", "viewer")
    
    if user_role not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Only admins can delete entries")
    
    entry = await db.ledger_entries.find_one({
        "id": entry_id,
        "tenant_id": current_user.get("tenant_id")
    })
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    # Soft delete
    await db.ledger_entries.update_one(
        {"id": entry_id},
        {
            "$set": {
                "is_deleted": True,
                "deleted_by": current_user.get("id"),
                "deleted_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Reverse the balance change
    balance_change = -entry["amount"] if entry["entry_type"] == "receipt" else entry["amount"]
    await db.ledger_heads.update_one(
        {"id": entry["ledger_head_id"]},
        {"$inc": {"current_balance": balance_change}}
    )
    
    return {"success": True, "message": "Entry deleted successfully"}

# ============== SETTINGS & OPENING BALANCE ==============

@router.get("/settings", response_model=dict)
async def get_ledger_settings(
    current_user: dict = None,
    db = None
):
    """Get ledger settings including opening balance"""
    if db is None:
        db = get_db()
    
    settings = await db.ledger_settings.find_one(
        {"tenant_id": current_user.get("tenant_id")},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults
        return {
            "opening_balance": 0,
            "effective_date": None,
            "financial_year_start": "04-01",
            "auto_voucher_numbering": True
        }
    
    return settings

@router.put("/settings/opening-balance", response_model=dict)
async def update_opening_balance(
    data: OpeningBalanceUpdate,
    current_user: dict = None,
    db = None
):
    """Update opening balance (admin only)"""
    if db is None:
        db = get_db()
    
    user_role = current_user.get("role", "viewer")
    
    if user_role not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Only admins can update opening balance")
    
    tenant_id = current_user.get("tenant_id")
    
    await db.ledger_settings.update_one(
        {"tenant_id": tenant_id},
        {
            "$set": {
                "tenant_id": tenant_id,
                "opening_balance": data.opening_balance,
                "effective_date": data.effective_date,
                "updated_by": current_user.get("id"),
                "updated_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    return {"success": True, "message": "Opening balance updated successfully"}

# ============== REPORTS ==============

@router.get("/reports/summary", response_model=dict)
async def get_monthly_summary(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    current_user: dict = None,
    db = None
):
    """Get monthly summary report"""
    if db is None:
        db = get_db()
    
    tenant_id = current_user.get("tenant_id")
    
    # Build date range
    start_date = f"{year}-{str(month).zfill(2)}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{str(month + 1).zfill(2)}-01"
    
    pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "date": {"$gte": start_date, "$lt": end_date},
                "status": "approved"
            }
        },
        {
            "$group": {
                "_id": {
                    "payment_mode": "$payment_mode",
                    "entry_type": "$entry_type"
                },
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }
        }
    ]
    
    results = await db.ledger_entries.aggregate(pipeline).to_list(None)
    
    # Structure the summary
    summary = {
        "year": year,
        "month": month,
        "by_payment_mode": {},
        "totals": {"receipts": 0, "payments": 0, "net": 0}
    }
    
    for r in results:
        mode = r["_id"]["payment_mode"]
        entry_type = r["_id"]["entry_type"]
        
        if mode not in summary["by_payment_mode"]:
            summary["by_payment_mode"][mode] = {"receipts": 0, "payments": 0}
        
        if entry_type == "receipt":
            summary["by_payment_mode"][mode]["receipts"] += r["total"]
            summary["totals"]["receipts"] += r["total"]
        else:
            summary["by_payment_mode"][mode]["payments"] += r["total"]
            summary["totals"]["payments"] += r["total"]
    
    summary["totals"]["net"] = summary["totals"]["receipts"] - summary["totals"]["payments"]
    
    return summary

@router.get("/reports/cash-book", response_model=dict)
async def get_cash_book(
    start_date: str,
    end_date: str,
    current_user: dict = None,
    db = None
):
    """Get Cash Book report"""
    if db is None:
        db = get_db()
    
    entries = await db.ledger_entries.find(
        {
            "tenant_id": current_user.get("tenant_id"),
            "payment_mode": "cash",
            "date": {"$gte": start_date, "$lte": end_date},
            "status": "approved"
        },
        {"_id": 0}
    ).sort([("date", 1), ("created_at", 1)]).to_list(None)
    
    # Calculate totals
    total_receipts = sum(e["receipt_amount"] for e in entries)
    total_payments = sum(e["payment_amount"] for e in entries)
    
    return {
        "report_type": "cash_book",
        "start_date": start_date,
        "end_date": end_date,
        "entries": entries,
        "total_receipts": total_receipts,
        "total_payments": total_payments,
        "net_cash_flow": total_receipts - total_payments
    }

@router.get("/reports/bank-book", response_model=dict)
async def get_bank_book(
    start_date: str,
    end_date: str,
    current_user: dict = None,
    db = None
):
    """Get Bank Book report"""
    if db is None:
        db = get_db()
    
    entries = await db.ledger_entries.find(
        {
            "tenant_id": current_user.get("tenant_id"),
            "payment_mode": {"$in": ["bank", "upi", "cheque"]},
            "date": {"$gte": start_date, "$lte": end_date},
            "status": "approved"
        },
        {"_id": 0}
    ).sort([("date", 1), ("created_at", 1)]).to_list(None)
    
    # Calculate totals
    total_receipts = sum(e["receipt_amount"] for e in entries)
    total_payments = sum(e["payment_amount"] for e in entries)
    
    return {
        "report_type": "bank_book",
        "start_date": start_date,
        "end_date": end_date,
        "entries": entries,
        "total_receipts": total_receipts,
        "total_payments": total_payments,
        "net_bank_flow": total_receipts - total_payments
    }

@router.get("/reports/day-wise", response_model=dict)
async def get_day_wise_summary(
    start_date: str,
    end_date: str,
    current_user: dict = None,
    db = None
):
    """Get day-wise transaction summary"""
    if db is None:
        db = get_db()
    
    pipeline = [
        {
            "$match": {
                "tenant_id": current_user.get("tenant_id"),
                "date": {"$gte": start_date, "$lte": end_date},
                "status": "approved"
            }
        },
        {
            "$group": {
                "_id": "$date",
                "receipts": {"$sum": "$receipt_amount"},
                "payments": {"$sum": "$payment_amount"},
                "transaction_count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.ledger_entries.aggregate(pipeline).to_list(None)
    
    days = []
    for r in results:
        days.append({
            "date": r["_id"],
            "receipts": r["receipts"],
            "payments": r["payments"],
            "net": r["receipts"] - r["payments"],
            "transaction_count": r["transaction_count"]
        })
    
    return {
        "report_type": "day_wise_summary",
        "start_date": start_date,
        "end_date": end_date,
        "days": days,
        "grand_total": {
            "receipts": sum(d["receipts"] for d in days),
            "payments": sum(d["payments"] for d in days),
            "net": sum(d["net"] for d in days)
        }
    }

# ============== EXPORT ==============

@router.get("/export/excel")
async def export_to_excel(
    start_date: str,
    end_date: str,
    current_user: dict = None,
    db = None
):
    """Export ledger entries to Excel"""
    if db is None:
        db = get_db()
    
    # This would generate an Excel file - returning data for now
    entries = await db.ledger_entries.find(
        {
            "tenant_id": current_user.get("tenant_id"),
            "date": {"$gte": start_date, "$lte": end_date}
        },
        {"_id": 0}
    ).sort([("date", 1), ("created_at", 1)]).to_list(None)
    
    return {
        "format": "excel",
        "data": entries,
        "message": "Excel export data ready"
    }

@router.get("/export/pdf")
async def export_to_pdf(
    start_date: str,
    end_date: str,
    report_type: str = Query("ledger", pattern="^(ledger|cash_book|bank_book)$"),
    current_user: dict = None,
    db = None
):
    """Export ledger entries to PDF"""
    if db is None:
        db = get_db()
    
    # This would generate a PDF file - returning data for now
    query = {
        "tenant_id": current_user.get("tenant_id"),
        "date": {"$gte": start_date, "$lte": end_date}
    }
    
    if report_type == "cash_book":
        query["payment_mode"] = "cash"
    elif report_type == "bank_book":
        query["payment_mode"] = {"$in": ["bank", "upi", "cheque"]}
    
    entries = await db.ledger_entries.find(
        query, {"_id": 0}
    ).sort([("date", 1), ("created_at", 1)]).to_list(None)
    
    return {
        "format": "pdf",
        "report_type": report_type,
        "data": entries,
        "message": "PDF export data ready"
    }

# ============== APPROVAL WORKFLOW ==============

@router.get("/pending-approvals", response_model=List[dict])
async def get_pending_approvals(
    current_user: dict = None,
    db = None
):
    """Get entries pending approval (admin only)"""
    if db is None:
        db = get_db()
    
    user_role = current_user.get("role", "viewer")
    
    if user_role not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Only admins can view pending approvals")
    
    entries = await db.ledger_entries.find(
        {
            "tenant_id": current_user.get("tenant_id"),
            "status": "pending_approval"
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(None)
    
    return entries

@router.put("/entries/{entry_id}/approve", response_model=dict)
async def approve_entry(
    entry_id: str,
    current_user: dict = None,
    db = None
):
    """Approve a pending entry (admin only)"""
    if db is None:
        db = get_db()
    
    user_role = current_user.get("role", "viewer")
    
    if user_role not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Only admins can approve entries")
    
    result = await db.ledger_entries.update_one(
        {
            "id": entry_id,
            "tenant_id": current_user.get("tenant_id"),
            "status": "pending_approval"
        },
        {
            "$set": {
                "status": "approved",
                "approved_by": current_user.get("id"),
                "approved_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found or already processed")
    
    return {"success": True, "message": "Entry approved successfully"}

@router.put("/entries/{entry_id}/reject", response_model=dict)
async def reject_entry(
    entry_id: str,
    reason: str = Query(..., min_length=1),
    current_user: dict = None,
    db = None
):
    """Reject a pending entry (admin only)"""
    if db is None:
        db = get_db()
    
    user_role = current_user.get("role", "viewer")
    
    if user_role not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Only admins can reject entries")
    
    result = await db.ledger_entries.update_one(
        {
            "id": entry_id,
            "tenant_id": current_user.get("tenant_id"),
            "status": "pending_approval"
        },
        {
            "$set": {
                "status": "rejected",
                "rejected_by": current_user.get("id"),
                "rejected_at": datetime.now(timezone.utc),
                "rejection_reason": reason
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found or already processed")
    
    return {"success": True, "message": "Entry rejected successfully"}
