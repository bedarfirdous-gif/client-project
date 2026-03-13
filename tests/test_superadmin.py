"""
Super Admin System Tests
Tests for multi-tenant Super Admin features including:
- Super Admin login authentication
- Dashboard with global stats
- Admin management (CRUD)
- Impersonation feature
- Market analytics
- Audit log
- RBAC enforcement (regular admins cannot access superadmin endpoints)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from requirements
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"
ADMIN_EMAIL = "demo@brandmafia.com"
ADMIN_PASSWORD = "demo123"


class TestSuperAdminAuthentication:
    """Test Super Admin login and authentication"""
    
    def test_superadmin_login_success(self):
        """Test Super Admin can login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == SUPERADMIN_EMAIL
        assert data["user"]["role"] == "superadmin"
        print(f"SUCCESS: Super Admin login - role={data['user']['role']}")
        
    def test_superadmin_login_invalid_password(self):
        """Test Super Admin login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": "WrongPassword123"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Invalid password rejected with 401")
    
    def test_regular_admin_login_success(self):
        """Test regular admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "admin"
        print(f"SUCCESS: Regular Admin login - role={data['user']['role']}")


class TestSuperAdminDashboard:
    """Test Super Admin Dashboard endpoint"""
    
    @pytest.fixture
    def superadmin_token(self):
        """Get Super Admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super Admin login failed")
    
    def test_dashboard_loads_with_global_stats(self, superadmin_token):
        """Test Super Admin dashboard returns all global stats"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/superadmin/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Validate summary structure with all required stats
        assert "summary" in data, "No summary in dashboard response"
        summary = data["summary"]
        
        required_stats = ["total_admins", "active_admins", "total_customers", 
                         "total_sales", "total_orders", "total_stores"]
        for stat in required_stats:
            assert stat in summary, f"Missing stat: {stat}"
            print(f"  {stat}: {summary[stat]}")
        
        # Validate tenants and recent_admins
        assert "tenants" in data, "No tenants in response"
        assert "recent_admins" in data, "No recent_admins in response"
        
        print(f"SUCCESS: Dashboard loaded with {len(data['tenants'])} tenants, {len(data['recent_admins'])} recent admins")


class TestAdminManagement:
    """Test Admin CRUD operations"""
    
    @pytest.fixture
    def superadmin_token(self):
        """Get Super Admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super Admin login failed")
    
    def test_list_admins(self, superadmin_token):
        """Test listing all admins with search and filter"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        # Test basic listing
        response = requests.get(f"{BASE_URL}/api/superadmin/admins?limit=100", headers=headers)
        assert response.status_code == 200, f"List admins failed: {response.text}"
        
        data = response.json()
        assert "admins" in data, "No admins array in response"
        assert "total" in data, "No total count in response"
        
        print(f"SUCCESS: Listed {len(data['admins'])} admins (total: {data['total']})")
        
        # Test search filter
        response = requests.get(f"{BASE_URL}/api/superadmin/admins?search=demo", headers=headers)
        assert response.status_code == 200
        
        # Test status filter
        response = requests.get(f"{BASE_URL}/api/superadmin/admins?status=active", headers=headers)
        assert response.status_code == 200
        print("SUCCESS: Search and status filters work")
    
    def test_create_admin(self, superadmin_token):
        """Test creating a new admin"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        import uuid
        unique_suffix = uuid.uuid4().hex[:6]
        
        admin_data = {
            "email": f"test_admin_{unique_suffix}@test.com",
            "password": "TestPassword123",
            "name": f"TEST Admin {unique_suffix}",
            "business_name": f"TEST Business {unique_suffix}",
            "business_type": "retail",
            "phone": "+91 9876543210",
            "address": "Test Address",
            "plan": "free"
        }
        
        response = requests.post(f"{BASE_URL}/api/superadmin/admins", 
                                headers=headers, json=admin_data)
        
        assert response.status_code == 200, f"Create admin failed: {response.text}"
        data = response.json()
        
        assert "admin" in data, "No admin in response"
        assert data["admin"]["email"] == admin_data["email"].lower()
        assert data["admin"]["role"] == "admin"
        assert "tenant_id" in data, "No tenant_id returned"
        
        print(f"SUCCESS: Created admin - ID: {data['admin']['id']}, Tenant: {data['tenant_id']}")
        
        # Store for cleanup/further tests
        return data["admin"]["id"]
    
    def test_get_admin_details(self, superadmin_token):
        """Test getting single admin details"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        # First get an admin ID
        response = requests.get(f"{BASE_URL}/api/superadmin/admins?limit=1", headers=headers)
        assert response.status_code == 200
        
        admins = response.json().get("admins", [])
        if not admins:
            pytest.skip("No admins to test with")
        
        admin_id = admins[0]["id"]
        
        # Get details
        response = requests.get(f"{BASE_URL}/api/superadmin/admins/{admin_id}", headers=headers)
        assert response.status_code == 200, f"Get admin details failed: {response.text}"
        
        data = response.json()
        assert "admin" in data, "No admin object in response"
        assert "stats" in data, "No stats in response"
        assert "stores" in data, "No stores in response"
        
        print(f"SUCCESS: Got admin details - {data['admin']['name']}, {data['stats']}")
    
    def test_toggle_admin_status(self, superadmin_token):
        """Test activating/deactivating an admin"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        # First create a test admin
        import uuid
        unique_suffix = uuid.uuid4().hex[:6]
        
        admin_data = {
            "email": f"toggle_test_{unique_suffix}@test.com",
            "password": "TestPassword123",
            "name": f"Toggle Test {unique_suffix}",
            "business_name": f"Toggle Business {unique_suffix}",
            "business_type": "retail",
            "plan": "free"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/superadmin/admins", 
                                       headers=headers, json=admin_data)
        if create_response.status_code != 200:
            pytest.skip("Could not create test admin")
        
        admin_id = create_response.json()["admin"]["id"]
        
        # Test deactivation
        response = requests.put(
            f"{BASE_URL}/api/superadmin/admins/{admin_id}/status",
            headers=headers,
            json={"is_active": False}
        )
        
        assert response.status_code == 200, f"Deactivate failed: {response.text}"
        print("SUCCESS: Admin deactivated")
        
        # Test reactivation
        response = requests.put(
            f"{BASE_URL}/api/superadmin/admins/{admin_id}/status",
            headers=headers,
            json={"is_active": True}
        )
        
        assert response.status_code == 200, f"Activate failed: {response.text}"
        print("SUCCESS: Admin reactivated")


class TestImpersonation:
    """Test Super Admin impersonation feature"""
    
    @pytest.fixture
    def superadmin_token(self):
        """Get Super Admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super Admin login failed")
    
    def test_impersonate_admin(self, superadmin_token):
        """Test Super Admin can impersonate a regular admin"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        # Get an admin to impersonate
        response = requests.get(f"{BASE_URL}/api/superadmin/admins?status=active&limit=1", headers=headers)
        assert response.status_code == 200
        
        admins = response.json().get("admins", [])
        if not admins:
            pytest.skip("No active admins to impersonate")
        
        admin_id = admins[0]["id"]
        admin_email = admins[0]["email"]
        
        # Impersonate
        response = requests.post(
            f"{BASE_URL}/api/superadmin/impersonate/{admin_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Impersonation failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data, "No token returned"
        assert "user" in data, "No user data returned"
        assert data["user"]["is_impersonated"] == True, "Missing impersonation flag"
        
        print(f"SUCCESS: Impersonating admin {admin_email}")
        
        # Verify impersonated token works
        impersonated_headers = {"Authorization": f"Bearer {data['access_token']}"}
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=impersonated_headers)
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["role"] == "admin"
        
        print(f"SUCCESS: Impersonated token works - now acting as {me_data['email']}")


class TestMarketAnalytics:
    """Test Market Analytics endpoint"""
    
    @pytest.fixture
    def superadmin_token(self):
        """Get Super Admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super Admin login failed")
    
    def test_market_analytics_month(self, superadmin_token):
        """Test market analytics with month period"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/superadmin/market-analytics?period=month", headers=headers)
        
        assert response.status_code == 200, f"Analytics failed: {response.text}"
        data = response.json()
        
        assert "period" in data, "No period in response"
        assert data["period"] == "month"
        assert "summary" in data, "No summary in response"
        
        summary = data["summary"]
        required_fields = ["total_sales", "total_orders", "new_admins"]
        for field in required_fields:
            assert field in summary, f"Missing {field} in summary"
        
        print(f"SUCCESS: Market analytics - Sales: {summary['total_sales']}, Orders: {summary['total_orders']}")
    
    def test_market_analytics_periods(self, superadmin_token):
        """Test analytics with different periods"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        for period in ["day", "week", "month", "year"]:
            response = requests.get(
                f"{BASE_URL}/api/superadmin/market-analytics?period={period}", 
                headers=headers
            )
            assert response.status_code == 200, f"Analytics failed for period {period}"
            assert response.json()["period"] == period
            print(f"  Period '{period}' - OK")
        
        print("SUCCESS: All analytics periods work")


class TestAuditLog:
    """Test Super Admin Audit Log"""
    
    @pytest.fixture
    def superadmin_token(self):
        """Get Super Admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super Admin login failed")
    
    def test_audit_log(self, superadmin_token):
        """Test fetching audit log"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/superadmin/audit-log?limit=100", headers=headers)
        
        assert response.status_code == 200, f"Audit log failed: {response.text}"
        data = response.json()
        
        assert "logs" in data, "No logs in response"
        assert "total" in data, "No total count"
        
        print(f"SUCCESS: Audit log has {len(data['logs'])} entries (total: {data['total']})")
        
        # Check log structure if we have entries
        if data["logs"]:
            log = data["logs"][0]
            assert "action" in log, "Log missing action"
            assert "timestamp" in log, "Log missing timestamp"
            print(f"  Latest action: {log['action']} at {log['timestamp']}")


class TestRBACEnforcement:
    """Test RBAC - Regular admins CANNOT access super admin endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get regular admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Regular admin login failed")
    
    def test_admin_cannot_access_superadmin_dashboard(self, admin_token):
        """Regular admin should get 403 on superadmin dashboard"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/superadmin/dashboard", headers=headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Regular admin blocked from /api/superadmin/dashboard (403)")
    
    def test_admin_cannot_list_admins(self, admin_token):
        """Regular admin should get 403 on admin list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/superadmin/admins", headers=headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Regular admin blocked from /api/superadmin/admins (403)")
    
    def test_admin_cannot_access_market_analytics(self, admin_token):
        """Regular admin should get 403 on market analytics"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/superadmin/market-analytics", headers=headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Regular admin blocked from /api/superadmin/market-analytics (403)")
    
    def test_admin_cannot_access_audit_log(self, admin_token):
        """Regular admin should get 403 on audit log"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/superadmin/audit-log", headers=headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Regular admin blocked from /api/superadmin/audit-log (403)")
    
    def test_admin_cannot_create_admin(self, admin_token):
        """Regular admin should get 403 when trying to create admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/admins",
            headers=headers,
            json={
                "email": "hacker@test.com",
                "password": "Test123",
                "name": "Hacker",
                "business_name": "Hack Corp"
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Regular admin blocked from creating admins (403)")
    
    def test_admin_cannot_impersonate(self, admin_token):
        """Regular admin should get 403 when trying to impersonate"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/impersonate/some-admin-id",
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Regular admin blocked from impersonation (403)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
