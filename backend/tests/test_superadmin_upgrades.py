"""
Test Super Admin Upgrades Tab Feature
Tests the GET /api/superadmin/admins-needing-upgrades endpoint
and PUT /api/superadmin/admins/{admin_id}/plan endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSuperAdminUpgradesFeature:
    """Tests for the Super Admin Upgrades tab feature"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get regular admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        """Get super admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "SuperAdmin@123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Super Admin login failed")
    
    @pytest.fixture(scope="class")
    def superadmin_session(self, superadmin_token):
        """Requests session with super admin auth"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {superadmin_token}",
            "Content-Type": "application/json"
        })
        return session
    
    @pytest.fixture(scope="class")
    def admin_session(self, admin_token):
        """Requests session with admin auth"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        })
        return session
    
    # ======================
    # Authentication Tests
    # ======================
    
    def test_admins_needing_upgrades_requires_auth(self):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/superadmin/admins-needing-upgrades")
        assert response.status_code == 403, f"Expected 403 for unauthenticated request, got {response.status_code}"
        print("PASS: Endpoint requires authentication")
    
    def test_admins_needing_upgrades_requires_superadmin(self, admin_session):
        """Test that endpoint requires superadmin role"""
        response = admin_session.get(f"{BASE_URL}/api/superadmin/admins-needing-upgrades")
        assert response.status_code == 403, f"Expected 403 for regular admin, got {response.status_code}"
        print("PASS: Endpoint requires superadmin role")
    
    # ======================
    # API Response Structure Tests
    # ======================
    
    def test_admins_needing_upgrades_returns_200(self, superadmin_session):
        """Test that endpoint returns 200 for superadmin"""
        response = superadmin_session.get(f"{BASE_URL}/api/superadmin/admins-needing-upgrades")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Endpoint returns 200 for superadmin")
    
    def test_response_has_summary_structure(self, superadmin_session):
        """Test that response has correct summary structure"""
        response = superadmin_session.get(f"{BASE_URL}/api/superadmin/admins-needing-upgrades")
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data, "Response missing 'summary' field"
        
        summary = data["summary"]
        assert "total_needing_upgrade" in summary, "Summary missing 'total_needing_upgrade'"
        assert "critical" in summary, "Summary missing 'critical' count"
        assert "warning" in summary, "Summary missing 'warning' count"
        assert "potential_monthly_revenue" in summary, "Summary missing 'potential_monthly_revenue'"
        
        # Verify types
        assert isinstance(summary["total_needing_upgrade"], int), "total_needing_upgrade should be int"
        assert isinstance(summary["critical"], int), "critical should be int"
        assert isinstance(summary["warning"], int), "warning should be int"
        assert isinstance(summary["potential_monthly_revenue"], (int, float)), "potential_monthly_revenue should be numeric"
        
        print(f"PASS: Response has correct summary structure")
        print(f"  - Total needing upgrade: {summary['total_needing_upgrade']}")
        print(f"  - Critical: {summary['critical']}")
        print(f"  - Warning: {summary['warning']}")
        print(f"  - Potential revenue: {summary['potential_monthly_revenue']}")
    
    def test_response_has_admins_list(self, superadmin_session):
        """Test that response has admins list"""
        response = superadmin_session.get(f"{BASE_URL}/api/superadmin/admins-needing-upgrades")
        assert response.status_code == 200
        
        data = response.json()
        assert "admins" in data, "Response missing 'admins' field"
        assert isinstance(data["admins"], list), "admins should be a list"
        print(f"PASS: Response has admins list with {len(data['admins'])} entries")
    
    def test_admin_entry_structure(self, superadmin_session):
        """Test that each admin entry has correct structure"""
        response = superadmin_session.get(f"{BASE_URL}/api/superadmin/admins-needing-upgrades")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["admins"]) == 0:
            pytest.skip("No admins needing upgrade to test structure")
        
        admin = data["admins"][0]
        
        # Required fields
        required_fields = [
            "admin_id", "admin_name", "admin_email", "business_name",
            "current_plan", "current_plan_name", "recommended_plan",
            "recommended_plan_name", "exceeded_count", "warning_count",
            "usage_alerts", "urgency"
        ]
        
        for field in required_fields:
            assert field in admin, f"Admin entry missing '{field}' field"
        
        # Verify urgency is valid
        assert admin["urgency"] in ["critical", "warning"], f"Invalid urgency: {admin['urgency']}"
        
        # Verify usage_alerts is a list
        assert isinstance(admin["usage_alerts"], list), "usage_alerts should be a list"
        
        print(f"PASS: Admin entry has correct structure")
        print(f"  - Admin: {admin['admin_name']} ({admin['admin_email']})")
        print(f"  - Current plan: {admin['current_plan_name']}")
        print(f"  - Recommended: {admin['recommended_plan_name']}")
        print(f"  - Urgency: {admin['urgency']}")
    
    def test_usage_alert_structure(self, superadmin_session):
        """Test that usage alerts have correct structure"""
        response = superadmin_session.get(f"{BASE_URL}/api/superadmin/admins-needing-upgrades")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["admins"]) == 0:
            pytest.skip("No admins needing upgrade to test")
        
        admin = data["admins"][0]
        if len(admin["usage_alerts"]) == 0:
            pytest.skip("No usage alerts to test")
        
        alert = admin["usage_alerts"][0]
        
        required_alert_fields = ["metric", "current", "limit", "percentage", "status"]
        for field in required_alert_fields:
            assert field in alert, f"Usage alert missing '{field}' field"
        
        # Verify status is valid
        assert alert["status"] in ["exceeded", "warning"], f"Invalid alert status: {alert['status']}"
        
        print(f"PASS: Usage alert has correct structure")
        print(f"  - Metric: {alert['metric']}")
        print(f"  - Current: {alert['current']} / Limit: {alert['limit']}")
        print(f"  - Percentage: {alert['percentage']}%")
        print(f"  - Status: {alert['status']}")
    
    # ======================
    # Summary Calculation Tests
    # ======================
    
    def test_summary_counts_match_admin_list(self, superadmin_session):
        """Test that summary counts match the actual admin list"""
        response = superadmin_session.get(f"{BASE_URL}/api/superadmin/admins-needing-upgrades")
        assert response.status_code == 200
        
        data = response.json()
        summary = data["summary"]
        admins = data["admins"]
        
        # Verify total matches
        assert summary["total_needing_upgrade"] == len(admins), \
            f"Total ({summary['total_needing_upgrade']}) doesn't match admin list length ({len(admins)})"
        
        # Verify critical count
        critical_in_list = len([a for a in admins if a["urgency"] == "critical"])
        assert summary["critical"] == critical_in_list, \
            f"Critical count ({summary['critical']}) doesn't match list ({critical_in_list})"
        
        # Verify warning count
        warning_in_list = len([a for a in admins if a["urgency"] == "warning"])
        assert summary["warning"] == warning_in_list, \
            f"Warning count ({summary['warning']}) doesn't match list ({warning_in_list})"
        
        print(f"PASS: Summary counts match admin list")
        print(f"  - Total: {summary['total_needing_upgrade']}")
        print(f"  - Critical: {summary['critical']}")
        print(f"  - Warning: {summary['warning']}")
    
    def test_potential_revenue_is_non_negative(self, superadmin_session):
        """Test that potential revenue is non-negative"""
        response = superadmin_session.get(f"{BASE_URL}/api/superadmin/admins-needing-upgrades")
        assert response.status_code == 200
        
        data = response.json()
        revenue = data["summary"]["potential_monthly_revenue"]
        
        assert revenue >= 0, f"Potential revenue should be non-negative, got {revenue}"
        print(f"PASS: Potential monthly revenue: {revenue}")
    
    # ======================
    # Plan Change Tests
    # ======================
    
    def test_change_plan_requires_superadmin(self, admin_session):
        """Test that plan change requires superadmin role"""
        # Using a fake admin_id
        response = admin_session.put(
            f"{BASE_URL}/api/superadmin/admins/fake-admin-id/plan",
            json={"plan_id": "basic"}
        )
        assert response.status_code == 403, f"Expected 403 for regular admin, got {response.status_code}"
        print("PASS: Plan change requires superadmin role")
    
    def test_change_plan_validates_plan_id(self, superadmin_session):
        """Test that plan change validates plan_id"""
        # Get an admin from the list first
        response = superadmin_session.get(f"{BASE_URL}/api/superadmin/admins?limit=1")
        if response.status_code != 200 or not response.json().get("admins"):
            pytest.skip("No admins to test plan change")
        
        admin_id = response.json()["admins"][0]["id"]
        
        # Try invalid plan
        response = superadmin_session.put(
            f"{BASE_URL}/api/superadmin/admins/{admin_id}/plan",
            json={"plan_id": "invalid_plan"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid plan, got {response.status_code}"
        print("PASS: Plan change validates plan_id")
    
    def test_change_plan_returns_404_for_unknown_admin(self, superadmin_session):
        """Test that plan change returns 404 for unknown admin"""
        response = superadmin_session.put(
            f"{BASE_URL}/api/superadmin/admins/nonexistent-admin-id/plan",
            json={"plan_id": "basic"}
        )
        assert response.status_code == 404, f"Expected 404 for unknown admin, got {response.status_code}"
        print("PASS: Plan change returns 404 for unknown admin")
    
    # ======================
    # Integration with Dashboard
    # ======================
    
    def test_superadmin_dashboard_accessible(self, superadmin_session):
        """Test that superadmin dashboard is accessible"""
        response = superadmin_session.get(f"{BASE_URL}/api/superadmin/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Superadmin dashboard accessible")
    
    def test_billing_plans_endpoint(self, superadmin_session):
        """Test that billing plans endpoint returns all plans"""
        response = superadmin_session.get(f"{BASE_URL}/api/billing/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "plans" in data, "Response missing 'plans'"
        
        plan_ids = [p["id"] for p in data["plans"]]
        assert "free" in plan_ids, "Missing 'free' plan"
        assert "basic" in plan_ids, "Missing 'basic' plan"
        assert "pro" in plan_ids, "Missing 'pro' plan"
        assert "enterprise" in plan_ids, "Missing 'enterprise' plan"
        
        print(f"PASS: Billing plans endpoint returns {len(data['plans'])} plans")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
