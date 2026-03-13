"""
Rollback Manager
================
Instant reversion system based on performance triggers.
"""

import os
import shutil
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import uuid
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RollbackManager")


class RollbackReason(Enum):
    """Reasons for triggering a rollback"""
    ERROR_RATE_HIGH = "error_rate_high"
    RESPONSE_TIME_HIGH = "response_time_high"
    HEALTH_CHECK_FAILED = "health_check_failed"
    REGRESSION_DETECTED = "regression_detected"
    MANUAL_TRIGGER = "manual_trigger"
    CRITICAL_ERROR = "critical_error"
    SERVICE_DOWN = "service_down"
    TIMEOUT = "timeout"


class RollbackStatus(Enum):
    """Status of a rollback operation"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    VERIFIED = "verified"


@dataclass
class RollbackTrigger:
    """Configuration for automatic rollback triggers"""
    trigger_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    reason: RollbackReason = RollbackReason.ERROR_RATE_HIGH
    
    # Thresholds
    threshold_value: float = 0.0
    comparison: str = "greater_than"  # greater_than, less_than, equals
    duration_seconds: int = 60  # How long threshold must be exceeded
    
    # Status
    enabled: bool = True
    triggered_count: int = 0
    last_triggered: Optional[str] = None


@dataclass
class RollbackAction:
    """Record of a rollback action"""
    action_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    fix_id: str = ""
    deployment_id: Optional[str] = None
    
    # What was rolled back
    file_path: str = ""
    original_content: str = ""
    rolled_back_content: str = ""
    
    # Reason
    reason: RollbackReason = RollbackReason.MANUAL_TRIGGER
    trigger_id: Optional[str] = None
    description: str = ""
    
    # Status
    status: RollbackStatus = RollbackStatus.PENDING
    
    # Timing
    triggered_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    # Results
    success: bool = False
    verification_result: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class BackupEntry:
    """A backup of file content before fix"""
    backup_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    fix_id: str = ""
    file_path: str = ""
    content: str = ""
    content_hash: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: str = ""  # Auto-cleanup old backups


# Default rollback triggers
DEFAULT_TRIGGERS = [
    RollbackTrigger(
        name="High Error Rate",
        reason=RollbackReason.ERROR_RATE_HIGH,
        threshold_value=0.1,  # 10% error rate
        comparison="greater_than",
        duration_seconds=30
    ),
    RollbackTrigger(
        name="High Response Time",
        reason=RollbackReason.RESPONSE_TIME_HIGH,
        threshold_value=5000,  # 5 seconds
        comparison="greater_than",
        duration_seconds=60
    ),
    RollbackTrigger(
        name="Service Down",
        reason=RollbackReason.SERVICE_DOWN,
        threshold_value=1,  # Any failure
        comparison="equals",
        duration_seconds=10
    ),
]


class RollbackManager:
    """
    Manager for instant rollback operations.
    
    Features:
    - Keep backups of all modified files
    - Automatic rollback on triggers
    - Manual rollback capability
    - Rollback verification
    - Backup cleanup
    """
    
    def __init__(self, db=None):
        self.db = db
        self.backups: Dict[str, BackupEntry] = {}
        self.actions: List[RollbackAction] = []
        self.triggers: Dict[str, RollbackTrigger] = {}
        self.backup_dir = "/app/backend/rollback_backups"
        self.backup_retention_hours = 72  # Keep backups for 72 hours
        
        # Collections
        if db is not None:
            self.backups_collection = db.rollback_backups
            self.actions_collection = db.rollback_actions
            self.triggers_collection = db.rollback_triggers
        
        # Ensure backup directory exists
        os.makedirs(self.backup_dir, exist_ok=True)
        
        # Load default triggers
        for trigger in DEFAULT_TRIGGERS:
            self.triggers[trigger.trigger_id] = trigger
        
        logger.info("RollbackManager initialized")
    
    async def create_backup(self, fix_id: str, file_path: str) -> Optional[BackupEntry]:
        """
        Create a backup of a file before applying a fix.
        """
        try:
            if not os.path.exists(file_path):
                logger.warning(f"File not found for backup: {file_path}")
                return None
            
            with open(file_path, 'r') as f:
                content = f.read()
            
            import hashlib
            content_hash = hashlib.md5(content.encode()).hexdigest()
            
            expires_at = (
                datetime.now(timezone.utc) + 
                timedelta(hours=self.backup_retention_hours)
            ).isoformat()
            
            backup = BackupEntry(
                fix_id=fix_id,
                file_path=file_path,
                content=content,
                content_hash=content_hash,
                expires_at=expires_at
            )
            
            # Store in memory
            self.backups[fix_id] = backup
            
            # Store to file
            backup_path = os.path.join(self.backup_dir, f"{fix_id}.backup")
            with open(backup_path, 'w') as f:
                f.write(content)
            
            # Store metadata in DB
            if self.db is not None:
                await self.backups_collection.insert_one({
                    "backup_id": backup.backup_id,
                    "fix_id": backup.fix_id,
                    "file_path": backup.file_path,
                    "content_hash": backup.content_hash,
                    "backup_path": backup_path,
                    "created_at": backup.created_at,
                    "expires_at": backup.expires_at
                })
            
            logger.info(f"[Rollback] Created backup for fix {fix_id[:8]}: {file_path}")
            
            return backup
            
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            return None
    
    async def rollback(
        self,
        fix_id: str,
        reason: RollbackReason = RollbackReason.MANUAL_TRIGGER,
        description: str = "",
        trigger_id: Optional[str] = None,
        deployment_id: Optional[str] = None
    ) -> RollbackAction:
        """
        Perform a rollback for a fix.
        """
        action = RollbackAction(
            fix_id=fix_id,
            deployment_id=deployment_id,
            reason=reason,
            trigger_id=trigger_id,
            description=description or f"Rollback triggered: {reason.value}"
        )
        action.started_at = datetime.now(timezone.utc).isoformat()
        action.status = RollbackStatus.IN_PROGRESS
        
        try:
            # Get backup
            backup = self.backups.get(fix_id)
            
            if not backup:
                # Try to load from file
                backup_path = os.path.join(self.backup_dir, f"{fix_id}.backup")
                if os.path.exists(backup_path):
                    with open(backup_path, 'r') as f:
                        content = f.read()
                    
                    # Get file path from DB
                    if self.db is not None:
                        doc = await self.backups_collection.find_one({"fix_id": fix_id})
                        if doc:
                            backup = BackupEntry(
                                fix_id=fix_id,
                                file_path=doc["file_path"],
                                content=content
                            )
            
            if not backup:
                action.status = RollbackStatus.FAILED
                action.error_message = "Backup not found"
                logger.error(f"[Rollback] Backup not found for fix {fix_id[:8]}")
                return action
            
            action.file_path = backup.file_path
            action.original_content = backup.content
            
            # Read current content (what we're rolling back from)
            if os.path.exists(backup.file_path):
                with open(backup.file_path, 'r') as f:
                    action.rolled_back_content = f.read()
            
            # Perform rollback
            with open(backup.file_path, 'w') as f:
                f.write(backup.content)
            
            action.status = RollbackStatus.COMPLETED
            action.success = True
            action.completed_at = datetime.now(timezone.utc).isoformat()
            
            logger.info(f"[Rollback] Successfully rolled back fix {fix_id[:8]}")
            
            # Verify rollback
            action = await self._verify_rollback(action)
            
        except Exception as e:
            action.status = RollbackStatus.FAILED
            action.error_message = str(e)
            action.completed_at = datetime.now(timezone.utc).isoformat()
            logger.error(f"[Rollback] Failed: {e}")
        
        self.actions.append(action)
        
        if self.db is not None:
            await self._store_action(action)
        
        return action
    
    async def _verify_rollback(self, action: RollbackAction) -> RollbackAction:
        """
        Verify that a rollback was successful.
        """
        try:
            # Check file content matches backup
            with open(action.file_path, 'r') as f:
                current_content = f.read()
            
            if current_content == action.original_content:
                action.verification_result = "Content matches backup"
                action.status = RollbackStatus.VERIFIED
            else:
                action.verification_result = "Content mismatch after rollback"
                action.status = RollbackStatus.FAILED
                action.success = False
            
            # Run health check
            proc = await asyncio.create_subprocess_exec(
                'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
                'http://localhost:8001/api/health',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            
            status_code = int(stdout.decode().strip()) if stdout else 0
            
            if status_code == 200:
                action.verification_result += "; Health check passed"
            else:
                action.verification_result += f"; Health check failed: {status_code}"
            
        except Exception as e:
            action.verification_result = f"Verification error: {str(e)}"
        
        return action
    
    async def check_triggers(
        self,
        error_rate: float = 0.0,
        response_time_ms: float = 0.0,
        service_status: int = 1,  # 1 = up, 0 = down
        fix_id: Optional[str] = None
    ) -> Optional[RollbackAction]:
        """
        Check if any rollback triggers should fire.
        Returns RollbackAction if a rollback was triggered.
        """
        for trigger in self.triggers.values():
            if not trigger.enabled:
                continue
            
            triggered = False
            value = 0.0
            
            if trigger.reason == RollbackReason.ERROR_RATE_HIGH:
                value = error_rate
                if trigger.comparison == "greater_than" and error_rate > trigger.threshold_value:
                    triggered = True
            
            elif trigger.reason == RollbackReason.RESPONSE_TIME_HIGH:
                value = response_time_ms
                if trigger.comparison == "greater_than" and response_time_ms > trigger.threshold_value:
                    triggered = True
            
            elif trigger.reason == RollbackReason.SERVICE_DOWN:
                value = service_status
                if service_status == 0:
                    triggered = True
            
            if triggered:
                trigger.triggered_count += 1
                trigger.last_triggered = datetime.now(timezone.utc).isoformat()
                
                logger.warning(
                    f"[Rollback] Trigger fired: {trigger.name} "
                    f"(value={value}, threshold={trigger.threshold_value})"
                )
                
                if fix_id:
                    return await self.rollback(
                        fix_id=fix_id,
                        reason=trigger.reason,
                        description=f"Auto-triggered: {trigger.name}",
                        trigger_id=trigger.trigger_id
                    )
        
        return None
    
    async def cleanup_old_backups(self):
        """
        Clean up expired backups.
        """
        now = datetime.now(timezone.utc)
        expired_ids = []
        
        for fix_id, backup in self.backups.items():
            try:
                expires_at = datetime.fromisoformat(backup.expires_at.replace('Z', '+00:00'))
                if now > expires_at:
                    expired_ids.append(fix_id)
            except:
                continue
        
        for fix_id in expired_ids:
            # Remove from memory
            del self.backups[fix_id]
            
            # Remove file
            backup_path = os.path.join(self.backup_dir, f"{fix_id}.backup")
            if os.path.exists(backup_path):
                os.remove(backup_path)
            
            # Remove from DB
            if self.db is not None:
                await self.backups_collection.delete_one({"fix_id": fix_id})
        
        if expired_ids:
            logger.info(f"[Rollback] Cleaned up {len(expired_ids)} expired backups")
    
    async def _store_action(self, action: RollbackAction):
        """Store rollback action in database"""
        if self.db is None:
            return
        
        doc = {
            "action_id": action.action_id,
            "fix_id": action.fix_id,
            "deployment_id": action.deployment_id,
            "file_path": action.file_path,
            "reason": action.reason.value,
            "trigger_id": action.trigger_id,
            "description": action.description,
            "status": action.status.value,
            "triggered_at": action.triggered_at,
            "started_at": action.started_at,
            "completed_at": action.completed_at,
            "success": action.success,
            "verification_result": action.verification_result,
            "error_message": action.error_message
        }
        
        await self.actions_collection.insert_one(doc)
    
    async def get_recent_actions(self, limit: int = 20) -> List[Dict]:
        """Get recent rollback actions"""
        if self.db is None:
            return [
                {
                    "action_id": a.action_id,
                    "fix_id": a.fix_id,
                    "reason": a.reason.value,
                    "status": a.status.value,
                    "success": a.success,
                    "triggered_at": a.triggered_at
                }
                for a in self.actions[-limit:]
            ]
        
        cursor = self.actions_collection.find({}, {"_id": 0}).sort("triggered_at", -1).limit(limit)
        return await cursor.to_list(limit)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get rollback statistics"""
        total = len(self.actions)
        successful = len([a for a in self.actions if a.success])
        
        return {
            "total_rollbacks": total,
            "successful_rollbacks": successful,
            "failed_rollbacks": total - successful,
            "success_rate": round((successful / max(total, 1)) * 100, 1),
            "active_triggers": len([t for t in self.triggers.values() if t.enabled]),
            "backups_stored": len(self.backups)
        }
