"""
Permission Enforcement Security Tests

This test suite validates that the security bug fix for role-based permissions
is working correctly. The fix ensures:
1. Users WITHOUT specific permissions get 403 Forbidden on protected routes
2. Superadmin bypasses ALL permission checks (god mode)
3. Users with specific permissions can only access granted routes

Test credentials:
- superadmin@bijnisbooks.com / SuperAdmin@123 - ALL permissions (bypasses checks)
- admin@test.com / Test@123 - Limited permissions: dashboard, items only
- user@test.com / Test@123 - NO permissions (should get 403 everywhere)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_CREDS = {"email": "superadmin@bijnisbooks.com", "password": "SuperAdmin@123"}
ADMIN_LIMITED_CREDS = {"email": "admin@test.com", "password": "Test@123"}
USER_NO_PERMS_CREDS = {"email": "user@test.com", "password": "Test@123"}


def get_auth_token(email: str, password: str) -> str:
    """Helper to get auth token for a user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


def get_user_info(token: str) -> dict:
    """Get user info to verify permissions"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
    if response.status_code == 200:
        return response.json()
    return {}


class TestAuthSetup:
    """Verify test users exist and can authenticate"""
    
    def test_superadmin_login(self):
        """Superadmin can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=SUPERADMIN_CREDS
        )
        print(f"Superadmin login status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")
        assert response.status_code == 200, "Superadmin should be able to login"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "superadmin"
        print(f"Superadmin user: {data['user'].get('email')}, role: {data['user'].get('role')}")
    
    def test_admin_limited_login(self):
        """Admin with limited permissions can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_LIMITED_CREDS
        )
        print(f"Admin login status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")
            pytest.skip("Admin user admin@test.com doesn't exist - needs to be seeded")
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"Admin user: {data['user'].get('email')}, role: {data['user'].get('role')}")
        print(f"Admin permissions: {data['user'].get('permissions', [])}")
    
    def test_user_no_perms_login(self):
        """User with no permissions can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=USER_NO_PERMS_CREDS
        )
        print(f"User login status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")
            pytest.skip("User user@test.com doesn't exist - needs to be seeded")
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"User: {data['user'].get('email')}, role: {data['user'].get('role')}")
        print(f"User permissions: {data['user'].get('permissions', [])}")


class TestSuperadminBypass:
    """Test that superadmin bypasses ALL permission checks (god mode)"""
    
    @pytest.fixture
    def superadmin_token(self):
        token = get_auth_token(**SUPERADMIN_CREDS)
        if not token:
            pytest.skip("Superadmin login failed")
        return token
    
    def test_superadmin_access_dashboard(self, superadmin_token):
        """Superadmin can access dashboard stats"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        print(f"Dashboard access: {response.status_code}")
        assert response.status_code == 200, f"Superadmin should access dashboard: {response.text}"
    
    def test_superadmin_access_items(self, superadmin_token):
        """Superadmin can access items"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/items", headers=headers)
        print(f"Items access: {response.status_code}")
        assert response.status_code == 200, f"Superadmin should access items: {response.text}"
    
    def test_superadmin_access_customers(self, superadmin_token):
        """Superadmin can access customers"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/customers", headers=headers)
        print(f"Customers access: {response.status_code}")
        assert response.status_code == 200, f"Superadmin should access customers: {response.text}"
    
    def test_superadmin_access_inventory(self, superadmin_token):
        """Superadmin can access inventory"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        print(f"Inventory access: {response.status_code}")
        assert response.status_code == 200, f"Superadmin should access inventory: {response.text}"
    
    def test_superadmin_access_employees(self, superadmin_token):
        """Superadmin can access employees"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/employees", headers=headers)
        print(f"Employees access: {response.status_code}")
        assert response.status_code == 200, f"Superadmin should access employees: {response.text}"
    
    def test_superadmin_access_ai_agent(self, superadmin_token):
        """Superadmin can access AI agent dashboard"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/ai-agent/dashboard", headers=headers)
        print(f"AI Agent access: {response.status_code}")
        assert response.status_code == 200, f"Superadmin should access AI agent: {response.text}"


class TestPermissionDenied:
    """Test that users WITHOUT permissions get 403 Forbidden"""
    
    @pytest.fixture
    def user_no_perms_token(self):
        token = get_auth_token(**USER_NO_PERMS_CREDS)
        if not token:
            pytest.skip("User with no permissions login failed - needs to be seeded")
        return token
    
    def test_user_denied_dashboard(self, user_no_perms_token):
        """User without 'dashboard' permission gets 403 on /api/dashboard/stats"""
        headers = {"Authorization": f"Bearer {user_no_perms_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        print(f"Dashboard denied test - Status: {response.status_code}")
        print(f"Response: {response.text[:200] if response.text else 'empty'}")
        # Should be 403 Forbidden since user has no permissions
        assert response.status_code == 403, f"User without permissions should get 403, got {response.status_code}"
    
    def test_user_denied_items(self, user_no_perms_token):
        """User without 'items' permission gets 403 on /api/items"""
        headers = {"Authorization": f"Bearer {user_no_perms_token}"}
        response = requests.get(f"{BASE_URL}/api/items", headers=headers)
        print(f"Items denied test - Status: {response.status_code}")
        assert response.status_code == 403, f"User without permissions should get 403, got {response.status_code}"
    
    def test_user_denied_customers(self, user_no_perms_token):
        """User without 'customers' permission gets 403 on /api/customers"""
        headers = {"Authorization": f"Bearer {user_no_perms_token}"}
        response = requests.get(f"{BASE_URL}/api/customers", headers=headers)
        print(f"Customers denied test - Status: {response.status_code}")
        assert response.status_code == 403, f"User without permissions should get 403, got {response.status_code}"
    
    def test_user_denied_inventory(self, user_no_perms_token):
        """User without 'inventory' permission gets 403 on /api/inventory"""
        headers = {"Authorization": f"Bearer {user_no_perms_token}"}
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        print(f"Inventory denied test - Status: {response.status_code}")
        assert response.status_code == 403, f"User without permissions should get 403, got {response.status_code}"
    
    def test_user_denied_employees(self, user_no_perms_token):
        """User without 'employees' permission gets 403 on /api/employees"""
        headers = {"Authorization": f"Bearer {user_no_perms_token}"}
        response = requests.get(f"{BASE_URL}/api/employees", headers=headers)
        print(f"Employees denied test - Status: {response.status_code}")
        assert response.status_code == 403, f"User without permissions should get 403, got {response.status_code}"
    
    def test_user_denied_ai_agent(self, user_no_perms_token):
        """User without 'ai_agent' permission gets 403 on /api/ai-agent/dashboard"""
        headers = {"Authorization": f"Bearer {user_no_perms_token}"}
        response = requests.get(f"{BASE_URL}/api/ai-agent/dashboard", headers=headers)
        print(f"AI Agent denied test - Status: {response.status_code}")
        assert response.status_code == 403, f"User without permissions should get 403, got {response.status_code}"


class TestLimitedPermissions:
    """Test that user with limited permissions can only access granted routes"""
    
    @pytest.fixture
    def admin_token(self):
        token = get_auth_token(**ADMIN_LIMITED_CREDS)
        if not token:
            pytest.skip("Admin with limited permissions login failed - needs to be seeded")
        return token
    
    @pytest.fixture
    def admin_permissions(self, admin_token):
        """Get admin's actual permissions"""
        user_info = get_user_info(admin_token)
        return user_info.get("permissions", [])
    
    def test_admin_access_dashboard_if_permitted(self, admin_token, admin_permissions):
        """Admin with 'dashboard' permission can access dashboard"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        print(f"Admin dashboard test - Status: {response.status_code}")
        print(f"Admin permissions: {admin_permissions}")
        
        if "dashboard" in admin_permissions:
            assert response.status_code == 200, f"Admin with 'dashboard' permission should access dashboard: {response.text}"
        else:
            assert response.status_code == 403, f"Admin without 'dashboard' permission should get 403: {response.text}"
    
    def test_admin_access_items_if_permitted(self, admin_token, admin_permissions):
        """Admin with 'items' permission can access items"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/items", headers=headers)
        print(f"Admin items test - Status: {response.status_code}")
        print(f"Admin permissions: {admin_permissions}")
        
        if "items" in admin_permissions:
            assert response.status_code == 200, f"Admin with 'items' permission should access items: {response.text}"
        else:
            assert response.status_code == 403, f"Admin without 'items' permission should get 403: {response.text}"
    
    def test_admin_denied_customers_if_not_permitted(self, admin_token, admin_permissions):
        """Admin without 'customers' permission gets 403 on /api/customers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/customers", headers=headers)
        print(f"Admin customers test - Status: {response.status_code}")
        print(f"Admin permissions: {admin_permissions}")
        
        if "customers" in admin_permissions:
            assert response.status_code == 200, f"Admin with 'customers' permission should access: {response.text}"
        else:
            assert response.status_code == 403, f"Admin without 'customers' permission should get 403: {response.text}"
    
    def test_admin_denied_inventory_if_not_permitted(self, admin_token, admin_permissions):
        """Admin without 'inventory' permission gets 403 on /api/inventory"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        print(f"Admin inventory test - Status: {response.status_code}")
        print(f"Admin permissions: {admin_permissions}")
        
        if "inventory" in admin_permissions:
            assert response.status_code == 200, f"Admin with 'inventory' permission should access: {response.text}"
        else:
            assert response.status_code == 403, f"Admin without 'inventory' permission should get 403: {response.text}"


class TestAuthRequired:
    """Test that protected endpoints require authentication"""
    
    def test_dashboard_requires_auth(self):
        """Dashboard endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        print(f"Dashboard no auth test - Status: {response.status_code}")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_items_requires_auth(self):
        """Items endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/items")
        print(f"Items no auth test - Status: {response.status_code}")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_customers_requires_auth(self):
        """Customers endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/customers")
        print(f"Customers no auth test - Status: {response.status_code}")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_inventory_requires_auth(self):
        """Inventory endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/inventory")
        print(f"Inventory no auth test - Status: {response.status_code}")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"


# Additional edge case tests
class TestPermissionEdgeCases:
    """Edge case tests for permission enforcement"""
    
    def test_invalid_token_denied(self):
        """Invalid token should be denied"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        print(f"Invalid token test - Status: {response.status_code}")
        assert response.status_code == 401, f"Invalid token should get 401, got {response.status_code}"
    
    def test_expired_token_like_denied(self):
        """Expired-like token should be denied"""
        # A valid JWT structure but with wrong signature
        fake_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        headers = {"Authorization": f"Bearer {fake_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        print(f"Fake token test - Status: {response.status_code}")
        assert response.status_code == 401, f"Fake token should get 401, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
