"""
Authentication utilities and helpers
"""
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.exceptions import InvalidTokenError as JWTError
import os
from typing import Dict, List, Any, Union

# JWT Config
SECRET_KEY = os.environ.get('JWT_SECRET', 'retail-pos-secret-key-2026')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def normalize_permissions(permissions: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Standardize permission format to always return array format.
    
    Handles:
    - Boolean format: {"dashboard": True} -> {"dashboard": ["view"]}
    - Array format: {"dashboard": ["view", "edit"]} -> unchanged
    - Object format: {"dashboard": {"view": True}} -> {"dashboard": ["view"]}
    
    This ensures consistent format for frontend consumption.
    """
    if not permissions:
        return {}
    
    normalized = {}
    for key, value in permissions.items():
        if isinstance(value, bool):
            # Boolean: True = ["view"], False = []
            normalized[key] = ["view"] if value else []
        elif isinstance(value, list):
            # Already array format
            normalized[key] = value
        elif isinstance(value, dict):
            # Object format: extract enabled actions
            normalized[key] = [action for action, enabled in value.items() if enabled]
        else:
            normalized[key] = []
    
    return normalized


def denormalize_permissions(permissions: Dict[str, List[str]]) -> Dict[str, bool]:
    """
    Convert array format back to boolean format for storage.
    
    Used when saving permissions back to database in the legacy boolean format.
    {"dashboard": ["view"]} -> {"dashboard": True}
    """
    if not permissions:
        return {}
    
    return {key: len(value) > 0 for key, value in permissions.items()}


def is_superadmin(user: dict) -> bool:
    """Check if user is superadmin - superadmin ALWAYS bypasses all permission checks"""
    return user.get("role") == "superadmin"


def check_admin_access(user: dict, allow_manager: bool = False):
    """
    Check if user has admin-level access.
    SUPER_ADMIN: Always passes (permanent unrestricted access)
    ADMIN: Must have explicit permission (permission-based)
    """
    if is_superadmin(user):
        return True  # SUPER_ADMIN bypasses ALL checks
    # ADMIN no longer has automatic access - must have permission
    if allow_manager and user.get("role") in ["admin", "manager"]:
        return True
    raise HTTPException(status_code=403, detail="Permission denied")


def check_role_access(user: dict, allowed_roles: list):
    """
    Check if user has one of the allowed roles.
    SUPER_ADMIN: Always passes regardless of allowed_roles
    """
    if is_superadmin(user):
        return True  # SUPER_ADMIN bypasses ALL role checks
    if user.get("role") in allowed_roles:
        return True
    raise HTTPException(status_code=403, detail=f"Access denied. Required roles: {', '.join(allowed_roles)}")


def check_permission(user: dict, permission_key: str) -> bool:
    """
    Check if user has a specific permission.
    SUPER_ADMIN: Always returns True (automatic access to all modules)
    ADMIN/Others: Must have explicit permission in their permissions dict
    """
    if is_superadmin(user):
        return True  # SUPER_ADMIN has ALL permissions automatically
    
    # Check user's explicit permissions
    user_permissions = user.get("permissions", {})
    return user_permissions.get(permission_key, False)


def get_tenant_id(user: dict) -> str:
    """Get the tenant ID from user"""
    return user.get("tenant_id", "default")


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
