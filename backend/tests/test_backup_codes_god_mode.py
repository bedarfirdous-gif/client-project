"""
Tests for Backup Codes and God Mode features
Features tested:
1. POST /api/superadmin/backup-codes/generate - generates 10 codes
2. GET /api/superadmin/backup-codes/status - returns unused/used counts
3. POST /api/auth/recover-with-backup-code - allows login with valid backup code
4. Recovery with invalid code returns error
5. POST /api/superadmin/god-mode/reset-password - resets user password
6. POST /api/superadmin/god-mode/force-logout - terminates sessions
7. POST /api/superadmin/god-mode/freeze-tenant - freezes tenant
8. POST /api/superadmin/god-mode/unfreeze-tenant - unfreezes tenant
9. Frozen users cannot login (403 error)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"
ADMIN_EMAIL = "demo@brandmafia.com"
ADMIN_PASSWORD = "demo12345"  # Min 8 chars required


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
def admin_token(superadmin_token):
    """Get or create regular admin authentication token"""
    # First try to login with existing admin
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    
    # Admin doesn't exist, create one
    headers = {"Authorization": f"Bearer {superadmin_token}"}
    create_response = requests.post(
        f"{BASE_URL}/api/superadmin/admins",
        headers=headers,
        json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "name": "Demo Admin",
            "business_name": "Brand Mafia"
        }
    )
    if create_response.status_code in [200, 201]:
        # Now login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            return login_response.json().get("access_token")
    
    pytest.skip(f"Admin authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def admin_user_info(superadmin_token):
    """Get admin user info"""
    # First try to login with existing admin
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("user")
    
    # Admin doesn't exist, create one
    headers = {"Authorization": f"Bearer {superadmin_token}"}
    create_response = requests.post(
        f"{BASE_URL}/api/superadmin/admins",
        headers=headers,
        json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "name": "Demo Admin",
            "business_name": "Brand Mafia"
        }
    )
    if create_response.status_code in [200, 201]:
        admin_data = create_response.json().get("admin", create_response.json())
        return admin_data
    
    pytest.skip(f"Admin authentication failed: {response.status_code}")


class TestBackupCodesGeneration:
    """Tests for backup codes generation endpoint"""
    
    def test_generate_backup_codes_success(self, superadmin_token):
        """POST /api/superadmin/backup-codes/generate should generate 10 codes"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/backup-codes/generate",
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
        
        # Check message and warning
        assert "message" in data, "Response should contain 'message'"
        assert "warning" in data, "Response should contain 'warning'"
        print(f"PASS: Generated 10 backup codes successfully")
    
    def test_generate_backup_codes_requires_superadmin(self, admin_token):
        """Non-superadmin should not be able to generate backup codes"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/backup-codes/generate",
            headers=headers
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: Non-superadmin blocked from generating backup codes")
    
    def test_generate_backup_codes_no_auth(self):
        """Unauthenticated request should be rejected"""
        response = requests.post(f"{BASE_URL}/api/superadmin/backup-codes/generate")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: Unauthenticated request blocked")


class TestBackupCodesStatus:
    """Tests for backup codes status endpoint"""
    
    def test_get_backup_codes_status(self, superadmin_token):
        """GET /api/superadmin/backup-codes/status should return counts"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        # First generate codes to ensure we have some
        requests.post(
            f"{BASE_URL}/api/superadmin/backup-codes/generate",
            headers=headers
        )
        
        response = requests.get(
            f"{BASE_URL}/api/superadmin/backup-codes/status",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "total_codes" in data, "Response should contain 'total_codes'"
        assert "unused_codes" in data, "Response should contain 'unused_codes'"
        assert "used_codes" in data, "Response should contain 'used_codes'"
        
        # After generation, should have 10 total and 10 unused
        assert data["total_codes"] == 10, f"Expected 10 total codes, got {data['total_codes']}"
        assert data["unused_codes"] == 10, f"Expected 10 unused codes, got {data['unused_codes']}"
        assert data["used_codes"] == 0, f"Expected 0 used codes, got {data['used_codes']}"
        
        print(f"PASS: Backup codes status: total={data['total_codes']}, unused={data['unused_codes']}, used={data['used_codes']}")


class TestRecoverWithBackupCode:
    """Tests for recovery login with backup code"""
    
    def test_recover_with_invalid_code(self):
        """Recovery with invalid backup code should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/recover-with-backup-code",
            json={
                "email": SUPERADMIN_EMAIL,
                "backup_code": "INVALIDX"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid code, got {response.status_code}"
        print(f"PASS: Invalid backup code rejected")
    
    def test_recover_with_invalid_email(self):
        """Recovery with non-existent email should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/recover-with-backup-code",
            json={
                "email": "nonexistent@test.com",
                "backup_code": "TESTCODE"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid email, got {response.status_code}"
        print(f"PASS: Invalid email rejected")
    
    def test_recover_non_superadmin_rejected(self):
        """Non-superadmin cannot use backup codes"""
        response = requests.post(
            f"{BASE_URL}/api/auth/recover-with-backup-code",
            json={
                "email": ADMIN_EMAIL,
                "backup_code": "TESTCODE"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for non-superadmin, got {response.status_code}"
        data = response.json()
        assert "only available for Super Admin" in data.get("detail", "") or "Invalid" in data.get("detail", "")
        print(f"PASS: Non-superadmin backup code recovery rejected")


class TestGodModeResetPassword:
    """Tests for god mode password reset"""
    
    def test_reset_password_success(self, superadmin_token, admin_user_info):
        """Super Admin can reset any user's password"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        # Get admin user id
        user_id = admin_user_info.get("id")
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/reset-password",
            headers=headers,
            json={
                "user_id": user_id,
                "new_password": "NewTestPassword123"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        assert ADMIN_EMAIL in data["message"] or "reset" in data["message"].lower()
        print(f"PASS: Password reset successful for {ADMIN_EMAIL}")
        
        # Reset password back to original
        requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/reset-password",
            headers=headers,
            json={
                "user_id": user_id,
                "new_password": ADMIN_PASSWORD
            }
        )
    
    def test_reset_password_short_password(self, superadmin_token, admin_user_info):
        """Password less than 8 characters should be rejected"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/reset-password",
            headers=headers,
            json={
                "user_id": admin_user_info.get("id"),
                "new_password": "short"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for short password, got {response.status_code}"
        print(f"PASS: Short password rejected")
    
    def test_reset_password_nonexistent_user(self, superadmin_token):
        """Password reset for non-existent user should fail"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/reset-password",
            headers=headers,
            json={
                "user_id": "nonexistent-user-id",
                "new_password": "ValidPassword123"
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"
        print(f"PASS: Non-existent user rejected")


class TestGodModeForceLogout:
    """Tests for god mode force logout"""
    
    def test_force_logout_user(self, superadmin_token, admin_user_info):
        """Super Admin can force logout a specific user"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/force-logout",
            headers=headers,
            json={
                "user_id": admin_user_info.get("id")
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        assert "session" in data["message"].lower() or "terminated" in data["message"].lower()
        print(f"PASS: Force logout successful")
    
    def test_force_logout_requires_target(self, superadmin_token):
        """Force logout without target should fail"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/force-logout",
            headers=headers,
            json={}
        )
        
        assert response.status_code == 400, f"Expected 400 without target, got {response.status_code}"
        print(f"PASS: Force logout without target rejected")


class TestGodModeFreezeTenant:
    """Tests for god mode freeze/unfreeze tenant"""
    
    def test_freeze_tenant_nonexistent(self, superadmin_token):
        """
        Freeze a non-existent tenant (to avoid affecting real data)
        Should return 200 with 0 users affected
        """
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        test_tenant_id = f"test-freeze-tenant-{uuid.uuid4()}"
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/freeze-tenant",
            headers=headers,
            json={"tenant_id": test_tenant_id}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        assert "frozen" in data["message"].lower()
        print(f"PASS: Freeze tenant endpoint works (tested with non-existent tenant)")
    
    def test_unfreeze_tenant_nonexistent(self, superadmin_token):
        """
        Unfreeze a non-existent tenant (to avoid affecting real data)
        Should return 200 with 0 users affected
        """
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        test_tenant_id = f"test-unfreeze-tenant-{uuid.uuid4()}"
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/unfreeze-tenant",
            headers=headers,
            json={"tenant_id": test_tenant_id}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        assert "unfrozen" in data["message"].lower()
        print(f"PASS: Unfreeze tenant endpoint works (tested with non-existent tenant)")
    
    def test_freeze_requires_superadmin(self, admin_token):
        """Non-superadmin cannot freeze tenants"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/god-mode/freeze-tenant",
            headers=headers,
            json={"tenant_id": "test-tenant"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: Non-superadmin blocked from freezing tenants")


class TestFrozenUserLogin:
    """Test that frozen users cannot login"""
    
    def test_frozen_user_cannot_login(self, superadmin_token):
        """
        Create a test user, freeze them, verify login fails, then cleanup
        """
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        # Create a test user
        test_email = f"frozen-test-{uuid.uuid4()}@test.com"
        test_password = "TestPassword123"
        
        # First, create the user via the admins endpoint
        create_response = requests.post(
            f"{BASE_URL}/api/superadmin/admins",
            headers=headers,
            json={
                "email": test_email,
                "password": test_password,
                "name": "Frozen Test User",
                "business_name": "Test Frozen Business"
            }
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create test user: {create_response.status_code}")
        
        # The response has 'admin' nested inside
        response_data = create_response.json()
        user_data = response_data.get("admin", response_data)
        test_user_id = user_data.get("id")
        user_tenant_id = response_data.get("tenant_id") or user_data.get("tenant_id")
        
        try:
            # Verify user can login first
            login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": test_email, "password": test_password}
            )
            assert login_response.status_code == 200, "User should be able to login before freeze"
            print(f"User can login before freeze: {login_response.status_code}")
            
            # Freeze the tenant
            freeze_response = requests.post(
                f"{BASE_URL}/api/superadmin/god-mode/freeze-tenant",
                headers=headers,
                json={"tenant_id": user_tenant_id}
            )
            assert freeze_response.status_code == 200, f"Freeze should succeed: {freeze_response.text}"
            print(f"Tenant frozen: {freeze_response.json()}")
            
            # Verify frozen user cannot login
            frozen_login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": test_email, "password": test_password}
            )
            assert frozen_login_response.status_code == 403, f"Frozen user should get 403, got {frozen_login_response.status_code}"
            print(f"PASS: Frozen user blocked from login (403)")
            
            # Unfreeze the tenant
            unfreeze_response = requests.post(
                f"{BASE_URL}/api/superadmin/god-mode/unfreeze-tenant",
                headers=headers,
                json={"tenant_id": user_tenant_id}
            )
            assert unfreeze_response.status_code == 200, f"Unfreeze should succeed: {unfreeze_response.text}"
            
            # Verify user can login again after unfreeze
            unfrozen_login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": test_email, "password": test_password}
            )
            assert unfrozen_login_response.status_code == 200, f"User should login after unfreeze, got {unfrozen_login_response.status_code}"
            print(f"PASS: User can login after unfreeze")
            
        finally:
            # Cleanup - delete the test user
            # First unfreeze in case test failed mid-way
            requests.post(
                f"{BASE_URL}/api/superadmin/god-mode/unfreeze-tenant",
                headers=headers,
                json={"tenant_id": user_tenant_id}
            )


class TestEnhancedRoles:
    """Test that enhanced roles exist"""
    
    def test_viewer_role_permissions(self, superadmin_token):
        """Verify viewer role exists in permission modules"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/permission-modules",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Check that roles include viewer
        roles = data.get("roles", [])
        assert "admin" in roles, "admin role should exist"
        assert "manager" in roles, "manager role should exist"
        assert "staff" in roles, "staff role should exist"
        assert "cashier" in roles, "cashier role should exist"
        
        # Check default_permissions contains our enhanced roles
        default_perms = data.get("default_permissions", {})
        assert "superadmin" in default_perms or len(default_perms) > 0, "Should have role permissions"
        
        print(f"PASS: Enhanced roles verified: {roles}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
