"""
SaaS Multi-Tenant Subscription System
=====================================
Centralized plan management with versioning, renewals, and analytics.
Scalable for 100K+ admins and millions of customers.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum
import uuid

# ============== ENUMS ==============

class RenewalType(str, Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"
    QUARTERLY = "quarterly"
    CUSTOM = "custom"

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    TRIALING = "trialing"
    PAST_DUE = "past_due"
    GRACE_PERIOD = "grace_period"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    SUSPENDED = "suspended"

class SubscriptionEventType(str, Enum):
    CREATED = "created"
    RENEWED = "renewed"
    UPGRADED = "upgraded"
    DOWNGRADED = "downgraded"
    CANCELLED = "cancelled"
    REACTIVATED = "reactivated"
    EXPIRED = "expired"
    PAYMENT_FAILED = "payment_failed"
    PAYMENT_SUCCESS = "payment_success"
    GRACE_PERIOD_START = "grace_period_start"
    GRACE_PERIOD_END = "grace_period_end"
    PLAN_CHANGED = "plan_changed"

# ============== PYDANTIC MODELS ==============

class PlanLimits(BaseModel):
    stores: int = 1
    products: int = 100
    users: int = 2
    customers: int = 100
    sales_per_month: int = 500
    api_calls_per_day: int = 1000
    storage_gb: float = 1.0

class RenewalConfig(BaseModel):
    is_renewable: bool = True
    renewal_type: RenewalType = RenewalType.MONTHLY
    renewal_price: Optional[float] = None  # None means same as base price
    renewal_discount_percent: float = 0.0
    grace_period_days: int = 7
    auto_renew_enabled: bool = True
    max_renewal_count: int = -1  # -1 means unlimited

class PlanMasterCreate(BaseModel):
    """Schema for creating a new master plan"""
    plan_code: str = Field(..., description="Unique plan code (e.g., 'basic', 'pro')")
    name: str
    description: Optional[str] = None
    base_price: float = 0.0
    currency: str = "INR"
    billing_interval: str = "month"  # month, year, quarter
    billing_interval_count: int = 1
    
    # Features and limits
    features: List[str] = []
    limits: PlanLimits = PlanLimits()
    
    # Renewal configuration
    renewal_config: RenewalConfig = RenewalConfig()
    
    # Trial configuration
    trial_days: int = 0
    
    # Display options
    is_popular: bool = False
    display_order: int = 0
    is_active: bool = True
    is_public: bool = True  # Show on pricing page

class PlanMasterUpdate(BaseModel):
    """Schema for updating a master plan (creates new version)"""
    name: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    currency: Optional[str] = None
    billing_interval: Optional[str] = None
    billing_interval_count: Optional[int] = None
    features: Optional[List[str]] = None
    limits: Optional[Dict[str, Any]] = None
    renewal_config: Optional[Dict[str, Any]] = None
    trial_days: Optional[int] = None
    is_popular: Optional[bool] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    
    # Version control
    apply_to_existing: bool = False  # If True, updates existing subscriptions
    version_note: Optional[str] = None

class SubscriptionCreate(BaseModel):
    """Schema for creating a new subscription"""
    plan_id: str
    billing_cycle: str = "month"
    auto_renew: bool = True
    coupon_code: Optional[str] = None

class SubscriptionRenewal(BaseModel):
    """Schema for manual renewal"""
    payment_method_id: Optional[str] = None
    apply_discount: bool = True

# ============== HELPER FUNCTIONS ==============

def generate_subscription_id() -> str:
    """Generate a unique subscription ID"""
    return f"sub_{uuid.uuid4().hex[:16]}"

def generate_plan_version_id() -> str:
    """Generate a unique plan version ID"""
    return f"pv_{uuid.uuid4().hex[:12]}"

def calculate_period_end(start_date: datetime, interval: str, count: int = 1) -> datetime:
    """Calculate subscription period end date"""
    if interval == "month":
        return start_date + timedelta(days=30 * count)
    elif interval == "year":
        return start_date + timedelta(days=365 * count)
    elif interval == "quarter":
        return start_date + timedelta(days=90 * count)
    elif interval == "week":
        return start_date + timedelta(weeks=count)
    else:
        return start_date + timedelta(days=30 * count)

def calculate_proration(
    old_price: float,
    new_price: float,
    days_remaining: int,
    total_days: int = 30
) -> Dict[str, Any]:
    """Calculate proration for plan changes"""
    if total_days <= 0:
        total_days = 30
    
    daily_old = old_price / total_days
    daily_new = new_price / total_days
    
    credit = daily_old * days_remaining
    charge = daily_new * days_remaining
    
    return {
        "credit_amount": round(credit, 2),
        "charge_amount": round(charge, 2),
        "net_amount": round(charge - credit, 2),
        "days_remaining": days_remaining,
        "is_upgrade": new_price > old_price
    }

def calculate_renewal_price(
    base_price: float,
    renewal_config: Dict[str, Any],
    renewal_count: int
) -> float:
    """Calculate renewal price with discounts"""
    renewal_price = renewal_config.get("renewal_price") or base_price
    discount_percent = renewal_config.get("renewal_discount_percent", 0)
    
    # Apply discount
    if discount_percent > 0:
        renewal_price = renewal_price * (1 - discount_percent / 100)
    
    return round(renewal_price, 2)

# ============== SUBSCRIPTION SYSTEM CLASS ==============

class SubscriptionSystem:
    """
    Centralized subscription management system.
    Handles plan management, subscriptions, renewals, and analytics.
    """
    
    def __init__(self, db):
        self.db = db
    
    # ========== PLAN MANAGEMENT ==========
    
    async def create_plan(self, plan_data: PlanMasterCreate, created_by: str) -> Dict[str, Any]:
        """Create a new master plan with initial version"""
        now = datetime.now(timezone.utc).isoformat()
        
        # Check if plan_code already exists
        existing = await self.db.plans_master.find_one({"plan_code": plan_data.plan_code})
        if existing:
            raise ValueError(f"Plan with code '{plan_data.plan_code}' already exists")
        
        plan_id = str(uuid.uuid4())
        version_id = generate_plan_version_id()
        
        # Create master plan document
        plan_doc = {
            "id": plan_id,
            "plan_code": plan_data.plan_code.lower().replace(" ", "_"),
            "current_version": version_id,
            "name": plan_data.name,
            "description": plan_data.description,
            "base_price": plan_data.base_price,
            "currency": plan_data.currency.upper(),
            "billing_interval": plan_data.billing_interval,
            "billing_interval_count": plan_data.billing_interval_count,
            "features": plan_data.features,
            "limits": plan_data.limits.dict() if hasattr(plan_data.limits, 'dict') else dict(plan_data.limits),
            "renewal_config": plan_data.renewal_config.dict() if hasattr(plan_data.renewal_config, 'dict') else dict(plan_data.renewal_config),
            "trial_days": plan_data.trial_days,
            "is_popular": plan_data.is_popular,
            "display_order": plan_data.display_order,
            "is_active": plan_data.is_active,
            "is_public": plan_data.is_public,
            "created_at": now,
            "created_by": created_by,
            "version_count": 1,
            "subscriber_count": 0
        }
        
        # Create initial version
        version_doc = {
            "id": version_id,
            "plan_id": plan_id,
            "version_number": 1,
            "snapshot": {**plan_doc},
            "created_at": now,
            "created_by": created_by,
            "note": "Initial version"
        }
        
        await self.db.plans_master.insert_one(plan_doc)
        await self.db.plan_versions.insert_one(version_doc)
        
        # Remove MongoDB _id
        del plan_doc["_id"]
        
        return {
            "message": f"Plan '{plan_data.name}' created successfully",
            "plan": plan_doc,
            "version_id": version_id
        }
    
    async def update_plan(
        self, 
        plan_id: str, 
        update_data: PlanMasterUpdate, 
        updated_by: str
    ) -> Dict[str, Any]:
        """Update a master plan (creates new version)"""
        now = datetime.now(timezone.utc).isoformat()
        
        # Get existing plan
        plan = await self.db.plans_master.find_one({"id": plan_id})
        if not plan:
            # Try by plan_code
            plan = await self.db.plans_master.find_one({"plan_code": plan_id})
        if not plan:
            raise ValueError("Plan not found")
        
        # Build update fields
        update_fields = {"updated_at": now, "updated_by": updated_by}
        
        update_dict = update_data.dict(exclude_unset=True, exclude={'apply_to_existing', 'version_note'})
        for key, value in update_dict.items():
            if value is not None:
                update_fields[key] = value
        
        # Create new version
        new_version_id = generate_plan_version_id()
        version_number = plan.get("version_count", 1) + 1
        
        # Update plan
        update_fields["current_version"] = new_version_id
        update_fields["version_count"] = version_number
        
        await self.db.plans_master.update_one(
            {"id": plan["id"]},
            {"$set": update_fields}
        )
        
        # Get updated plan for snapshot
        updated_plan = await self.db.plans_master.find_one({"id": plan["id"]}, {"_id": 0})
        
        # Create version snapshot
        version_doc = {
            "id": new_version_id,
            "plan_id": plan["id"],
            "version_number": version_number,
            "snapshot": updated_plan,
            "changes": update_dict,
            "created_at": now,
            "created_by": updated_by,
            "note": update_data.version_note or f"Version {version_number}"
        }
        
        await self.db.plan_versions.insert_one(version_doc)
        
        # Apply to existing subscriptions if requested
        affected_subscriptions = 0
        if update_data.apply_to_existing:
            result = await self.db.subscriptions.update_many(
                {"plan_id": plan["id"], "status": {"$in": ["active", "trialing"]}},
                {"$set": {
                    "plan_version": new_version_id,
                    "plan_snapshot": updated_plan,
                    "version_updated_at": now
                }}
            )
            affected_subscriptions = result.modified_count
        
        return {
            "message": f"Plan updated to version {version_number}",
            "plan": updated_plan,
            "version_id": new_version_id,
            "affected_subscriptions": affected_subscriptions
        }
    
    async def get_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        """Get a plan by ID or code"""
        plan = await self.db.plans_master.find_one(
            {"$or": [{"id": plan_id}, {"plan_code": plan_id}]},
            {"_id": 0}
        )
        return plan
    
    async def get_all_plans(self, include_inactive: bool = False) -> List[Dict[str, Any]]:
        """Get all master plans"""
        query = {} if include_inactive else {"is_active": True}
        plans = await self.db.plans_master.find(query, {"_id": 0}).sort("display_order", 1).to_list(None)
        return plans
    
    async def get_plan_versions(self, plan_id: str) -> List[Dict[str, Any]]:
        """Get all versions of a plan"""
        versions = await self.db.plan_versions.find(
            {"plan_id": plan_id},
            {"_id": 0}
        ).sort("version_number", -1).to_list(None)
        return versions
    
    # ========== SUBSCRIPTION MANAGEMENT ==========
    
    async def create_subscription(
        self,
        tenant_id: str,
        plan_id: str,
        created_by: str,
        auto_renew: bool = True,
        coupon_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new subscription for a tenant"""
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        # Get the plan
        plan = await self.get_plan(plan_id)
        if not plan:
            raise ValueError("Plan not found")
        if not plan.get("is_active"):
            raise ValueError("Plan is not active")
        
        # Check for existing subscription
        existing = await self.db.subscriptions.find_one({
            "tenant_id": tenant_id,
            "status": {"$in": ["active", "trialing", "past_due", "grace_period"]}
        })
        if existing:
            raise ValueError("Tenant already has an active subscription. Use upgrade/downgrade instead.")
        
        # Calculate pricing
        base_price = plan.get("base_price", 0)
        discount_amount = 0
        
        # Apply coupon if provided
        if coupon_code:
            coupon = await self.db.coupons.find_one({"code": coupon_code, "is_active": True})
            if coupon:
                if coupon.get("discount_type") == "percent":
                    discount_amount = base_price * (coupon.get("discount_value", 0) / 100)
                else:
                    discount_amount = coupon.get("discount_value", 0)
        
        final_price = max(0, base_price - discount_amount)
        
        # Calculate period
        interval = plan.get("billing_interval", "month")
        interval_count = plan.get("billing_interval_count", 1)
        trial_days = plan.get("trial_days", 0)
        
        if trial_days > 0:
            period_start = now
            period_end = now + timedelta(days=trial_days)
            status = SubscriptionStatus.TRIALING.value
        else:
            period_start = now
            period_end = calculate_period_end(now, interval, interval_count)
            status = SubscriptionStatus.ACTIVE.value
        
        # Get renewal config
        renewal_config = plan.get("renewal_config", {})
        grace_period_days = renewal_config.get("grace_period_days", 7)
        
        subscription_id = generate_subscription_id()
        
        # Create subscription document
        subscription_doc = {
            "id": subscription_id,
            "tenant_id": tenant_id,
            "plan_id": plan["id"],
            "plan_code": plan["plan_code"],
            "plan_version": plan.get("current_version"),
            "plan_snapshot": plan,  # Store snapshot for reference
            
            # Status
            "status": status,
            "is_active": True,
            
            # Billing
            "base_price": base_price,
            "discount_amount": discount_amount,
            "coupon_code": coupon_code,
            "final_price": final_price,
            "currency": plan.get("currency", "INR"),
            
            # Period
            "billing_interval": interval,
            "billing_interval_count": interval_count,
            "current_period_start": period_start.isoformat(),
            "current_period_end": period_end.isoformat(),
            "trial_end": (now + timedelta(days=trial_days)).isoformat() if trial_days > 0 else None,
            
            # Renewal
            "auto_renew": auto_renew and renewal_config.get("auto_renew_enabled", True),
            "renewal_count": 0,
            "last_renewal_at": None,
            "next_renewal_at": period_end.isoformat(),
            "grace_period_days": grace_period_days,
            "grace_period_end": None,
            
            # Limits (from plan)
            "limits": plan.get("limits", {}),
            
            # Metadata
            "created_at": now_iso,
            "created_by": created_by,
            "updated_at": now_iso,
            "cancelled_at": None,
            "cancel_reason": None
        }
        
        await self.db.subscriptions.insert_one(subscription_doc)
        
        # Record event
        await self._record_event(
            subscription_id=subscription_id,
            tenant_id=tenant_id,
            event_type=SubscriptionEventType.CREATED.value,
            details={
                "plan_id": plan["id"],
                "plan_name": plan["name"],
                "price": final_price,
                "trial_days": trial_days
            }
        )
        
        # Update plan subscriber count
        await self.db.plans_master.update_one(
            {"id": plan["id"]},
            {"$inc": {"subscriber_count": 1}}
        )
        
        # Update tenant's plan
        await self.db.users.update_many(
            {"tenant_id": tenant_id},
            {"$set": {
                "plan": plan["plan_code"],
                "plan_id": plan["id"],
                "subscription_id": subscription_id,
                "subscription_status": status
            }}
        )
        
        del subscription_doc["_id"]
        
        return {
            "message": f"Subscription created successfully",
            "subscription": subscription_doc
        }
    
    async def renew_subscription(
        self,
        subscription_id: str,
        payment_successful: bool = True,
        payment_details: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Renew an existing subscription"""
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        # Get subscription
        subscription = await self.db.subscriptions.find_one({"id": subscription_id})
        if not subscription:
            raise ValueError("Subscription not found")
        
        # Get current plan (for latest pricing)
        plan = await self.get_plan(subscription["plan_id"])
        if not plan:
            raise ValueError("Associated plan not found")
        
        renewal_config = plan.get("renewal_config", {})
        
        # Check if renewable
        if not renewal_config.get("is_renewable", True):
            raise ValueError("This plan is not renewable")
        
        # Check max renewals
        max_renewals = renewal_config.get("max_renewal_count", -1)
        current_renewals = subscription.get("renewal_count", 0)
        if max_renewals != -1 and current_renewals >= max_renewals:
            raise ValueError(f"Maximum renewal count ({max_renewals}) reached")
        
        if not payment_successful:
            # Start grace period
            grace_days = renewal_config.get("grace_period_days", 7)
            grace_end = now + timedelta(days=grace_days)
            
            await self.db.subscriptions.update_one(
                {"id": subscription_id},
                {"$set": {
                    "status": SubscriptionStatus.GRACE_PERIOD.value,
                    "grace_period_end": grace_end.isoformat(),
                    "updated_at": now_iso
                }}
            )
            
            await self._record_event(
                subscription_id=subscription_id,
                tenant_id=subscription["tenant_id"],
                event_type=SubscriptionEventType.PAYMENT_FAILED.value,
                details={"grace_period_end": grace_end.isoformat()}
            )
            
            return {
                "message": "Payment failed. Grace period started.",
                "grace_period_end": grace_end.isoformat(),
                "status": SubscriptionStatus.GRACE_PERIOD.value
            }
        
        # Calculate renewal price
        renewal_price = calculate_renewal_price(
            plan.get("base_price", 0),
            renewal_config,
            current_renewals + 1
        )
        
        # Calculate new period
        interval = subscription.get("billing_interval", "month")
        interval_count = subscription.get("billing_interval_count", 1)
        
        # Extend from current period end (not from now)
        current_end = datetime.fromisoformat(subscription["current_period_end"].replace("Z", "+00:00"))
        new_period_start = max(current_end, now)
        new_period_end = calculate_period_end(new_period_start, interval, interval_count)
        
        # Update subscription - EXTEND, don't create new
        update_data = {
            "status": SubscriptionStatus.ACTIVE.value,
            "is_active": True,
            "current_period_start": new_period_start.isoformat(),
            "current_period_end": new_period_end.isoformat(),
            "next_renewal_at": new_period_end.isoformat(),
            "renewal_count": current_renewals + 1,
            "last_renewal_at": now_iso,
            "last_renewal_price": renewal_price,
            "grace_period_end": None,
            "updated_at": now_iso,
            
            # Update to latest plan version
            "plan_version": plan.get("current_version"),
            "plan_snapshot": plan,
            "limits": plan.get("limits", {})
        }
        
        await self.db.subscriptions.update_one(
            {"id": subscription_id},
            {"$set": update_data}
        )
        
        # Record payment
        payment_record = {
            "id": str(uuid.uuid4()),
            "subscription_id": subscription_id,
            "tenant_id": subscription["tenant_id"],
            "type": "renewal",
            "amount": renewal_price,
            "currency": subscription.get("currency", "INR"),
            "status": "success",
            "renewal_number": current_renewals + 1,
            "payment_details": payment_details,
            "created_at": now_iso
        }
        await self.db.subscription_payments.insert_one(payment_record)
        
        # Record event
        await self._record_event(
            subscription_id=subscription_id,
            tenant_id=subscription["tenant_id"],
            event_type=SubscriptionEventType.RENEWED.value,
            details={
                "renewal_number": current_renewals + 1,
                "amount": renewal_price,
                "new_period_end": new_period_end.isoformat()
            }
        )
        
        # Update revenue analytics
        await self._update_revenue_analytics(
            tenant_id=subscription["tenant_id"],
            plan_id=subscription["plan_id"],
            amount=renewal_price,
            event_type="renewal"
        )
        
        return {
            "message": f"Subscription renewed successfully (renewal #{current_renewals + 1})",
            "subscription_id": subscription_id,
            "renewal_count": current_renewals + 1,
            "new_period_end": new_period_end.isoformat(),
            "amount_charged": renewal_price
        }
    
    async def change_plan(
        self,
        subscription_id: str,
        new_plan_id: str,
        changed_by: str,
        immediate: bool = True
    ) -> Dict[str, Any]:
        """Upgrade or downgrade subscription plan"""
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        # Get subscription
        subscription = await self.db.subscriptions.find_one({"id": subscription_id})
        if not subscription:
            raise ValueError("Subscription not found")
        
        # Get new plan
        new_plan = await self.get_plan(new_plan_id)
        if not new_plan:
            raise ValueError("New plan not found")
        if not new_plan.get("is_active"):
            raise ValueError("New plan is not active")
        
        old_plan_id = subscription["plan_id"]
        if old_plan_id == new_plan["id"]:
            raise ValueError("Already subscribed to this plan")
        
        # Get old plan for comparison
        old_plan = subscription.get("plan_snapshot", {})
        old_price = old_plan.get("base_price", 0)
        new_price = new_plan.get("base_price", 0)
        
        is_upgrade = new_price > old_price
        
        # Check if downgrade is allowed (validate limits)
        if not is_upgrade:
            tenant_id = subscription["tenant_id"]
            new_limits = new_plan.get("limits", {})
            
            # Get current usage
            usage = {
                "stores": await self.db.stores.count_documents({"tenant_id": tenant_id}),
                "products": await self.db.products.count_documents({"tenant_id": tenant_id}),
                "users": await self.db.users.count_documents({"tenant_id": tenant_id})
            }
            
            # Validate
            for key, limit in new_limits.items():
                if limit != -1 and key in usage and usage[key] > limit:
                    raise ValueError(f"Cannot downgrade: Current {key} ({usage[key]}) exceeds new limit ({limit})")
        
        # Calculate proration
        current_end = datetime.fromisoformat(subscription["current_period_end"].replace("Z", "+00:00"))
        days_remaining = max(0, (current_end - now).days)
        
        proration = calculate_proration(old_price, new_price, days_remaining)
        
        # Update subscription
        update_data = {
            "plan_id": new_plan["id"],
            "plan_code": new_plan["plan_code"],
            "plan_version": new_plan.get("current_version"),
            "plan_snapshot": new_plan,
            "base_price": new_price,
            "final_price": new_price,
            "limits": new_plan.get("limits", {}),
            "renewal_config": new_plan.get("renewal_config", {}),
            "updated_at": now_iso,
            "last_plan_change_at": now_iso
        }
        
        if immediate:
            # Calculate new period if immediate
            interval = new_plan.get("billing_interval", "month")
            interval_count = new_plan.get("billing_interval_count", 1)
            new_period_end = calculate_period_end(now, interval, interval_count)
            update_data["current_period_start"] = now_iso
            update_data["current_period_end"] = new_period_end.isoformat()
            update_data["next_renewal_at"] = new_period_end.isoformat()
        
        await self.db.subscriptions.update_one(
            {"id": subscription_id},
            {"$set": update_data}
        )
        
        # Update subscriber counts
        await self.db.plans_master.update_one(
            {"id": old_plan_id},
            {"$inc": {"subscriber_count": -1}}
        )
        await self.db.plans_master.update_one(
            {"id": new_plan["id"]},
            {"$inc": {"subscriber_count": 1}}
        )
        
        # Update tenant users
        await self.db.users.update_many(
            {"tenant_id": subscription["tenant_id"]},
            {"$set": {
                "plan": new_plan["plan_code"],
                "plan_id": new_plan["id"]
            }}
        )
        
        # Record event
        await self._record_event(
            subscription_id=subscription_id,
            tenant_id=subscription["tenant_id"],
            event_type=SubscriptionEventType.UPGRADED.value if is_upgrade else SubscriptionEventType.DOWNGRADED.value,
            details={
                "from_plan": old_plan.get("name"),
                "to_plan": new_plan["name"],
                "proration": proration,
                "changed_by": changed_by
            }
        )
        
        return {
            "message": f"Plan {'upgraded' if is_upgrade else 'downgraded'} to {new_plan['name']}",
            "is_upgrade": is_upgrade,
            "proration": proration,
            "new_plan": new_plan["name"],
            "effective_immediately": immediate
        }
    
    async def cancel_subscription(
        self,
        subscription_id: str,
        reason: Optional[str] = None,
        immediate: bool = False,
        cancelled_by: str = None
    ) -> Dict[str, Any]:
        """Cancel a subscription"""
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        subscription = await self.db.subscriptions.find_one({"id": subscription_id})
        if not subscription:
            raise ValueError("Subscription not found")
        
        if immediate:
            new_status = SubscriptionStatus.CANCELLED.value
            is_active = False
        else:
            # Cancel at period end
            new_status = subscription["status"]
            is_active = True
        
        await self.db.subscriptions.update_one(
            {"id": subscription_id},
            {"$set": {
                "status": new_status if immediate else subscription["status"],
                "is_active": is_active,
                "auto_renew": False,
                "cancelled_at": now_iso,
                "cancel_reason": reason,
                "cancel_at_period_end": not immediate,
                "updated_at": now_iso
            }}
        )
        
        # Update subscriber count
        if immediate:
            await self.db.plans_master.update_one(
                {"id": subscription["plan_id"]},
                {"$inc": {"subscriber_count": -1}}
            )
        
        # Record event
        await self._record_event(
            subscription_id=subscription_id,
            tenant_id=subscription["tenant_id"],
            event_type=SubscriptionEventType.CANCELLED.value,
            details={
                "reason": reason,
                "immediate": immediate,
                "cancelled_by": cancelled_by
            }
        )
        
        # Update churn analytics
        await self._update_churn_analytics(
            tenant_id=subscription["tenant_id"],
            plan_id=subscription["plan_id"],
            reason=reason
        )
        
        return {
            "message": "Subscription cancelled" + (" immediately" if immediate else " at period end"),
            "effective_date": now_iso if immediate else subscription["current_period_end"]
        }
    
    async def get_subscription(self, subscription_id: str) -> Optional[Dict[str, Any]]:
        """Get subscription by ID"""
        return await self.db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    
    async def get_tenant_subscription(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get active subscription for a tenant"""
        return await self.db.subscriptions.find_one(
            {"tenant_id": tenant_id, "is_active": True},
            {"_id": 0}
        )
    
    # ========== ANALYTICS ==========
    
    async def get_subscription_analytics(self) -> Dict[str, Any]:
        """Get comprehensive subscription analytics"""
        now = datetime.now(timezone.utc)
        
        # Total counts by status
        status_counts = {}
        for status in SubscriptionStatus:
            count = await self.db.subscriptions.count_documents({"status": status.value})
            status_counts[status.value] = count
        
        total_subscriptions = sum(status_counts.values())
        active_subscriptions = status_counts.get("active", 0) + status_counts.get("trialing", 0)
        
        # Revenue metrics
        pipeline = [
            {"$match": {"status": "active"}},
            {"$group": {
                "_id": None,
                "total_mrr": {"$sum": {"$ifNull": ["$final_price", 0]}},
                "avg_price": {"$avg": {"$ifNull": ["$final_price", 0]}}
            }}
        ]
        revenue_result = await self.db.subscriptions.aggregate(pipeline).to_list(1)
        mrr = revenue_result[0]["total_mrr"] if revenue_result and revenue_result[0].get("total_mrr") else 0
        avg_price = revenue_result[0]["avg_price"] if revenue_result and revenue_result[0].get("avg_price") else 0
        
        # Plan distribution
        plan_pipeline = [
            {"$match": {"is_active": True}},
            {"$group": {
                "_id": "$plan_code",
                "count": {"$sum": 1},
                "revenue": {"$sum": {"$ifNull": ["$final_price", 0]}}
            }},
            {"$sort": {"count": -1}}
        ]
        plan_distribution = await self.db.subscriptions.aggregate(plan_pipeline).to_list(None)
        
        # Renewal stats
        renewal_pipeline = [
            {"$match": {"renewal_count": {"$gt": 0}}},
            {"$group": {
                "_id": None,
                "total_renewals": {"$sum": "$renewal_count"},
                "avg_renewals": {"$avg": "$renewal_count"},
                "max_renewals": {"$max": "$renewal_count"}
            }}
        ]
        renewal_result = await self.db.subscriptions.aggregate(renewal_pipeline).to_list(1)
        
        # Churn (cancelled in last 30 days)
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        churn_count = await self.db.subscriptions.count_documents({
            "cancelled_at": {"$gte": thirty_days_ago}
        })
        
        churn_rate = (churn_count / active_subscriptions * 100) if active_subscriptions > 0 else 0
        
        # Trial conversion
        trial_converted = await self.db.subscription_history.count_documents({
            "event_type": "converted_from_trial",
            "timestamp": {"$gte": thirty_days_ago}
        })
        total_trials = await self.db.subscriptions.count_documents({
            "trial_end": {"$ne": None},
            "created_at": {"$gte": thirty_days_ago}
        })
        trial_conversion_rate = (trial_converted / total_trials * 100) if total_trials > 0 else 0
        
        # Handle None values safely
        def safe_round(val, decimals=2):
            return round(val, decimals) if val is not None else 0
        
        renewal_data = renewal_result[0] if renewal_result else {}
        
        return {
            "overview": {
                "total_subscriptions": total_subscriptions,
                "active_subscriptions": active_subscriptions,
                "trialing": status_counts.get("trialing", 0),
                "past_due": status_counts.get("past_due", 0),
                "cancelled": status_counts.get("cancelled", 0)
            },
            "revenue": {
                "mrr": safe_round(mrr),
                "arr": safe_round(mrr * 12 if mrr else 0),
                "avg_revenue_per_user": safe_round(avg_price)
            },
            "renewals": {
                "total_renewals": renewal_data.get("total_renewals", 0) or 0,
                "avg_renewals_per_subscription": safe_round(renewal_data.get("avg_renewals", 0)),
                "max_renewals": renewal_data.get("max_renewals", 0) or 0
            },
            "churn": {
                "cancelled_last_30_days": churn_count,
                "churn_rate_percent": safe_round(churn_rate)
            },
            "trials": {
                "conversion_rate_percent": safe_round(trial_conversion_rate),
                "converted_last_30_days": trial_converted
            },
            "plan_distribution": [
                {"plan": p["_id"] or "unknown", "subscribers": p["count"], "revenue": safe_round(p.get("revenue", 0))}
                for p in plan_distribution
            ]
        }
    
    async def get_revenue_trends(self, period: str = "month") -> List[Dict[str, Any]]:
        """Get revenue trends over time"""
        now = datetime.now(timezone.utc)
        
        if period == "day":
            days = 30
            group_format = "%Y-%m-%d"
        elif period == "week":
            days = 90
            group_format = "%Y-W%U"
        elif period == "month":
            days = 365
            group_format = "%Y-%m"
        else:
            days = 365
            group_format = "%Y-%m"
        
        start_date = (now - timedelta(days=days)).isoformat()
        
        pipeline = [
            {"$match": {"created_at": {"$gte": start_date}}},
            {"$addFields": {
                "date": {"$dateFromString": {"dateString": "$created_at"}}
            }},
            {"$group": {
                "_id": {"$dateToString": {"format": group_format, "date": "$date"}},
                "revenue": {"$sum": "$amount"},
                "transactions": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        trends = await self.db.subscription_payments.aggregate(pipeline).to_list(None)
        
        return [
            {"period": t["_id"], "revenue": round(t["revenue"], 2), "transactions": t["transactions"]}
            for t in trends
        ]
    
    # ========== INTERNAL HELPERS ==========
    
    async def _record_event(
        self,
        subscription_id: str,
        tenant_id: str,
        event_type: str,
        details: Dict[str, Any]
    ):
        """Record a subscription event"""
        event = {
            "id": str(uuid.uuid4()),
            "subscription_id": subscription_id,
            "tenant_id": tenant_id,
            "event_type": event_type,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.db.subscription_history.insert_one(event)
    
    async def _update_revenue_analytics(
        self,
        tenant_id: str,
        plan_id: str,
        amount: float,
        event_type: str
    ):
        """Update revenue analytics"""
        now = datetime.now(timezone.utc)
        date_key = now.strftime("%Y-%m-%d")
        month_key = now.strftime("%Y-%m")
        
        # Daily stats
        await self.db.revenue_daily.update_one(
            {"date": date_key},
            {
                "$inc": {
                    "total_revenue": amount,
                    f"by_type.{event_type}": amount,
                    "transaction_count": 1
                },
                "$setOnInsert": {"date": date_key}
            },
            upsert=True
        )
        
        # Monthly stats
        await self.db.revenue_monthly.update_one(
            {"month": month_key},
            {
                "$inc": {
                    "total_revenue": amount,
                    f"by_type.{event_type}": amount,
                    "transaction_count": 1
                },
                "$setOnInsert": {"month": month_key}
            },
            upsert=True
        )
    
    async def _update_churn_analytics(
        self,
        tenant_id: str,
        plan_id: str,
        reason: Optional[str]
    ):
        """Update churn analytics"""
        now = datetime.now(timezone.utc)
        month_key = now.strftime("%Y-%m")
        
        await self.db.churn_analytics.update_one(
            {"month": month_key},
            {
                "$inc": {"total_churned": 1},
                "$push": {
                    "reasons": {
                        "tenant_id": tenant_id,
                        "plan_id": plan_id,
                        "reason": reason or "not_specified",
                        "timestamp": now.isoformat()
                    }
                },
                "$setOnInsert": {"month": month_key}
            },
            upsert=True
        )
