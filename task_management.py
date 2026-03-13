"""
Task Management Module - ERP Structure
Handles task creation, assignment, tracking, and version history
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import uuid
import logging

logger = logging.getLogger(__name__)

class TaskManagementSystem:
    def __init__(self, db):
        self.db = db
        self.collection = db.tasks
        self.history_collection = db.task_history
        
    async def initialize(self):
        """Create indexes for optimal performance"""
        await self.collection.create_index([("tenant_id", 1), ("task_id", 1)], unique=True)
        await self.collection.create_index([("tenant_id", 1), ("assigned_to", 1)])
        await self.collection.create_index([("tenant_id", 1), ("department", 1)])
        await self.collection.create_index([("tenant_id", 1), ("status", 1)])
        await self.collection.create_index([("tenant_id", 1), ("priority", 1)])
        await self.collection.create_index([("tenant_id", 1), ("due_date", 1)])
        await self.history_collection.create_index([("task_id", 1)])
        logger.info("Task Management indexes created")
    
    async def get_next_task_id(self, tenant_id: str) -> str:
        """Generate next sequential task ID"""
        last_task = await self.collection.find_one(
            {"tenant_id": tenant_id},
            sort=[("created_at", -1)]
        )
        if last_task and last_task.get("task_id"):
            try:
                num = int(last_task["task_id"].replace("TASK-", ""))
                return f"TASK-{num + 1:05d}"
            except:
                pass
        return "TASK-00001"
    
    async def create_task(self, tenant_id: str, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Create a new task"""
        task_id = await self.get_next_task_id(tenant_id)
        
        # Handle multiple employees - convert single to list if needed
        assigned_employees = data.get("assigned_employees", [])
        if not assigned_employees and data.get("assigned_to"):
            # Backwards compatibility - single employee
            assigned_employees = [{
                "id": data.get("assigned_to", ""),
                "name": data.get("assigned_to_name", "")
            }]
        
        task = {
            "id": str(uuid.uuid4()),
            "task_id": task_id,
            "tenant_id": tenant_id,
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "department": data.get("department", ""),
            "assigned_employees": assigned_employees,  # List of {id, name} objects
            "assigned_to": data.get("assigned_to", ""),  # Keep for backwards compatibility
            "assigned_to_name": data.get("assigned_to_name", ""),  # Keep for backwards compatibility
            "assigned_by": created_by,
            "assigned_by_name": data.get("assigned_by_name", ""),
            "priority": data.get("priority", "Medium"),
            "task_type": data.get("task_type", "Daily"),
            "start_date": data.get("start_date", ""),
            "due_date": data.get("due_date", ""),
            "estimated_hours": data.get("estimated_hours", 0),
            "status": "Pending",
            "completion_percentage": 0,
            "rating": data.get("rating", 0),  # Rating 0-5 stars
            "remarks": data.get("remarks", ""),
            "version": 1,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await self.collection.insert_one(task)
        
        # Create initial version history
        await self._create_history_entry(task, "Created", created_by, "Task created")
        
        return {k: v for k, v in task.items() if k != "_id"}
    
    async def update_task(self, tenant_id: str, task_id: str, data: Dict[str, Any], updated_by: str) -> Optional[Dict[str, Any]]:
        """Update task and create version history"""
        existing = await self.collection.find_one({
            "tenant_id": tenant_id,
            "task_id": task_id
        })
        
        if not existing:
            return None
        
        # Track changes for history
        changes = []
        update_data = {}
        
        fields_to_track = [
            "title", "description", "department", "assigned_to", "assigned_to_name",
            "assigned_employees", "priority", "task_type", "start_date", "due_date", 
            "estimated_hours", "status", "completion_percentage", "rating", "remarks"
        ]
        
        # Handle assigned_employees update
        if "assigned_employees" in data:
            update_data["assigned_employees"] = data["assigned_employees"]
            # Update legacy fields for backwards compatibility
            if data["assigned_employees"]:
                update_data["assigned_to"] = data["assigned_employees"][0].get("id", "")
                update_data["assigned_to_name"] = data["assigned_employees"][0].get("name", "")
            else:
                update_data["assigned_to"] = ""
                update_data["assigned_to_name"] = ""
        
        for field in fields_to_track:
            if field in data and data[field] != existing.get(field):
                old_val = existing.get(field, "")
                new_val = data[field]
                changes.append(f"{field}: '{old_val}' → '{new_val}'")
                update_data[field] = new_val
        
        if not update_data:
            return {k: v for k, v in existing.items() if k != "_id"}
        
        # Increment version
        new_version = existing.get("version", 1) + 1
        update_data["version"] = new_version
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        await self.collection.update_one(
            {"tenant_id": tenant_id, "task_id": task_id},
            {"$set": update_data}
        )
        
        # Create history entry
        updated_task = await self.collection.find_one({
            "tenant_id": tenant_id,
            "task_id": task_id
        })
        
        await self._create_history_entry(
            updated_task,
            "Updated",
            updated_by,
            "; ".join(changes) if changes else "No changes"
        )
        
        return {k: v for k, v in updated_task.items() if k != "_id"}
    
    async def _create_history_entry(self, task: Dict, action: str, user_id: str, changes: str):
        """Create a version history entry"""
        history_entry = {
            "id": str(uuid.uuid4()),
            "task_id": task["task_id"],
            "tenant_id": task["tenant_id"],
            "version": task.get("version", 1),
            "action": action,
            "changed_by": user_id,
            "changes": changes,
            "snapshot": {
                "title": task.get("title"),
                "status": task.get("status"),
                "priority": task.get("priority"),
                "assigned_to": task.get("assigned_to"),
                "assigned_employees": task.get("assigned_employees", []),
                "completion_percentage": task.get("completion_percentage"),
                "rating": task.get("rating", 0)
            },
            "timestamp": datetime.now(timezone.utc)
        }
        await self.history_collection.insert_one(history_entry)
    
    async def get_task(self, tenant_id: str, task_id: str) -> Optional[Dict[str, Any]]:
        """Get a single task by ID"""
        task = await self.collection.find_one({
            "tenant_id": tenant_id,
            "task_id": task_id
        })
        if task:
            return {k: v for k, v in task.items() if k != "_id"}
        return None
    
    async def list_tasks(
        self, 
        tenant_id: str,
        department: str = None,
        status: str = None,
        priority: str = None,
        task_type: str = None,
        assigned_to: str = None,
        search: str = None
    ) -> List[Dict[str, Any]]:
        """List tasks with filters"""
        query = {"tenant_id": tenant_id}
        
        if department:
            query["department"] = department
        if status:
            query["status"] = status
        if priority:
            query["priority"] = priority
        if task_type:
            query["task_type"] = task_type
        if assigned_to:
            query["assigned_to"] = assigned_to
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"task_id": {"$regex": search, "$options": "i"}}
            ]
        
        tasks = await self.collection.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        return tasks
    
    async def get_task_history(self, tenant_id: str, task_id: str) -> List[Dict[str, Any]]:
        """Get version history for a task"""
        history = await self.history_collection.find(
            {"tenant_id": tenant_id, "task_id": task_id},
            {"_id": 0}
        ).sort("timestamp", -1).to_list(100)
        return history
    
    async def delete_task(self, tenant_id: str, task_id: str, deleted_by: str) -> bool:
        """Soft delete a task"""
        result = await self.collection.update_one(
            {"tenant_id": tenant_id, "task_id": task_id},
            {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc), "deleted_by": deleted_by}}
        )
        return result.modified_count > 0
    
    async def get_statistics(self, tenant_id: str) -> Dict[str, Any]:
        """Get task statistics for dashboard"""
        pipeline = [
            {"$match": {"tenant_id": tenant_id, "is_deleted": {"$ne": True}}},
            {"$group": {
                "_id": None,
                "total": {"$sum": 1},
                "pending": {"$sum": {"$cond": [{"$eq": ["$status", "Pending"]}, 1, 0]}},
                "in_progress": {"$sum": {"$cond": [{"$eq": ["$status", "In Progress"]}, 1, 0]}},
                "completed": {"$sum": {"$cond": [{"$eq": ["$status", "Completed"]}, 1, 0]}},
                "delayed": {"$sum": {"$cond": [{"$eq": ["$status", "Delayed"]}, 1, 0]}},
                "high_priority": {"$sum": {"$cond": [{"$eq": ["$priority", "High"]}, 1, 0]}},
                "urgent": {"$sum": {"$cond": [{"$eq": ["$priority", "Urgent"]}, 1, 0]}}
            }}
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(1)
        
        if result:
            stats = result[0]
            stats.pop("_id", None)
            return stats
        
        return {
            "total": 0, "pending": 0, "in_progress": 0, 
            "completed": 0, "delayed": 0, "high_priority": 0, "urgent": 0
        }
    
    async def get_department_stats(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Get task counts by department"""
        pipeline = [
            {"$match": {"tenant_id": tenant_id, "is_deleted": {"$ne": True}}},
            {"$group": {
                "_id": "$department",
                "total": {"$sum": 1},
                "pending": {"$sum": {"$cond": [{"$eq": ["$status", "Pending"]}, 1, 0]}},
                "completed": {"$sum": {"$cond": [{"$eq": ["$status", "Completed"]}, 1, 0]}}
            }},
            {"$sort": {"total": -1}}
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(20)
        return [{"department": r["_id"] or "Unassigned", **{k: v for k, v in r.items() if k != "_id"}} for r in result]

# Pydantic models for API
from pydantic import BaseModel
from typing import List as PyList

class AssignedEmployee(BaseModel):
    id: str
    name: str

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    department: str = ""
    assigned_to: str = ""  # Backwards compatibility
    assigned_to_name: str = ""  # Backwards compatibility
    assigned_employees: PyList[AssignedEmployee] = []  # Multiple employees
    assigned_by_name: str = ""
    priority: str = "Medium"
    task_type: str = "Daily"
    start_date: str = ""
    due_date: str = ""
    estimated_hours: float = 0
    rating: int = 0  # Rating 0-5 stars
    remarks: str = ""

class TaskUpdate(BaseModel):
    title: str = None
    description: str = None
    department: str = None
    assigned_to: str = None  # Backwards compatibility
    assigned_to_name: str = None  # Backwards compatibility
    assigned_employees: PyList[AssignedEmployee] = None  # Multiple employees
    priority: str = None
    task_type: str = None
    start_date: str = None
    due_date: str = None
    estimated_hours: float = None
    status: str = None
    completion_percentage: int = None
    rating: int = None  # Rating 0-5 stars
    remarks: str = None
