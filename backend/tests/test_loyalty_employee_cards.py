"""
Tests for Customer Loyalty Card and Employee ID Card APIs
Verifies that business/store info is properly returned for card display
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestLoyaltyCardAPI:
    """Tests for Customer Loyalty Card API - verifies store name and address are returned"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client, auth_token):
        """Setup test fixtures"""
        self.client = api_client
        self.token = auth_token
        self.client.headers.update({"Authorization": f"Bearer {auth_token}"})
    
    def test_loyalty_card_returns_business_info(self, api_client, auth_token):
        """Test that loyalty card API returns business info with store name and address"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        # Use test customer ID
        customer_id = "6843c4ef-fe7c-4bb2-ad7f-8c93713c6f02"
        response = api_client.get(f"{BASE_URL}/api/customers/{customer_id}/loyalty-card")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify card_data structure
        assert "card_data" in data, "Response missing card_data"
        card_data = data["card_data"]
        assert "customer_id" in card_data
        assert "customer_name" in card_data
        assert "loyalty_points" in card_data
        assert "tier" in card_data
        assert "qr_code_data" in card_data
        
        # Verify business structure with store name and address
        assert "business" in data, "Response missing business info"
        business = data["business"]
        assert "name" in business, "Business missing name field"
        assert "store_name" in business, "Business missing store_name field"
        assert "address" in business, "Business missing address field"
        assert "phone" in business, "Business missing phone field"
        
        # Verify values are not empty (for test customer)
        print(f"Business name: {business.get('name')}")
        print(f"Store name: {business.get('store_name')}")
        print(f"Address: {business.get('address')}")
        
    def test_loyalty_card_not_found(self, api_client, auth_token):
        """Test that non-existent customer returns 404"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        response = api_client.get(f"{BASE_URL}/api/customers/non-existent-id-12345/loyalty-card")
        
        assert response.status_code == 404
    
    def test_loyalty_card_requires_auth(self, api_client):
        """Test that loyalty card API requires authentication"""
        # Remove auth header
        api_client.headers.pop("Authorization", None)
        
        customer_id = "6843c4ef-fe7c-4bb2-ad7f-8c93713c6f02"
        response = api_client.get(f"{BASE_URL}/api/customers/{customer_id}/loyalty-card")
        
        assert response.status_code in [401, 403]


class TestEmployeeIDCardAPI:
    """Tests for Employee ID Card API - verifies company name is returned"""
    
    def test_employee_id_card_returns_business_info(self, api_client, auth_token):
        """Test that employee ID card API returns business info with company name"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        # Use test employee ID
        employee_id = "88056ab4-5f68-41e5-b2d4-59fb2dbf34c9"
        response = api_client.get(f"{BASE_URL}/api/employees/{employee_id}/id-card")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify card_data structure
        assert "card_data" in data, "Response missing card_data"
        card_data = data["card_data"]
        assert "employee_id" in card_data
        assert "employee_code" in card_data
        assert "name" in card_data
        assert "designation" in card_data
        assert "qr_code_data" in card_data
        
        # Verify business structure with company name
        assert "business" in data, "Response missing business info"
        business = data["business"]
        assert "name" in business, "Business missing name field (company name)"
        
        # Verify company name is not empty
        assert business.get("name"), "Business name should not be empty"
        print(f"Company name: {business.get('name')}")
        
    def test_employee_id_card_not_found(self, api_client, auth_token):
        """Test that non-existent employee returns 404"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        response = api_client.get(f"{BASE_URL}/api/employees/non-existent-id-12345/id-card")
        
        assert response.status_code == 404
    
    def test_employee_id_card_requires_auth(self, api_client):
        """Test that employee ID card API requires authentication"""
        # Remove auth header
        api_client.headers.pop("Authorization", None)
        
        employee_id = "88056ab4-5f68-41e5-b2d4-59fb2dbf34c9"
        response = api_client.get(f"{BASE_URL}/api/employees/{employee_id}/id-card")
        
        assert response.status_code in [401, 403]


# Fixtures
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "superadmin@bijnisbooks.com",
        "password": "SuperAdmin@123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")
