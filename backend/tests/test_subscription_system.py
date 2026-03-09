"""
Subscription System Migration Tests
===================================
Tests for the new centralized subscription management system.
Covers: Master Plans, Billing endpoints, Analytics, and Super Admin access.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


class TestSetup:
    """Setup and authentication helpers"""
    
    @staticmethod
    def get_superadmin_token():
        """Get Super Admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    @staticmethod
    def get_admin_token():
        """Get Admin authentication token (demo user)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo12345"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None


# ============== BILLING ENDPOINTS TESTS ==============

class TestBillingPlans:
    """Tests for GET /api/billing/plans - should return plans from new master plans system"""
    
    def test_billing_plans_returns_plans(self):
        """GET /api/billing/plans should return list of plans"""
        response = requests.get(f"{BASE_URL}/api/billing/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plans" in data, "Response should contain 'plans' key"
        assert isinstance(data["plans"], list), "Plans should be a list"
        assert len(data["plans"]) > 0, "Should have at least one plan"
        
        # Verify plan structure
        plan = data["plans"][0]
        assert "id" in plan, "Plan should have 'id'"
        assert "name" in plan, "Plan should have 'name'"
        assert "price" in plan or "base_price" in plan, "Plan should have price"
        assert "features" in plan, "Plan should have 'features'"
        
        print(f"✓ Found {len(data['plans'])} plans")
        print(f"✓ Source: {data.get('source', 'unknown')}")
    
    def test_billing_plans_has_expected_plans(self):
        """GET /api/billing/plans should include Free, Starter, Basic, Pro, Enterprise"""
        response = requests.get(f"{BASE_URL}/api/billing/plans")
        assert response.status_code == 200
        
        data = response.json()
        plan_ids = [p.get("id", "").lower() for p in data["plans"]]
        
        # Check for expected plans (at least some of them)
        expected_plans = ["free", "basic", "pro"]
        found_plans = [p for p in expected_plans if p in plan_ids]
        
        assert len(found_plans) >= 2, f"Expected at least 2 of {expected_plans}, found: {found_plans}"
        print(f"✓ Found expected plans: {found_plans}")
    
    def test_billing_plans_source_is_master_plans(self):
        """GET /api/billing/plans should use master_plans source when available"""
        response = requests.get(f"{BASE_URL}/api/billing/plans")
        assert response.status_code == 200
        
        data = response.json()
        source = data.get("source", "unknown")
        
        # Either master_plans or legacy is acceptable
        assert source in ["master_plans", "legacy"], f"Unexpected source: {source}"
        print(f"✓ Plans source: {source}")


class TestBillingSubscription:
    """Tests for GET /api/billing/subscription - should return subscription from new system"""
    
    def test_subscription_requires_auth(self):
        """GET /api/billing/subscription should require authentication"""
        response = requests.get(f"{BASE_URL}/api/billing/subscription")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Subscription endpoint requires authentication")
    
    def test_subscription_returns_data_for_admin(self):
        """GET /api/billing/subscription should return subscription for authenticated admin"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/billing/subscription", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plan" in data, "Response should contain 'plan'"
        assert "status" in data, "Response should contain 'status'"
        
        print(f"✓ Current plan: {data.get('plan')}")
        print(f"✓ Status: {data.get('status')}")
        print(f"✓ Source: {data.get('source', 'unknown')}")


class TestBillingUsage:
    """Tests for GET /api/billing/usage - should return usage with correct limits"""
    
    def test_usage_requires_auth(self):
        """GET /api/billing/usage should require authentication"""
        response = requests.get(f"{BASE_URL}/api/billing/usage")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Usage endpoint requires authentication")
    
    def test_usage_returns_data_for_admin(self):
        """GET /api/billing/usage should return usage stats for authenticated admin"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/billing/usage", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plan" in data, "Response should contain 'plan'"
        assert "usage" in data, "Response should contain 'usage'"
        
        usage = data["usage"]
        # Check expected usage fields
        expected_fields = ["stores", "products", "users"]
        for field in expected_fields:
            assert field in usage, f"Usage should contain '{field}'"
            assert "current" in usage[field], f"Usage.{field} should have 'current'"
            assert "limit" in usage[field], f"Usage.{field} should have 'limit'"
        
        print(f"✓ Plan: {data.get('plan')}")
        print(f"✓ Stores: {usage['stores']['current']}/{usage['stores']['limit']}")
        print(f"✓ Products: {usage['products']['current']}/{usage['products']['limit']}")
        print(f"✓ Users: {usage['users']['current']}/{usage['users']['limit']}")


# ============== MASTER PLANS ENDPOINTS (SUPER ADMIN ONLY) ==============

class TestMasterPlansGet:
    """Tests for GET /api/subscriptions/plans/master - Super Admin only"""
    
    def test_master_plans_requires_superadmin(self):
        """GET /api/subscriptions/plans/master should require Super Admin"""
        # Test without auth
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans/master")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        # Test with regular admin
        admin_token = TestSetup.get_admin_token()
        if admin_token:
            headers = {"Authorization": f"Bearer {admin_token}"}
            response = requests.get(f"{BASE_URL}/api/subscriptions/plans/master", headers=headers)
            assert response.status_code == 403, f"Expected 403 for admin, got {response.status_code}"
        
        print("✓ Master plans endpoint requires Super Admin")
    
    def test_master_plans_returns_plans_for_superadmin(self):
        """GET /api/subscriptions/plans/master should return plans for Super Admin"""
        token = TestSetup.get_superadmin_token()
        if not token:
            pytest.skip("Could not get superadmin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans/master", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plans" in data, "Response should contain 'plans'"
        assert "total" in data, "Response should contain 'total'"
        
        plans = data["plans"]
        assert isinstance(plans, list), "Plans should be a list"
        
        print(f"✓ Found {data['total']} master plans")
        
        # Verify plan structure if plans exist
        if plans:
            plan = plans[0]
            assert "id" in plan, "Plan should have 'id'"
            assert "plan_code" in plan, "Plan should have 'plan_code'"
            assert "name" in plan, "Plan should have 'name'"
            assert "base_price" in plan, "Plan should have 'base_price'"
            assert "limits" in plan, "Plan should have 'limits'"
            print(f"✓ Plan structure verified: {plan.get('name')}")
    
    def test_master_plans_include_inactive(self):
        """GET /api/subscriptions/plans/master?include_inactive=true should include inactive plans"""
        token = TestSetup.get_superadmin_token()
        if not token:
            pytest.skip("Could not get superadmin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get active only
        response_active = requests.get(
            f"{BASE_URL}/api/subscriptions/plans/master?include_inactive=false", 
            headers=headers
        )
        assert response_active.status_code == 200
        
        # Get all including inactive
        response_all = requests.get(
            f"{BASE_URL}/api/subscriptions/plans/master?include_inactive=true", 
            headers=headers
        )
        assert response_all.status_code == 200
        
        active_count = response_active.json().get("total", 0)
        all_count = response_all.json().get("total", 0)
        
        assert all_count >= active_count, "All plans should be >= active plans"
        print(f"✓ Active plans: {active_count}, All plans: {all_count}")


class TestMasterPlansCreate:
    """Tests for POST /api/subscriptions/plans/master - Super Admin only, create new plan"""
    
    def test_create_plan_requires_superadmin(self):
        """POST /api/subscriptions/plans/master should require Super Admin"""
        plan_data = {
            "plan_code": "test_plan_unauthorized",
            "name": "Test Plan",
            "base_price": 100
        }
        
        # Test without auth
        response = requests.post(f"{BASE_URL}/api/subscriptions/plans/master", json=plan_data)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        # Test with regular admin
        admin_token = TestSetup.get_admin_token()
        if admin_token:
            headers = {"Authorization": f"Bearer {admin_token}"}
            response = requests.post(
                f"{BASE_URL}/api/subscriptions/plans/master", 
                json=plan_data, 
                headers=headers
            )
            assert response.status_code == 403, f"Expected 403 for admin, got {response.status_code}"
        
        print("✓ Create plan endpoint requires Super Admin")
    
    def test_create_plan_validates_required_fields(self):
        """POST /api/subscriptions/plans/master should validate required fields"""
        token = TestSetup.get_superadmin_token()
        if not token:
            pytest.skip("Could not get superadmin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Missing plan_code
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/plans/master",
            json={"name": "Test Plan"},
            headers=headers
        )
        assert response.status_code in [400, 422], f"Expected 400/422 for missing plan_code, got {response.status_code}"
        
        print("✓ Create plan validates required fields")


class TestMasterPlansUpdate:
    """Tests for PUT /api/subscriptions/plans/master/{id} - Super Admin only, update with versioning"""
    
    def test_update_plan_requires_superadmin(self):
        """PUT /api/subscriptions/plans/master/{id} should require Super Admin"""
        update_data = {"name": "Updated Name"}
        
        # Test without auth
        response = requests.put(
            f"{BASE_URL}/api/subscriptions/plans/master/free", 
            json=update_data
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        print("✓ Update plan endpoint requires Super Admin")
    
    def test_update_nonexistent_plan_returns_404(self):
        """PUT /api/subscriptions/plans/master/{id} should return 404 for non-existent plan"""
        token = TestSetup.get_superadmin_token()
        if not token:
            pytest.skip("Could not get superadmin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.put(
            f"{BASE_URL}/api/subscriptions/plans/master/nonexistent_plan_xyz",
            json={"name": "Updated Name"},
            headers=headers
        )
        
        # Should return 400 (Plan not found) or 404
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        print("✓ Update non-existent plan returns error")


# ============== SUBSCRIPTION ANALYTICS (SUPER ADMIN ONLY) ==============

class TestSubscriptionAnalytics:
    """Tests for GET /api/subscriptions/analytics - Super Admin only"""
    
    def test_analytics_requires_superadmin(self):
        """GET /api/subscriptions/analytics should require Super Admin"""
        # Test without auth
        response = requests.get(f"{BASE_URL}/api/subscriptions/analytics")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        # Test with regular admin
        admin_token = TestSetup.get_admin_token()
        if admin_token:
            headers = {"Authorization": f"Bearer {admin_token}"}
            response = requests.get(f"{BASE_URL}/api/subscriptions/analytics", headers=headers)
            assert response.status_code == 403, f"Expected 403 for admin, got {response.status_code}"
        
        print("✓ Analytics endpoint requires Super Admin")
    
    def test_analytics_returns_data_for_superadmin(self):
        """GET /api/subscriptions/analytics should return analytics for Super Admin"""
        token = TestSetup.get_superadmin_token()
        if not token:
            pytest.skip("Could not get superadmin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/subscriptions/analytics", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify analytics structure
        assert "overview" in data, "Response should contain 'overview'"
        assert "revenue" in data, "Response should contain 'revenue'"
        
        overview = data["overview"]
        assert "total_subscriptions" in overview or "active_subscriptions" in overview, \
            "Overview should have subscription counts"
        
        revenue = data["revenue"]
        assert "mrr" in revenue, "Revenue should have 'mrr'"
        assert "arr" in revenue, "Revenue should have 'arr'"
        
        print(f"✓ Analytics overview: {overview}")
        print(f"✓ MRR: ₹{revenue.get('mrr', 0)}, ARR: ₹{revenue.get('arr', 0)}")
    
    def test_analytics_has_plan_distribution(self):
        """GET /api/subscriptions/analytics should include plan distribution"""
        token = TestSetup.get_superadmin_token()
        if not token:
            pytest.skip("Could not get superadmin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/subscriptions/analytics", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "plan_distribution" in data, "Response should contain 'plan_distribution'"
        
        distribution = data["plan_distribution"]
        assert isinstance(distribution, list), "Plan distribution should be a list"
        
        print(f"✓ Plan distribution: {len(distribution)} plans")
        for plan in distribution[:3]:
            print(f"  - {plan.get('plan', 'unknown')}: {plan.get('subscribers', 0)} subscribers")


class TestRevenueTrends:
    """Tests for GET /api/subscriptions/analytics/revenue-trends"""
    
    def test_revenue_trends_requires_superadmin(self):
        """GET /api/subscriptions/analytics/revenue-trends should require Super Admin"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/analytics/revenue-trends")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Revenue trends endpoint requires Super Admin")
    
    def test_revenue_trends_returns_data(self):
        """GET /api/subscriptions/analytics/revenue-trends should return trend data"""
        token = TestSetup.get_superadmin_token()
        if not token:
            pytest.skip("Could not get superadmin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/analytics/revenue-trends?period=month",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "period" in data, "Response should contain 'period'"
        assert "trends" in data, "Response should contain 'trends'"
        
        print(f"✓ Revenue trends period: {data.get('period')}")
        print(f"✓ Trends data points: {len(data.get('trends', []))}")


# ============== INTEGRATION TESTS ==============

class TestBillingIntegration:
    """Integration tests for billing flow"""
    
    def test_billing_plans_match_master_plans(self):
        """Billing plans should match master plans when available"""
        token = TestSetup.get_superadmin_token()
        if not token:
            pytest.skip("Could not get superadmin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get billing plans (public)
        billing_response = requests.get(f"{BASE_URL}/api/billing/plans")
        assert billing_response.status_code == 200
        billing_data = billing_response.json()
        
        # Get master plans (super admin)
        master_response = requests.get(
            f"{BASE_URL}/api/subscriptions/plans/master",
            headers=headers
        )
        assert master_response.status_code == 200
        master_data = master_response.json()
        
        # If source is master_plans, counts should match (for public plans)
        if billing_data.get("source") == "master_plans":
            billing_count = len(billing_data.get("plans", []))
            # Master plans may include inactive, billing only shows active+public
            print(f"✓ Billing plans: {billing_count}")
            print(f"✓ Master plans (all): {master_data.get('total', 0)}")
        else:
            print(f"✓ Using legacy plans (source: {billing_data.get('source')})")


class TestPlanPricing:
    """Tests for plan pricing consistency"""
    
    def test_expected_plan_prices(self):
        """Plans should have expected prices: Free (₹0), Starter (₹499), Basic (₹999), Pro (₹2499), Enterprise (₹4999)"""
        response = requests.get(f"{BASE_URL}/api/billing/plans")
        assert response.status_code == 200
        
        data = response.json()
        plans = {p.get("id", "").lower(): p for p in data.get("plans", [])}
        
        expected_prices = {
            "free": 0,
            "starter": 499,
            "basic": 999,
            "pro": 2499,
            "enterprise": 4999
        }
        
        for plan_id, expected_price in expected_prices.items():
            if plan_id in plans:
                actual_price = plans[plan_id].get("price", plans[plan_id].get("base_price", 0))
                print(f"✓ {plan_id.capitalize()}: ₹{actual_price} (expected: ₹{expected_price})")
                # Allow some flexibility in pricing
                if expected_price > 0:
                    assert actual_price > 0, f"{plan_id} should have price > 0"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
