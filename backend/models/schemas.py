"""
Pydantic Models/Schemas for API validation and documentation.

This file contains shared schema definitions for the API.
Note: Currently most models are defined in server.py.
New models should be added here for better organization.
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime


class Permission(BaseModel):
    """Standard permission format"""
    module: str
    actions: List[str] = ["view"]  # Standardized to array format


class UserPermissions(BaseModel):
    """User permissions in standardized format"""
    permissions: Dict[str, List[str]]  # {"dashboard": ["view", "edit"], ...}


class PermissionUpdate(BaseModel):
    """Request model for updating permissions"""
    permissions: Dict[str, List[str]]


class RolePermissions(BaseModel):
    """Role with permissions"""
    id: str
    name: str
    permissions: Dict[str, List[str]]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ModuleAccess(BaseModel):
    """Module access configuration"""
    module_key: str
    name: str
    description: Optional[str] = None
    enabled: bool = False
    available: bool = True  # Based on plan


class AdminModules(BaseModel):
    """Admin's module configuration"""
    admin_id: str
    admin_name: str
    plan: str
    modules: Dict[str, Dict[str, ModuleAccess]]


# Standard API response models
class SuccessResponse(BaseModel):
    """Standard success response"""
    message: str
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    """Standard error response"""
    detail: str
    error_code: Optional[str] = None


class PaginatedResponse(BaseModel):
    """Paginated list response"""
    items: List[Any]
    total: int
    page: int = 1
    page_size: int = 20
    has_more: bool = False
