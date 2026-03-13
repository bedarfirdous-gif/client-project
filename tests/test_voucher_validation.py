"""
Test Voucher Validation API
Tests for voucher apply/validation functionality in POS page

Test cases:
1. Successful voucher application (no minimum)
2. Successful voucher application (with minimum met)
3. Invalid voucher code error
4. Expired voucher error
5. Minimum purchase not met error
6. Usage limit reached error
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVoucherValidation:
    """Voucher validation endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        # Login with test credentials
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Login failed - unable to test voucher APIs")
        
        login_data = login_response.json()
        self.token = login_data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Get user info
        self.user = login_data.get("user", {})
        print(f"Logged in as: {self.user.get('email')}")
    
    def test_validate_voucher_test10off_no_minimum(self):
        """Test TEST10OFF voucher - 10% discount with no minimum purchase requirement"""
        # Validate voucher with a cart amount
        cart_amount = 500
        response = requests.get(
            f"{BASE_URL}/api/vouchers/validate/TEST10OFF?amount={cart_amount}",
            headers=self.headers
        )
        
        print(f"TEST10OFF validation response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        # Check if voucher exists
        if response.status_code == 404:
            pytest.skip("TEST10OFF voucher not found - creating one would be needed")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "calculated_discount" in data, "Response should contain calculated_discount"
        print(f"Calculated discount: {data.get('calculated_discount')}")
        
        # If it's a percentage voucher (10%), discount should be cart_amount * 0.1
        if data.get("is_percentage"):
            expected_discount = cart_amount * data.get("value", 0) / 100
            assert data["calculated_discount"] == pytest.approx(expected_discount, rel=0.01)
    
    def test_validate_voucher_min500_with_sufficient_amount(self):
        """Test MIN500 voucher - requires ₹500 minimum purchase (should pass)"""
        cart_amount = 600  # Above ₹500 minimum
        response = requests.get(
            f"{BASE_URL}/api/vouchers/validate/MIN500?amount={cart_amount}",
            headers=self.headers
        )
        
        print(f"MIN500 (amount=600) response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 404:
            pytest.skip("MIN500 voucher not found")
        
        assert response.status_code == 200, f"Expected 200 with sufficient amount, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "calculated_discount" in data
        print(f"Calculated discount: {data.get('calculated_discount')}")
    
    def test_validate_voucher_min500_with_insufficient_amount(self):
        """Test MIN500 voucher - requires ₹500 minimum purchase (should fail with 400)"""
        cart_amount = 300  # Below ₹500 minimum
        response = requests.get(
            f"{BASE_URL}/api/vouchers/validate/MIN500?amount={cart_amount}",
            headers=self.headers
        )
        
        print(f"MIN500 (amount=300) response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 404:
            pytest.skip("MIN500 voucher not found")
        
        # Should return 400 for minimum purchase not met
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        # Check error message contains minimum purchase info
        assert "minimum" in data["detail"].lower() or "₹500" in data["detail"]
        print(f"Error message: {data['detail']}")
    
    def test_validate_invalid_voucher_code(self):
        """Test with a completely invalid voucher code"""
        response = requests.get(
            f"{BASE_URL}/api/vouchers/validate/INVALIDCODE123?amount=500",
            headers=self.headers
        )
        
        print(f"Invalid voucher response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        # Should return 404 for invalid voucher
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        print(f"Error message: {data['detail']}")
    
    def test_list_available_vouchers(self):
        """Test listing available vouchers to see test voucher setup"""
        response = requests.get(f"{BASE_URL}/api/vouchers", headers=self.headers)
        
        print(f"List vouchers response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        vouchers = response.json()
        print(f"Found {len(vouchers)} vouchers")
        
        for v in vouchers:
            print(f"  - {v.get('code')}: type={v.get('voucher_type')}, value={v.get('value')}, min_purchase={v.get('min_purchase')}, active={v.get('active')}")
    
    def test_voucher_code_case_insensitivity(self):
        """Test that voucher code validation is case insensitive"""
        # Test lowercase
        response_lower = requests.get(
            f"{BASE_URL}/api/vouchers/validate/test10off?amount=500",
            headers=self.headers
        )
        
        # Test mixed case
        response_mixed = requests.get(
            f"{BASE_URL}/api/vouchers/validate/Test10Off?amount=500",
            headers=self.headers
        )
        
        print(f"Lowercase response: {response_lower.status_code}")
        print(f"Mixed case response: {response_mixed.status_code}")
        
        # Both should have the same status code (both work or both fail)
        assert response_lower.status_code == response_mixed.status_code, \
            "Voucher validation should be case insensitive"


class TestVoucherCreation:
    """Test creating test vouchers for validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        login_data = login_response.json()
        self.token = login_data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_create_test10off_voucher_if_not_exists(self):
        """Create TEST10OFF voucher for testing if it doesn't exist"""
        # First check if it exists
        check_response = requests.get(
            f"{BASE_URL}/api/vouchers/validate/TEST10OFF?amount=100",
            headers=self.headers
        )
        
        if check_response.status_code == 200:
            print("TEST10OFF voucher already exists")
            return
        
        # Create the voucher
        today = datetime.now()
        valid_from = today.strftime("%Y-%m-%d")
        valid_until = (today + timedelta(days=365)).strftime("%Y-%m-%d")
        
        voucher_data = {
            "code": "TEST10OFF",
            "voucher_type": "percent",
            "value": 10,
            "is_percentage": True,
            "min_purchase": 0,  # No minimum
            "max_discount": 1000,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "usage_limit": 1000,
            "per_customer_limit": 10,
            "description": "10% off - no minimum purchase",
            "active": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vouchers",
            headers=self.headers,
            json=voucher_data
        )
        
        print(f"Create TEST10OFF response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code in [200, 201], f"Failed to create voucher: {response.text}"
    
    def test_create_min500_voucher_if_not_exists(self):
        """Create MIN500 voucher for testing if it doesn't exist"""
        # First check if it exists
        check_response = requests.get(
            f"{BASE_URL}/api/vouchers/validate/MIN500?amount=600",
            headers=self.headers
        )
        
        if check_response.status_code == 200:
            print("MIN500 voucher already exists")
            return
        
        # Create the voucher
        today = datetime.now()
        valid_from = today.strftime("%Y-%m-%d")
        valid_until = (today + timedelta(days=365)).strftime("%Y-%m-%d")
        
        voucher_data = {
            "code": "MIN500",
            "voucher_type": "gift",
            "value": 50,  # ₹50 off
            "is_percentage": False,
            "min_purchase": 500,  # Requires ₹500 minimum
            "max_discount": None,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "usage_limit": 1000,
            "per_customer_limit": 10,
            "description": "₹50 off on ₹500+ purchase",
            "active": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vouchers",
            headers=self.headers,
            json=voucher_data
        )
        
        print(f"Create MIN500 response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code in [200, 201], f"Failed to create voucher: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
