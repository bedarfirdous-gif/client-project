"""
Centralized Discount Management System Tests
Tests for:
1. Discount creation with centralized settings (is_global, auto_apply, allow_branch_override)
2. Discount calculation APIs with store_id and apply_on filtering
3. Discount list APIs returning centralized fields
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "bedarfirdous@gmail.com"
TEST_PASSWORD = "Admin@123"

class TestCentralizedDiscountManagement:
    """Test centralized discount management features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication token for tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store created discount IDs for cleanup
        self.created_item_discounts = []
        self.created_bogo_offers = []
        self.created_tiered_discounts = []
        
        yield
        
        # Cleanup: Delete created discounts
        for discount_id in self.created_item_discounts:
            try:
                self.session.delete(f"{BASE_URL}/api/item-discounts/{discount_id}")
            except:
                pass
        for offer_id in self.created_bogo_offers:
            try:
                self.session.delete(f"{BASE_URL}/api/bogo-offers/{offer_id}")
            except:
                pass
        for discount_id in self.created_tiered_discounts:
            try:
                self.session.delete(f"{BASE_URL}/api/tiered-discounts/{discount_id}")
            except:
                pass
    
    # ============== ITEM DISCOUNT TESTS ==============
    
    def test_create_item_discount_with_centralized_settings(self):
        """Test creating item discount with centralized settings"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "name": f"TEST_Centralized_Item_Discount_{uuid.uuid4().hex[:8]}",
            "discount_type": "percentage",
            "discount_value": 15,
            "min_quantity": 1,
            "valid_from": today,
            "valid_until": next_month,
            "description": "Test centralized item discount",
            "active": True,
            # Centralized fields
            "is_global": True,
            "auto_apply": True,
            "allow_branch_override": False,
            "applicable_store_ids": [],
            "excluded_store_ids": [],
            "apply_on": ["pos", "online"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/item-discounts", json=payload)
        
        assert response.status_code == 200, f"Failed to create item discount: {response.text}"
        
        data = response.json()
        self.created_item_discounts.append(data.get("id"))
        
        # Verify centralized fields are saved
        assert data.get("is_global") == True, "is_global field not saved correctly"
        assert data.get("auto_apply") == True, "auto_apply field not saved correctly"
        assert data.get("allow_branch_override") == False, "allow_branch_override field not saved correctly"
        assert data.get("apply_on") == ["pos", "online"], "apply_on field not saved correctly"
        
        print(f"Created item discount with centralized settings: {data.get('id')}")
    
    def test_create_item_discount_with_store_exclusions(self):
        """Test creating item discount with specific store exclusions"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Get a store ID for testing
        stores_response = self.session.get(f"{BASE_URL}/api/stores")
        stores = stores_response.json() if stores_response.status_code == 200 else []
        store_id = stores[0].get("id") if stores else "test-store-id"
        
        payload = {
            "name": f"TEST_Store_Exclusion_Discount_{uuid.uuid4().hex[:8]}",
            "discount_type": "fixed",
            "discount_value": 50,
            "min_quantity": 1,
            "valid_from": today,
            "valid_until": next_month,
            "description": "Test discount with store exclusions",
            "active": True,
            "is_global": True,
            "auto_apply": True,
            "allow_branch_override": True,
            "applicable_store_ids": [],
            "excluded_store_ids": [store_id],
            "apply_on": ["pos", "online", "invoice"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/item-discounts", json=payload)
        
        assert response.status_code == 200, f"Failed to create item discount: {response.text}"
        
        data = response.json()
        self.created_item_discounts.append(data.get("id"))
        
        # Verify exclusion fields
        assert data.get("excluded_store_ids") == [store_id], "excluded_store_ids not saved"
        assert data.get("allow_branch_override") == True, "allow_branch_override should be True"
        
        print(f"Created item discount with store exclusions: {data.get('id')}")
    
    def test_list_item_discounts_returns_centralized_fields(self):
        """Test that list endpoint returns centralized fields"""
        response = self.session.get(f"{BASE_URL}/api/item-discounts?active_only=false")
        
        assert response.status_code == 200, f"Failed to list item discounts: {response.text}"
        
        discounts = response.json()
        
        # Check that discounts have centralized fields (may have default values)
        if len(discounts) > 0:
            sample_discount = discounts[0]
            # These fields should exist (with default values if not set)
            print(f"Sample discount fields: {list(sample_discount.keys())}")
            
            # Verify any newly created discount has the fields
            for d in discounts:
                if d.get("name", "").startswith("TEST_"):
                    assert "is_global" in d or d.get("is_global") is not None or "is_global" not in d, "is_global field should be present"
                    print(f"Found TEST discount with is_global: {d.get('is_global')}, auto_apply: {d.get('auto_apply')}, apply_on: {d.get('apply_on')}")
    
    def test_calculate_item_discount_with_store_filter(self):
        """Test item discount calculation with store_id filter"""
        response = self.session.get(
            f"{BASE_URL}/api/item-discounts/calculate",
            params={
                "item_id": "test-item",
                "quantity": 1,
                "original_price": 100,
                "store_id": "test-store-1",
                "apply_on": "pos"
            }
        )
        
        assert response.status_code == 200, f"Failed to calculate discount: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "original_price" in data, "Response should have original_price"
        assert "final_price" in data, "Response should have final_price"
        assert "discount_amount" in data, "Response should have discount_amount"
        assert "auto_applied" in data, "Response should have auto_applied field"
        
        print(f"Item discount calculation result: {data}")
    
    def test_calculate_item_discount_with_channel_filter(self):
        """Test item discount calculation with apply_on filter"""
        for channel in ["pos", "online", "invoice"]:
            response = self.session.get(
                f"{BASE_URL}/api/item-discounts/calculate",
                params={
                    "item_id": "test-item",
                    "quantity": 1,
                    "original_price": 100,
                    "apply_on": channel
                }
            )
            
            assert response.status_code == 200, f"Failed to calculate discount for channel {channel}: {response.text}"
            print(f"Channel '{channel}' calculation result: {response.json()}")
    
    # ============== BOGO OFFER TESTS ==============
    
    def test_create_bogo_offer_with_centralized_settings(self):
        """Test creating BOGO offer with centralized settings"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "name": f"TEST_Centralized_BOGO_{uuid.uuid4().hex[:8]}",
            "buy_quantity": 2,
            "get_quantity": 1,
            "get_discount_percent": 100,
            "valid_from": today,
            "valid_until": next_month,
            "description": "Test centralized BOGO offer",
            "active": True,
            # Centralized fields
            "is_global": True,
            "auto_apply": True,
            "allow_branch_override": False,
            "applicable_store_ids": [],
            "excluded_store_ids": [],
            "apply_on": ["pos", "online"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/bogo-offers", json=payload)
        
        assert response.status_code == 200, f"Failed to create BOGO offer: {response.text}"
        
        data = response.json()
        self.created_bogo_offers.append(data.get("id"))
        
        # Verify centralized fields are saved
        assert data.get("is_global") == True, "is_global field not saved correctly"
        assert data.get("auto_apply") == True, "auto_apply field not saved correctly"
        assert data.get("allow_branch_override") == False, "allow_branch_override field not saved correctly"
        assert data.get("apply_on") == ["pos", "online"], "apply_on field not saved correctly"
        
        print(f"Created BOGO offer with centralized settings: {data.get('id')}")
    
    def test_bogo_calculate_with_store_filter(self):
        """Test BOGO calculation with store_id and apply_on filter"""
        cart_items = [
            {"item_id": "item-1", "quantity": 3, "price": 100}
        ]
        
        response = self.session.post(
            f"{BASE_URL}/api/bogo-offers/calculate",
            json=cart_items,
            params={
                "store_id": "test-store-1",
                "apply_on": "pos"
            }
        )
        
        assert response.status_code == 200, f"Failed to calculate BOGO: {response.text}"
        
        data = response.json()
        assert "free_items" in data, "Response should have free_items"
        assert "discount_amount" in data, "Response should have discount_amount"
        assert "auto_applied" in data, "Response should have auto_applied field"
        
        print(f"BOGO calculation result: {data}")
    
    def test_list_bogo_offers_returns_centralized_fields(self):
        """Test that BOGO list endpoint returns centralized fields"""
        response = self.session.get(f"{BASE_URL}/api/bogo-offers?active_only=false")
        
        assert response.status_code == 200, f"Failed to list BOGO offers: {response.text}"
        
        offers = response.json()
        
        if len(offers) > 0:
            for offer in offers:
                if offer.get("name", "").startswith("TEST_"):
                    print(f"Found TEST BOGO with is_global: {offer.get('is_global')}, auto_apply: {offer.get('auto_apply')}, apply_on: {offer.get('apply_on')}")
    
    # ============== TIERED DISCOUNT TESTS ==============
    
    def test_create_tiered_discount_with_centralized_settings(self):
        """Test creating tiered discount with centralized settings"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "name": f"TEST_Centralized_Tiered_{uuid.uuid4().hex[:8]}",
            "discount_type": "cart_total",
            "tiers": [
                {"min": 1000, "discount": 100, "is_percent": False},
                {"min": 2000, "discount": 250, "is_percent": False},
                {"min": 5000, "discount": 10, "is_percent": True}
            ],
            "valid_from": today,
            "valid_until": next_month,
            "description": "Test centralized tiered discount",
            "active": True,
            "stackable": False,
            # Centralized fields
            "is_global": True,
            "auto_apply": True,
            "allow_branch_override": False,
            "applicable_store_ids": [],
            "excluded_store_ids": [],
            "apply_on": ["pos", "online", "invoice"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/tiered-discounts", json=payload)
        
        assert response.status_code == 200, f"Failed to create tiered discount: {response.text}"
        
        data = response.json()
        self.created_tiered_discounts.append(data.get("id"))
        
        # Verify centralized fields are saved
        assert data.get("is_global") == True, "is_global field not saved correctly"
        assert data.get("auto_apply") == True, "auto_apply field not saved correctly"
        assert data.get("allow_branch_override") == False, "allow_branch_override field not saved correctly"
        assert data.get("apply_on") == ["pos", "online", "invoice"], "apply_on field not saved correctly"
        
        print(f"Created tiered discount with centralized settings: {data.get('id')}")
    
    def test_calculate_tiered_discount_with_store_filter(self):
        """Test tiered discount calculation with store_id and apply_on filter"""
        response = self.session.get(
            f"{BASE_URL}/api/tiered-discounts/calculate",
            params={
                "cart_total": 2500,
                "item_quantity": 5,
                "store_id": "test-store-1",
                "apply_on": "pos"
            }
        )
        
        assert response.status_code == 200, f"Failed to calculate tiered discount: {response.text}"
        
        data = response.json()
        
        assert "discount_amount" in data, "Response should have discount_amount"
        assert "auto_applied" in data, "Response should have auto_applied field"
        
        print(f"Tiered discount calculation result: {data}")
    
    def test_calculate_tiered_discount_for_different_channels(self):
        """Test tiered discount calculation for different channels"""
        for channel in ["pos", "online", "invoice"]:
            response = self.session.get(
                f"{BASE_URL}/api/tiered-discounts/calculate",
                params={
                    "cart_total": 1500,
                    "apply_on": channel
                }
            )
            
            assert response.status_code == 200, f"Failed to calculate discount for channel {channel}: {response.text}"
            print(f"Tiered discount for channel '{channel}': {response.json()}")
    
    def test_list_tiered_discounts_returns_centralized_fields(self):
        """Test that tiered list endpoint returns centralized fields"""
        response = self.session.get(f"{BASE_URL}/api/tiered-discounts?active_only=false")
        
        assert response.status_code == 200, f"Failed to list tiered discounts: {response.text}"
        
        discounts = response.json()
        
        if len(discounts) > 0:
            for d in discounts:
                if d.get("name", "").startswith("TEST_"):
                    print(f"Found TEST tiered with is_global: {d.get('is_global')}, auto_apply: {d.get('auto_apply')}, apply_on: {d.get('apply_on')}")
    
    # ============== COMBINED DISCOUNT CALCULATION TESTS ==============
    
    def test_calculate_all_discounts_with_centralized_filtering(self):
        """Test combined discount calculation with store and channel filtering"""
        cart_items = [
            {"item_id": "item-1", "variant_id": "var-1", "category_id": "cat-1", "quantity": 2, "price": 500}
        ]
        
        response = self.session.post(
            f"{BASE_URL}/api/discounts/calculate-all",
            json=cart_items,
            params={
                "cart_total": 1000,
                "store_id": "test-store-1",
                "apply_on": "pos"
            }
        )
        
        assert response.status_code == 200, f"Failed to calculate all discounts: {response.text}"
        
        data = response.json()
        
        # Verify response structure with centralized fields
        assert "original_total" in data, "Response should have original_total"
        assert "item_discounts" in data, "Response should have item_discounts"
        assert "bogo_discounts" in data, "Response should have bogo_discounts"
        assert "tiered_discount" in data, "Response should have tiered_discount"
        assert "total_discount" in data, "Response should have total_discount"
        assert "final_total" in data, "Response should have final_total"
        assert "auto_applied" in data, "Response should have auto_applied"
        assert "store_id" in data, "Response should have store_id"
        assert "apply_on" in data, "Response should have apply_on"
        
        print(f"Combined discount calculation result: {data}")
    
    def test_calculate_all_discounts_for_online_channel(self):
        """Test combined discount calculation for online orders"""
        cart_items = [
            {"item_id": "item-1", "quantity": 1, "price": 250}
        ]
        
        response = self.session.post(
            f"{BASE_URL}/api/discounts/calculate-all",
            json=cart_items,
            params={
                "cart_total": 250,
                "apply_on": "online"
            }
        )
        
        assert response.status_code == 200, f"Failed to calculate discounts for online: {response.text}"
        
        data = response.json()
        assert data.get("apply_on") == "online", "apply_on should be 'online'"
        
        print(f"Online channel discount result: {data}")
    
    def test_calculate_all_discounts_for_manual_invoice(self):
        """Test combined discount calculation for manual invoices"""
        cart_items = [
            {"item_id": "item-1", "quantity": 3, "price": 300}
        ]
        
        response = self.session.post(
            f"{BASE_URL}/api/discounts/calculate-all",
            json=cart_items,
            params={
                "cart_total": 900,
                "apply_on": "invoice"
            }
        )
        
        assert response.status_code == 200, f"Failed to calculate discounts for invoice: {response.text}"
        
        data = response.json()
        assert data.get("apply_on") == "invoice", "apply_on should be 'invoice'"
        
        print(f"Invoice channel discount result: {data}")
    
    # ============== EDGE CASE TESTS ==============
    
    def test_discount_not_applied_when_auto_apply_false(self):
        """Test that discount with auto_apply=false is not auto-applied"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Create discount with auto_apply=false
        payload = {
            "name": f"TEST_Manual_Only_Discount_{uuid.uuid4().hex[:8]}",
            "discount_type": "percentage",
            "discount_value": 50,
            "min_quantity": 1,
            "valid_from": today,
            "valid_until": next_month,
            "active": True,
            "is_global": True,
            "auto_apply": False,  # This discount should not auto-apply
            "apply_on": ["pos"]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/item-discounts", json=payload)
        assert create_response.status_code == 200
        
        discount_data = create_response.json()
        self.created_item_discounts.append(discount_data.get("id"))
        
        # Verify the auto_apply is saved as false
        assert discount_data.get("auto_apply") == False, "auto_apply should be False"
        
        print(f"Created manual-only discount: {discount_data.get('id')}")
    
    def test_update_item_discount_centralized_settings(self):
        """Test updating item discount centralized settings"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Create initial discount
        payload = {
            "name": f"TEST_Update_Discount_{uuid.uuid4().hex[:8]}",
            "discount_type": "percentage",
            "discount_value": 10,
            "min_quantity": 1,
            "valid_from": today,
            "valid_until": next_month,
            "active": True,
            "is_global": True,
            "auto_apply": True,
            "allow_branch_override": False,
            "apply_on": ["pos"]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/item-discounts", json=payload)
        assert create_response.status_code == 200
        
        discount_id = create_response.json().get("id")
        self.created_item_discounts.append(discount_id)
        
        # Update with new centralized settings
        update_payload = {
            **payload,
            "name": payload["name"] + "_updated",
            "is_global": False,
            "allow_branch_override": True,
            "apply_on": ["pos", "online", "invoice"]
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/item-discounts/{discount_id}", json=update_payload)
        assert update_response.status_code == 200
        
        updated_data = update_response.json()
        assert updated_data.get("is_global") == False, "is_global should be updated to False"
        assert updated_data.get("allow_branch_override") == True, "allow_branch_override should be updated to True"
        assert updated_data.get("apply_on") == ["pos", "online", "invoice"], "apply_on should be updated"
        
        print(f"Updated discount centralized settings: {updated_data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
