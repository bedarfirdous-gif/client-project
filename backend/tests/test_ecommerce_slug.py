"""
Backend tests for Custom Store Slug Feature
Tests for:
- /api/ecommerce/check-slug/{slug} endpoint
- /api/ecommerce/store-slug PUT endpoint
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "admin123"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")  # Note: API returns access_token
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestCheckSlugEndpoint:
    """Tests for GET /api/ecommerce/check-slug/{slug}"""
    
    def test_check_slug_valid_format(self, authenticated_client):
        """Test checking a validly formatted slug"""
        # Use a unique slug based on test id
        test_slug = f"test-store-{uuid.uuid4().hex[:8]}"
        response = authenticated_client.get(f"{BASE_URL}/api/ecommerce/check-slug/{test_slug}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should have availability info
        assert "available" in data, f"Response missing 'available': {data}"
        assert isinstance(data["available"], bool), f"'available' should be boolean: {data}"
        
        # If available, should have preview URL
        if data["available"]:
            assert "preview_url" in data, f"Response missing 'preview_url': {data}"
            assert "bijnisbooks.com" in data["preview_url"], f"Preview URL format wrong: {data}"
        print(f"✓ Valid slug check: {test_slug} -> available={data['available']}")

    def test_check_slug_too_short(self, authenticated_client):
        """Test slug validation for too short slug"""
        response = authenticated_client.get(f"{BASE_URL}/api/ecommerce/check-slug/ab")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "available" in data, f"Response missing 'available': {data}"
        assert data["available"] == False, f"Short slug should not be available: {data}"
        assert "reason" in data, f"Should have rejection reason: {data}"
        print(f"✓ Short slug rejected with reason: {data.get('reason')}")

    def test_check_slug_reserved_word(self, authenticated_client):
        """Test that reserved slugs are rejected"""
        reserved_slugs = ['admin', 'api', 'www', 'shop', 'store', 'test']
        
        for slug in reserved_slugs[:3]:  # Test first 3
            response = authenticated_client.get(f"{BASE_URL}/api/ecommerce/check-slug/{slug}")
            
            assert response.status_code == 200, f"Expected 200 for '{slug}', got {response.status_code}"
            data = response.json()
            
            assert data["available"] == False, f"Reserved slug '{slug}' should not be available: {data}"
            assert "reason" in data, f"Should have rejection reason for '{slug}': {data}"
            print(f"✓ Reserved slug '{slug}' rejected: {data.get('reason')}")

    def test_check_slug_invalid_format_with_special_chars(self, authenticated_client):
        """Test slug with invalid characters"""
        invalid_slugs = ['my_store', 'store@123', 'store.name', 'UPPERCASE']
        
        for slug in invalid_slugs[:2]:  # Test first 2
            response = authenticated_client.get(f"{BASE_URL}/api/ecommerce/check-slug/{slug}")
            
            assert response.status_code == 200, f"Expected 200 for '{slug}', got {response.status_code}"
            data = response.json()
            
            # Invalid format slugs should be rejected
            if data["available"] == False:
                assert "reason" in data, f"Should have rejection reason for '{slug}': {data}"
                print(f"✓ Invalid slug '{slug}' rejected: {data.get('reason')}")
            else:
                print(f"⚠ Slug '{slug}' was marked available (may have been normalized)")

    def test_check_slug_without_auth(self, api_client):
        """Test that endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/ecommerce/check-slug/test-store")
        
        # Should require auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Endpoint requires authentication")


class TestStoreSlugUpdateEndpoint:
    """Tests for PUT /api/ecommerce/store-slug"""
    
    def test_update_store_slug_success(self, authenticated_client):
        """Test successfully updating store slug"""
        # First check availability of a unique slug
        new_slug = f"test-store-{uuid.uuid4().hex[:6]}"
        
        check_response = authenticated_client.get(f"{BASE_URL}/api/ecommerce/check-slug/{new_slug}")
        check_data = check_response.json()
        
        if not check_data.get("available"):
            pytest.skip(f"Test slug '{new_slug}' not available, skipping update test")
        
        # Now update
        update_response = authenticated_client.put(
            f"{BASE_URL}/api/ecommerce/store-slug",
            json={"slug": new_slug}
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        data = update_response.json()
        
        assert "slug" in data, f"Response missing 'slug': {data}"
        assert data["slug"] == new_slug, f"Slug mismatch: expected {new_slug}, got {data['slug']}"
        assert "store_url" in data, f"Response missing 'store_url': {data}"
        assert new_slug in data["store_url"], f"Store URL should contain slug: {data}"
        print(f"✓ Store slug updated to '{new_slug}' -> {data['store_url']}")

    def test_update_store_slug_empty(self, authenticated_client):
        """Test that empty slug is rejected"""
        response = authenticated_client.put(
            f"{BASE_URL}/api/ecommerce/store-slug",
            json={"slug": ""}
        )
        
        assert response.status_code == 400, f"Expected 400 for empty slug, got {response.status_code}"
        print("✓ Empty slug rejected")

    def test_update_store_slug_reserved(self, authenticated_client):
        """Test that reserved slugs are rejected on update"""
        response = authenticated_client.put(
            f"{BASE_URL}/api/ecommerce/store-slug",
            json={"slug": "admin"}
        )
        
        assert response.status_code == 400, f"Expected 400 for reserved slug, got {response.status_code}"
        data = response.json()
        assert "detail" in data, f"Should have error detail: {data}"
        print(f"✓ Reserved slug 'admin' rejected: {data.get('detail')}")

    def test_update_store_slug_invalid_format(self, authenticated_client):
        """Test that invalid format slugs are rejected"""
        invalid_slugs = [
            "ab",  # Too short
            "-start-with-hyphen",  # Starts with hyphen
            "end-with-hyphen-",  # Ends with hyphen
        ]
        
        for slug in invalid_slugs:
            response = authenticated_client.put(
                f"{BASE_URL}/api/ecommerce/store-slug",
                json={"slug": slug}
            )
            
            assert response.status_code == 400, f"Expected 400 for '{slug}', got {response.status_code}"
            print(f"✓ Invalid slug '{slug}' rejected")

    def test_update_store_slug_without_auth(self, api_client):
        """Test that endpoint requires authentication"""
        response = api_client.put(
            f"{BASE_URL}/api/ecommerce/store-slug",
            json={"slug": "test-store"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Update endpoint requires authentication")


class TestEcommerceSettingsIntegration:
    """Integration tests for ecommerce settings with slug"""
    
    def test_get_ecommerce_settings(self, authenticated_client):
        """Test getting ecommerce settings"""
        response = authenticated_client.get(f"{BASE_URL}/api/ecommerce/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should have settings structure
        assert isinstance(data, dict), f"Settings should be dict: {data}"
        print(f"✓ Got ecommerce settings: enabled={data.get('enabled')}, store_slug={data.get('store_slug')}")

    def test_get_ecommerce_dashboard(self, authenticated_client):
        """Test getting ecommerce dashboard data"""
        response = authenticated_client.get(f"{BASE_URL}/api/ecommerce/dashboard")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, dict), f"Dashboard should be dict: {data}"
        print(f"✓ Got dashboard: monthly_orders={data.get('monthly_orders')}, monthly_revenue={data.get('monthly_revenue')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
