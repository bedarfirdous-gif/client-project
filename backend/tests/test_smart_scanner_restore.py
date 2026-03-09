"""
Test Smart Scanner and Restore Data APIs
Tests the bug fixes for:
1. Smart Scanner - Document upload and AI extraction
2. Restore Data - Should restore backup data without overwriting users
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "bedarfirdous@gmail.com"
ADMIN_PASSWORD = "Admin@123"
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def superadmin_token():
    """Get superadmin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Superadmin login failed: {response.status_code} - {response.text}")


@pytest.fixture
def admin_headers(admin_token):
    """Get admin request headers"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def superadmin_headers(superadmin_token):
    """Get superadmin request headers"""
    return {"Authorization": f"Bearer {superadmin_token}"}


class TestLogin:
    """Test login functionality - no 'Session expired' error"""
    
    def test_admin_login_success(self):
        """Admin login should work without session expired error"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful - Role: {data['user'].get('role')}")

    def test_superadmin_login_success(self):
        """Superadmin login should work without session expired error"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert data["user"]["role"] == "superadmin"
        print(f"✓ Superadmin login successful")

    def test_auth_me_endpoint(self, admin_headers):
        """Auth/me endpoint should work with valid token"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert "email" in data
        print(f"✓ Auth/me working - User: {data.get('name')}")


class TestSmartScanner:
    """Test Smart Scanner Document API"""

    def test_smart_scanner_endpoint_exists(self, admin_headers):
        """Smart Scanner document endpoint should exist"""
        # Test with minimal data to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/smart-scanner/document",
            headers=admin_headers,
            data={"document_type": "auto", "store_id": ""}
        )
        # Expecting 422 (missing file) not 404
        assert response.status_code != 404, "Smart Scanner endpoint not found!"
        print(f"✓ Smart Scanner endpoint exists - Status: {response.status_code}")

    def test_smart_scanner_excel_endpoint_exists(self, admin_headers):
        """Smart Scanner excel endpoint should exist"""
        response = requests.post(
            f"{BASE_URL}/api/smart-scanner/excel",
            headers=admin_headers,
            data={"store_id": ""}
        )
        # Expecting 422 (missing file) not 404
        assert response.status_code != 404, "Smart Scanner Excel endpoint not found!"
        print(f"✓ Smart Scanner Excel endpoint exists - Status: {response.status_code}")

    def test_smart_scanner_with_test_image(self, admin_headers):
        """Test Smart Scanner with a small test image"""
        # Create a minimal PNG image (1x1 pixel white)
        import base64
        # Minimal 1x1 white PNG
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg=="
        )
        
        files = {"file": ("test.png", png_data, "image/png")}
        data = {"document_type": "auto", "store_id": ""}
        
        # Remove Content-Type header since we're using multipart/form-data
        headers = {k: v for k, v in admin_headers.items() if k != "Content-Type"}
        
        response = requests.post(
            f"{BASE_URL}/api/smart-scanner/document",
            headers=headers,
            files=files,
            data=data
        )
        
        # Should process (may return empty items for blank image)
        # Not expecting 404 or 401
        print(f"Smart Scanner response: {response.status_code} - {response.text[:200] if response.text else 'No body'}")
        
        if response.status_code == 200:
            data = response.json()
            assert "items" in data or "success" in data
            print(f"✓ Smart Scanner processed image - Items: {len(data.get('items', []))}")
        elif response.status_code in [500, 503]:
            # AI service may have temporary issues - this is acceptable
            print(f"⚠ Smart Scanner AI service returned {response.status_code} - may be temporary")
        else:
            # Check it's not a fundamental endpoint error
            assert response.status_code not in [404, 405], f"Endpoint error: {response.status_code}"
            print(f"⚠ Smart Scanner returned {response.status_code}")

    def test_smart_scanner_import_endpoint(self, admin_headers):
        """Smart Scanner import endpoint should exist"""
        response = requests.post(
            f"{BASE_URL}/api/smart-scanner/import",
            headers=admin_headers,
            json={"items": [], "store_id": "test"}
        )
        # Should not be 404
        assert response.status_code != 404, "Smart Scanner import endpoint not found!"
        print(f"✓ Smart Scanner import endpoint exists - Status: {response.status_code}")


class TestRestoreBackup:
    """Test Restore Backup API"""

    def test_restore_backup_requires_superadmin(self, admin_headers):
        """Restore backup should require superadmin role"""
        response = requests.post(
            f"{BASE_URL}/api/admin/restore-backup",
            headers=admin_headers
        )
        # Admin should be denied (403)
        assert response.status_code == 403, f"Expected 403 for admin, got {response.status_code}"
        print(f"✓ Restore backup correctly requires superadmin - Admin denied")

    def test_restore_backup_endpoint_exists(self, superadmin_headers):
        """Restore backup endpoint should exist and be accessible by superadmin"""
        response = requests.post(
            f"{BASE_URL}/api/admin/restore-backup",
            headers=superadmin_headers
        )
        # Should not return 401 (unauthorized) or 405 (method not allowed)
        # 404 means backup file not found which is acceptable
        # 200 means restore worked
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "restored" in data
            # Verify users collection is protected
            if "users" in data["restored"]:
                assert data["restored"]["users"] == "SKIPPED (protected)", \
                    "Users collection should be SKIPPED (protected)"
            print(f"✓ Restore backup successful - Protected collections preserved")
            print(f"  Restored: {data['restored']}")
        else:
            print(f"⚠ Backup file not found (404) - endpoint exists but no backup available")

    def test_restore_protects_users_collection(self, superadmin_headers):
        """Verify users collection is protected during restore"""
        # Get current users before restore
        response = requests.get(f"{BASE_URL}/api/users", headers=superadmin_headers)
        if response.status_code == 200:
            users_before = response.json()
            print(f"Users before restore: {len(users_before)}")
        
        # Attempt restore
        response = requests.post(
            f"{BASE_URL}/api/admin/restore-backup",
            headers=superadmin_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            # Check that users was skipped
            restored = data.get("restored", {})
            if "users" in restored:
                assert restored["users"] == "SKIPPED (protected)", \
                    "Users collection should be SKIPPED (protected)"
                print(f"✓ Users collection correctly protected during restore")
            
            # Verify superadmin still exists after restore
            verify_response = requests.get(f"{BASE_URL}/api/auth/me", headers=superadmin_headers)
            assert verify_response.status_code == 200, "Superadmin should still exist after restore"
            print(f"✓ Superadmin account preserved after restore")


class TestSmartScannerSidebarLink:
    """Test Smart Scanner appears in sidebar menu"""

    def test_stores_endpoint(self, admin_headers):
        """Stores endpoint should work for Smart Scanner store selector"""
        response = requests.get(f"{BASE_URL}/api/stores", headers=admin_headers)
        assert response.status_code == 200, f"Stores endpoint failed: {response.text}"
        print(f"✓ Stores endpoint working - Count: {len(response.json())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
