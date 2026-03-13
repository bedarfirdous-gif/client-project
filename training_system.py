"""
Internal Screen Share System for Employee Training
==================================================
Enables centralized training, onboarding, and live support for employees.
Features: Live screen share, recording, chat, attendance, scheduling, breakout rooms.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum
import uuid
import httpx

# ============== ENUMS ==============

class SessionType(str, Enum):
    TRAINING = "training"
    ONBOARDING = "onboarding"
    LIVE_SUPPORT = "live_support"
    WEBINAR = "webinar"

class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"
    CANCELLED = "cancelled"

class ParticipantRole(str, Enum):
    HOST = "host"
    CO_HOST = "co_host"
    PRESENTER = "presenter"
    VIEWER = "viewer"

class AttendanceStatus(str, Enum):
    INVITED = "invited"
    JOINED = "joined"
    LEFT = "left"
    NO_SHOW = "no_show"

# ============== PYDANTIC MODELS ==============

class SessionCreate(BaseModel):
    """Schema for creating a training session"""
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    session_type: SessionType = SessionType.TRAINING
    scheduled_start: str  # ISO datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)
    max_participants: int = Field(default=20, ge=2, le=100)
    
    # Features
    enable_recording: bool = True
    enable_chat: bool = True
    enable_screen_share: bool = True
    enable_breakout_rooms: bool = False
    
    # Access control
    is_tenant_wide: bool = False  # If true, all employees in tenant can join
    invited_user_ids: List[str] = []
    invited_tenant_ids: List[str] = []  # For Super Admin cross-tenant training


class SessionUpdate(BaseModel):
    """Schema for updating a session"""
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_start: Optional[str] = None
    duration_minutes: Optional[int] = None
    max_participants: Optional[int] = None
    enable_recording: Optional[bool] = None
    enable_chat: Optional[bool] = None
    enable_breakout_rooms: Optional[bool] = None


class BreakoutRoomCreate(BaseModel):
    """Schema for creating a breakout room"""
    name: str
    participant_ids: List[str] = []


class ChatMessage(BaseModel):
    """Schema for chat message"""
    content: str = Field(..., min_length=1, max_length=1000)
    reply_to_id: Optional[str] = None


# ============== HELPER FUNCTIONS ==============

def generate_session_id() -> str:
    """Generate unique session ID"""
    return f"ts_{uuid.uuid4().hex[:12]}"

def generate_room_token() -> str:
    """Generate room access token"""
    return uuid.uuid4().hex[:24]


# ============== TRAINING SYSTEM CLASS ==============

class TrainingSystem:
    """
    Comprehensive training and screen share system.
    Supports live sessions, recordings, chat, attendance, and breakout rooms.
    """
    
    def __init__(self, db, daily_api_key: Optional[str] = None):
        self.db = db
        self.daily_api_key = daily_api_key
        self.daily_base_url = "https://api.daily.co/v1"
    
    # ========== SESSION MANAGEMENT ==========
    
    async def create_session(
        self,
        session_data: SessionCreate,
        host_id: str,
        host_tenant_id: str,
        host_role: str
    ) -> Dict[str, Any]:
        """Create a new training session"""
        now = datetime.now(timezone.utc).isoformat()
        session_id = generate_session_id()
        room_token = generate_room_token()
        
        # Parse scheduled time
        try:
            scheduled_dt = datetime.fromisoformat(session_data.scheduled_start.replace("Z", "+00:00"))
        except:
            scheduled_dt = datetime.now(timezone.utc) + timedelta(minutes=5)
        
        # Create Daily.co room if API key available
        daily_room_url = None
        daily_room_name = None
        if self.daily_api_key:
            daily_room = await self._create_daily_room(
                session_id=session_id,
                enable_recording=session_data.enable_recording,
                enable_chat=session_data.enable_chat,
                max_participants=session_data.max_participants,
                expires_at=scheduled_dt + timedelta(minutes=session_data.duration_minutes + 30)
            )
            if daily_room:
                daily_room_url = daily_room.get("url")
                daily_room_name = daily_room.get("name")
        
        # Create session document
        session_doc = {
            "id": session_id,
            "title": session_data.title,
            "description": session_data.description,
            "session_type": session_data.session_type.value,
            "status": SessionStatus.SCHEDULED.value,
            
            # Scheduling
            "scheduled_start": scheduled_dt.isoformat(),
            "scheduled_end": (scheduled_dt + timedelta(minutes=session_data.duration_minutes)).isoformat(),
            "duration_minutes": session_data.duration_minutes,
            "actual_start": None,
            "actual_end": None,
            
            # Host info
            "host_id": host_id,
            "host_tenant_id": host_tenant_id,
            "host_role": host_role,
            "co_host_ids": [],
            
            # Room details
            "room_token": room_token,
            "daily_room_url": daily_room_url,
            "daily_room_name": daily_room_name,
            
            # Features
            "enable_recording": session_data.enable_recording,
            "enable_chat": session_data.enable_chat,
            "enable_screen_share": session_data.enable_screen_share,
            "enable_breakout_rooms": session_data.enable_breakout_rooms,
            
            # Access
            "max_participants": session_data.max_participants,
            "is_tenant_wide": session_data.is_tenant_wide,
            "invited_user_ids": session_data.invited_user_ids,
            "invited_tenant_ids": session_data.invited_tenant_ids,
            
            # Stats
            "participant_count": 0,
            "peak_participants": 0,
            "total_chat_messages": 0,
            
            # Recording
            "recording_url": None,
            "recording_duration": None,
            
            # Breakout rooms
            "breakout_rooms": [],
            
            # Metadata
            "created_at": now,
            "updated_at": now
        }
        
        await self.db.training_sessions.insert_one(session_doc)
        
        # Create attendance records for invited users
        if session_data.invited_user_ids:
            attendance_docs = [
                {
                    "id": str(uuid.uuid4()),
                    "session_id": session_id,
                    "user_id": user_id,
                    "status": AttendanceStatus.INVITED.value,
                    "invited_at": now,
                    "joined_at": None,
                    "left_at": None,
                    "duration_seconds": 0,
                    "created_at": now
                }
                for user_id in session_data.invited_user_ids
            ]
            await self.db.training_attendance.insert_many(attendance_docs)
        
        del session_doc["_id"]
        
        return {
            "message": f"Training session '{session_data.title}' created successfully",
            "session": session_doc
        }
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by ID"""
        return await self.db.training_sessions.find_one({"id": session_id}, {"_id": 0})
    
    async def get_sessions(
        self,
        user_id: str,
        tenant_id: str,
        user_role: str,
        status: Optional[str] = None,
        session_type: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get sessions accessible by user"""
        query = {"$or": []}
        
        # Super admin sees all
        if user_role == "superadmin":
            query = {}
        else:
            # Sessions where user is host
            query["$or"].append({"host_id": user_id})
            # Sessions where user is invited
            query["$or"].append({"invited_user_ids": user_id})
            # Tenant-wide sessions
            query["$or"].append({"host_tenant_id": tenant_id, "is_tenant_wide": True})
            # Cross-tenant sessions (for admins)
            if user_role in ["admin", "manager"]:
                query["$or"].append({"invited_tenant_ids": tenant_id})
        
        if status:
            query["status"] = status
        if session_type:
            query["session_type"] = session_type
        
        # Handle empty $or
        if "$or" in query and not query["$or"]:
            del query["$or"]
        
        sessions = await self.db.training_sessions.find(
            query, {"_id": 0}
        ).sort("scheduled_start", -1).limit(limit).to_list(limit)
        
        return sessions
    
    async def update_session(
        self,
        session_id: str,
        update_data: SessionUpdate,
        user_id: str
    ) -> Dict[str, Any]:
        """Update a session"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        if session["host_id"] != user_id and user_id not in session.get("co_host_ids", []):
            raise ValueError("Only host or co-host can update session")
        
        if session["status"] in [SessionStatus.ENDED.value, SessionStatus.CANCELLED.value]:
            raise ValueError("Cannot update ended or cancelled session")
        
        now = datetime.now(timezone.utc).isoformat()
        update_fields = {"updated_at": now}
        
        update_dict = update_data.dict(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                update_fields[key] = value
        
        await self.db.training_sessions.update_one(
            {"id": session_id},
            {"$set": update_fields}
        )
        
        updated = await self.get_session(session_id)
        return {"message": "Session updated", "session": updated}
    
    async def start_session(self, session_id: str, user_id: str) -> Dict[str, Any]:
        """Start a live session"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        if session["host_id"] != user_id:
            raise ValueError("Only host can start session")
        
        if session["status"] != SessionStatus.SCHEDULED.value:
            raise ValueError(f"Session cannot be started (status: {session['status']})")
        
        now = datetime.now(timezone.utc).isoformat()
        
        await self.db.training_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": SessionStatus.LIVE.value,
                "actual_start": now,
                "updated_at": now
            }}
        )
        
        return {
            "message": "Session started",
            "status": SessionStatus.LIVE.value,
            "room_url": session.get("daily_room_url"),
            "room_token": session.get("room_token")
        }
    
    async def end_session(self, session_id: str, user_id: str) -> Dict[str, Any]:
        """End a live session"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        if session["host_id"] != user_id and user_id not in session.get("co_host_ids", []):
            raise ValueError("Only host or co-host can end session")
        
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        # Calculate actual duration
        actual_start = session.get("actual_start")
        duration_seconds = 0
        if actual_start:
            start_dt = datetime.fromisoformat(actual_start.replace("Z", "+00:00"))
            duration_seconds = int((now - start_dt).total_seconds())
        
        # Update all active attendance records
        await self.db.training_attendance.update_many(
            {"session_id": session_id, "status": AttendanceStatus.JOINED.value},
            {"$set": {"status": AttendanceStatus.LEFT.value, "left_at": now_iso}}
        )
        
        await self.db.training_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": SessionStatus.ENDED.value,
                "actual_end": now_iso,
                "recording_duration": duration_seconds,
                "updated_at": now_iso
            }}
        )
        
        return {
            "message": "Session ended",
            "duration_seconds": duration_seconds,
            "status": SessionStatus.ENDED.value
        }
    
    async def cancel_session(
        self,
        session_id: str,
        user_id: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Cancel a scheduled session"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        if session["host_id"] != user_id:
            raise ValueError("Only host can cancel session")
        
        if session["status"] != SessionStatus.SCHEDULED.value:
            raise ValueError("Can only cancel scheduled sessions")
        
        now = datetime.now(timezone.utc).isoformat()
        
        await self.db.training_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": SessionStatus.CANCELLED.value,
                "cancel_reason": reason,
                "cancelled_at": now,
                "updated_at": now
            }}
        )
        
        return {"message": "Session cancelled"}
    
    # ========== ATTENDANCE MANAGEMENT ==========
    
    async def join_session(
        self,
        session_id: str,
        user_id: str,
        user_name: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Record user joining a session"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        if session["status"] != SessionStatus.LIVE.value:
            raise ValueError("Session is not live")
        
        # Check access
        has_access = (
            session["host_id"] == user_id or
            user_id in session.get("invited_user_ids", []) or
            (session["is_tenant_wide"] and session["host_tenant_id"] == tenant_id) or
            tenant_id in session.get("invited_tenant_ids", [])
        )
        
        if not has_access:
            raise ValueError("You don't have access to this session")
        
        # Check capacity
        if session["participant_count"] >= session["max_participants"]:
            raise ValueError("Session is at capacity")
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Check if already has attendance record
        existing = await self.db.training_attendance.find_one({
            "session_id": session_id,
            "user_id": user_id
        })
        
        if existing:
            # Update existing record
            await self.db.training_attendance.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "status": AttendanceStatus.JOINED.value,
                    "joined_at": now
                }}
            )
        else:
            # Create new attendance record
            await self.db.training_attendance.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "user_id": user_id,
                "user_name": user_name,
                "tenant_id": tenant_id,
                "status": AttendanceStatus.JOINED.value,
                "invited_at": None,
                "joined_at": now,
                "left_at": None,
                "duration_seconds": 0,
                "created_at": now
            })
        
        # Update participant count
        new_count = session["participant_count"] + 1
        peak = max(session["peak_participants"], new_count)
        
        await self.db.training_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "participant_count": new_count,
                "peak_participants": peak
            }}
        )
        
        return {
            "message": "Joined session",
            "room_url": session.get("daily_room_url"),
            "room_token": session.get("room_token"),
            "session": session
        }
    
    async def leave_session(self, session_id: str, user_id: str) -> Dict[str, Any]:
        """Record user leaving a session"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        # Get attendance record
        attendance = await self.db.training_attendance.find_one({
            "session_id": session_id,
            "user_id": user_id,
            "status": AttendanceStatus.JOINED.value
        })
        
        if attendance:
            # Calculate duration
            joined_at = attendance.get("joined_at")
            duration = 0
            if joined_at:
                joined_dt = datetime.fromisoformat(joined_at.replace("Z", "+00:00"))
                duration = int((now - joined_dt).total_seconds())
            
            await self.db.training_attendance.update_one(
                {"id": attendance["id"]},
                {"$set": {
                    "status": AttendanceStatus.LEFT.value,
                    "left_at": now_iso,
                    "duration_seconds": attendance.get("duration_seconds", 0) + duration
                }}
            )
        
        # Update participant count
        if session["participant_count"] > 0:
            await self.db.training_sessions.update_one(
                {"id": session_id},
                {"$inc": {"participant_count": -1}}
            )
        
        return {"message": "Left session"}
    
    async def get_attendance(
        self,
        session_id: str,
        include_no_shows: bool = False
    ) -> List[Dict[str, Any]]:
        """Get attendance for a session"""
        query = {"session_id": session_id}
        if not include_no_shows:
            query["status"] = {"$ne": AttendanceStatus.NO_SHOW.value}
        
        attendance = await self.db.training_attendance.find(
            query, {"_id": 0}
        ).to_list(None)
        
        return attendance
    
    # ========== CHAT MANAGEMENT ==========
    
    async def send_chat_message(
        self,
        session_id: str,
        user_id: str,
        user_name: str,
        message: ChatMessage
    ) -> Dict[str, Any]:
        """Send a chat message in session"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        if not session.get("enable_chat"):
            raise ValueError("Chat is disabled for this session")
        
        if session["status"] != SessionStatus.LIVE.value:
            raise ValueError("Chat is only available during live sessions")
        
        now = datetime.now(timezone.utc).isoformat()
        message_id = str(uuid.uuid4())
        
        message_doc = {
            "id": message_id,
            "session_id": session_id,
            "user_id": user_id,
            "user_name": user_name,
            "content": message.content,
            "reply_to_id": message.reply_to_id,
            "is_pinned": False,
            "is_deleted": False,
            "created_at": now
        }
        
        await self.db.training_chat.insert_one(message_doc)
        
        # Update message count
        await self.db.training_sessions.update_one(
            {"id": session_id},
            {"$inc": {"total_chat_messages": 1}}
        )
        
        del message_doc["_id"]
        return {"message": message_doc}
    
    async def get_chat_messages(
        self,
        session_id: str,
        limit: int = 100,
        before_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get chat messages for session"""
        query = {"session_id": session_id, "is_deleted": False}
        
        if before_id:
            before_msg = await self.db.training_chat.find_one({"id": before_id})
            if before_msg:
                query["created_at"] = {"$lt": before_msg["created_at"]}
        
        messages = await self.db.training_chat.find(
            query, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return list(reversed(messages))
    
    async def pin_message(self, message_id: str, user_id: str) -> Dict[str, Any]:
        """Pin/unpin a chat message (host only)"""
        message = await self.db.training_chat.find_one({"id": message_id})
        if not message:
            raise ValueError("Message not found")
        
        session = await self.get_session(message["session_id"])
        if session["host_id"] != user_id and user_id not in session.get("co_host_ids", []):
            raise ValueError("Only host or co-host can pin messages")
        
        new_pinned = not message.get("is_pinned", False)
        await self.db.training_chat.update_one(
            {"id": message_id},
            {"$set": {"is_pinned": new_pinned}}
        )
        
        return {"message": "Message pinned" if new_pinned else "Message unpinned"}
    
    # ========== BREAKOUT ROOMS ==========
    
    async def create_breakout_room(
        self,
        session_id: str,
        room_data: BreakoutRoomCreate,
        user_id: str
    ) -> Dict[str, Any]:
        """Create a breakout room"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        if session["host_id"] != user_id:
            raise ValueError("Only host can create breakout rooms")
        
        if not session.get("enable_breakout_rooms"):
            raise ValueError("Breakout rooms are disabled for this session")
        
        room_id = str(uuid.uuid4())[:8]
        room_token = generate_room_token()
        
        # Create Daily room for breakout if available
        daily_room_url = None
        if self.daily_api_key:
            daily_room = await self._create_daily_room(
                session_id=f"{session_id}_br_{room_id}",
                enable_recording=False,
                enable_chat=True,
                max_participants=10
            )
            if daily_room:
                daily_room_url = daily_room.get("url")
        
        breakout_room = {
            "id": room_id,
            "name": room_data.name,
            "room_token": room_token,
            "daily_room_url": daily_room_url,
            "participant_ids": room_data.participant_ids,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.training_sessions.update_one(
            {"id": session_id},
            {"$push": {"breakout_rooms": breakout_room}}
        )
        
        return {"message": f"Breakout room '{room_data.name}' created", "room": breakout_room}
    
    async def close_breakout_rooms(self, session_id: str, user_id: str) -> Dict[str, Any]:
        """Close all breakout rooms and bring everyone back"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        if session["host_id"] != user_id:
            raise ValueError("Only host can close breakout rooms")
        
        await self.db.training_sessions.update_one(
            {"id": session_id},
            {"$set": {"breakout_rooms.$[].is_active": False}}
        )
        
        return {"message": "All breakout rooms closed"}
    
    # ========== RECORDINGS ==========
    
    async def get_recordings(
        self,
        user_id: str,
        tenant_id: str,
        user_role: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get recorded sessions"""
        query = {
            "status": SessionStatus.ENDED.value,
            "recording_url": {"$ne": None}
        }
        
        if user_role != "superadmin":
            query["$or"] = [
                {"host_id": user_id},
                {"invited_user_ids": user_id},
                {"host_tenant_id": tenant_id, "is_tenant_wide": True}
            ]
        
        recordings = await self.db.training_sessions.find(
            query,
            {"_id": 0, "id": 1, "title": 1, "description": 1, "session_type": 1,
             "actual_start": 1, "actual_end": 1, "recording_url": 1, "recording_duration": 1,
             "host_id": 1, "peak_participants": 1}
        ).sort("actual_end", -1).limit(limit).to_list(limit)
        
        return recordings
    
    async def set_recording_url(
        self,
        session_id: str,
        recording_url: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Set recording URL for a session"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        if session["host_id"] != user_id:
            raise ValueError("Only host can set recording URL")
        
        await self.db.training_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "recording_url": recording_url,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Recording URL set"}
    
    # ========== ANALYTICS ==========
    
    async def get_training_analytics(
        self,
        tenant_id: Optional[str] = None,
        user_role: str = "admin"
    ) -> Dict[str, Any]:
        """Get training analytics"""
        query = {}
        if tenant_id and user_role != "superadmin":
            query["host_tenant_id"] = tenant_id
        
        # Total sessions
        total_sessions = await self.db.training_sessions.count_documents(query)
        
        # Sessions by status
        status_pipeline = [
            {"$match": query},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        status_counts = await self.db.training_sessions.aggregate(status_pipeline).to_list(None)
        
        # Sessions by type
        type_pipeline = [
            {"$match": query},
            {"$group": {"_id": "$session_type", "count": {"$sum": 1}}}
        ]
        type_counts = await self.db.training_sessions.aggregate(type_pipeline).to_list(None)
        
        # Total attendance
        attendance_pipeline = [
            {"$lookup": {
                "from": "training_sessions",
                "localField": "session_id",
                "foreignField": "id",
                "as": "session"
            }},
            {"$unwind": "$session"},
            {"$match": {"session.host_tenant_id": tenant_id} if tenant_id and user_role != "superadmin" else {}},
            {"$group": {
                "_id": None,
                "total_attendees": {"$sum": 1},
                "total_duration": {"$sum": "$duration_seconds"}
            }}
        ]
        attendance_stats = await self.db.training_attendance.aggregate(attendance_pipeline).to_list(1)
        
        # Average session duration
        duration_pipeline = [
            {"$match": {**query, "status": "ended", "recording_duration": {"$ne": None}}},
            {"$group": {
                "_id": None,
                "avg_duration": {"$avg": "$recording_duration"},
                "total_duration": {"$sum": "$recording_duration"}
            }}
        ]
        duration_stats = await self.db.training_sessions.aggregate(duration_pipeline).to_list(1)
        
        att_data = attendance_stats[0] if attendance_stats else {}
        dur_data = duration_stats[0] if duration_stats else {}
        
        return {
            "total_sessions": total_sessions,
            "sessions_by_status": {s["_id"]: s["count"] for s in status_counts},
            "sessions_by_type": {t["_id"]: t["count"] for t in type_counts},
            "total_attendees": att_data.get("total_attendees", 0),
            "total_watch_time_hours": round(att_data.get("total_duration", 0) / 3600, 2),
            "avg_session_duration_minutes": round(dur_data.get("avg_duration", 0) / 60, 2),
            "total_training_hours": round(dur_data.get("total_duration", 0) / 3600, 2)
        }
    
    # ========== DAILY.CO INTEGRATION ==========
    
    async def _create_daily_room(
        self,
        session_id: str,
        enable_recording: bool = True,
        enable_chat: bool = True,
        max_participants: int = 20,
        expires_at: Optional[datetime] = None
    ) -> Optional[Dict[str, Any]]:
        """Create a Daily.co room"""
        if not self.daily_api_key:
            return None
        
        try:
            room_name = f"training-{session_id}"
            
            properties = {
                "max_participants": max_participants,
                "enable_chat": enable_chat,
                "enable_screenshare": True,
                "enable_recording": "cloud" if enable_recording else None,
                "start_video_off": True,
                "start_audio_off": True
            }
            
            if expires_at:
                properties["exp"] = int(expires_at.timestamp())
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.daily_base_url}/rooms",
                    headers={"Authorization": f"Bearer {self.daily_api_key}"},
                    json={"name": room_name, "properties": properties}
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"Daily.co room creation failed: {response.text}")
                    return None
        except Exception as e:
            print(f"Daily.co error: {e}")
            return None
