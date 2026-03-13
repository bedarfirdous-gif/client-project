"""
Face Attendance Routes Module

This module handles face recognition-based attendance marking.

Routes:
- POST /face-attendance/register - Register an employee's face
- POST /face-attendance/verify - Verify face against registered employees
- POST /face-attendance/mark - Mark attendance using face recognition
- GET /face-attendance/status/{employee_id} - Check registration status
- GET /face-attendance/registrations - Get all face registrations
- DELETE /face-attendance/registration/{employee_id} - Delete registration

Status: Routes are implemented in server.py
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/face-attendance", tags=["Face Attendance"])

# Note: All routes are currently implemented in server.py
# This file serves as documentation and future migration target

# Request Models (defined in server.py):
#
# class FaceRegistrationRequest:
#     employee_id: str
#     image: str  # Base64 encoded image
#
# class FaceVerifyRequest:
#     image: str  # Base64 encoded image
#
# class FaceAttendanceRequest:
#     employee_id: str
#     store_id: str
#     image: str  # Base64 encoded image

# The following routes exist in server.py:
#
# POST /api/face-attendance/register
# - Registers an employee's face for recognition
# - Requires employees permission
# - Extracts facial features using OpenCV
# - Stores in face_registrations collection
#
# POST /api/face-attendance/verify
# - Verifies a captured face against all registered faces
# - Returns matched employee info and confidence score
# - Threshold: 60% similarity
#
# POST /api/face-attendance/mark
# - Marks attendance using face recognition
# - Verifies face first, then creates attendance record
# - Supports check-in and check-out
# - Records method as "face_recognition"
#
# GET /api/face-attendance/status/{employee_id}
# - Checks if an employee has registered their face
# - Returns registration status and timestamp
#
# GET /api/face-attendance/registrations
# - Lists all face registrations for tenant
# - Includes employee name and code
#
# DELETE /api/face-attendance/registration/{employee_id}
# - Deletes face registration for an employee
# - Soft delete - marks as inactive

# Data Schema:
# face_registrations collection:
# {
#     "id": str,                  # Registration ID
#     "tenant_id": str,           # Tenant ID
#     "employee_id": str,         # Employee ID
#     "features": dict,           # Facial features (histogram, mean, std)
#     "registered_at": str,       # ISO timestamp
#     "is_active": bool           # Active status
# }
