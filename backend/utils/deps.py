"""
Shared Dependencies Module for BijnisBooks Backend

Contains commonly used dependencies, helpers, and database connections
that are shared across all route modules.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import jwt
import os

# MongoDB connection - imported from server.py context
# Note: This will be properly initialized when imported from server.py
db = None

# JWT Configuration - must match server.py
JWT_SECRET = os.environ.get("JWT_SECRET", "retail-pos-secret-key-2026")
JWT_ALGORITHM = "HS256"

# Security
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def set_database(database):
    """Set the database instance (called from server.py)"""
    global db
    db = database


def get_db():
    """Get the database instance"""
    if db is None:
        raise RuntimeError("Database not initialized. Call set_database() first.")
    return db


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    import bcrypt
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a hash"""
    import bcrypt
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(data: dict, expires_minutes: int = 1440) -> str:
    """Create a JWT access token"""
    from datetime import timedelta
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode a JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def is_superadmin(user: dict) -> bool:
    """Check if user is a superadmin"""
    return user.get("role") == "superadmin" or user.get("is_superadmin", False)


def check_admin_access(user: dict, allow_manager: bool = False):
    """Check if user has admin access"""
    allowed_roles = ["admin", "superadmin"]
    if allow_manager:
        allowed_roles.append("manager")
    
    if user.get("role") not in allowed_roles and not user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


def check_role_access(user: dict, allowed_roles: list):
    """Check if user has one of the allowed roles"""
    if user.get("role") not in allowed_roles and not is_superadmin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
        )


def get_tenant_id(user: dict) -> str:
    """Get tenant ID from user"""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID not found"
        )
    return tenant_id


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    database = get_db()
    user = await database.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Remove sensitive fields
    user.pop("_id", None)
    user.pop("password", None)
    
    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(optional_security)
) -> Optional[dict]:
    """Get current user if authenticated, None otherwise"""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def check_permission(user: dict, permission_key: str) -> bool:
    """Check if user has a specific permission"""
    if is_superadmin(user):
        return True
    
    role = user.get("role", "")
    if role in ["admin", "manager"]:
        return True
    
    permissions = user.get("permissions", {})
    
    # Check module permissions
    if permission_key in permissions:
        perm = permissions[permission_key]
        if isinstance(perm, bool):
            return perm
        if isinstance(perm, dict):
            return perm.get("view", False) or perm.get("edit", False)
    
    return False


def require_permission(permission_key: str):
    """Dependency that requires a specific permission"""
    async def permission_checker(user: dict = Depends(get_current_user)):
        if not check_permission(user, permission_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_key}' required"
            )
        return user
    return permission_checker


# Common response helpers
def success_response(message: str, data: Any = None) -> dict:
    """Create a success response"""
    response = {"success": True, "message": message}
    if data is not None:
        response["data"] = data
    return response


def error_response(message: str, status_code: int = 400) -> HTTPException:
    """Create an error response"""
    return HTTPException(status_code=status_code, detail=message)


# Date/Time helpers
def utc_now() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    """Get current UTC datetime as ISO string"""
    return datetime.now(timezone.utc).isoformat()
