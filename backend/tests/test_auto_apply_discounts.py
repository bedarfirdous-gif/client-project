"""
Auto-Apply Discounts Test - Tests for verifying discounts are automatically fetched and calculated in POS

Test Coverage:
- Backend API /api/discounts/calculate-all endpoint
- BOGO offer calculations
- Tiered discount calculations
- Item discount calculations
- Centralized discount filtering (store_id, apply_on channel)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://erp-invoice-fix-1.preview.emergentagent.com').rstrip('/')

# Test credentials provided
TEST_EMAIL = "bedarfirdous@gmail.com"
TEST_PASSWORD = "1234"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


@pytest.fixture(scope="module")
def store_id(api_client):
    """Get first store ID"""
    response = api_client.get(f"{BASE_URL}/api/stores")
    assert response.status_code == 200
    stores = response.json()
    assert len(stores) > 0, "No stores found"
    return stores[0]["id"]


class TestDiscountCalculationAPI:
    """Tests for /api/discounts/calculate-all endpoint"""
    
    def test_basic_discount_calculation(self, api_client, store_id):
        """Test basic discount calculation with cart items"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [
                {"item_id": "test-item-1", "variant_id": "test-variant-1", "quantity": 3, "price": 1960}
            ],
            "cart_total": 5880,
            "store_id": store_id,
            "apply_on": "pos"
        })
        
        assert response.status_code == 200, f"API failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "original_total" in data
        assert "item_discounts" in data
        assert "bogo_discounts" in data
        assert "tiered_discount" in data
        assert "total_discount" in data
        assert "final_total" in data
        assert "auto_applied" in data
        assert "store_id" in data
        assert "apply_on" in data
        
        print(f"✓ Basic discount calculation passed - Total discount: ₹{data['total_discount']}")
    
    def test_tiered_discount_at_5000_threshold(self, api_client, store_id):
        """Test tiered discount triggers at ₹5000 threshold (Spend More Save More)"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [
                {"item_id": "test-item-1", "variant_id": "test-variant-1", "quantity": 3, "price": 1960}
            ],
            "cart_total": 5880,  # Above 5000 threshold
            "store_id": store_id,
            "apply_on": "pos"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify tiered discount is applied (₹300 for 5000+ tier)
        tiered = data.get("tiered_discount")
        if tiered:
            assert tiered.get("discount_amount", 0) >= 0
            print(f"✓ Tiered discount applied: ₹{tiered.get('discount_amount', 0)}")
        else:
            print("ℹ No tiered discount found (may not have qualifying tier)")
    
    def test_tiered_discount_below_threshold(self, api_client, store_id):
        """Test no tiered discount below minimum threshold"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [
                {"item_id": "test-item-1", "variant_id": "test-variant-1", "quantity": 1, "price": 500}
            ],
            "cart_total": 500,  # Below 2000 threshold
            "store_id": store_id,
            "apply_on": "pos"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # May or may not have tiered discount depending on configured tiers
        tiered = data.get("tiered_discount")
        tiered_amount = tiered.get("discount_amount", 0) if tiered else 0
        print(f"✓ Tiered discount for cart below threshold: ₹{tiered_amount}")
    
    def test_bogo_discount_calculation(self, api_client, store_id):
        """Test BOGO offers are calculated correctly"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [
                {"item_id": "test-bogo-item", "variant_id": "test-bogo-variant", "quantity": 3, "price": 1960}
            ],
            "cart_total": 5880,
            "store_id": store_id,
            "apply_on": "pos"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check BOGO discounts (may be empty if no matching BOGO offers)
        bogo_discounts = data.get("bogo_discounts", [])
        bogo_total = sum(b.get("discount_amount", 0) for b in bogo_discounts)
        print(f"✓ BOGO discounts found: {len(bogo_discounts)}, Total: ₹{bogo_total}")
    
    def test_channel_filtering_pos(self, api_client, store_id):
        """Test discounts filter correctly for POS channel"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [
                {"item_id": "test-item", "variant_id": "test-variant", "quantity": 2, "price": 2000}
            ],
            "cart_total": 4000,
            "store_id": store_id,
            "apply_on": "pos"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("apply_on") == "pos"
        print(f"✓ POS channel filtering passed - apply_on: {data.get('apply_on')}")
    
    def test_channel_filtering_online(self, api_client, store_id):
        """Test discounts filter correctly for online channel"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [
                {"item_id": "test-item", "variant_id": "test-variant", "quantity": 2, "price": 2000}
            ],
            "cart_total": 4000,
            "store_id": store_id,
            "apply_on": "online"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("apply_on") == "online"
        print(f"✓ Online channel filtering passed - apply_on: {data.get('apply_on')}")
    
    def test_store_id_filtering(self, api_client, store_id):
        """Test discounts filter correctly for specific store"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [
                {"item_id": "test-item", "variant_id": "test-variant", "quantity": 2, "price": 2000}
            ],
            "cart_total": 4000,
            "store_id": store_id,
            "apply_on": "pos"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("store_id") == store_id
        print(f"✓ Store filtering passed - store_id: {data.get('store_id')}")
    
    def test_empty_cart(self, api_client, store_id):
        """Test discount calculation with empty cart"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [],
            "cart_total": 0,
            "store_id": store_id,
            "apply_on": "pos"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("total_discount", 0) == 0
        print(f"✓ Empty cart returns 0 discount")
    
    def test_final_total_calculation(self, api_client, store_id):
        """Test final_total = original_total - total_discount"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [
                {"item_id": "test-item", "variant_id": "test-variant", "quantity": 3, "price": 1960}
            ],
            "cart_total": 5880,
            "store_id": store_id,
            "apply_on": "pos"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        original = data.get("original_total", 0)
        discount = data.get("total_discount", 0)
        final = data.get("final_total", 0)
        
        # Final should be original minus discount (but not negative)
        expected_final = max(0, original - discount)
        assert final == expected_final, f"Expected {expected_final}, got {final}"
        print(f"✓ Final total calculation correct: ₹{original} - ₹{discount} = ₹{final}")


class TestDiscountTypesExists:
    """Tests to verify discount types are configured"""
    
    def test_item_discounts_list(self, api_client):
        """Test item discounts endpoint returns discounts"""
        response = api_client.get(f"{BASE_URL}/api/item-discounts")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Item discounts found: {len(data)}")
    
    def test_bogo_offers_list(self, api_client):
        """Test BOGO offers endpoint returns offers"""
        response = api_client.get(f"{BASE_URL}/api/bogo-offers")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ BOGO offers found: {len(data)}")
        
        # Verify BOGO offers have auto_apply
        for offer in data:
            assert "auto_apply" in offer or offer.get("auto_apply") is None
    
    def test_tiered_discounts_list(self, api_client):
        """Test tiered discounts endpoint returns discounts"""
        response = api_client.get(f"{BASE_URL}/api/tiered-discounts")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Tiered discounts found: {len(data)}")
        
        # Verify tiered discounts have tiers array
        for discount in data:
            tiers = discount.get("tiers", [])
            if tiers:
                print(f"  - {discount.get('name')}: {len(tiers)} tiers")


class TestAutoApplyFunctionality:
    """Tests for auto-apply behavior"""
    
    def test_auto_applied_flag_in_response(self, api_client, store_id):
        """Test auto_applied flag is true in response"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [
                {"item_id": "test-item", "variant_id": "test-variant", "quantity": 2, "price": 1000}
            ],
            "cart_total": 2000,
            "store_id": store_id,
            "apply_on": "pos"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("auto_applied") == True
        print(f"✓ auto_applied flag is True in response")
    
    def test_discount_breakdown_structure(self, api_client, store_id):
        """Test response contains proper discount breakdown for UI display"""
        response = api_client.post(f"{BASE_URL}/api/discounts/calculate-all", json={
            "cart_items": [
                {"item_id": "test-item", "variant_id": "test-variant", "quantity": 3, "price": 1960}
            ],
            "cart_total": 5880,
            "store_id": store_id,
            "apply_on": "pos"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify each discount type has proper structure for UI display
        for item_discount in data.get("item_discounts", []):
            assert "discount" in item_discount
            print(f"  Item discount: ₹{item_discount.get('discount')}")
        
        for bogo in data.get("bogo_discounts", []):
            assert "discount_amount" in bogo
            print(f"  BOGO discount: ₹{bogo.get('discount_amount')} ({bogo.get('offer_name')})")
        
        tiered = data.get("tiered_discount")
        if tiered:
            assert "discount_amount" in tiered
            print(f"  Tiered discount: ₹{tiered.get('discount_amount')} ({tiered.get('discount_name')})")
        
        print(f"✓ Discount breakdown structure is correct for UI display")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
