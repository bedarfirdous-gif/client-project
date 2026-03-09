# 📋 RBAC Permission Module - Complete API Documentation

## Overview

The RBAC (Role-Based Access Control) module provides comprehensive user permission management for the BijnisBooks platform. This document covers all APIs with request/response examples.

---

## 🔐 Authentication

All APIs require Bearer token authentication:
```
Authorization: Bearer <access_token>
```

---

## 📑 Table of Contents

1. [Role Management](#1-role-management)
2. [Permission Templates](#2-permission-templates)
3. [User Permissions](#3-user-permissions)
4. [Session Management](#4-session-management)
5. [Login History](#5-login-history)
6. [IP Whitelisting](#6-ip-whitelisting)
7. [Time-Based Access](#7-time-based-access)
8. [API Keys Management](#8-api-keys-management)
9. [Activity Log](#9-activity-log)
10. [RBAC Stats](#10-rbac-stats)
11. [Super Admin APIs](#11-super-admin-apis)
12. [God Mode APIs](#12-god-mode-apis)

---

## 1. Role Management

### GET /api/roles
Get all roles for the tenant.

**Response:**
```json
[
  {
    "id": "role_abc123",
    "tenant_id": "tenant_xyz",
    "name": "Store Manager",
    "description": "Manages store operations",
    "permissions": {
      "dashboard": ["view"],
      "sales": ["view", "create", "edit"],
      "inventory": ["view", "edit"]
    },
    "created_at": "2026-02-06T10:00:00Z"
  }
]
```

---

### POST /api/roles
Create a new role.

**Request:**
```json
{
  "name": "Cashier",
  "description": "POS and sales only",
  "permissions": {
    "pos": ["view", "create"],
    "sales": ["view", "create"],
    "customers": ["view"]
  }
}
```

**Response:**
```json
{
  "id": "role_new123",
  "tenant_id": "tenant_xyz",
  "name": "Cashier",
  "description": "POS and sales only",
  "permissions": {
    "pos": ["view", "create"],
    "sales": ["view", "create"],
    "customers": ["view"]
  },
  "created_at": "2026-02-06T10:00:00Z",
  "created_by": "user_admin"
}
```

---

### PUT /api/roles/{role_id}
Update an existing role.

**Request:**
```json
{
  "name": "Senior Cashier",
  "description": "POS with returns access",
  "permissions": {
    "pos": ["view", "create"],
    "sales": ["view", "create", "edit"],
    "returns": ["view", "create"],
    "customers": ["view", "create"]
  }
}
```

---

### DELETE /api/roles/{role_id}
Delete a role.

**Response:**
```json
{
  "message": "Role deleted"
}
```

---

### POST /api/rbac/roles/{role_id}/clone
Clone an existing role with a new name.

**Request:**
```json
{
  "new_name": "Junior Store Manager"
}
```

**Response:**
```json
{
  "id": "role_cloned456",
  "name": "Junior Store Manager",
  "description": "Cloned from Store Manager",
  "permissions": { ... },
  "cloned_from": "role_abc123",
  "created_at": "2026-02-06T10:00:00Z"
}
```

---

## 2. Permission Templates

### GET /api/rbac/permission-templates
Get pre-defined and custom permission templates.

**Response:**
```json
{
  "templates": [
    {
      "id": "tpl_admin",
      "name": "Full Admin",
      "description": "Complete access to all modules",
      "is_system": true,
      "permissions": {
        "dashboard": ["view", "edit"],
        "items": ["view", "create", "edit", "delete"],
        "inventory": ["view", "create", "edit", "delete"],
        "sales": ["view", "create", "edit", "delete"],
        "purchases": ["view", "create", "edit", "delete"],
        "customers": ["view", "create", "edit", "delete"],
        "employees": ["view", "create", "edit", "delete"],
        "reports": ["view", "export"],
        "settings": ["view", "edit"],
        "users": ["view", "create", "edit", "delete"]
      }
    },
    {
      "id": "tpl_manager",
      "name": "Store Manager",
      "description": "Manage store operations, no user management",
      "is_system": true,
      "permissions": { ... }
    },
    {
      "id": "tpl_cashier",
      "name": "Cashier",
      "description": "POS and sales only",
      "is_system": true,
      "permissions": {
        "dashboard": ["view"],
        "pos": ["view", "create"],
        "sales": ["view", "create"],
        "customers": ["view", "create"],
        "inventory": ["view"]
      }
    },
    {
      "id": "tpl_accountant",
      "name": "Accountant",
      "description": "Financial reports and ledgers",
      "is_system": true,
      "permissions": { ... }
    },
    {
      "id": "tpl_viewer",
      "name": "Read-Only Viewer",
      "description": "View all data, no modifications",
      "is_system": true,
      "permissions": { ... }
    }
  ]
}
```

---

### POST /api/rbac/permission-templates
Create a custom permission template.

**Request:**
```json
{
  "name": "Warehouse Staff",
  "description": "Inventory and stock management only",
  "permissions": {
    "dashboard": ["view"],
    "inventory": ["view", "create", "edit"],
    "stock_transfers": ["view", "create"],
    "items": ["view"]
  }
}
```

**Response:**
```json
{
  "id": "tpl_custom_abc",
  "tenant_id": "tenant_xyz",
  "name": "Warehouse Staff",
  "description": "Inventory and stock management only",
  "permissions": { ... },
  "is_system": false,
  "created_at": "2026-02-06T10:00:00Z"
}
```

---

### DELETE /api/rbac/permission-templates/{template_id}
Delete a custom template (system templates cannot be deleted).

**Response:**
```json
{
  "message": "Template deleted"
}
```

**Error (system template):**
```json
{
  "detail": "Cannot delete system templates"
}
```

---

## 3. User Permissions

### PUT /api/users/{user_id}/permissions
Update permissions for a specific user.

**Request:**
```json
{
  "permissions": {
    "dashboard": ["view"],
    "sales": ["view", "create"],
    "inventory": ["view"]
  }
}
```

---

### POST /api/users/bulk-assign-role
Bulk assign a role to multiple users.

**Request:**
```json
{
  "user_ids": ["user_1", "user_2", "user_3"],
  "role_id": "role_cashier"
}
```

---

### POST /api/rbac/bulk-update-permissions
Bulk update permissions for multiple users.

**Request:**
```json
{
  "user_ids": ["user_1", "user_2", "user_3"],
  "permissions": {
    "sales": ["view", "create"],
    "inventory": ["view"]
  },
  "mode": "replace"
}
```

**Mode options:**
- `replace` - Replace all existing permissions
- `merge` - Merge with existing permissions

**Response:**
```json
{
  "message": "Updated permissions for 3 users",
  "updated_count": 3
}
```

---

### GET /api/rbac/check-permission
Check if a user has a specific permission.

**Query Parameters:**
- `module` (required): Module to check (e.g., "sales")
- `action` (required): Action to check (e.g., "create")
- `target_user_id` (optional): Check for another user (admin only)

**Request:**
```
GET /api/rbac/check-permission?module=sales&action=create
```

**Response:**
```json
{
  "has_permission": true,
  "user_id": "user_123",
  "module": "sales",
  "action": "create",
  "user_permissions": ["view", "create", "edit"]
}
```

---

## 4. Session Management

### GET /api/rbac/sessions
Get all active user sessions.

**Response:**
```json
{
  "sessions": [
    {
      "id": "sess_abc123",
      "user_id": "user_123",
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "device_type": "desktop",
      "last_active": "2026-02-06T10:00:00Z",
      "created_at": "2026-02-06T08:00:00Z",
      "is_active": true
    }
  ],
  "total": 15
}
```

---

### GET /api/rbac/sessions/user/{user_id}
Get all sessions for a specific user.

**Response:**
```json
{
  "sessions": [
    {
      "id": "sess_abc123",
      "ip_address": "192.168.1.100",
      "device_type": "desktop",
      "last_active": "2026-02-06T10:00:00Z",
      "is_active": true
    },
    {
      "id": "sess_def456",
      "ip_address": "10.0.0.50",
      "device_type": "mobile",
      "last_active": "2026-02-05T15:00:00Z",
      "is_active": true
    }
  ]
}
```

---

### DELETE /api/rbac/sessions/{session_id}
Revoke a specific session (force logout).

**Response:**
```json
{
  "message": "Session revoked"
}
```

---

### POST /api/rbac/sessions/revoke-all/{user_id}
Revoke all sessions for a user (force logout from all devices).

**Response:**
```json
{
  "message": "Revoked 3 sessions"
}
```

---

## 5. Login History

### GET /api/rbac/login-history
Get login history for audit purposes.

**Query Parameters:**
- `user_id` (optional): Filter by user
- `from_date` (optional): Start date (YYYY-MM-DD)
- `to_date` (optional): End date (YYYY-MM-DD)
- `status` (optional): "success" or "failed"
- `limit` (optional): Max records (default 100)

**Request:**
```
GET /api/rbac/login-history?status=failed&limit=50
```

**Response:**
```json
{
  "history": [
    {
      "id": "log_123",
      "user_id": "user_abc",
      "user_email": "john@example.com",
      "status": "failed",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "failure_reason": "Invalid password",
      "timestamp": "2026-02-06T09:30:00Z"
    }
  ],
  "total": 5
}
```

---

### GET /api/rbac/login-history/summary
Get login statistics summary.

**Query Parameters:**
- `days` (optional): Number of days to analyze (default 30)

**Response:**
```json
{
  "period_days": 30,
  "total_attempts": 1250,
  "successful": 1180,
  "failed": 70,
  "success_rate": 94.4,
  "unique_users": 45
}
```

---

## 6. IP Whitelisting

### GET /api/rbac/ip-whitelist
Get IP whitelist configuration.

**Response:**
```json
{
  "ip_whitelist_enabled": true,
  "whitelisted_ips": ["192.168.1.100", "10.0.0.50"],
  "whitelisted_ranges": ["192.168.1.0/24", "10.0.0.0/16"]
}
```

---

### PUT /api/rbac/ip-whitelist
Update IP whitelist configuration.

**Request:**
```json
{
  "ip_whitelist_enabled": true,
  "whitelisted_ips": ["192.168.1.100", "10.0.0.50", "203.0.113.25"],
  "whitelisted_ranges": ["192.168.1.0/24"]
}
```

**Response:**
```json
{
  "message": "IP whitelist updated"
}
```

---

## 7. Time-Based Access

### GET /api/rbac/access-schedule
Get time-based access schedules.

**Response:**
```json
{
  "schedules": [
    {
      "id": "sched_abc123",
      "name": "Business Hours Only",
      "role_id": "role_cashier",
      "user_id": null,
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
      "start_time": "09:00",
      "end_time": "18:00",
      "timezone": "Asia/Kolkata",
      "is_active": true
    }
  ]
}
```

---

### POST /api/rbac/access-schedule
Create a time-based access schedule.

**Request:**
```json
{
  "name": "Weekend Restricted",
  "role_id": "role_staff",
  "user_id": null,
  "days": ["saturday", "sunday"],
  "start_time": "10:00",
  "end_time": "14:00",
  "timezone": "Asia/Kolkata",
  "is_active": true
}
```

**Response:**
```json
{
  "id": "sched_new456",
  "name": "Weekend Restricted",
  "role_id": "role_staff",
  "days": ["saturday", "sunday"],
  "start_time": "10:00",
  "end_time": "14:00",
  "timezone": "Asia/Kolkata",
  "is_active": true,
  "created_at": "2026-02-06T10:00:00Z"
}
```

---

### DELETE /api/rbac/access-schedule/{schedule_id}
Delete an access schedule.

**Response:**
```json
{
  "message": "Schedule deleted"
}
```

---

## 8. API Keys Management

### GET /api/rbac/api-keys
Get all API keys for external integrations.

**Response:**
```json
{
  "api_keys": [
    {
      "id": "key_abc123",
      "name": "ERP Integration",
      "key_prefix": "bk_live_a1b2",
      "permissions": ["read:items", "read:inventory", "write:sales"],
      "rate_limit": 1000,
      "expires_at": "2025-12-31",
      "is_active": true,
      "last_used": "2026-02-06T09:00:00Z",
      "usage_count": 15420,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

---

### POST /api/rbac/api-keys
Create a new API key.

**Request:**
```json
{
  "name": "Mobile App Integration",
  "permissions": ["read:items", "read:inventory", "read:customers"],
  "expires_at": "2026-12-31",
  "rate_limit": 5000
}
```

**Response (key shown only once!):**
```json
{
  "id": "key_new789",
  "name": "Mobile App Integration",
  "key": "bk_live_8f3a2c1d9e4b5f6a7c8d9e0f1a2b3c4d5e6f7a8b",
  "permissions": ["read:items", "read:inventory", "read:customers"],
  "expires_at": "2026-12-31",
  "message": "Save this API key securely. It won't be shown again."
}
```

⚠️ **Important:** The full API key is only shown once at creation time!

---

### DELETE /api/rbac/api-keys/{key_id}
Revoke an API key.

**Response:**
```json
{
  "message": "API key revoked"
}
```

---

## 9. Activity Log

### GET /api/rbac/activity-log
Get detailed activity log for audit purposes.

**Query Parameters:**
- `user_id` (optional): Filter by user
- `action` (optional): "create", "update", "delete", "view", "export"
- `module` (optional): "items", "sales", "purchases", etc.
- `from_date` (optional): Start date
- `to_date` (optional): End date
- `limit` (optional): Max records (default 100)

**Request:**
```
GET /api/rbac/activity-log?module=sales&action=create&limit=50
```

**Response:**
```json
{
  "logs": [
    {
      "id": "act_123",
      "user_id": "user_abc",
      "user_name": "John Doe",
      "action": "create",
      "module": "sales",
      "entity_id": "sale_xyz",
      "entity_type": "sale",
      "description": "Created sale INV-000125",
      "changes": {
        "total_amount": 15000,
        "items_count": 3
      },
      "ip_address": "192.168.1.100",
      "timestamp": "2026-02-06T10:30:00Z"
    }
  ],
  "total": 50
}
```

---

### GET /api/rbac/activity-log/export
Export activity log for compliance/audit.

**Query Parameters:**
- `from_date` (required): Start date
- `to_date` (required): End date
- `format` (optional): "json" (default)

**Response:**
```json
{
  "export_date": "2026-02-06T10:00:00Z",
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31"
  },
  "total_records": 2450,
  "data": [ ... ]
}
```

---

## 10. RBAC Stats

### GET /api/rbac/stats
Get RBAC statistics for the dashboard.

**Response:**
```json
{
  "total_users": 45,
  "users_by_role": {
    "admin": 2,
    "manager": 5,
    "staff": 25,
    "cashier": 10,
    "viewer": 3
  },
  "total_roles": 8,
  "active_sessions": 32,
  "active_api_keys": 3,
  "failed_logins_24h": 5
}
```

---

## 11. Super Admin APIs

### GET /api/superadmin/dashboard
Get super admin dashboard statistics.

**Response:**
```json
{
  "total_tenants": 150,
  "active_tenants": 142,
  "total_users": 2500,
  "monthly_revenue": 450000,
  "recent_signups": 12,
  "system_health": "healthy"
}
```

---

### GET /api/superadmin/admins
List all admin tenants.

**Response:**
```json
[
  {
    "id": "admin_123",
    "name": "ABC Store",
    "email": "abc@store.com",
    "plan": "premium",
    "status": "active",
    "users_count": 15,
    "created_at": "2025-06-15T10:00:00Z"
  }
]
```

---

### POST /api/superadmin/impersonate/{admin_id}
Impersonate an admin (login as them).

**Response:**
```json
{
  "message": "Impersonation started",
  "impersonated_user": {
    "id": "admin_123",
    "name": "ABC Store",
    "email": "abc@store.com"
  },
  "token": "new_impersonation_token"
}
```

---

### POST /api/superadmin/exit-impersonation
Exit impersonation mode.

**Response:**
```json
{
  "message": "Impersonation ended",
  "token": "original_superadmin_token"
}
```

---

## 12. God Mode APIs

### POST /api/superadmin/god-mode/reset-password
Force reset any user's password.

**Request:**
```json
{
  "user_id": "user_abc",
  "new_password": "NewSecurePassword123!"
}
```

---

### POST /api/superadmin/god-mode/force-logout
Force logout a user from all sessions.

**Request:**
```json
{
  "user_id": "user_abc"
}
```

---

### POST /api/superadmin/god-mode/freeze-tenant
Freeze/suspend a tenant account.

**Request:**
```json
{
  "tenant_id": "tenant_xyz",
  "reason": "Payment overdue"
}
```

---

### POST /api/superadmin/god-mode/change-role
Change any user's role.

**Request:**
```json
{
  "user_id": "user_abc",
  "new_role": "admin"
}
```

---

### GET /api/superadmin/god-mode/system-health
Get system health status.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "memory_usage": "45%",
  "cpu_usage": "12%",
  "active_connections": 250,
  "uptime": "15 days, 4 hours"
}
```

---

## 🔒 Permission Actions Reference

| Action | Description |
|--------|-------------|
| `view` | Read/view data |
| `create` | Create new records |
| `edit` | Modify existing records |
| `delete` | Delete records |
| `export` | Export data to files |
| `all` | Full access to module |

---

## 📊 Available Modules

| Module Key | Description |
|------------|-------------|
| `dashboard` | Main dashboard |
| `pos` | Point of Sale |
| `items` | Item management |
| `inventory` | Inventory management |
| `sales` | Sales management |
| `purchases` | Purchase management |
| `customers` | Customer management |
| `suppliers` | Supplier management |
| `employees` | HR management |
| `reports` | Analytics & reports |
| `settings` | System settings |
| `users` | User management |
| `gst_master` | GST configuration |

---

## ⚠️ Error Responses

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "detail": "Admin only"
}
```

### 404 Not Found
```json
{
  "detail": "Role not found"
}
```

### 400 Bad Request
```json
{
  "detail": "Cannot delete system templates"
}
```

---

## 📈 Total API Count Summary

| Category | Count |
|----------|-------|
| Role Management | 5 |
| Permission Templates | 3 |
| User Permissions | 4 |
| Session Management | 4 |
| Login History | 2 |
| IP Whitelisting | 2 |
| Time-Based Access | 3 |
| API Keys | 3 |
| Activity Log | 2 |
| RBAC Stats | 1 |
| Super Admin | 8 |
| God Mode | 9 |
| **TOTAL** | **~46 APIs** |

---

*Documentation generated: February 6, 2026*
