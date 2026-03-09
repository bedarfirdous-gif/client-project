"""
Critical Module Guard
=====================
Protection system for critical modules (financial logic, permissions, etc.)
to prevent auto-modification that could cause data integrity issues.
"""

import re
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Any
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CriticalModuleGuard")


class ProtectionLevel(Enum):
    """Protection levels for critical modules"""
    NONE = "none"              # No protection, auto-fix allowed
    NOTIFY = "notify"          # Auto-fix allowed, but notify admin
    REVIEW_REQUIRED = "review" # Auto-fix generates suggestion, requires approval
    MANUAL_ONLY = "manual"     # No auto-fix allowed, manual intervention only
    LOCKED = "locked"          # No modifications allowed at all


class ModuleCategory(Enum):
    """Categories of critical modules"""
    FINANCIAL = "financial"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    BILLING = "billing"
    DATA_INTEGRITY = "data_integrity"
    AUDIT = "audit"
    SECURITY = "security"
    COMPLIANCE = "compliance"
    CORE_BUSINESS = "core_business"


@dataclass
class CriticalModule:
    """
    Definition of a critical module that requires protection.
    """
    module_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    category: ModuleCategory = ModuleCategory.CORE_BUSINESS
    protection_level: ProtectionLevel = ProtectionLevel.REVIEW_REQUIRED
    
    # File patterns to protect
    file_patterns: List[str] = field(default_factory=list)
    
    # Function/method names to protect
    protected_functions: List[str] = field(default_factory=list)
    
    # API endpoints to protect
    protected_endpoints: List[str] = field(default_factory=list)
    
    # Database collections involved
    protected_collections: List[str] = field(default_factory=list)
    
    # Required approvers for changes
    required_approvers: List[str] = field(default_factory=list)
    
    # Enabled status
    is_active: bool = True
    
    # Metadata
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class ProtectionViolation:
    """
    Record of a protection violation attempt.
    """
    violation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    module_id: str = ""
    module_name: str = ""
    violation_type: str = ""  # auto_fix_blocked, unauthorized_access, etc.
    attempted_action: str = ""
    file_path: Optional[str] = None
    function_name: Optional[str] = None
    endpoint: Optional[str] = None
    error_id: Optional[str] = None
    agent_id: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    blocked: bool = True
    override_approved_by: Optional[str] = None


# Default critical modules for enterprise systems
DEFAULT_CRITICAL_MODULES = [
    CriticalModule(
        name="Financial Calculations",
        description="Core financial calculation logic including tax, totals, balances",
        category=ModuleCategory.FINANCIAL,
        protection_level=ProtectionLevel.MANUAL_ONLY,
        file_patterns=[
            r".*gst.*\.py$",
            r".*tax.*\.py$",
            r".*invoice.*\.py$",
            r".*payment.*\.py$",
            r".*ledger.*\.py$",
            r".*accounting.*\.py$",
            r".*billing.*\.py$",
        ],
        protected_functions=[
            "calculate_gst",
            "calculate_tax",
            "calculate_total",
            "process_payment",
            "update_balance",
            "create_invoice",
            "calculate_interest",
            "calculate_discount",
        ],
        protected_endpoints=[
            "/api/payments",
            "/api/invoices",
            "/api/accounting-vouchers",
            "/api/gst-ledger",
            "/api/ledger",
        ],
        protected_collections=[
            "payments",
            "invoices",
            "accounting_vouchers",
            "gst_ledger",
            "ledger_entries",
        ]
    ),
    CriticalModule(
        name="Authentication System",
        description="User authentication, login, password management",
        category=ModuleCategory.AUTHENTICATION,
        protection_level=ProtectionLevel.LOCKED,
        file_patterns=[
            r".*auth.*\.py$",
            r".*login.*\.py$",
            r".*password.*\.py$",
            r".*jwt.*\.py$",
        ],
        protected_functions=[
            "hash_password",
            "verify_password",
            "create_access_token",
            "validate_token",
            "login",
            "logout",
            "change_password",
            "reset_password",
        ],
        protected_endpoints=[
            "/api/auth/login",
            "/api/auth/logout",
            "/api/auth/password",
            "/api/auth/token",
        ],
        protected_collections=[
            "users",
            "user_sessions",
            "login_history",
        ]
    ),
    CriticalModule(
        name="Authorization & Permissions",
        description="Role-based access control, permissions, roles",
        category=ModuleCategory.AUTHORIZATION,
        protection_level=ProtectionLevel.LOCKED,
        file_patterns=[
            r".*rbac.*\.py$",
            r".*permission.*\.py$",
            r".*role.*\.py$",
        ],
        protected_functions=[
            "check_permission",
            "get_user_permissions",
            "assign_role",
            "create_role",
            "is_admin",
            "is_admin_or_higher",
            "require_permission",
        ],
        protected_endpoints=[
            "/api/roles",
            "/api/permissions",
            "/api/rbac",
        ],
        protected_collections=[
            "roles",
            "user_permissions",
        ]
    ),
    CriticalModule(
        name="Subscription & Billing",
        description="Subscription management, billing, plan limits",
        category=ModuleCategory.BILLING,
        protection_level=ProtectionLevel.REVIEW_REQUIRED,
        file_patterns=[
            r".*subscription.*\.py$",
            r".*billing.*\.py$",
            r".*plan.*\.py$",
        ],
        protected_functions=[
            "create_subscription",
            "renew_subscription",
            "cancel_subscription",
            "process_billing",
            "check_plan_limits",
        ],
        protected_endpoints=[
            "/api/subscriptions",
            "/api/billing",
            "/api/plans",
        ],
        protected_collections=[
            "subscriptions",
            "billing_history",
            "subscription_plans",
        ]
    ),
    CriticalModule(
        name="Audit Trail",
        description="System audit logs and activity tracking",
        category=ModuleCategory.AUDIT,
        protection_level=ProtectionLevel.LOCKED,
        file_patterns=[
            r".*audit.*\.py$",
            r".*activity.*log.*\.py$",
        ],
        protected_functions=[
            "log_activity",
            "create_audit_entry",
            "track_change",
        ],
        protected_collections=[
            "audit_logs",
            "activity_logs",
            "stock_audit_trail",
        ]
    ),
    CriticalModule(
        name="Data Backup & Restore",
        description="Backup and restore functionality",
        category=ModuleCategory.DATA_INTEGRITY,
        protection_level=ProtectionLevel.MANUAL_ONLY,
        file_patterns=[
            r".*backup.*\.py$",
            r".*restore.*\.py$",
        ],
        protected_functions=[
            "create_backup",
            "restore_backup",
            "delete_backup",
        ],
        protected_endpoints=[
            "/api/backup",
            "/api/restore",
        ],
        protected_collections=[
            "backups",
        ]
    ),
]


class CriticalModuleGuard:
    """
    Guardian system for critical modules.
    
    Features:
    - Define protected modules with file patterns, functions, endpoints
    - Block or require approval for auto-fix attempts on protected modules
    - Log all protection violations
    - Allow temporary overrides with admin approval
    """
    
    def __init__(self, db=None):
        self.db = db
        self.modules: Dict[str, CriticalModule] = {}
        self.violations: List[ProtectionViolation] = []
        self.override_cache: Dict[str, datetime] = {}
        
        # Collections
        if db is not None:
            self.modules_collection = db.critical_modules
            self.violations_collection = db.protection_violations
        
        # Load default modules
        self._load_default_modules()
        
        logger.info(f"CriticalModuleGuard initialized with {len(self.modules)} protected modules")
    
    def _load_default_modules(self):
        """Load default critical module definitions"""
        for module in DEFAULT_CRITICAL_MODULES:
            self.modules[module.module_id] = module
    
    async def init_db(self):
        """Initialize database with default modules if empty"""
        if self.db is None:
            return
        
        count = await self.modules_collection.count_documents({})
        if count == 0:
            for module in DEFAULT_CRITICAL_MODULES:
                await self._store_module(module)
            logger.info("Initialized database with default critical modules")
        else:
            # Load existing modules
            cursor = self.modules_collection.find({}, {"_id": 0})
            async for doc in cursor:
                module = self._dict_to_module(doc)
                self.modules[module.module_id] = module
    
    def _dict_to_module(self, doc: Dict) -> CriticalModule:
        """Convert dict to CriticalModule"""
        return CriticalModule(
            module_id=doc.get("module_id", str(uuid.uuid4())),
            name=doc.get("name", ""),
            description=doc.get("description", ""),
            category=ModuleCategory(doc.get("category", "core_business")),
            protection_level=ProtectionLevel(doc.get("protection_level", "review")),
            file_patterns=doc.get("file_patterns", []),
            protected_functions=doc.get("protected_functions", []),
            protected_endpoints=doc.get("protected_endpoints", []),
            protected_collections=doc.get("protected_collections", []),
            required_approvers=doc.get("required_approvers", []),
            is_active=doc.get("is_active", True),
            created_at=doc.get("created_at", datetime.now(timezone.utc).isoformat()),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc).isoformat())
        )
    
    async def _store_module(self, module: CriticalModule):
        """Store module in database"""
        if self.db is None:
            return
        
        doc = {
            "module_id": module.module_id,
            "name": module.name,
            "description": module.description,
            "category": module.category.value,
            "protection_level": module.protection_level.value,
            "file_patterns": module.file_patterns,
            "protected_functions": module.protected_functions,
            "protected_endpoints": module.protected_endpoints,
            "protected_collections": module.protected_collections,
            "required_approvers": module.required_approvers,
            "is_active": module.is_active,
            "created_at": module.created_at,
            "updated_at": module.updated_at
        }
        
        await self.modules_collection.replace_one(
            {"module_id": module.module_id},
            doc,
            upsert=True
        )
    
    def check_file_protection(self, file_path: str) -> Optional[CriticalModule]:
        """
        Check if a file is protected by any critical module.
        Returns the module if protected, None otherwise.
        """
        for module in self.modules.values():
            if not module.is_active:
                continue
            
            for pattern in module.file_patterns:
                if re.match(pattern, file_path, re.IGNORECASE):
                    return module
        
        return None
    
    def check_function_protection(self, function_name: str) -> Optional[CriticalModule]:
        """
        Check if a function is protected.
        """
        for module in self.modules.values():
            if not module.is_active:
                continue
            
            if function_name in module.protected_functions:
                return module
        
        return None
    
    def check_endpoint_protection(self, endpoint: str) -> Optional[CriticalModule]:
        """
        Check if an API endpoint is protected.
        """
        for module in self.modules.values():
            if not module.is_active:
                continue
            
            for protected_endpoint in module.protected_endpoints:
                if endpoint.startswith(protected_endpoint):
                    return module
        
        return None
    
    def check_collection_protection(self, collection_name: str) -> Optional[CriticalModule]:
        """
        Check if a database collection is protected.
        """
        for module in self.modules.values():
            if not module.is_active:
                continue
            
            if collection_name in module.protected_collections:
                return module
        
        return None
    
    async def can_auto_fix(
        self,
        file_path: Optional[str] = None,
        function_name: Optional[str] = None,
        endpoint: Optional[str] = None,
        collection_name: Optional[str] = None,
        error_id: Optional[str] = None,
        agent_id: Optional[str] = None
    ) -> tuple[bool, Optional[CriticalModule], str]:
        """
        Check if auto-fix is allowed for the given context.
        
        Returns:
            (allowed, module, message)
            - allowed: True if auto-fix can proceed
            - module: The critical module if protection applies
            - message: Explanation message
        """
        # Check all protection dimensions
        module = None
        
        if file_path:
            module = self.check_file_protection(file_path)
        if not module and function_name:
            module = self.check_function_protection(function_name)
        if not module and endpoint:
            module = self.check_endpoint_protection(endpoint)
        if not module and collection_name:
            module = self.check_collection_protection(collection_name)
        
        if not module:
            return True, None, "No protection applies"
        
        # Check protection level
        if module.protection_level == ProtectionLevel.NONE:
            return True, module, f"Module '{module.name}' has no protection"
        
        if module.protection_level == ProtectionLevel.NOTIFY:
            # Allowed but should notify
            return True, module, f"Auto-fix allowed for '{module.name}' but notification required"
        
        if module.protection_level == ProtectionLevel.REVIEW_REQUIRED:
            # Generate suggestion but don't auto-apply
            await self._log_violation(
                module, "auto_fix_blocked_review", 
                f"Auto-fix blocked pending review",
                file_path, function_name, endpoint, error_id, agent_id
            )
            return False, module, f"Auto-fix for '{module.name}' requires manual review"
        
        if module.protection_level == ProtectionLevel.MANUAL_ONLY:
            await self._log_violation(
                module, "auto_fix_blocked_manual",
                f"Auto-fix blocked - manual only",
                file_path, function_name, endpoint, error_id, agent_id
            )
            return False, module, f"'{module.name}' is protected - manual intervention required"
        
        if module.protection_level == ProtectionLevel.LOCKED:
            await self._log_violation(
                module, "auto_fix_blocked_locked",
                f"Auto-fix blocked - module locked",
                file_path, function_name, endpoint, error_id, agent_id
            )
            return False, module, f"'{module.name}' is LOCKED - no modifications allowed"
        
        return False, module, "Unknown protection level"
    
    async def _log_violation(
        self,
        module: CriticalModule,
        violation_type: str,
        attempted_action: str,
        file_path: Optional[str] = None,
        function_name: Optional[str] = None,
        endpoint: Optional[str] = None,
        error_id: Optional[str] = None,
        agent_id: Optional[str] = None
    ):
        """Log a protection violation"""
        violation = ProtectionViolation(
            module_id=module.module_id,
            module_name=module.name,
            violation_type=violation_type,
            attempted_action=attempted_action,
            file_path=file_path,
            function_name=function_name,
            endpoint=endpoint,
            error_id=error_id,
            agent_id=agent_id
        )
        
        self.violations.append(violation)
        
        if self.db is not None:
            await self.violations_collection.insert_one({
                "violation_id": violation.violation_id,
                "module_id": violation.module_id,
                "module_name": violation.module_name,
                "violation_type": violation.violation_type,
                "attempted_action": violation.attempted_action,
                "file_path": violation.file_path,
                "function_name": violation.function_name,
                "endpoint": violation.endpoint,
                "error_id": violation.error_id,
                "agent_id": violation.agent_id,
                "timestamp": violation.timestamp,
                "blocked": violation.blocked,
                "override_approved_by": violation.override_approved_by
            })
        
        logger.warning(f"[CriticalGuard] Violation: {violation_type} on {module.name} - {attempted_action}")
    
    async def get_modules(self) -> List[Dict]:
        """Get all critical modules"""
        return [
            {
                "module_id": m.module_id,
                "name": m.name,
                "description": m.description,
                "category": m.category.value,
                "protection_level": m.protection_level.value,
                "file_patterns": m.file_patterns,
                "protected_functions": m.protected_functions,
                "protected_endpoints": m.protected_endpoints,
                "protected_collections": m.protected_collections,
                "is_active": m.is_active
            }
            for m in self.modules.values()
        ]
    
    async def get_violations(self, limit: int = 50) -> List[Dict]:
        """Get recent violations"""
        if self.db is not None:
            cursor = self.violations_collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
            return await cursor.to_list(limit)
        
        return [
            {
                "violation_id": v.violation_id,
                "module_id": v.module_id,
                "module_name": v.module_name,
                "violation_type": v.violation_type,
                "attempted_action": v.attempted_action,
                "timestamp": v.timestamp,
                "blocked": v.blocked
            }
            for v in self.violations[-limit:]
        ]
    
    async def update_protection_level(self, module_id: str, new_level: ProtectionLevel, updated_by: str) -> bool:
        """Update protection level for a module"""
        if module_id not in self.modules:
            return False
        
        module = self.modules[module_id]
        module.protection_level = new_level
        module.updated_at = datetime.now(timezone.utc).isoformat()
        
        await self._store_module(module)
        
        logger.info(f"[CriticalGuard] Protection level for {module.name} updated to {new_level.value} by {updated_by}")
        
        return True
