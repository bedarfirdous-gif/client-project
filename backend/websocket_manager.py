"""
WebSocket Manager for Real-time Notifications
Handles connection management and broadcasting of events
"""
from fastapi import WebSocket
from typing import Dict, List, Set
import json
import asyncio
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time notifications"""
    
    def __init__(self):
        # Active connections: {tenant_id: {user_id: WebSocket}}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # Track connection metadata
        self.connection_info: Dict[str, Dict] = {}
    
    async def connect(self, websocket: WebSocket, tenant_id: str, user_id: str, user_name: str = ""):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        
        if tenant_id not in self.active_connections:
            self.active_connections[tenant_id] = {}
        
        # Close existing connection for this user if any
        if user_id in self.active_connections[tenant_id]:
            try:
                await self.active_connections[tenant_id][user_id].close()
            except:
                pass
        
        self.active_connections[tenant_id][user_id] = websocket
        self.connection_info[user_id] = {
            "tenant_id": tenant_id,
            "user_name": user_name,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        
        logger.info(f"WebSocket connected: user={user_id}, tenant={tenant_id}")
        
        # Broadcast user online status
        await self.broadcast_to_tenant(tenant_id, {
            "type": "user_online",
            "data": {
                "user_id": user_id,
                "user_name": user_name,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }, exclude_user=user_id)
    
    def disconnect(self, tenant_id: str, user_id: str):
        """Remove a WebSocket connection"""
        if tenant_id in self.active_connections:
            if user_id in self.active_connections[tenant_id]:
                del self.active_connections[tenant_id][user_id]
                logger.info(f"WebSocket disconnected: user={user_id}")
        
        if user_id in self.connection_info:
            del self.connection_info[user_id]
    
    async def broadcast_to_tenant(self, tenant_id: str, message: dict, exclude_user: str = None):
        """Broadcast a message to all users in a tenant"""
        if tenant_id not in self.active_connections:
            return
        
        disconnected = []
        for user_id, websocket in self.active_connections[tenant_id].items():
            if exclude_user and user_id == exclude_user:
                continue
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to {user_id}: {e}")
                disconnected.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected:
            self.disconnect(tenant_id, user_id)
    
    async def send_to_user(self, tenant_id: str, user_id: str, message: dict):
        """Send a message to a specific user"""
        if tenant_id in self.active_connections:
            if user_id in self.active_connections[tenant_id]:
                try:
                    await self.active_connections[tenant_id][user_id].send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send to {user_id}: {e}")
                    self.disconnect(tenant_id, user_id)
    
    def get_online_users(self, tenant_id: str) -> List[str]:
        """Get list of online user IDs for a tenant"""
        if tenant_id not in self.active_connections:
            return []
        return list(self.active_connections[tenant_id].keys())
    
    def get_connection_count(self, tenant_id: str = None) -> int:
        """Get total number of connections"""
        if tenant_id:
            return len(self.active_connections.get(tenant_id, {}))
        return sum(len(conns) for conns in self.active_connections.values())


# Global instance
manager = ConnectionManager()


# Event types for notifications
class EventType:
    SALE_CREATED = "sale_created"
    SALE_RETURNED = "sale_returned"
    CUSTOMER_CREATED = "customer_created"
    STOCK_TRANSFER = "stock_transfer"
    LOW_STOCK_ALERT = "low_stock_alert"
    SECURITY_ALERT = "security_alert"
    USER_ONLINE = "user_online"
    USER_OFFLINE = "user_offline"
    INVENTORY_UPDATE = "inventory_update"
    VOUCHER_USED = "voucher_used"
    # Chat events
    CHAT_MESSAGE = "chat_message"
    CHAT_TYPING = "chat_typing"
    CHAT_READ = "chat_read"
    CHAT_DELETE = "chat_delete"
    # AutoHeal events
    AUTOHEAL_ERROR_DETECTED = "autoheal_error_detected"
    AUTOHEAL_HEALING_STARTED = "autoheal_healing_started"
    AUTOHEAL_HEALING_COMPLETE = "autoheal_healing_complete"
    AUTOHEAL_STATS_UPDATE = "autoheal_stats_update"
    AUTOHEAL_NEW_ALERT = "autoheal_new_alert"
    AUTOHEAL_SYSTEM_HEALTH = "autoheal_system_health"
    # Enterprise Self-Healing events
    SELF_HEAL_ERROR_DETECTED = "self_heal_error_detected"
    SELF_HEAL_FIX_GENERATING = "self_heal_fix_generating"
    SELF_HEAL_FIX_TESTING = "self_heal_fix_testing"
    SELF_HEAL_DEPLOYING = "self_heal_deploying"
    SELF_HEAL_COMPLETED = "self_heal_completed"
    SELF_HEAL_FAILED = "self_heal_failed"
    SELF_HEAL_ROLLBACK = "self_heal_rollback"
    SELF_HEAL_HEALTH_UPDATE = "self_heal_health_update"
    SELF_HEAL_BLOCKED = "self_heal_blocked"


async def broadcast_chat_message(tenant_id: str, message_data: dict, sender_id: str = None):
    """Broadcast a chat message to all tenant users"""
    message = {
        "type": EventType.CHAT_MESSAGE,
        "data": message_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await manager.broadcast_to_tenant(tenant_id, message, exclude_user=sender_id)


async def broadcast_typing_indicator(tenant_id: str, user_id: str, user_name: str, is_typing: bool):
    """Broadcast typing indicator"""
    message = {
        "type": EventType.CHAT_TYPING,
        "data": {
            "user_id": user_id,
            "user_name": user_name,
            "is_typing": is_typing
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await manager.broadcast_to_tenant(tenant_id, message, exclude_user=user_id)


async def broadcast_event(tenant_id: str, event_type: str, data: dict, title: str = "", severity: str = "info"):
    """Helper function to broadcast an event to all tenant users"""
    message = {
        "type": event_type,
        "title": title,
        "severity": severity,  # info, success, warning, error
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await manager.broadcast_to_tenant(tenant_id, message)


# ============== AutoHeal Real-time Functions ==============

async def broadcast_autoheal_error(tenant_id: str, error_data: dict):
    """Broadcast when a new error is detected"""
    await broadcast_event(
        tenant_id,
        EventType.AUTOHEAL_ERROR_DETECTED,
        error_data,
        title="Error Detected",
        severity="error"
    )

async def broadcast_autoheal_healing_started(tenant_id: str, healing_data: dict):
    """Broadcast when healing process starts"""
    await broadcast_event(
        tenant_id,
        EventType.AUTOHEAL_HEALING_STARTED,
        healing_data,
        title="Auto-Healing Started",
        severity="warning"
    )

async def broadcast_autoheal_healing_complete(tenant_id: str, result_data: dict):
    """Broadcast when healing is complete"""
    success = result_data.get("success", False)
    await broadcast_event(
        tenant_id,
        EventType.AUTOHEAL_HEALING_COMPLETE,
        result_data,
        title="Auto-Healing Complete" if success else "Auto-Healing Failed",
        severity="success" if success else "error"
    )

async def broadcast_autoheal_stats(stats_data: dict):
    """Broadcast stats update to all connected clients"""
    # Broadcast to all tenants
    for tenant_id in manager.active_connections.keys():
        message = {
            "type": EventType.AUTOHEAL_STATS_UPDATE,
            "data": stats_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await manager.broadcast_to_tenant(tenant_id, message)

async def broadcast_autoheal_alert(tenant_id: str, alert_data: dict):
    """Broadcast a new alert"""
    await broadcast_event(
        tenant_id,
        EventType.AUTOHEAL_NEW_ALERT,
        alert_data,
        title="New Alert",
        severity=alert_data.get("severity", "warning")
    )

async def broadcast_system_health(health_data: dict):
    """Broadcast system health update to all"""
    for tenant_id in manager.active_connections.keys():
        message = {
            "type": EventType.AUTOHEAL_SYSTEM_HEALTH,
            "data": health_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await manager.broadcast_to_tenant(tenant_id, message)


# ============== Enterprise Self-Healing Real-time Functions ==============

async def broadcast_self_heal_event(event_type: str, data: dict, title: str = "", severity: str = "info"):
    """Broadcast self-healing event to all connected admins"""
    message = {
        "type": event_type,
        "title": title,
        "severity": severity,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    # Broadcast to all tenants (admins will filter based on permissions)
    for tenant_id in manager.active_connections.keys():
        await manager.broadcast_to_tenant(tenant_id, message)


async def broadcast_self_heal_error_detected(error_data: dict):
    """Broadcast when enterprise self-healing detects an error"""
    await broadcast_self_heal_event(
        EventType.SELF_HEAL_ERROR_DETECTED,
        error_data,
        title=f"Error Detected: {error_data.get('error_type', 'Unknown')}",
        severity="error"
    )


async def broadcast_self_heal_fix_generating(operation_data: dict):
    """Broadcast when AI is generating a fix"""
    await broadcast_self_heal_event(
        EventType.SELF_HEAL_FIX_GENERATING,
        operation_data,
        title="AI Generating Fix (GPT-5.2)",
        severity="warning"
    )


async def broadcast_self_heal_fix_testing(operation_data: dict):
    """Broadcast when fix is being tested in sandbox"""
    await broadcast_self_heal_event(
        EventType.SELF_HEAL_FIX_TESTING,
        operation_data,
        title="Testing Fix in Sandbox",
        severity="info"
    )


async def broadcast_self_heal_deploying(operation_data: dict):
    """Broadcast when fix is being deployed"""
    await broadcast_self_heal_event(
        EventType.SELF_HEAL_DEPLOYING,
        operation_data,
        title="Deploying Fix",
        severity="warning"
    )


async def broadcast_self_heal_completed(operation_data: dict):
    """Broadcast when self-healing completes successfully"""
    await broadcast_self_heal_event(
        EventType.SELF_HEAL_COMPLETED,
        operation_data,
        title="Self-Healing Completed Successfully",
        severity="success"
    )


async def broadcast_self_heal_failed(operation_data: dict):
    """Broadcast when self-healing fails"""
    await broadcast_self_heal_event(
        EventType.SELF_HEAL_FAILED,
        operation_data,
        title=f"Self-Healing Failed: {operation_data.get('reason', 'Unknown')}",
        severity="error"
    )


async def broadcast_self_heal_rollback(rollback_data: dict):
    """Broadcast when a rollback is triggered"""
    await broadcast_self_heal_event(
        EventType.SELF_HEAL_ROLLBACK,
        rollback_data,
        title="Rollback Triggered",
        severity="warning"
    )


async def broadcast_self_heal_blocked(block_data: dict):
    """Broadcast when auto-fix is blocked by critical guard"""
    await broadcast_self_heal_event(
        EventType.SELF_HEAL_BLOCKED,
        block_data,
        title="Auto-Fix Blocked (Protected Module)",
        severity="warning"
    )


async def broadcast_self_heal_health_update(health_data: dict):
    """Broadcast real-time system health update"""
    await broadcast_self_heal_event(
        EventType.SELF_HEAL_HEALTH_UPDATE,
        health_data,
        title="System Health Update",
        severity="info" if health_data.get("overall_status") == "healthy" else "warning"
    )

