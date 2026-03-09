"""
Face Recognition Attendance System

This module provides face-based attendance marking using webcam.
Uses OpenCV for face detection with Haar Cascade classifier.
Face encodings are stored in the database for each employee.
"""

import cv2
import base64
import numpy as np
from datetime import datetime, timezone
import uuid
import os
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Path to OpenCV's pre-trained face detector
CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'


class FaceAttendanceSystem:
    """Face recognition-based attendance system"""
    
    def __init__(self, db):
        self.db = db
        self.face_cascade = cv2.CascadeClassifier(CASCADE_PATH)
        
    def decode_image(self, base64_image: str) -> Optional[np.ndarray]:
        """Decode base64 image to numpy array"""
        try:
            # Remove data URL prefix if present
            if ',' in base64_image:
                base64_image = base64_image.split(',')[1]
            
            image_data = base64.b64decode(base64_image)
            np_array = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
            return image
        except Exception as e:
            logger.error(f"Error decoding image: {e}")
            return None
    
    def detect_face(self, image: np.ndarray) -> Optional[tuple]:
        """Detect face in image and return face region"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(100, 100)
            )
            
            if len(faces) == 0:
                return None
            
            # Return the largest face
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            return tuple(largest_face)
        except Exception as e:
            logger.error(f"Error detecting face: {e}")
            return None
    
    def extract_face_features(self, image: np.ndarray, face_rect: tuple) -> Dict[str, Any]:
        """Extract simple features from face region for comparison"""
        x, y, w, h = face_rect
        face_region = image[y:y+h, x:x+w]
        
        # Resize to standard size for consistency
        face_resized = cv2.resize(face_region, (100, 100))
        
        # Convert to grayscale
        face_gray = cv2.cvtColor(face_resized, cv2.COLOR_BGR2GRAY)
        
        # Calculate histogram as simple feature
        hist = cv2.calcHist([face_gray], [0], None, [256], [0, 256])
        hist = cv2.normalize(hist, hist).flatten()
        
        # Calculate mean and std of face region
        mean_val = np.mean(face_gray)
        std_val = np.std(face_gray)
        
        # Create feature vector - ensure all values are JSON serializable
        features = {
            "histogram": [float(x) for x in hist.tolist()],
            "mean": float(mean_val),
            "std": float(std_val),
            "width": int(w),
            "height": int(h)
        }
        
        return features
    
    def compare_features(self, features1: Dict, features2: Dict) -> float:
        """Compare two feature sets and return similarity score (0-1)"""
        try:
            hist1 = np.array(features1.get("histogram", []))
            hist2 = np.array(features2.get("histogram", []))
            
            if len(hist1) == 0 or len(hist2) == 0:
                return 0.0
            
            # Compare histograms using correlation
            correlation = cv2.compareHist(
                hist1.astype(np.float32).reshape(-1, 1),
                hist2.astype(np.float32).reshape(-1, 1),
                cv2.HISTCMP_CORREL
            )
            
            # Normalize correlation to 0-1 range
            similarity = max(0, min(1, (correlation + 1) / 2))
            
            return float(similarity)
        except Exception as e:
            logger.error(f"Error comparing features: {e}")
            return 0.0
    
    async def register_face(
        self,
        tenant_id: str,
        employee_id: str,
        base64_image: str
    ) -> Dict[str, Any]:
        """Register an employee's face for recognition"""
        
        # Decode image
        image = self.decode_image(base64_image)
        if image is None:
            return {"success": False, "error": "Invalid image data"}
        
        # Detect face
        face_rect = self.detect_face(image)
        if face_rect is None:
            return {"success": False, "error": "No face detected in image. Please ensure your face is clearly visible."}
        
        # Extract features
        features = self.extract_face_features(image, face_rect)
        
        # Store in database
        face_doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "employee_id": employee_id,
            "features": features,
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True
        }
        
        # Remove old registrations for this employee
        await self.db.face_registrations.update_many(
            {"tenant_id": tenant_id, "employee_id": employee_id},
            {"$set": {"is_active": False}}
        )
        
        # Insert new registration
        await self.db.face_registrations.insert_one(face_doc)
        
        return {
            "success": True,
            "message": "Face registered successfully",
            "registration_id": face_doc["id"]
        }
    
    async def verify_face(
        self,
        tenant_id: str,
        base64_image: str,
        threshold: float = 0.70
    ) -> Dict[str, Any]:
        """Verify face against registered employees and return match
        
        Threshold increased to 70% to reduce false positives.
        For production, consider using a proper face recognition ML model.
        """
        
        # Decode image
        image = self.decode_image(base64_image)
        if image is None:
            return {"success": False, "error": "Invalid image data", "matched": False}
        
        # Detect face
        face_rect = self.detect_face(image)
        if face_rect is None:
            return {
                "success": False,
                "error": "No face detected. Please position your face in the camera.",
                "matched": False
            }
        
        # Extract features from captured face
        captured_features = self.extract_face_features(image, face_rect)
        
        # Get all registered faces for this tenant
        registrations = await self.db.face_registrations.find(
            {"tenant_id": tenant_id, "is_active": True},
            {"_id": 0}
        ).to_list(1000)
        
        if not registrations:
            return {
                "success": False,
                "error": "No registered faces found. Please register face first.",
                "matched": False
            }
        
        # Find best match
        best_match = None
        best_score = 0.0
        
        for reg in registrations:
            score = self.compare_features(captured_features, reg.get("features", {}))
            if score > best_score:
                best_score = score
                best_match = reg
        
        if best_match and best_score >= threshold:
            # Get employee details
            employee = await self.db.employees.find_one(
                {"id": best_match["employee_id"]},
                {"_id": 0, "password": 0}
            )
            
            return {
                "success": True,
                "matched": True,
                "employee_id": best_match["employee_id"],
                "employee_name": employee.get("name") if employee else "Unknown",
                "employee_code": employee.get("employee_code") if employee else "",
                "confidence": round(best_score * 100, 1),
                "message": f"Face recognized: {employee.get('name') if employee else 'Unknown'}"
            }
        else:
            return {
                "success": True,
                "matched": False,
                "confidence": round(best_score * 100, 1) if best_score > 0 else 0,
                "error": "Face not recognized. Please try again or register your face.",
                "message": "Face not matched to any registered employee"
            }
    
    async def mark_face_attendance(
        self,
        tenant_id: str,
        employee_id: str,
        store_id: str,
        base64_image: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Mark attendance using face recognition"""
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        now_time = datetime.now(timezone.utc).strftime("%H:%M:%S")
        
        # Verify face matches the employee
        verification = await self.verify_face(tenant_id, base64_image)
        
        if not verification.get("matched"):
            return {
                "success": False,
                "error": verification.get("error", "Face verification failed"),
                "attendance_marked": False
            }
        
        if verification.get("employee_id") != employee_id:
            return {
                "success": False,
                "error": "Face does not match the selected employee",
                "attendance_marked": False
            }
        
        # Check if attendance already exists for today
        existing = await self.db.attendance.find_one({
            "tenant_id": tenant_id,
            "employee_id": employee_id,
            "date": today
        })
        
        if existing:
            # Update out_time if checking out
            if existing.get("in_time") and not existing.get("out_time"):
                await self.db.attendance.update_one(
                    {"id": existing["id"]},
                    {"$set": {
                        "out_time": now_time,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "checkout_method": "face_recognition",
                        "checkout_confidence": verification.get("confidence")
                    }}
                )
                return {
                    "success": True,
                    "attendance_marked": True,
                    "action": "checkout",
                    "message": f"Check-out recorded at {now_time}",
                    "employee_name": verification.get("employee_name"),
                    "confidence": verification.get("confidence")
                }
            else:
                return {
                    "success": True,
                    "attendance_marked": False,
                    "message": "Attendance already marked for today",
                    "existing_record": {
                        "in_time": existing.get("in_time"),
                        "out_time": existing.get("out_time"),
                        "status": existing.get("status")
                    }
                }
        
        # Create new attendance record
        attendance_doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "employee_id": employee_id,
            "store_id": store_id,
            "date": today,
            "status": "present",
            "in_time": now_time,
            "out_time": None,
            "method": "face_recognition",
            "checkin_confidence": verification.get("confidence"),
            "marked_by": user_id,
            "notes": f"Face check-in at {now_time}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.attendance.insert_one(attendance_doc)
        
        return {
            "success": True,
            "attendance_marked": True,
            "action": "checkin",
            "attendance_id": attendance_doc["id"],
            "message": f"Check-in recorded at {now_time}",
            "employee_name": verification.get("employee_name"),
            "confidence": verification.get("confidence")
        }
    
    async def get_registration_status(
        self,
        tenant_id: str,
        employee_id: str
    ) -> Dict[str, Any]:
        """Check if an employee has registered their face"""
        
        registration = await self.db.face_registrations.find_one(
            {"tenant_id": tenant_id, "employee_id": employee_id, "is_active": True},
            {"_id": 0}
        )
        
        if registration:
            return {
                "registered": True,
                "registered_at": registration.get("registered_at"),
                "registration_id": registration.get("id")
            }
        else:
            return {
                "registered": False
            }
    
    async def get_all_registrations(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Get all face registrations for a tenant"""
        
        registrations = await self.db.face_registrations.find(
            {"tenant_id": tenant_id, "is_active": True},
            {"_id": 0, "features": 0}  # Exclude features for privacy
        ).to_list(1000)
        
        # Enrich with employee info
        for reg in registrations:
            employee = await self.db.employees.find_one(
                {"id": reg.get("employee_id")},
                {"_id": 0, "name": 1, "employee_code": 1}
            )
            if employee:
                reg["employee_name"] = employee.get("name")
                reg["employee_code"] = employee.get("employee_code")
        
        return registrations
    
    async def delete_registration(
        self,
        tenant_id: str,
        employee_id: str
    ) -> Dict[str, Any]:
        """Delete face registration for an employee"""
        
        result = await self.db.face_registrations.update_many(
            {"tenant_id": tenant_id, "employee_id": employee_id},
            {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.modified_count > 0:
            return {"success": True, "message": "Face registration deleted"}
        else:
            return {"success": False, "error": "No registration found"}


# Singleton instance
_face_system: Optional[FaceAttendanceSystem] = None


def get_face_attendance_system(db=None) -> Optional[FaceAttendanceSystem]:
    """Get or create singleton instance"""
    global _face_system
    
    if _face_system is None and db is not None:
        _face_system = FaceAttendanceSystem(db)
    
    return _face_system


def init_face_attendance_system(db) -> FaceAttendanceSystem:
    """Initialize the face attendance system"""
    global _face_system
    _face_system = FaceAttendanceSystem(db)
    return _face_system
