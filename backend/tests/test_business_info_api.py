"""
Test file for /api/posters/business-info endpoint
Tests the business name fetching logic for Auto Poster feature
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBusinessInfoAPI:
    """Test the business-info endpoint for Auto Poster"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for superadmin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "SuperAdmin@123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_business_info_endpoint_returns_200(self, auth_headers):
        """Test that business-info endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/posters/business-info", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Business info endpoint returns 200")
    
    def test_business_info_returns_required_fields(self, auth_headers):
        """Test that business-info returns all required fields"""
        response = requests.get(f"{BASE_URL}/api/posters/business-info", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields exist
        assert "business_name" in data, "Missing business_name field"
        assert "brand_colors" in data, "Missing brand_colors field"
        assert "logo_url" in data, "Missing logo_url field"
        assert "tenant_id" in data, "Missing tenant_id field"
        
        print(f"✓ All required fields present: business_name={data['business_name']}, tenant_id={data['tenant_id']}")
    
    def test_business_name_is_not_empty(self, auth_headers):
        """Test that business name is not empty or None"""
        response = requests.get(f"{BASE_URL}/api/posters/business-info", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        business_name = data.get("business_name")
        
        assert business_name is not None, "business_name should not be None"
        assert isinstance(business_name, str), "business_name should be a string"
        assert len(business_name) > 0, "business_name should not be empty"
        
        print(f"✓ Business name is valid: '{business_name}'")
    
    def test_brand_colors_is_array(self, auth_headers):
        """Test that brand_colors is an array of color strings"""
        response = requests.get(f"{BASE_URL}/api/posters/business-info", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        brand_colors = data.get("brand_colors")
        
        assert isinstance(brand_colors, list), "brand_colors should be a list"
        assert len(brand_colors) > 0, "brand_colors should have at least one color"
        
        # Verify each color is a valid hex string
        for color in brand_colors:
            assert isinstance(color, str), f"Color {color} should be a string"
            assert color.startswith("#"), f"Color {color} should start with #"
        
        print(f"✓ Brand colors valid: {brand_colors}")
    
    def test_unauthorized_request_fails(self):
        """Test that request without auth fails"""
        response = requests.get(f"{BASE_URL}/api/posters/business-info")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 for unauthorized request, got {response.status_code}"
        print("✓ Unauthorized request correctly rejected")


class TestSecurityDashboard:
    """Test Security Dashboard accessibility"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for superadmin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "SuperAdmin@123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_autonomous_healer_status_returns_200(self, auth_headers):
        """Test that autonomous-healer status endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/autonomous-healer/status", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "is_running" in data, "Missing is_running field"
        assert "statistics" in data, "Missing statistics field"
        print("✓ Security Dashboard API (autonomous-healer/status) accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
