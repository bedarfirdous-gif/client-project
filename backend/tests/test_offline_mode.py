"""
Test suite for Offline Mode functionality
Tests the backend APIs required for offline POS operations:
- /api/sales (POST) - for syncing offline sales
- /api/items - for caching items
- /api/variants - for caching variants
- /api/customers - for caching customers
- /api/stores - for caching stores
- /api/vouchers - for caching vouchers
- /api/loyalty/settings - for caching loyalty settings
- /api/discounts - for caching discounts (MISSING - needs to be added)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Global session for authentication
session = requests.Session()
auth_token = None
headers = {}


def get_auth_headers():
    """Get authentication headers, login if needed"""
    global auth_token, headers
    
    if auth_token:
        return headers
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@brandmafia.com",
        "password": "demo123"
    })
    
    if response.status_code == 200:
        data = response.json()
        # API returns access_token, not token
        auth_token = data.get("access_token") or data.get("token")
        headers = {"Authorization": f"Bearer {auth_token}"}
        return headers
    else:
        pytest.skip(f"Authentication failed: {response.status_code}")


class TestOfflineDataCaching:
    """Test endpoints used for caching data for offline use"""
    
    def test_get_items_for_cache(self):
        """Test GET /api/items - used for caching items offline"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/items", headers=h)
        assert response.status_code == 200
        
        items = response.json()
        assert isinstance(items, list)
        print(f"Items available for caching: {len(items)}")
        
        # Verify item structure
        if items:
            item = items[0]
            assert "id" in item
            assert "name" in item
    
    def test_get_variants_for_cache(self):
        """Test GET /api/variants - used for caching variants offline"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/variants", headers=h)
        assert response.status_code == 200
        
        variants = response.json()
        assert isinstance(variants, list)
        print(f"Variants available for caching: {len(variants)}")
        
        # Verify variant structure
        if variants:
            variant = variants[0]
            assert "id" in variant
            assert "item_id" in variant
    
    def test_get_customers_for_cache(self):
        """Test GET /api/customers - used for caching customers offline"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/customers", headers=h)
        assert response.status_code == 200
        
        customers = response.json()
        assert isinstance(customers, list)
        print(f"Customers available for caching: {len(customers)}")
        
        # Verify customer structure
        if customers:
            customer = customers[0]
            assert "id" in customer
            assert "name" in customer
    
    def test_get_stores_for_cache(self):
        """Test GET /api/stores - used for caching stores offline"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/stores", headers=h)
        assert response.status_code == 200
        
        stores = response.json()
        assert isinstance(stores, list)
        print(f"Stores available for caching: {len(stores)}")
        
        # Verify store structure
        if stores:
            store = stores[0]
            assert "id" in store
            assert "name" in store
    
    def test_get_vouchers_for_cache(self):
        """Test GET /api/vouchers - used for caching vouchers offline"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/vouchers", headers=h)
        assert response.status_code == 200
        
        vouchers = response.json()
        assert isinstance(vouchers, list)
        print(f"Vouchers available for caching: {len(vouchers)}")
    
    def test_get_loyalty_settings_for_cache(self):
        """Test GET /api/loyalty/settings - used for caching loyalty settings offline"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/loyalty/settings", headers=h)
        assert response.status_code == 200
        
        settings = response.json()
        assert isinstance(settings, dict)
        print(f"Loyalty settings: {settings.get('points_per_rupee', 'N/A')} points per rupee")
        
        # Verify settings structure
        assert "points_per_rupee" in settings or "point_value" in settings
    
    def test_get_discounts_endpoint_exists(self):
        """Test GET /api/discounts - endpoint now exists for offline caching
        
        The frontend OfflineContext.js calls /api/discounts and this endpoint
        now returns combined item-discounts and tiered-discounts.
        """
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/discounts", headers=h)
        assert response.status_code == 200
        
        discounts = response.json()
        assert isinstance(discounts, list)
        print(f"Discounts available for caching: {len(discounts)}")
        
        # Verify discount structure includes source
        if discounts:
            discount = discounts[0]
            assert "id" in discount
            assert "discount_source" in discount
            assert discount["discount_source"] in ["item", "tiered"]
    
    def test_get_item_discounts_exists(self):
        """Test GET /api/item-discounts - this endpoint exists"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/item-discounts", headers=h)
        assert response.status_code == 200
        
        discounts = response.json()
        assert isinstance(discounts, list)
        print(f"Item discounts available: {len(discounts)}")
    
    def test_get_tiered_discounts_exists(self):
        """Test GET /api/tiered-discounts - this endpoint exists"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/tiered-discounts", headers=h)
        assert response.status_code == 200
        
        discounts = response.json()
        assert isinstance(discounts, list)
        print(f"Tiered discounts available: {len(discounts)}")


class TestOfflineSalesSync:
    """Test the /api/sales endpoint for syncing offline sales"""
    
    def test_create_sale_online(self):
        """Test POST /api/sales - create a sale (simulating online sale)"""
        h = get_auth_headers()
        
        # Get a store
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=h)
        if stores_response.status_code != 200 or not stores_response.json():
            pytest.skip("No stores available")
        store_id = stores_response.json()[0]["id"]
        
        # Get a variant
        variants_response = requests.get(f"{BASE_URL}/api/variants", headers=h)
        if variants_response.status_code != 200 or not variants_response.json():
            pytest.skip("No variants available")
        variant = variants_response.json()[0]
        
        sale_data = {
            "store_id": store_id,
            "customer_id": None,
            "customer_name": "Walk-in Customer",
            "items": [{
                "item_id": variant.get("item_id"),
                "variant_id": variant.get("id"),
                "item_name": "Test Item",
                "quantity": 1,
                "rate": 100
            }],
            "subtotal": 100,
            "discount_amount": 0,
            "voucher_code": None,
            "voucher_discount": 0,
            "loyalty_points_used": 0,
            "loyalty_points_value": 0,
            "gst_amount": 18,
            "gst_rate": 18,
            "total_amount": 118,
            "payment_methods": [{"method": "cash", "amount": 118}],
            "payment_method": "cash"
        }
        
        response = requests.post(f"{BASE_URL}/api/sales", headers=h, json=sale_data)
        assert response.status_code == 200
        
        result = response.json()
        assert "id" in result
        assert "invoice_number" in result
        print(f"Sale created: {result.get('invoice_number')}")
    
    def test_create_offline_sale_sync(self):
        """Test POST /api/sales - sync an offline sale with offline_sale flag"""
        h = get_auth_headers()
        
        # Get a store
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=h)
        if stores_response.status_code != 200 or not stores_response.json():
            pytest.skip("No stores available")
        store_id = stores_response.json()[0]["id"]
        
        # Get a variant
        variants_response = requests.get(f"{BASE_URL}/api/variants", headers=h)
        if variants_response.status_code != 200 or not variants_response.json():
            pytest.skip("No variants available")
        variant = variants_response.json()[0]
        
        offline_id = f"offline-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:9]}"
        
        sale_data = {
            "store_id": store_id,
            "customer_id": None,
            "customer_name": "Walk-in Customer",
            "items": [{
                "item_id": variant.get("item_id"),
                "variant_id": variant.get("id"),
                "item_name": "Offline Test Item",
                "quantity": 1,
                "rate": 200
            }],
            "subtotal": 200,
            "discount_amount": 0,
            "voucher_code": None,
            "voucher_discount": 0,
            "loyalty_points_used": 0,
            "loyalty_points_value": 0,
            "gst_amount": 36,
            "gst_rate": 18,
            "total_amount": 236,
            "payment_methods": [{"method": "cash", "amount": 236}],
            "payment_method": "cash",
            "offline_sale": True,
            "offline_id": offline_id
        }
        
        response = requests.post(f"{BASE_URL}/api/sales", headers=h, json=sale_data)
        assert response.status_code == 200
        
        result = response.json()
        assert "id" in result
        assert "invoice_number" in result
        print(f"Offline sale synced: {result.get('invoice_number')} (offline_id: {offline_id})")
    
    def test_get_sales_list(self):
        """Test GET /api/sales - verify synced sales appear in list"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/sales", headers=h)
        assert response.status_code == 200
        
        sales = response.json()
        assert isinstance(sales, list)
        print(f"Total sales in system: {len(sales)}")
        
        if sales:
            sale = sales[0]
            assert "id" in sale
            assert "invoice_number" in sale
            assert "total_amount" in sale


class TestVoucherValidation:
    """Test voucher validation for offline use"""
    
    def test_create_and_validate_voucher(self):
        """Create a test voucher and validate it"""
        h = get_auth_headers()
        
        voucher_code = f"TEST_OFFLINE_{uuid.uuid4().hex[:6].upper()}"
        voucher_data = {
            "code": voucher_code,
            "name": "Test Offline Voucher",
            "voucher_type": "gift",
            "value": 50,
            "is_percentage": False,
            "min_purchase": 100,
            "max_discount": 50,
            "usage_limit": 100,
            "valid_from": datetime.now().strftime("%Y-%m-%d"),
            "valid_until": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/vouchers", headers=h, json=voucher_data)
        assert response.status_code == 200
        
        result = response.json()
        print(f"Test voucher created: {voucher_code}")
        
        # Validate the voucher
        validate_response = requests.get(
            f"{BASE_URL}/api/vouchers/validate/{voucher_code}?amount=200",
            headers=h
        )
        assert validate_response.status_code == 200
        
        validation = validate_response.json()
        assert "calculated_discount" in validation
        assert validation["calculated_discount"] == 50
        print(f"Voucher validated: discount = {validation['calculated_discount']}")
        
        # Cleanup - delete the voucher
        voucher_id = result.get("id")
        requests.delete(f"{BASE_URL}/api/vouchers/{voucher_id}", headers=h)
    
    def test_validate_invalid_voucher(self):
        """Test validation of non-existent voucher"""
        h = get_auth_headers()
        response = requests.get(
            f"{BASE_URL}/api/vouchers/validate/INVALID_CODE_12345?amount=200",
            headers=h
        )
        assert response.status_code == 404
        print("Invalid voucher correctly rejected")
    
    def test_validate_voucher_min_purchase(self):
        """Test voucher validation with amount below minimum purchase"""
        h = get_auth_headers()
        
        # First create a voucher with min_purchase
        voucher_code = f"TEST_MIN_{uuid.uuid4().hex[:6].upper()}"
        voucher_data = {
            "code": voucher_code,
            "name": "Min Purchase Test",
            "voucher_type": "gift",
            "value": 100,
            "is_percentage": False,
            "min_purchase": 500,
            "usage_limit": 100,
            "valid_from": datetime.now().strftime("%Y-%m-%d"),
            "valid_until": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "active": True
        }
        
        create_response = requests.post(f"{BASE_URL}/api/vouchers", headers=h, json=voucher_data)
        assert create_response.status_code == 200
        voucher_id = create_response.json().get("id")
        
        # Try to validate with amount below min_purchase
        validate_response = requests.get(
            f"{BASE_URL}/api/vouchers/validate/{voucher_code}?amount=200",
            headers=h
        )
        assert validate_response.status_code == 400
        print("Voucher correctly rejected for amount below minimum purchase")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/vouchers/{voucher_id}", headers=h)


class TestLoyaltySettings:
    """Test loyalty settings for offline use"""
    
    def test_get_loyalty_settings(self):
        """Test GET /api/loyalty/settings"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/loyalty/settings", headers=h)
        assert response.status_code == 200
        
        settings = response.json()
        assert isinstance(settings, dict)
        
        # Check for expected fields
        expected_fields = ["points_per_rupee", "point_value", "min_redeem_points", "max_redeem_percent"]
        for field in expected_fields:
            assert field in settings, f"Missing field: {field}"
        
        print(f"Loyalty settings: {settings.get('points_per_rupee')} points/rupee, "
              f"value: {settings.get('point_value')}, "
              f"min redeem: {settings.get('min_redeem_points')}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_vouchers(self):
        """Delete test vouchers created during testing"""
        h = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/vouchers", headers=h)
        if response.status_code == 200:
            vouchers = response.json()
            deleted = 0
            for voucher in vouchers:
                if voucher.get("code", "").startswith("TEST_"):
                    delete_response = requests.delete(
                        f"{BASE_URL}/api/vouchers/{voucher['id']}",
                        headers=h
                    )
                    if delete_response.status_code == 200:
                        deleted += 1
            print(f"Cleaned up {deleted} test vouchers")
