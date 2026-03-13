"""
Fabric Catalogue Routes Module

This module handles fabric management for virtual try-on and custom stitching.

Routes:
- GET /api/fabrics - List all fabrics
- POST /api/fabrics - Create a new fabric
- PUT /api/fabrics/{fabric_id} - Update fabric
- DELETE /api/fabrics/{fabric_id} - Delete fabric
- GET /api/fabrics/categories - List fabric categories
- POST /api/fabrics/custom-stitch-request - Create custom stitching request
- GET /api/fabrics/custom-stitch-requests - List custom stitching requests
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import base64
import os

router = APIRouter(prefix="/fabrics", tags=["Fabric Catalogue"])

# Fabric Categories
FABRIC_CATEGORIES = [
    {"id": "cotton", "name": "Cotton", "description": "Breathable, soft, natural fiber"},
    {"id": "silk", "name": "Silk", "description": "Luxurious, smooth, natural protein fiber"},
    {"id": "linen", "name": "Linen", "description": "Cool, crisp, highly absorbent"},
    {"id": "wool", "name": "Wool", "description": "Warm, durable, natural insulator"},
    {"id": "polyester", "name": "Polyester", "description": "Durable, wrinkle-resistant, synthetic"},
    {"id": "denim", "name": "Denim", "description": "Sturdy cotton twill, classic look"},
    {"id": "velvet", "name": "Velvet", "description": "Soft, luxurious pile fabric"},
    {"id": "chiffon", "name": "Chiffon", "description": "Lightweight, sheer, elegant"},
    {"id": "satin", "name": "Satin", "description": "Glossy, smooth surface"},
    {"id": "georgette", "name": "Georgette", "description": "Sheer, crinkled texture"},
    {"id": "crepe", "name": "Crepe", "description": "Crinkled texture, drapes well"},
    {"id": "jacquard", "name": "Jacquard", "description": "Intricately woven patterns"},
    {"id": "brocade", "name": "Brocade", "description": "Rich, decorative shuttle-woven"},
    {"id": "organza", "name": "Organza", "description": "Thin, sheer, crisp"},
    {"id": "tweed", "name": "Tweed", "description": "Rough, woolen, multicolored"},
]

# Pydantic Models
class FabricCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = ""
    color: Optional[str] = ""
    pattern: Optional[str] = "solid"  # solid, striped, checkered, printed, etc.
    price_per_meter: float = 0
    available_quantity: float = 0  # in meters
    image_url: Optional[str] = ""
    suitable_for: List[str] = []  # tops, bottoms, dresses, etc.
    care_instructions: Optional[str] = ""
    composition: Optional[str] = ""  # e.g., "100% Cotton", "60% Polyester, 40% Cotton"


class CustomStitchRequest(BaseModel):
    fabric_id: str
    clothing_type: str  # tops, bottoms, dresses, etc.
    measurements: dict
    design_notes: Optional[str] = ""
    quantity: int = 1
    urgency: str = "normal"  # normal, express, urgent
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = ""
    delivery_address: Optional[str] = ""


# Routes will be registered in server.py
