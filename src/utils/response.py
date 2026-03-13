"""
Standardized API Response Format
================================
All API responses follow this consistent structure for predictability.
"""

from typing import Any, Optional, Dict, List, Union
from datetime import datetime, timezone
from fastapi.responses import JSONResponse
from fastapi import status


class APIResponse:
    """Standardized API response builder"""
    
    @staticmethod
    def success(
        data: Any = None,
        message: str = "Success",
        meta: Optional[Dict] = None,
        status_code: int = status.HTTP_200_OK
    ) -> JSONResponse:
        """
        Success response format:
        {
            "success": true,
            "message": "Success message",
            "data": {...},
            "meta": {...},
            "timestamp": "2026-02-20T15:00:00Z"
        }
        """
        response = {
            "success": True,
            "message": message,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if meta:
            response["meta"] = meta
        return JSONResponse(content=response, status_code=status_code)
    
    @staticmethod
    def created(
        data: Any = None,
        message: str = "Created successfully"
    ) -> JSONResponse:
        """201 Created response"""
        return APIResponse.success(data, message, status_code=status.HTTP_201_CREATED)
    
    @staticmethod
    def error(
        message: str = "An error occurred",
        error_code: Optional[str] = None,
        details: Optional[Any] = None,
        status_code: int = status.HTTP_400_BAD_REQUEST
    ) -> JSONResponse:
        """
        Error response format:
        {
            "success": false,
            "message": "Error message",
            "error_code": "ERR_CODE",
            "details": {...},
            "timestamp": "2026-02-20T15:00:00Z"
        }
        """
        response = {
            "success": False,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if error_code:
            response["error_code"] = error_code
        if details:
            response["details"] = details
        return JSONResponse(content=response, status_code=status_code)
    
    @staticmethod
    def not_found(message: str = "Resource not found") -> JSONResponse:
        """404 Not Found response"""
        return APIResponse.error(message, "NOT_FOUND", status_code=status.HTTP_404_NOT_FOUND)
    
    @staticmethod
    def unauthorized(message: str = "Unauthorized") -> JSONResponse:
        """401 Unauthorized response"""
        return APIResponse.error(message, "UNAUTHORIZED", status_code=status.HTTP_401_UNAUTHORIZED)
    
    @staticmethod
    def forbidden(message: str = "Access forbidden") -> JSONResponse:
        """403 Forbidden response"""
        return APIResponse.error(message, "FORBIDDEN", status_code=status.HTTP_403_FORBIDDEN)
    
    @staticmethod
    def validation_error(details: Any, message: str = "Validation failed") -> JSONResponse:
        """422 Validation Error response"""
        return APIResponse.error(message, "VALIDATION_ERROR", details, status.HTTP_422_UNPROCESSABLE_ENTITY)
    
    @staticmethod
    def server_error(message: str = "Internal server error") -> JSONResponse:
        """500 Internal Server Error response"""
        return APIResponse.error(message, "SERVER_ERROR", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @staticmethod
    def paginated(
        data: List[Any],
        total: int,
        page: int = 1,
        page_size: int = 20,
        message: str = "Success"
    ) -> JSONResponse:
        """
        Paginated response format:
        {
            "success": true,
            "message": "Success",
            "data": [...],
            "meta": {
                "total": 100,
                "page": 1,
                "page_size": 20,
                "total_pages": 5,
                "has_next": true,
                "has_prev": false
            },
            "timestamp": "..."
        }
        """
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        meta = {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
        return APIResponse.success(data, message, meta)


# Convenience functions for direct import
def success_response(data=None, message="Success", **kwargs):
    return APIResponse.success(data, message, **kwargs)

def error_response(message="Error", **kwargs):
    return APIResponse.error(message, **kwargs)

def created_response(data=None, message="Created"):
    return APIResponse.created(data, message)

def paginated_response(data, total, page=1, page_size=20):
    return APIResponse.paginated(data, total, page, page_size)
