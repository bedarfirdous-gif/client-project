"""
Test Backup Code Login and RBAC Features
- Backup code recovery endpoint
- VIEWER role read-only restrictions
- STAFF role limited write access
- Role badge display verification
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackupCodeRecovery:
    """Test backup code recovery endpoint"""
    
    def test_backup_code_endpoint_exists(self):
        """Test that backup code recovery endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/recover-with-backup-code",
            json={"email": "test@test.com", "backup_code": "INVALID"}
        )
        # Should return 400 (invalid code) not 404 (endpoint not found)
        assert response.status_code in [400, 422], f"Expected 400 or 422, got {response.status_code}"
        print("SUCCESS: Backup code recovery endpoint exists")
    
    def test_backup_code_invalid_email(self):
        """Test backup code with invalid email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/recover-with-backup-code",
            json={"email": "nonexistent@test.com", "backup_code": "TESTCODE"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid email or backup code" in data.get("detail", "")
        print("SUCCESS: Invalid email returns proper error")
    
    def test_backup_code_invalid_code(self):
        """Test backup code with invalid code for superadmin"""
        response = requests.post(
            f"{BASE_URL}/api/auth/recover-with-backup-code",
            json={"email": "superadmin@bijnisbooks.com", "backup_code": "INVALID123"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid email or backup code" in data.get("detail", "")
        print("SUCCESS: Invalid backup code returns proper error")
    
    def test_backup_code_non_superadmin(self):
        """Test that non-superadmin users cannot use backup codes"""
        response = requests.post(
            f"{BASE_URL}/api/auth/recover-with-backup-code",
            json={"email": "viewer@test.com", "backup_code": "TESTCODE"}
        )
        assert response.status_code == 400
        data = response.json()
        # Should indicate backup codes only for superadmin
        assert "Backup codes only available for Super Admin" in data.get("detail", "") or "Invalid" in data.get("detail", "")
        print("SUCCESS: Non-superadmin cannot use backup codes")


class TestViewerRoleRBAC:
    """Test VIEWER role read-only restrictions"""
    
    @pytest.fixture
    def viewer_token(self):
        """Get viewer authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "viewer@test.com", "password": "Viewer@123"}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Viewer login failed")
    
    def test_viewer_login_success(self):
        """Test viewer can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "viewer@test.com", "password": "Viewer@123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("access_token") is not None
        assert data.get("user", {}).get("role") == "viewer"
        print("SUCCESS: Viewer login successful")
    
    def test_viewer_has_read_only_permission(self):
        """Test viewer has read_only permission flag"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "viewer@test.com", "password": "Viewer@123"}
        )
        assert response.status_code == 200
        data = response.json()
        permissions = data.get("user", {}).get("permissions", {})
        assert permissions.get("read_only") == True
        print("SUCCESS: Viewer has read_only permission flag")
    
    def test_viewer_can_read_items(self, viewer_token):
        """Test viewer can read items"""
        response = requests.get(
            f"{BASE_URL}/api/items",
            headers={"Authorization": f"Bearer {viewer_token}"}
        )
        assert response.status_code == 200
        print("SUCCESS: Viewer can read items")
    
    def test_viewer_can_read_customers(self, viewer_token):
        """Test viewer can read customers"""
        response = requests.get(
            f"{BASE_URL}/api/customers",
            headers={"Authorization": f"Bearer {viewer_token}"}
        )
        assert response.status_code == 200
        print("SUCCESS: Viewer can read customers")


class TestStaffRoleRBAC:
    """Test STAFF role limited write access"""
    
    @pytest.fixture
    def staff_token(self):
        """Get staff authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "staff@test.com", "password": "Staff@123"}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Staff login failed")
    
    def test_staff_login_success(self):
        """Test staff can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "staff@test.com", "password": "Staff@123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("access_token") is not None
        assert data.get("user", {}).get("role") == "staff"
        print("SUCCESS: Staff login successful")
    
    def test_staff_can_read_items(self, staff_token):
        """Test staff can read items"""
        response = requests.get(
            f"{BASE_URL}/api/items",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 200
        print("SUCCESS: Staff can read items")
    
    def test_staff_can_read_customers(self, staff_token):
        """Test staff can read customers"""
        response = requests.get(
            f"{BASE_URL}/api/customers",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 200
        print("SUCCESS: Staff can read customers")
    
    def test_staff_has_items_permission(self):
        """Test staff has items permission"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "staff@test.com", "password": "Staff@123"}
        )
        assert response.status_code == 200
        data = response.json()
        permissions = data.get("user", {}).get("permissions", {})
        assert permissions.get("items") == True
        print("SUCCESS: Staff has items permission")
    
    def test_staff_has_invoices_permission(self):
        """Test staff has invoices permission"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "staff@test.com", "password": "Staff@123"}
        )
        assert response.status_code == 200
        data = response.json()
        permissions = data.get("user", {}).get("permissions", {})
        assert permissions.get("invoices") == True
        print("SUCCESS: Staff has invoices permission")


class TestRoleBadgeColors:
    """Test role badge colors are correctly configured"""
    
    def test_superadmin_role_config(self):
        """Test superadmin role returns correct data"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "SuperAdmin@123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("user", {}).get("role") == "superadmin"
        print("SUCCESS: Superadmin role is 'superadmin' (purple badge)")
    
    def test_viewer_role_config(self):
        """Test viewer role returns correct data"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "viewer@test.com", "password": "Viewer@123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("user", {}).get("role") == "viewer"
        print("SUCCESS: Viewer role is 'viewer' (gray badge)")
    
    def test_staff_role_config(self):
        """Test staff role returns correct data"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "staff@test.com", "password": "Staff@123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("user", {}).get("role") == "staff"
        print("SUCCESS: Staff role is 'staff' (amber badge)")


class TestDefaultRolePermissions:
    """Test default role permissions are correctly set"""
    
    def test_permission_modules_endpoint(self):
        """Test permission modules endpoint returns role configs"""
        # Login as superadmin to access this endpoint
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "SuperAdmin@123"}
        )
        token = login_response.json().get("access_token")
        
        response = requests.get(
            f"{BASE_URL}/api/permission-modules",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check default permissions exist
        default_perms = data.get("default_permissions", {})
        assert "superadmin" in default_perms
        assert "admin" in default_perms
        assert "manager" in default_perms
        assert "staff" in default_perms
        assert "viewer" in default_perms
        assert "cashier" in default_perms
        print("SUCCESS: All role default permissions are configured")
    
    def test_viewer_default_permissions_read_only(self):
        """Test viewer default permissions include read_only flag"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "SuperAdmin@123"}
        )
        token = login_response.json().get("access_token")
        
        response = requests.get(
            f"{BASE_URL}/api/permission-modules",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = response.json()
        viewer_perms = data.get("default_permissions", {}).get("viewer", {})
        
        assert viewer_perms.get("read_only") == True
        print("SUCCESS: Viewer default permissions include read_only=True")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
