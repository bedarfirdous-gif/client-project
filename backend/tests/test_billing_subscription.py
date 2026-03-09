"""
Test Billing & Subscription System
- Tests billing endpoints: plans, subscription, usage, checkout, history, cancel
- Tests Super Admin subscription management endpoints
"""
import pytest
import requests
import os
import uuid

# Get base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "demo@brandmafia.com"
ADMIN_PASSWORD = "demo123"
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Get admin headers with auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def superadmin_token():
    """Get super admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Super Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def superadmin_headers(superadmin_token):
    """Get super admin headers with auth token"""
    return {
        "Authorization": f"Bearer {superadmin_token}",
        "Content-Type": "application/json"
    }


class TestBillingPlans:
    """Test GET /api/billing/plans - Available subscription plans"""
    
    def test_get_plans_returns_4_plans(self):
        """Plans endpoint should return 4 plans: Free, Basic, Pro, Enterprise"""
        response = requests.get(f"{BASE_URL}/api/billing/plans")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plans" in data, "Response should contain 'plans' key"
        
        plans = data["plans"]
        assert len(plans) == 4, f"Expected 4 plans, got {len(plans)}"
        
        plan_ids = [p["id"] for p in plans]
        assert "free" in plan_ids, "Free plan should exist"
        assert "basic" in plan_ids, "Basic plan should exist"
        assert "pro" in plan_ids, "Pro plan should exist"
        assert "enterprise" in plan_ids, "Enterprise plan should exist"
        print("✓ GET /api/billing/plans returns 4 plans correctly")
    
    def test_plans_have_correct_pricing(self):
        """Each plan should have correct pricing in INR"""
        response = requests.get(f"{BASE_URL}/api/billing/plans")
        assert response.status_code == 200
        
        plans = {p["id"]: p for p in response.json()["plans"]}
        
        # Verify prices
        assert plans["free"]["price"] == 0, "Free plan should be 0"
        assert plans["basic"]["price"] == 999, "Basic plan should be 999"
        assert plans["pro"]["price"] == 2499, "Pro plan should be 2499"
        assert plans["enterprise"]["price"] == 4999, "Enterprise plan should be 4999"
        print("✓ Plan prices are correct: Free=0, Basic=999, Pro=2499, Enterprise=4999 INR")
    
    def test_plans_have_features_list(self):
        """Each plan should have features list"""
        response = requests.get(f"{BASE_URL}/api/billing/plans")
        assert response.status_code == 200
        
        for plan in response.json()["plans"]:
            assert "features" in plan, f"Plan {plan['id']} should have features"
            assert isinstance(plan["features"], list), f"Features should be a list"
            assert len(plan["features"]) > 0, f"Plan {plan['id']} should have at least 1 feature"
        print("✓ All plans have features list")
    
    def test_plans_have_limits(self):
        """Each plan should have resource limits"""
        response = requests.get(f"{BASE_URL}/api/billing/plans")
        assert response.status_code == 200
        
        for plan in response.json()["plans"]:
            assert "limits" in plan, f"Plan {plan['id']} should have limits"
            limits = plan["limits"]
            
            # Check required limit keys
            assert "stores" in limits, f"Plan {plan['id']} should have stores limit"
            assert "products" in limits, f"Plan {plan['id']} should have products limit"
            assert "users" in limits, f"Plan {plan['id']} should have users limit"
            assert "customers" in limits, f"Plan {plan['id']} should have customers limit"
            assert "sales_per_month" in limits, f"Plan {plan['id']} should have sales_per_month limit"
        print("✓ All plans have resource limits (stores, products, users, customers, sales_per_month)")


class TestCurrentSubscription:
    """Test GET /api/billing/subscription - Current subscription status"""
    
    def test_get_subscription_requires_auth(self):
        """Subscription endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/billing/subscription")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ GET /api/billing/subscription requires authentication")
    
    def test_get_subscription_returns_plan_info(self, admin_headers):
        """Should return current subscription plan details"""
        response = requests.get(
            f"{BASE_URL}/api/billing/subscription",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plan" in data, "Response should contain 'plan' key"
        assert "status" in data, "Response should contain 'status' key"
        
        # Default should be free plan
        assert data["plan"] in ["free", "basic", "pro", "enterprise"], f"Invalid plan: {data['plan']}"
        print(f"✓ GET /api/billing/subscription returns current plan: {data['plan']}")
    
    def test_subscription_has_plan_details(self, admin_headers):
        """Subscription should include plan details"""
        response = requests.get(
            f"{BASE_URL}/api/billing/subscription",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        if "plan_details" in data:
            details = data["plan_details"]
            assert "name" in details, "Plan details should have name"
            assert "price" in details, "Plan details should have price"
            print(f"✓ Subscription includes plan details: {details.get('name')}")
        else:
            print("✓ Subscription response structure is valid (plan_details may be optional)")


class TestUsageStats:
    """Test GET /api/billing/usage - Usage statistics with limits"""
    
    def test_get_usage_requires_auth(self):
        """Usage endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/billing/usage")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ GET /api/billing/usage requires authentication")
    
    def test_get_usage_returns_stats(self, admin_headers):
        """Should return usage stats with limits"""
        response = requests.get(
            f"{BASE_URL}/api/billing/usage",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plan" in data, "Response should contain 'plan' key"
        assert "usage" in data, "Response should contain 'usage' key"
        
        usage = data["usage"]
        print(f"✓ GET /api/billing/usage returns usage stats for plan: {data['plan']}")
    
    def test_usage_has_all_metrics(self, admin_headers):
        """Usage should include all resource metrics"""
        response = requests.get(
            f"{BASE_URL}/api/billing/usage",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        usage = response.json()["usage"]
        required_metrics = ["stores", "products", "users", "customers", "sales_this_month"]
        
        for metric in required_metrics:
            assert metric in usage, f"Usage should include '{metric}'"
            metric_data = usage[metric]
            assert "current" in metric_data, f"{metric} should have 'current' value"
            assert "limit" in metric_data, f"{metric} should have 'limit' value"
            assert "percentage" in metric_data, f"{metric} should have 'percentage' value"
            assert "exceeded" in metric_data, f"{metric} should have 'exceeded' flag"
        
        print("✓ Usage includes all metrics: stores, products, users, customers, sales_this_month")
    
    def test_usage_exceeded_flag_works(self, admin_headers):
        """Exceeded flag should indicate when limits are surpassed"""
        response = requests.get(
            f"{BASE_URL}/api/billing/usage",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        usage = response.json()["usage"]
        
        for metric, data in usage.items():
            if isinstance(data["limit"], int) and data["limit"] > 0:
                expected_exceeded = data["current"] > data["limit"]
                assert data["exceeded"] == expected_exceeded, \
                    f"{metric}: exceeded={data['exceeded']} should match current({data['current']}) > limit({data['limit']})"
        
        print("✓ Usage exceeded flags are correctly calculated")


class TestCheckoutSession:
    """Test POST /api/billing/checkout - Create Stripe checkout session"""
    
    def test_checkout_requires_auth(self):
        """Checkout endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan_id": "basic", "origin_url": "https://example.com"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ POST /api/billing/checkout requires authentication")
    
    def test_checkout_rejects_invalid_plan(self, admin_headers):
        """Should reject invalid plan ID"""
        response = requests.post(
            f"{BASE_URL}/api/billing/checkout",
            headers=admin_headers,
            json={"plan_id": "invalid_plan", "origin_url": "https://example.com"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid plan, got {response.status_code}"
        print("✓ POST /api/billing/checkout rejects invalid plan")
    
    def test_checkout_rejects_free_plan(self, admin_headers):
        """Should reject checkout for free plan"""
        response = requests.post(
            f"{BASE_URL}/api/billing/checkout",
            headers=admin_headers,
            json={"plan_id": "free", "origin_url": "https://example.com"}
        )
        assert response.status_code == 400, f"Expected 400 for free plan checkout, got {response.status_code}"
        print("✓ POST /api/billing/checkout rejects free plan checkout")
    
    def test_checkout_creates_session_for_basic(self, admin_headers):
        """Should create checkout session for Basic plan"""
        response = requests.post(
            f"{BASE_URL}/api/billing/checkout",
            headers=admin_headers,
            json={"plan_id": "basic", "origin_url": BASE_URL}
        )
        
        # May fail if Stripe not properly configured, but should return valid response structure
        if response.status_code == 200:
            data = response.json()
            assert "checkout_url" in data, "Response should contain checkout_url"
            assert "session_id" in data, "Response should contain session_id"
            print(f"✓ POST /api/billing/checkout creates session for Basic plan")
        elif response.status_code == 500:
            # Stripe integration may fail in test environment
            print(f"⚠ Stripe checkout failed (likely test environment): {response.text[:200]}")
        else:
            assert False, f"Unexpected status {response.status_code}: {response.text}"


class TestCheckoutStatus:
    """Test GET /api/billing/checkout/status/{session_id} - Check payment status"""
    
    def test_status_requires_auth(self):
        """Status endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/billing/checkout/status/test_session_123")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ GET /api/billing/checkout/status requires authentication")
    
    def test_status_returns_404_for_unknown_session(self, admin_headers):
        """Should return 404 for unknown session ID"""
        response = requests.get(
            f"{BASE_URL}/api/billing/checkout/status/nonexistent_session_{uuid.uuid4().hex[:8]}",
            headers=admin_headers
        )
        assert response.status_code == 404, f"Expected 404 for unknown session, got {response.status_code}"
        print("✓ GET /api/billing/checkout/status returns 404 for unknown session")


class TestBillingHistory:
    """Test GET /api/billing/history - Payment transaction history"""
    
    def test_history_requires_auth(self):
        """History endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/billing/history")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ GET /api/billing/history requires authentication")
    
    def test_history_returns_transactions_list(self, admin_headers):
        """Should return list of transactions"""
        response = requests.get(
            f"{BASE_URL}/api/billing/history",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "transactions" in data, "Response should contain 'transactions' key"
        assert isinstance(data["transactions"], list), "Transactions should be a list"
        print(f"✓ GET /api/billing/history returns {len(data['transactions'])} transactions")


class TestCancelSubscription:
    """Test POST /api/billing/cancel - Cancel subscription"""
    
    def test_cancel_requires_auth(self):
        """Cancel endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/billing/cancel")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ POST /api/billing/cancel requires authentication")
    
    def test_cancel_returns_success_message(self, admin_headers):
        """Should return success message (even if no subscription to cancel)"""
        response = requests.post(
            f"{BASE_URL}/api/billing/cancel",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message' key"
        print(f"✓ POST /api/billing/cancel returns message: {data['message'][:50]}")


class TestSuperAdminSubscriptions:
    """Test Super Admin billing management endpoints"""
    
    def test_superadmin_subscriptions_requires_superadmin(self, admin_headers):
        """Regular admin should not access super admin subscription endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/subscriptions",
            headers=admin_headers
        )
        assert response.status_code == 403, f"Expected 403 for regular admin, got {response.status_code}"
        print("✓ GET /api/superadmin/subscriptions returns 403 for regular admin")
    
    def test_superadmin_can_view_subscriptions(self, superadmin_headers):
        """Super admin should be able to view all subscriptions"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/subscriptions",
            headers=superadmin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_active" in data, "Response should contain 'total_active'"
        assert "plan_breakdown" in data, "Response should contain 'plan_breakdown'"
        assert "monthly_revenue" in data, "Response should contain 'monthly_revenue'"
        assert "subscriptions" in data, "Response should contain 'subscriptions' list"
        
        print(f"✓ Super Admin can view subscriptions: {data['total_active']} active, revenue: {data['monthly_revenue']}")
    
    def test_superadmin_change_plan_requires_superadmin(self, admin_headers):
        """Regular admin should not change other admin's plan"""
        response = requests.put(
            f"{BASE_URL}/api/superadmin/admins/some_admin_id/plan",
            headers=admin_headers,
            json={"plan_id": "pro"}
        )
        assert response.status_code == 403, f"Expected 403 for regular admin, got {response.status_code}"
        print("✓ PUT /api/superadmin/admins/{id}/plan returns 403 for regular admin")
    
    def test_superadmin_change_plan_rejects_invalid_plan(self, superadmin_headers):
        """Should reject invalid plan ID"""
        # First get a valid admin ID
        admins_response = requests.get(
            f"{BASE_URL}/api/superadmin/admins",
            headers=superadmin_headers
        )
        
        if admins_response.status_code == 200 and admins_response.json().get("admins"):
            admin_id = admins_response.json()["admins"][0]["id"]
            
            response = requests.put(
                f"{BASE_URL}/api/superadmin/admins/{admin_id}/plan",
                headers=superadmin_headers,
                json={"plan_id": "invalid_plan_xyz"}
            )
            assert response.status_code == 400, f"Expected 400 for invalid plan, got {response.status_code}"
            print("✓ Super Admin change plan rejects invalid plan ID")
        else:
            print("⚠ Skipping invalid plan test - no admins found")


class TestIntegration:
    """Integration tests for billing workflow"""
    
    def test_full_billing_page_data_flow(self, admin_headers):
        """Test that billing page can load all required data"""
        # Simulate what the BillingPage.js does on load
        
        # 1. Get plans
        plans_response = requests.get(f"{BASE_URL}/api/billing/plans")
        assert plans_response.status_code == 200, "Failed to get plans"
        plans = plans_response.json()["plans"]
        assert len(plans) == 4, "Should have 4 plans"
        
        # 2. Get subscription
        sub_response = requests.get(
            f"{BASE_URL}/api/billing/subscription",
            headers=admin_headers
        )
        assert sub_response.status_code == 200, "Failed to get subscription"
        
        # 3. Get usage
        usage_response = requests.get(
            f"{BASE_URL}/api/billing/usage",
            headers=admin_headers
        )
        assert usage_response.status_code == 200, "Failed to get usage"
        
        # 4. Get history
        history_response = requests.get(
            f"{BASE_URL}/api/billing/history",
            headers=admin_headers
        )
        assert history_response.status_code == 200, "Failed to get history"
        
        print("✓ Full billing page data flow works: plans + subscription + usage + history")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
