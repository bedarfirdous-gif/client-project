"""
HR Routes Module

Handles HR-related operations:
- Attendance management
- Leave management
- Shift management

Permission keys: attendance, leaves, shifts
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["HR"])

from utils.deps import get_db, get_current_user, get_tenant_id, require_permission


# ============== ATTENDANCE ==============

@router.get("/attendance")
async def list_attendance(
    employee_id: str = "",
    date: str = "",
    status: str = "",
    user: dict = Depends(require_permission("attendance"))
):
    """List attendance records"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id}
    
    if employee_id:
        query["employee_id"] = employee_id
    if date:
        query["date"] = date
    if status:
        query["status"] = status
    
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return records


@router.post("/attendance")
async def create_attendance(request: Request, user: dict = Depends(require_permission("attendance"))):
    """Create attendance record"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    employee_id = data.get("employee_id")
    date = data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    
    # Check if attendance already exists
    existing = await db.attendance.find_one({
        "tenant_id": tenant_id,
        "employee_id": employee_id,
        "date": date
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already marked for this date")
    
    attendance = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "employee_id": employee_id,
        "date": date,
        "check_in": data.get("check_in", ""),
        "check_out": data.get("check_out", ""),
        "status": data.get("status", "present"),  # present, absent, half_day, late
        "work_hours": data.get("work_hours", 0),
        "overtime_hours": data.get("overtime_hours", 0),
        "notes": data.get("notes", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id")
    }
    
    await db.attendance.insert_one(attendance)
    attendance.pop("_id", None)
    
    return {"message": "Attendance recorded", "attendance": attendance}


@router.put("/attendance/{attendance_id}")
async def update_attendance(
    attendance_id: str,
    request: Request,
    user: dict = Depends(require_permission("attendance"))
):
    """Update attendance record"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field in ["check_in", "check_out", "status", "work_hours", "overtime_hours", "notes"]:
        if field in data:
            update_data[field] = data[field]
    
    result = await db.attendance.update_one(
        {"id": attendance_id, "tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    return {"message": "Attendance updated"}


# ============== LEAVES ==============

@router.get("/leaves")
async def list_leaves(
    employee_id: str = "",
    status: str = "",
    leave_type: str = "",
    user: dict = Depends(require_permission("leaves"))
):
    """List leave requests"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    query = {"tenant_id": tenant_id}
    
    if employee_id:
        query["employee_id"] = employee_id
    if status:
        query["status"] = status
    if leave_type:
        query["leave_type"] = leave_type
    
    leaves = await db.leaves.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return leaves


@router.post("/leaves")
async def create_leave_request(request: Request, user: dict = Depends(require_permission("leaves"))):
    """Create leave request"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    leave = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "employee_id": data.get("employee_id"),
        "leave_type": data.get("leave_type", "casual"),  # casual, sick, annual, unpaid
        "start_date": data.get("start_date"),
        "end_date": data.get("end_date"),
        "days": data.get("days", 1),
        "reason": data.get("reason", ""),
        "status": "pending",  # pending, approved, rejected
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id")
    }
    
    await db.leaves.insert_one(leave)
    leave.pop("_id", None)
    
    return {"message": "Leave request submitted", "leave": leave}


@router.put("/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, user: dict = Depends(require_permission("leaves"))):
    """Approve leave request"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    result = await db.leaves.update_one(
        {"id": leave_id, "tenant_id": tenant_id, "status": "pending"},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": user.get("id")
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leave request not found or already processed")
    
    return {"message": "Leave approved"}


@router.put("/leaves/{leave_id}/reject")
async def reject_leave(
    leave_id: str,
    request: Request,
    user: dict = Depends(require_permission("leaves"))
):
    """Reject leave request"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    result = await db.leaves.update_one(
        {"id": leave_id, "tenant_id": tenant_id, "status": "pending"},
        {"$set": {
            "status": "rejected",
            "rejection_reason": data.get("reason", ""),
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejected_by": user.get("id")
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leave request not found or already processed")
    
    return {"message": "Leave rejected"}


@router.delete("/leaves/{leave_id}")
async def delete_leave(leave_id: str, user: dict = Depends(require_permission("leaves"))):
    """Delete leave request"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    leave = await db.leaves.find_one({"id": leave_id, "tenant_id": tenant_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave.get("status") == "approved":
        raise HTTPException(status_code=400, detail="Cannot delete approved leave")
    
    await db.leaves.delete_one({"id": leave_id})
    return {"message": "Leave request deleted"}


# ============== SHIFTS ==============

@router.get("/shifts")
async def list_shifts(user: dict = Depends(require_permission("shifts"))):
    """List all shifts"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    shifts = await db.shifts.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    return shifts


@router.post("/shifts")
async def create_shift(request: Request, user: dict = Depends(require_permission("shifts"))):
    """Create a shift"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    shift = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "name": data.get("name"),
        "start_time": data.get("start_time"),
        "end_time": data.get("end_time"),
        "break_duration": data.get("break_duration", 60),  # minutes
        "working_days": data.get("working_days", ["mon", "tue", "wed", "thu", "fri"]),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.shifts.insert_one(shift)
    shift.pop("_id", None)
    
    return {"message": "Shift created", "shift": shift}


@router.put("/shifts/{shift_id}")
async def update_shift(
    shift_id: str,
    request: Request,
    user: dict = Depends(require_permission("shifts"))
):
    """Update a shift"""
    db = get_db()
    data = await request.json()
    tenant_id = get_tenant_id(user)
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field in ["name", "start_time", "end_time", "break_duration", "working_days", "is_active"]:
        if field in data:
            update_data[field] = data[field]
    
    result = await db.shifts.update_one(
        {"id": shift_id, "tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    return {"message": "Shift updated"}


@router.delete("/shifts/{shift_id}")
async def delete_shift(shift_id: str, user: dict = Depends(require_permission("shifts"))):
    """Delete a shift"""
    db = get_db()
    tenant_id = get_tenant_id(user)
    
    result = await db.shifts.delete_one({"id": shift_id, "tenant_id": tenant_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    return {"message": "Shift deleted"}
