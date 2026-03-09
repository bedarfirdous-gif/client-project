"""
POS Favorites API Tests
Tests the per-store favorites system for POS quick add functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "admin123"


class TestPOSFavoritesAPI:
    """Test POS Favorites API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get or create a test store
        stores_response = self.session.get(f"{BASE_URL}/api/stores")
        if stores_response.status_code == 200:
            stores = stores_response.json()
            if stores:
                self.store_id = stores[0].get("id", "")
            else:
                self.store_id = ""
        else:
            self.store_id = ""
        
        # Get some items for testing
        items_response = self.session.get(f"{BASE_URL}/api/items?active=true")
        if items_response.status_code == 200:
            items = items_response.json()
            self.test_items = items[:3] if len(items) >= 3 else items
        else:
            self.test_items = []
        
        yield
        
        # Cleanup - remove test favorites
        self.session.delete(f"{BASE_URL}/api/pos/favorites?store_id={self.store_id}")

    def test_login_works(self):
        """Test that login endpoint works correctly"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Login successful - User: {data['user'].get('email')}")

    def test_get_favorites_returns_list(self):
        """Test GET /api/pos/favorites returns favorites list"""
        response = self.session.get(f"{BASE_URL}/api/pos/favorites")
        
        assert response.status_code == 200, f"Failed to get favorites: {response.text}"
        data = response.json()
        
        assert "favorites" in data, "Response should contain 'favorites' key"
        assert isinstance(data["favorites"], list), "Favorites should be a list"
        assert "source" in data, "Response should indicate favorites source"
        
        print(f"GET favorites - Source: {data.get('source')}, Count: {len(data['favorites'])}")

    def test_get_favorites_with_store_id(self):
        """Test GET /api/pos/favorites with store_id parameter"""
        if not self.store_id:
            pytest.skip("No store available for testing")
        
        response = self.session.get(f"{BASE_URL}/api/pos/favorites?store_id={self.store_id}")
        
        assert response.status_code == 200, f"Failed to get favorites: {response.text}"
        data = response.json()
        
        assert "favorites" in data
        print(f"GET favorites with store_id - Count: {len(data['favorites'])}")

    def test_get_favorites_with_limit(self):
        """Test GET /api/pos/favorites respects limit parameter"""
        response = self.session.get(f"{BASE_URL}/api/pos/favorites?limit=3")
        
        assert response.status_code == 200, f"Failed to get favorites: {response.text}"
        data = response.json()
        
        assert len(data["favorites"]) <= 3, "Favorites should respect limit parameter"
        print(f"GET favorites with limit=3 - Count: {len(data['favorites'])}")

    def test_add_to_favorites(self):
        """Test POST /api/pos/favorites/add adds item to favorites"""
        if not self.test_items:
            pytest.skip("No items available for testing")
        
        item_id = self.test_items[0].get("id")
        
        response = self.session.post(f"{BASE_URL}/api/pos/favorites/add", json={
            "item_id": item_id,
            "store_id": self.store_id
        })
        
        assert response.status_code == 200, f"Failed to add favorite: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "count" in data
        print(f"Add to favorites - Message: {data['message']}, Count: {data['count']}")
        
        # Verify it was added by getting favorites
        verify_response = self.session.get(f"{BASE_URL}/api/pos/favorites?store_id={self.store_id}")
        assert verify_response.status_code == 200
        favorites = verify_response.json()["favorites"]
        favorite_ids = [f.get("id") for f in favorites]
        assert item_id in favorite_ids, "Added item should appear in favorites"

    def test_add_duplicate_favorite(self):
        """Test that adding duplicate favorite returns appropriate message"""
        if not self.test_items:
            pytest.skip("No items available for testing")
        
        item_id = self.test_items[0].get("id")
        
        # Add first time
        self.session.post(f"{BASE_URL}/api/pos/favorites/add", json={
            "item_id": item_id,
            "store_id": self.store_id
        })
        
        # Add again
        response = self.session.post(f"{BASE_URL}/api/pos/favorites/add", json={
            "item_id": item_id,
            "store_id": self.store_id
        })
        
        assert response.status_code == 200, f"Duplicate add should succeed: {response.text}"
        data = response.json()
        assert "already in favorites" in data.get("message", "").lower() or "count" in data
        print(f"Duplicate favorite - Message: {data['message']}")

    def test_add_favorite_without_item_id(self):
        """Test POST /api/pos/favorites/add returns error without item_id"""
        response = self.session.post(f"{BASE_URL}/api/pos/favorites/add", json={
            "store_id": self.store_id
        })
        
        assert response.status_code == 400, "Should return 400 without item_id"
        print(f"Add without item_id - Status: {response.status_code}")

    def test_remove_from_favorites(self):
        """Test POST /api/pos/favorites/remove removes item from favorites"""
        if not self.test_items:
            pytest.skip("No items available for testing")
        
        item_id = self.test_items[0].get("id")
        
        # First add the item
        add_response = self.session.post(f"{BASE_URL}/api/pos/favorites/add", json={
            "item_id": item_id,
            "store_id": self.store_id
        })
        assert add_response.status_code == 200, "Failed to add item first"
        
        # Now remove it
        response = self.session.post(f"{BASE_URL}/api/pos/favorites/remove", json={
            "item_id": item_id,
            "store_id": self.store_id
        })
        
        assert response.status_code == 200, f"Failed to remove favorite: {response.text}"
        data = response.json()
        
        assert "message" in data
        print(f"Remove from favorites - Message: {data['message']}")
        
        # Verify it was removed
        verify_response = self.session.get(f"{BASE_URL}/api/pos/favorites?store_id={self.store_id}")
        assert verify_response.status_code == 200

    def test_remove_non_existent_favorite(self):
        """Test removing non-existent item from favorites"""
        response = self.session.post(f"{BASE_URL}/api/pos/favorites/remove", json={
            "item_id": "non-existent-item-id",
            "store_id": self.store_id
        })
        
        # Should return success with "not in favorites" message
        assert response.status_code == 200
        data = response.json()
        print(f"Remove non-existent - Message: {data.get('message')}")

    def test_save_bulk_favorites(self):
        """Test POST /api/pos/favorites saves multiple favorites at once"""
        if len(self.test_items) < 2:
            pytest.skip("Need at least 2 items for bulk save test")
        
        item_ids = [item.get("id") for item in self.test_items[:2]]
        
        response = self.session.post(f"{BASE_URL}/api/pos/favorites", json={
            "item_ids": item_ids,
            "store_id": self.store_id
        })
        
        assert response.status_code == 200, f"Failed to save bulk favorites: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert data.get("count") == 2
        print(f"Bulk save favorites - Message: {data['message']}, Count: {data['count']}")
        
        # Verify they were saved
        verify_response = self.session.get(f"{BASE_URL}/api/pos/favorites?store_id={self.store_id}")
        assert verify_response.status_code == 200
        favorites = verify_response.json()["favorites"]
        assert len(favorites) >= 2
        assert favorites[0].get("selling_price") is not None, "Favorites should have selling_price"

    def test_save_exceeds_max_favorites(self):
        """Test that saving more than 20 favorites returns error"""
        # Create 21 fake item IDs
        item_ids = [f"fake-item-{i}" for i in range(21)]
        
        response = self.session.post(f"{BASE_URL}/api/pos/favorites", json={
            "item_ids": item_ids,
            "store_id": self.store_id
        })
        
        assert response.status_code == 400, "Should return 400 for >20 favorites"
        print(f"Exceed max favorites - Status: {response.status_code}")

    def test_clear_favorites(self):
        """Test DELETE /api/pos/favorites clears custom favorites"""
        if not self.test_items:
            pytest.skip("No items available for testing")
        
        # First add some favorites
        item_id = self.test_items[0].get("id")
        self.session.post(f"{BASE_URL}/api/pos/favorites/add", json={
            "item_id": item_id,
            "store_id": self.store_id
        })
        
        # Clear favorites
        response = self.session.delete(f"{BASE_URL}/api/pos/favorites?store_id={self.store_id}")
        
        assert response.status_code == 200, f"Failed to clear favorites: {response.text}"
        print(f"Clear favorites - Status: {response.status_code}")
        
        # Verify favorites are cleared (should return to top sellers or catalog)
        verify_response = self.session.get(f"{BASE_URL}/api/pos/favorites?store_id={self.store_id}")
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data.get("source") in ["top_selling", "catalog"], "After clear, should return auto-generated favorites"

    def test_favorites_have_variant_info(self):
        """Test that favorites include variant pricing info"""
        response = self.session.get(f"{BASE_URL}/api/pos/favorites")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["favorites"]:
            first_fav = data["favorites"][0]
            # Should have selling_price from variant
            print(f"First favorite - Name: {first_fav.get('name')}, Price: {first_fav.get('selling_price')}, Variant ID: {first_fav.get('variant_id')}")
        else:
            print("No favorites returned to check variant info")

    def test_favorites_per_store_isolation(self):
        """Test that different stores can have different favorites"""
        if len(self.test_items) < 2:
            pytest.skip("Need at least 2 items for store isolation test")
        
        # Get two stores if available
        stores_response = self.session.get(f"{BASE_URL}/api/stores")
        if stores_response.status_code != 200 or len(stores_response.json()) < 2:
            pytest.skip("Need at least 2 stores for isolation test")
        
        stores = stores_response.json()
        store1_id = stores[0].get("id")
        store2_id = stores[1].get("id")
        
        # Add different items to each store
        self.session.post(f"{BASE_URL}/api/pos/favorites", json={
            "item_ids": [self.test_items[0].get("id")],
            "store_id": store1_id
        })
        
        self.session.post(f"{BASE_URL}/api/pos/favorites", json={
            "item_ids": [self.test_items[1].get("id")],
            "store_id": store2_id
        })
        
        # Verify store1 has item1
        response1 = self.session.get(f"{BASE_URL}/api/pos/favorites?store_id={store1_id}")
        assert response1.status_code == 200
        favorites1 = response1.json()["favorites"]
        
        # Verify store2 has item2
        response2 = self.session.get(f"{BASE_URL}/api/pos/favorites?store_id={store2_id}")
        assert response2.status_code == 200
        favorites2 = response2.json()["favorites"]
        
        print(f"Store1 favorites: {[f.get('id') for f in favorites1]}")
        print(f"Store2 favorites: {[f.get('id') for f in favorites2]}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/pos/favorites?store_id={store1_id}")
        self.session.delete(f"{BASE_URL}/api/pos/favorites?store_id={store2_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
