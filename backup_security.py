"""
Backup Security Module
======================
Provides layered security for backup operations:
1. RBAC - Role-based access control
2. MFA - Multi-factor authentication (TOTP)
3. Encryption - AES-256-GCM encryption for backup data
4. Malware Defense - File validation and sanitization
"""

import os
import json
import base64
import hashlib
import secrets
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import pyotp
import qrcode
from io import BytesIO

# Security Configuration
ENCRYPTION_KEY_LENGTH = 32  # 256 bits
NONCE_LENGTH = 12  # 96 bits for AES-GCM
SALT_LENGTH = 16
PBKDF2_ITERATIONS = 100000

# Allowed backup collections (whitelist)
ALLOWED_BACKUP_COLLECTIONS = {
    'items', 'variants', 'inventory', 'customers', 'suppliers',
    'invoices', 'purchase_invoices', 'employees', 'stores',
    'settings', 'vouchers', 'discounts', 'loyalty_programs',
    'stock_transfers', 'attendance', 'payroll'
}

# Dangerous patterns to detect in backup data
MALWARE_PATTERNS = [
    r'<script[^>]*>',  # Script tags
    r'javascript:',     # JavaScript URLs
    r'eval\s*\(',       # Eval functions
    r'exec\s*\(',       # Exec functions
    r'__import__',      # Python imports
    r'subprocess',      # Subprocess calls
    r'os\.system',      # OS system calls
    r'\$\{.*\}',        # Template injection
    r'{{.*}}',          # Jinja template injection
]


class BackupSecurityManager:
    """Manages all security aspects of backup operations"""
    
    def __init__(self, master_key: Optional[str] = None):
        """Initialize with optional master key for encryption"""
        self.master_key = master_key or os.environ.get('BACKUP_ENCRYPTION_KEY', secrets.token_hex(32))
    
    # ============== RBAC (Role-Based Access Control) ==============
    
    @staticmethod
    def check_backup_permission(user: Dict[str, Any], action: str) -> Tuple[bool, str]:
        """
        Check if user has permission to perform backup action
        
        Actions: 'create', 'upload', 'restore', 'delete', 'download'
        Returns: (allowed, reason)
        """
        role = user.get('role', '').lower()
        
        # Define permissions by role
        permissions = {
            'owner': ['create', 'upload', 'restore', 'delete', 'download', 'settings'],
            'admin': ['create', 'upload', 'restore', 'delete', 'download', 'settings'],
            'manager': ['create', 'download'],
            'cashier': [],
            'staff': [],
        }
        
        allowed_actions = permissions.get(role, [])
        
        if action in allowed_actions:
            return True, "Permission granted"
        else:
            return False, f"Role '{role}' is not authorized for '{action}' backup operations. Required: admin or owner."
    
    @staticmethod
    def require_admin(user: Dict[str, Any]) -> bool:
        """Check if user is admin or owner"""
        return user.get('role', '').lower() in ['admin', 'owner']
    
    # ============== MFA (Multi-Factor Authentication) ==============
    
    @staticmethod
    def generate_mfa_secret() -> str:
        """Generate a new MFA secret for user"""
        return pyotp.random_base32()
    
    @staticmethod
    def get_mfa_qr_code(secret: str, user_email: str, issuer: str = "BijnisBooks") -> str:
        """Generate QR code for MFA setup as base64 string"""
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(name=user_email, issuer_name=issuer)
        
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    @staticmethod
    def verify_mfa_code(secret: str, code: str) -> bool:
        """Verify MFA code against secret"""
        if not secret or not code:
            return False
        
        totp = pyotp.TOTP(secret)
        # Allow 1 window of tolerance (30 seconds before/after)
        return totp.verify(code, valid_window=1)
    
    @staticmethod
    def generate_backup_verification_code() -> str:
        """Generate a one-time verification code for backup operations"""
        return secrets.token_hex(3).upper()  # 6 character hex code
    
    # ============== ENCRYPTION ==============
    
    def _derive_key(self, salt: bytes) -> bytes:
        """Derive encryption key from master key using PBKDF2"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=ENCRYPTION_KEY_LENGTH,
            salt=salt,
            iterations=PBKDF2_ITERATIONS,
        )
        return kdf.derive(self.master_key.encode())
    
    def encrypt_backup(self, data: Dict[str, Any]) -> Dict[str, str]:
        """
        Encrypt backup data using AES-256-GCM
        
        Returns: {
            'encrypted_data': base64 encoded encrypted data,
            'salt': base64 encoded salt,
            'nonce': base64 encoded nonce,
            'checksum': SHA256 hash of original data
        }
        """
        # Convert data to JSON bytes
        json_data = json.dumps(data, default=str).encode('utf-8')
        
        # Generate salt and nonce
        salt = secrets.token_bytes(SALT_LENGTH)
        nonce = secrets.token_bytes(NONCE_LENGTH)
        
        # Derive key
        key = self._derive_key(salt)
        
        # Encrypt
        aesgcm = AESGCM(key)
        encrypted = aesgcm.encrypt(nonce, json_data, None)
        
        # Calculate checksum of original data
        checksum = hashlib.sha256(json_data).hexdigest()
        
        return {
            'encrypted_data': base64.b64encode(encrypted).decode('utf-8'),
            'salt': base64.b64encode(salt).decode('utf-8'),
            'nonce': base64.b64encode(nonce).decode('utf-8'),
            'checksum': checksum,
            'encrypted': True,
            'encryption_algorithm': 'AES-256-GCM',
            'encrypted_at': datetime.now(timezone.utc).isoformat()
        }
    
    def decrypt_backup(self, encrypted_backup: Dict[str, str]) -> Dict[str, Any]:
        """
        Decrypt backup data
        
        Returns: Original backup data dictionary
        Raises: ValueError if decryption fails or checksum doesn't match
        """
        try:
            # Decode components
            encrypted_data = base64.b64decode(encrypted_backup['encrypted_data'])
            salt = base64.b64decode(encrypted_backup['salt'])
            nonce = base64.b64decode(encrypted_backup['nonce'])
            stored_checksum = encrypted_backup.get('checksum')
            
            # Derive key
            key = self._derive_key(salt)
            
            # Decrypt
            aesgcm = AESGCM(key)
            decrypted = aesgcm.decrypt(nonce, encrypted_data, None)
            
            # Verify checksum
            actual_checksum = hashlib.sha256(decrypted).hexdigest()
            if stored_checksum and actual_checksum != stored_checksum:
                raise ValueError("Backup integrity check failed: checksum mismatch")
            
            # Parse JSON
            return json.loads(decrypted.decode('utf-8'))
            
        except Exception as e:
            raise ValueError(f"Failed to decrypt backup: {str(e)}")
    
    # ============== MALWARE DEFENSE ==============
    
    @staticmethod
    def scan_for_malware(data: Any, path: str = "") -> list:
        """
        Recursively scan data for malware patterns
        
        Returns: List of detected threats with their locations
        """
        threats = []
        
        if isinstance(data, dict):
            for key, value in data.items():
                current_path = f"{path}.{key}" if path else key
                threats.extend(BackupSecurityManager.scan_for_malware(value, current_path))
                
        elif isinstance(data, list):
            for i, item in enumerate(data):
                current_path = f"{path}[{i}]"
                threats.extend(BackupSecurityManager.scan_for_malware(item, current_path))
                
        elif isinstance(data, str):
            for pattern in MALWARE_PATTERNS:
                if re.search(pattern, data, re.IGNORECASE):
                    threats.append({
                        'location': path,
                        'pattern': pattern,
                        'sample': data[:100] if len(data) > 100 else data,
                        'severity': 'HIGH'
                    })
        
        return threats
    
    @staticmethod
    def validate_backup_structure(data: Dict[str, Any]) -> Tuple[bool, list]:
        """
        Validate backup structure and content
        
        Returns: (is_valid, list of issues)
        """
        issues = []
        
        if not isinstance(data, dict):
            return False, ["Backup must be a JSON object"]
        
        # Check for unknown collections
        unknown_collections = set(data.keys()) - ALLOWED_BACKUP_COLLECTIONS
        if unknown_collections:
            issues.append(f"Unknown collections found: {', '.join(unknown_collections)}")
        
        # Check data size limits
        for collection, items in data.items():
            if isinstance(items, list):
                if len(items) > 100000:
                    issues.append(f"Collection '{collection}' exceeds maximum size (100,000 items)")
                
                # Check for ObjectId fields that shouldn't be restored
                for item in items[:10]:  # Sample check
                    if isinstance(item, dict) and '_id' in item:
                        issues.append(f"Collection '{collection}' contains _id fields that should be excluded")
                        break
        
        # Scan for malware
        threats = BackupSecurityManager.scan_for_malware(data)
        if threats:
            issues.append(f"Potential security threats detected: {len(threats)} suspicious patterns found")
            for threat in threats[:5]:  # Show first 5
                issues.append(f"  - {threat['location']}: {threat['pattern']}")
        
        return len(issues) == 0, issues
    
    @staticmethod
    def sanitize_backup_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize backup data by removing potentially dangerous content
        
        Returns: Sanitized backup data
        """
        def sanitize_value(value: Any) -> Any:
            if isinstance(value, dict):
                return {k: sanitize_value(v) for k, v in value.items() if k != '_id'}
            elif isinstance(value, list):
                return [sanitize_value(item) for item in value]
            elif isinstance(value, str):
                # Remove dangerous patterns
                sanitized = value
                for pattern in MALWARE_PATTERNS:
                    sanitized = re.sub(pattern, '[REMOVED]', sanitized, flags=re.IGNORECASE)
                return sanitized
            else:
                return value
        
        # Only keep allowed collections
        sanitized = {}
        for collection in ALLOWED_BACKUP_COLLECTIONS:
            if collection in data:
                sanitized[collection] = sanitize_value(data[collection])
        
        return sanitized
    
    # ============== AUDIT LOGGING ==============
    
    @staticmethod
    def create_security_audit_log(
        action: str,
        user: Dict[str, Any],
        success: bool,
        details: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Create an audit log entry for security-sensitive operations"""
        return {
            'id': secrets.token_hex(16),
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'action': action,
            'user_id': user.get('id'),
            'user_name': user.get('name'),
            'user_role': user.get('role'),
            'success': success,
            'ip_address': details.get('ip_address') if details else None,
            'user_agent': details.get('user_agent') if details else None,
            'details': details or {},
            'category': 'backup_security'
        }


# Global instance
backup_security = BackupSecurityManager()
