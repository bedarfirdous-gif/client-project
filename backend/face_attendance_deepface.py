"""
Enhanced Face Recognition Attendance System using DeepFace

This module provides high-accuracy face recognition using DeepFace library.
DeepFace uses pre-trained deep learning models for face verification.

Available Models (in order of accuracy):
1. ArcFace - State-of-the-art, highest accuracy (recommended)
2. Facenet512 - High accuracy, Google's model
3. Facenet - Good accuracy, faster than 512
4. VGG-Face - Good balance of speed/accuracy
5. OpenFace - Fast, decent accuracy
6. DeepFace - Facebook's model
7. SFace - Lightweight, fast
"""

import cv2
import base64
import numpy as np
from datetime import datetime, timezone, timedelta
import uuid
import os
from typing import Optional, Dict, Any, List
import logging
import json

logger = logging.getLogger(__name__)

# Try to import DeepFace
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
    logger.info("DeepFace loaded successfully")
except ImportError:
    DEEPFACE_AVAILABLE = False
    logger.warning("DeepFace not available, falling back to OpenCV")

# Path to OpenCV's pre-trained face detector (fallback)
CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'

# Model configurations with their thresholds
MODEL_CONFIG = {
    "ArcFace": {
        "name": "ArcFace",
        "threshold": 0.68,
        "accuracy": "99.5%",
        "speed": "Medium",
        "description": "State-of-the-art model, highest accuracy"
    },
    "Facenet512": {
        "name": "Facenet512",
        "threshold": 0.30,
        "accuracy": "99.2%",
        "speed": "Medium",
        "description": "Google's high-accuracy model (512-dim)"
    },
    "Facenet": {
        "name": "Facenet",
        "threshold": 0.40,
        "accuracy": "98.5%",
        "speed": "Fast",
        "description": "Google's model, good balance"
    },
    "VGG-Face": {
        "name": "VGG-Face",
        "threshold": 0.40,
        "accuracy": "97.5%",
        "speed": "Fast",
        "description": "Oxford's model, reliable"
    },
    "OpenFace": {
        "name": "OpenFace",
        "threshold": 0.10,
        "accuracy": "93%",
        "speed": "Very Fast",
        "description": "Lightweight, fastest option"
    },
    "DeepFace": {
        "name": "DeepFace",
        "threshold": 0.23,
        "accuracy": "97%",
        "speed": "Medium",
        "description": "Facebook's original model"
    },
    "SFace": {
        "name": "SFace",
        "threshold": 0.59,
        "accuracy": "96%",
        "speed": "Very Fast",
        "description": "Lightweight and fast"
    }
}


class EnhancedFaceAttendanceSystem:
    """Enhanced face recognition using DeepFace for high accuracy"""
    
    def __init__(self, db, default_model: str = "ArcFace"):
        self.db = db
        self.face_cascade = cv2.CascadeClassifier(CASCADE_PATH)
        self.current_model = default_model if default_model in MODEL_CONFIG else "ArcFace"
        self.distance_metric = "cosine"
        self._model_cache = {}  # Cache loaded models
        
    @property
    def model_name(self) -> str:
        return self.current_model
    
    @property
    def threshold(self) -> float:
        return MODEL_CONFIG.get(self.current_model, {}).get("threshold", 0.40)
    
    def get_available_models(self) -> List[Dict[str, Any]]:
        """Get list of available face recognition models"""
        return [
            {
                "id": model_id,
                "name": config["name"],
                "accuracy": config["accuracy"],
                "speed": config["speed"],
                "description": config["description"],
                "is_current": model_id == self.current_model
            }
            for model_id, config in MODEL_CONFIG.items()
        ]
    
    def set_model(self, model_name: str) -> Dict[str, Any]:
        """Change the current face recognition model"""
        if model_name not in MODEL_CONFIG:
            return {
                "success": False,
                "error": f"Unknown model: {model_name}",
                "available_models": list(MODEL_CONFIG.keys())
            }
        
        self.current_model = model_name
        return {
            "success": True,
            "model": model_name,
            "accuracy": MODEL_CONFIG[model_name]["accuracy"],
            "threshold": MODEL_CONFIG[model_name]["threshold"],
            "message": f"Switched to {model_name} model"
        }
        
    def decode_image(self, base64_image: str) -> Optional[np.ndarray]:
        """Decode base64 image to numpy array"""
        try:
            if ',' in base64_image:
                base64_image = base64_image.split(',')[1]
            
            image_data = base64.b64decode(base64_image)
            np_array = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
            return image
        except Exception as e:
            logger.error(f"Error decoding image: {e}")
            return None
    
    def save_temp_image(self, image: np.ndarray) -> str:
        """Save image to temp file for DeepFace processing"""
        temp_path = f"/tmp/face_{uuid.uuid4()}.jpg"
        cv2.imwrite(temp_path, image)
        return temp_path
    
    def cleanup_temp(self, path: str):
        """Remove temp file"""
        try:
            if os.path.exists(path):
                os.remove(path)
        except:
            pass
    
    def detect_face_deepface(self, image: np.ndarray) -> bool:
        """Detect if face exists using DeepFace"""
        if not DEEPFACE_AVAILABLE:
            return self._detect_face_opencv(image)
        
        try:
            temp_path = self.save_temp_image(image)
            faces = DeepFace.extract_faces(
                img_path=temp_path,
                detector_backend='opencv',
                enforce_detection=False
            )
            self.cleanup_temp(temp_path)
            
            # Check if any face was detected with confidence
            for face in faces:
                if face.get('confidence', 0) > 0.5:
                    return True
            return False
        except Exception as e:
            logger.error(f"DeepFace detection error: {e}")
            return self._detect_face_opencv(image)
    
    def _detect_face_opencv(self, image: np.ndarray) -> bool:
        """Fallback face detection using OpenCV"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50)
            )
            return len(faces) > 0
        except:
            return False
    
    def get_face_embedding(self, image: np.ndarray) -> Optional[List[float]]:
        """Extract face embedding using DeepFace"""
        if not DEEPFACE_AVAILABLE:
            return None
        
        try:
            temp_path = self.save_temp_image(image)
            embedding = DeepFace.represent(
                img_path=temp_path,
                model_name=self.model_name,
                detector_backend='opencv',
                enforce_detection=False
            )
            self.cleanup_temp(temp_path)
            
            if embedding and len(embedding) > 0:
                return embedding[0].get('embedding', [])
            return None
        except Exception as e:
            logger.error(f"Error getting embedding: {e}")
            return None
    
    def compare_faces(self, img1_path: str, img2_path: str) -> Dict[str, Any]:
        """Compare two faces using DeepFace"""
        if not DEEPFACE_AVAILABLE:
            return {"verified": False, "distance": 1.0}
        
        try:
            result = DeepFace.verify(
                img1_path=img1_path,
                img2_path=img2_path,
                model_name=self.model_name,
                distance_metric=self.distance_metric,
                enforce_detection=False
            )
            return {
                "verified": result.get("verified", False),
                "distance": result.get("distance", 1.0),
                "threshold": result.get("threshold", self.threshold),
                "model": self.model_name
            }
        except Exception as e:
            logger.error(f"Face comparison error: {e}")
            return {"verified": False, "distance": 1.0, "error": str(e)}
    
    async def register_face(
        self,
        tenant_id: str,
        employee_id: str,
        base64_image: str
    ) -> Dict[str, Any]:
        """Register an employee's face for recognition"""
        
        image = self.decode_image(base64_image)
        if image is None:
            return {"success": False, "error": "Invalid image data"}
        
        # Detect face
        if not self.detect_face_deepface(image):
            return {"success": False, "error": "No face detected. Please ensure your face is clearly visible."}
        
        # Get face embedding
        embedding = self.get_face_embedding(image)
        
        # Store in database
        face_doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "employee_id": employee_id,
            "image_base64": base64_image,  # Store original image for comparison
            "embedding": embedding,  # Store embedding if available
            "model_used": self.model_name if DEEPFACE_AVAILABLE else "opencv",
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
            "message": "Face registered successfully with DeepFace" if DEEPFACE_AVAILABLE else "Face registered with OpenCV",
            "registration_id": face_doc["id"],
            "model": self.model_name if DEEPFACE_AVAILABLE else "opencv"
        }
    
    async def verify_face(
        self,
        tenant_id: str,
        base64_image: str
    ) -> Dict[str, Any]:
        """Verify face against registered employees"""
        
        image = self.decode_image(base64_image)
        if image is None:
            return {"success": False, "error": "Invalid image data", "matched": False}
        
        # Detect face
        if not self.detect_face_deepface(image):
            return {
                "success": False,
                "error": "No face detected. Please position your face in the camera.",
                "matched": False
            }
        
        # Save captured image temporarily
        captured_path = self.save_temp_image(image)
        
        # Get all registered faces for this tenant
        registrations = await self.db.face_registrations.find(
            {"tenant_id": tenant_id, "is_active": True},
            {"_id": 0}
        ).to_list(1000)
        
        if not registrations:
            self.cleanup_temp(captured_path)
            return {
                "success": False,
                "error": "No registered faces found. Please register face first.",
                "matched": False
            }
        
        # Find best match
        best_match = None
        best_distance = float('inf')
        
        for reg in registrations:
            try:
                # Decode registered image
                reg_image = self.decode_image(reg.get("image_base64", ""))
                if reg_image is None:
                    continue
                
                reg_path = self.save_temp_image(reg_image)
                
                # Compare faces
                result = self.compare_faces(captured_path, reg_path)
                self.cleanup_temp(reg_path)
                
                distance = result.get("distance", 1.0)
                
                if result.get("verified") and distance < best_distance:
                    best_distance = distance
                    best_match = reg
                    
            except Exception as e:
                logger.error(f"Error comparing with registration {reg.get('id')}: {e}")
                continue
        
        self.cleanup_temp(captured_path)
        
        if best_match:
            # Get employee details
            employee = await self.db.employees.find_one(
                {"id": best_match["employee_id"]},
                {"_id": 0, "password": 0}
            )
            
            # Convert distance to confidence (lower distance = higher confidence)
            confidence = max(0, min(100, (1 - best_distance) * 100))
            
            return {
                "success": True,
                "matched": True,
                "employee_id": best_match["employee_id"],
                "employee_name": employee.get("name") if employee else "Unknown",
                "employee_code": employee.get("employee_code") if employee else "",
                "confidence": round(confidence, 1),
                "distance": round(best_distance, 4),
                "model": self.model_name if DEEPFACE_AVAILABLE else "opencv",
                "message": f"Face recognized: {employee.get('name') if employee else 'Unknown'}"
            }
        else:
            return {
                "success": True,
                "matched": False,
                "confidence": 0,
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
                        "checkout_method": "face_recognition_deepface",
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
            "method": "face_recognition_deepface",
            "checkin_confidence": verification.get("confidence"),
            "model_used": verification.get("model"),
            "marked_by": user_id,
            "notes": f"Face check-in at {now_time} (confidence: {verification.get('confidence')}%)",
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
            {"_id": 0, "image_base64": 0, "embedding": 0}
        )
        
        if registration:
            return {
                "registered": True,
                "registered_at": registration.get("registered_at"),
                "registration_id": registration.get("id"),
                "model_used": registration.get("model_used", "unknown")
            }
        else:
            return {"registered": False}
    
    async def get_all_registrations(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Get all face registrations for a tenant"""
        
        registrations = await self.db.face_registrations.find(
            {"tenant_id": tenant_id, "is_active": True},
            {"_id": 0, "image_base64": 0, "embedding": 0}
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
_enhanced_face_system: Optional[EnhancedFaceAttendanceSystem] = None


def get_enhanced_face_system(db=None) -> Optional[EnhancedFaceAttendanceSystem]:
    """Get or create singleton instance"""
    global _enhanced_face_system
    
    if _enhanced_face_system is None and db is not None:
        _enhanced_face_system = EnhancedFaceAttendanceSystem(db)
    
    return _enhanced_face_system


def init_enhanced_face_system(db) -> EnhancedFaceAttendanceSystem:
    """Initialize the enhanced face attendance system"""
    global _enhanced_face_system
    _enhanced_face_system = EnhancedFaceAttendanceSystem(db)
    return _enhanced_face_system


def is_deepface_available() -> bool:
    """Check if DeepFace is available"""
    return DEEPFACE_AVAILABLE
