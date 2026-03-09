"""
Test Backup Codes for All Users and Enhanced God Mode Features
Features tested:
1. POST /api/users/backup-codes/generate - generates backup codes for any authenticated user
2. GET /api/users/backup-codes/status - returns code count for current user
3. POST /api/auth/recover-with-backup-code - works for staff/viewer users (not just superadmin)
4. POST /api/superadmin/god-mode/impersonate - impersonate any user
5. POST /api/superadmin/god-mode/change-role - change any user's role
6. POST /api/superadmin/god-mode/generate-backup-codes - generate backup codes for any user
7. POST /api/superadmin/god-mode/delete-tenant-data - delete all tenant data
8. GET /api/superadmin/god-mode/system-health - get system health stats
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"
VIEWER_EMAIL = "viewer@test.com"
VIEWER_PASSWORD = "Viewer@123"
STAFF_EMAIL = "staff@test.com"
STAFF_PASSWORD = "Staff@123"


@pytest.fixture(scope="module")
def superadmin_token():
    """Get superadmin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Super Admin authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def viewer_token():
    """Get viewer authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": VIEWER_EMAIL,
        "password": VIEWER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Viewer authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def staff_token():
    """Get staff authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STAFF_EMAIL,
        "password": STAFF_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Staff authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def viewer_user_info():
    """Get viewer user info"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": VIEWER_EMAIL,
        "password": VIEWER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("user")
    pytest.skip(f"Viewer authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def staff_user_info():
    """Get staff user info"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STAFF_EMAIL,
        "password": STAFF_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("user")
    pytest.skip(f"Staff authentication failed: {response.status_code}")


class TestUserBackupCodesGeneration:
    """Tests for backup codes generation for all users (not just superadmin)"""
    
    def test_viewer_can_generate_backup_codes(self, viewer_token):
        """POST /api/users/backup-codes/generate should work for viewer"""
        headers = {"Authorization": f"Bearer {viewer_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/users/backup-codes/generate",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check that 10 codes are returned
        assert "codes" in data, "Response should contain 'codes'"
        assert len(data["codes"]) == 10, f"Expected 10 codes, got {len(data['codes'])}"
        
        # Check code format (8 alphanumeric characters)
        for code in data["codes"]:
            assert len(code) == 8, f"Code should be 8 characters, got {len(code)}"
            assert code.isalnum(), f"Code should be alphanumeric: {code}"
        
        print(f"PASS: Viewer generated 10 backup codes successfully")
    
    def test_staff_can_generate_backup_codes(self, staff_token):
        """POST /api/users/backup-codes/generate should work for staff"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/users/backup-codes/generate",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "codes" in data, "Response should contain 'codes'"
        assert len(data["codes"]) == 10, f"Expected 10 codes, got {len(data['codes'])}"
        
        print(f"PASS: Staff generated 10 backup codes successfully")
    
    def test_unauthenticated_cannot_generate_codes(self):
        """Unauthenticated request should be rejected"""
        response = requests.post(f"{BASE_URL}/api/users/backup-codes/generate")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: Unauthenticated request blocked")


class TestUserBackupCodesStatus:
    """Tests for backup codes status endpoint for all users"""
    
    def test_viewer_can_check_backup_codes_status(self, viewer_token):
        """GET /api/users/backup-codes/status should work for viewer"""
        headers = {"Authorization": f"Bearer {viewer_token}"}
        
        # First generate codes to ensure we have some
        requests.post(
            f"{BASE_URL}/api/users/backup-codes/generate",
            headers=headers
        )
        
        response = requests.get(
            f"{BASE_URL}/api/users/backup-codes/status",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "total_codes" in data, "Response should contain 'total_codes'"
        assert "unused_codes" in data, "Response should contain 'unused_codes'"
        
        print(f"PASS: Viewer backup codes status: total={data['total_codes']}, unused={data['unused_codes']}")
    
    def test_staff_can_check_backup_codes_status(self, staff_token):
        """GET /api/users/backup-codes/status should work for staff"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/users/backup-codes/status",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "total_codes" in data, "Response should contain 'total_codes'"
        
        print(f"PASS: Staff backup codes status: total={data['total_codes']}")


class TestBackupCodeRecoveryAllUsers:
    """Tests for backup code recovery for all users (not just superadmin)"""
    
    def test_viewer_can_recover_with_backup_code(self, viewer_token):
        """Viewer should be able to use backup code for recovery"""
        headers = {"Authorization": f"Bearer {viewer_token}"}
        
        # First generate backup codes for viewer
        gen_response = requests.post(
            f"{BASE_URL}/api/users/backup-codes/generate",
            headers=headers
        )
        
        if gen_response.status_code != 200:
            pytest.skip("Could not generate backup codes for viewer")
        
        codes = gen_response.json().get("codes", [])
        if not codes:
            pytest.skip("No backup codes generated")
        
        # Try to recover with the first code
        recovery_response = requests.post(
            f"{BASE_URL}/api/auth/recover-with-backup-code",
            json={
                "email": VIEWER_EMAIL,
                "backup_code": codes[0]
            }
        )
        
        assert recovery_response.status_code == 200, f"Expected 200, got {recovery_response.status_code}: {recovery_response.text}"
        data = recovery_response.json()
        
        assert "access_token" in data, "Response should contain 'access_token'"
        assert "user" in data, "Response should contain 'user'"
        assert data["user"]["email"] == VIEWER_EMAIL
        
        print(f"PASS: Viewer recovered with backup code successfully")
    
    def test_staff_can_recover_with_backup_code(self, staff_token):
        """Staff should be able to use backup code for recovery"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # First generate backup codes for staff
        gen_response = requests.post(
            f"{BASE_URL}/api/users/backup-codes/generate",
            headers=headers
        )
        
        if gen_response.status_code != 200:
            pytest.skip("Could not generate backup codes for staff")
        
        codes = gen_response.json().get("codes", [])
        if not codes:
            pytest.skip("No backup codes generated")
        
        # Try to recover with the first code
        recovery_response = requests.post(
            f"{BASE_URL}/api/auth/recover-with-backup-code",
            json={
                "email": STAFF_EMAIL,
                "backup_code": codes[0]
            }
        )
        
        assert recovery_response.status_code == 200, f"Expected 200, got {recovery_response.status_code}: {recovery_response.text}"
        data = recovery_response.json()
        
        assert "access_token" in data, "Response should contain 'access_token'"
        assert "remaining_codes" in data, "Response should contain 'remaining_codes'"
        
        print(f"PASS: Staff recovered with backup code successfully, remaining codes: {data['remaining_codes']}")


class TestGodModeImpersonate:
    """Tests for God Mode impersonate action"""
    
    def test_impersonate_user_success(self, superadmin_token, viewer_user_info):
        """Super Admin can impersonate any user"""
        headers = {"Authorization": f"Bearer {superadmin_token}", "Content-Type": "application/json"}
        
        # API expects raw string body for target_user_id
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/impersonate",
            headers=headers,
            data=f'"{viewer_user_info.get("id")}"'
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "access_token" in data, "Response should contain 'access_token'"
        assert "user" in data, "Response should contain 'user'"
        assert data["user"]["email"] == VIEWER_EMAIL
        assert data.get("impersonation") == True
        
        print(f"PASS: Impersonation successful for {VIEWER_EMAIL}")
    
    def test_impersonate_nonexistent_user(self, superadmin_token):
        """Impersonating non-existent user should fail"""
        headers = {"Authorization": f"Bearer {superadmin_token}", "Content-Type": "application/json"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/impersonate",
            headers=headers,
            data='"nonexistent-user-id"'
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASS: Non-existent user impersonation rejected")
    
    def test_impersonate_requires_superadmin(self, viewer_token, staff_user_info):
        """Non-superadmin cannot impersonate"""
        headers = {"Authorization": f"Bearer {viewer_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/impersonate",
            headers=headers,
            json={"target_user_id": staff_user_info.get("id")}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: Non-superadmin blocked from impersonation")


class TestGodModeChangeRole:
    """Tests for God Mode change role action"""
    
    def test_change_role_success(self, superadmin_token, viewer_user_info):
        """Super Admin can change any user's role"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        original_role = viewer_user_info.get("role")
        
        # Change to staff
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/change-role",
            headers=headers,
            json={
                "target_user_id": viewer_user_info.get("id"),
                "new_role": "staff"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        
        print(f"PASS: Role changed from {original_role} to staff")
        
        # Change back to original role
        requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/change-role",
            headers=headers,
            json={
                "target_user_id": viewer_user_info.get("id"),
                "new_role": original_role or "viewer"
            }
        )
    
    def test_change_role_invalid_role(self, superadmin_token, viewer_user_info):
        """Invalid role should be rejected"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/change-role",
            headers=headers,
            json={
                "target_user_id": viewer_user_info.get("id"),
                "new_role": "invalid_role"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"PASS: Invalid role rejected")
    
    def test_change_role_nonexistent_user(self, superadmin_token):
        """Changing role for non-existent user should fail"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/change-role",
            headers=headers,
            json={
                "target_user_id": "nonexistent-user-id",
                "new_role": "staff"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASS: Non-existent user role change rejected")


class TestGodModeGenerateBackupCodes:
    """Tests for God Mode generate backup codes for any user"""
    
    def test_generate_backup_codes_for_user(self, superadmin_token, viewer_user_info):
        """Super Admin can generate backup codes for any user"""
        headers = {"Authorization": f"Bearer {superadmin_token}", "Content-Type": "application/json"}
        
        # API expects raw string body for target_user_id
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/generate-backup-codes",
            headers=headers,
            data=f'"{viewer_user_info.get("id")}"'
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "codes" in data, "Response should contain 'codes'"
        assert len(data["codes"]) == 10, f"Expected 10 codes, got {len(data['codes'])}"
        assert "message" in data
        
        print(f"PASS: Generated backup codes for {VIEWER_EMAIL}")
    
    def test_generate_backup_codes_nonexistent_user(self, superadmin_token):
        """Generating codes for non-existent user should fail"""
        headers = {"Authorization": f"Bearer {superadmin_token}", "Content-Type": "application/json"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/generate-backup-codes",
            headers=headers,
            data='"nonexistent-user-id"'
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASS: Non-existent user backup code generation rejected")


class TestGodModeDeleteTenantData:
    """Tests for God Mode delete tenant data action"""
    
    def test_delete_tenant_data_requires_confirm(self, superadmin_token):
        """Delete tenant data requires confirm=true"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/delete-tenant-data",
            headers=headers,
            json={
                "tenant_id": "test-tenant-to-delete",
                "confirm": False
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"PASS: Delete tenant data requires confirmation")
    
    def test_delete_superadmin_tenant_blocked(self, superadmin_token):
        """Cannot delete superadmin tenant"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/delete-tenant-data",
            headers=headers,
            json={
                "tenant_id": "superadmin",
                "confirm": True
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"PASS: Superadmin tenant deletion blocked")
    
    def test_delete_nonexistent_tenant(self, superadmin_token):
        """Delete non-existent tenant should succeed with 0 deleted"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        test_tenant_id = f"test-delete-{uuid.uuid4()}"
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/delete-tenant-data",
            headers=headers,
            json={
                "tenant_id": test_tenant_id,
                "confirm": True
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "deleted_counts" in data
        
        print(f"PASS: Delete tenant data endpoint works")


class TestGodModeSystemHealth:
    """Tests for God Mode system health endpoint"""
    
    def test_system_health_returns_stats(self, superadmin_token):
        """GET /api/superadmin/god-mode/system-health should return stats"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/superadmin/god-mode/system-health",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check expected fields (based on actual API response)
        assert "users" in data or "total_users" in data, "Response should contain user count"
        assert "tenants" in data or "tenants_count" in data, "Response should contain tenant info"
        assert "items" in data, "Response should contain 'items'"
        assert "sales" in data, "Response should contain 'sales'"
        
        print(f"PASS: System health stats returned: users={data.get('users', data.get('total_users'))}")
    
    def test_system_health_requires_superadmin(self, viewer_token):
        """Non-superadmin cannot access system health"""
        headers = {"Authorization": f"Bearer {viewer_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/superadmin/god-mode/system-health",
            headers=headers
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: Non-superadmin blocked from system health")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
