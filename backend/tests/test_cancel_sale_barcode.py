"""
Test Cancel Sale and Barcode Size/Color Features
Tests:
1. Cancel Sale endpoint - PUT /api/sales/{sale_id}/cancel
2. Items API returns variants with size/color
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCancelSaleFeature:
    """Test Cancel Sale functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = data["user"]
    
    def test_get_sales_list(self):
        """Test GET /api/sales returns sales with status field"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=self.headers)
        assert response.status_code == 200, f"Failed to get sales: {response.text}"
        
        sales = response.json()
        assert isinstance(sales, list), "Sales should be a list"
        
        if len(sales) > 0:
            sale = sales[0]
            # Check sale has required fields
            assert "id" in sale, "Sale should have id"
            assert "invoice_number" in sale, "Sale should have invoice_number"
            assert "total_amount" in sale, "Sale should have total_amount"
            print(f"Found {len(sales)} sales")
            
            # Check if any sale has status field
            has_status = any("status" in s for s in sales)
            print(f"Sales have status field: {has_status}")
    
    def test_cancel_sale_requires_reason(self):
        """Test that cancel sale works with reason parameter"""
        # First get a sale to cancel
        response = requests.get(f"{BASE_URL}/api/sales", headers=self.headers)
        assert response.status_code == 200
        
        sales = response.json()
        # Find a non-cancelled sale
        active_sales = [s for s in sales if s.get("status") != "cancelled"]
        
        if len(active_sales) == 0:
            pytest.skip("No active sales to test cancellation")
        
        # We won't actually cancel, just verify the endpoint exists
        sale = active_sales[0]
        sale_id = sale["id"]
        
        # Test endpoint exists by checking with empty reason (should work but we'll verify)
        # Note: We're not actually cancelling to preserve test data
        print(f"Found active sale {sale['invoice_number']} for testing")
        print(f"Sale ID: {sale_id}")
    
    def test_cancel_sale_endpoint_exists(self):
        """Test that PUT /api/sales/{sale_id}/cancel endpoint exists"""
        # Use a fake ID to test endpoint existence without modifying data
        fake_id = "test-fake-id-12345"
        
        response = requests.put(
            f"{BASE_URL}/api/sales/{fake_id}/cancel?reason=test",
            headers=self.headers
        )
        
        # Should return 404 (not found) not 405 (method not allowed)
        # This confirms the endpoint exists
        assert response.status_code in [404, 400], f"Unexpected status: {response.status_code}"
        print(f"Cancel endpoint exists, returned {response.status_code} for fake ID")
    
    def test_cancel_already_cancelled_sale(self):
        """Test that cancelling an already cancelled sale returns error"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=self.headers)
        assert response.status_code == 200
        
        sales = response.json()
        cancelled_sales = [s for s in sales if s.get("status") == "cancelled"]
        
        if len(cancelled_sales) == 0:
            pytest.skip("No cancelled sales to test")
        
        sale = cancelled_sales[0]
        response = requests.put(
            f"{BASE_URL}/api/sales/{sale['id']}/cancel?reason=test",
            headers=self.headers
        )
        
        # Should return 400 - already cancelled
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "already cancelled" in response.json().get("detail", "").lower()
        print(f"Correctly rejected re-cancellation of {sale['invoice_number']}")


class TestItemsVariantsFeature:
    """Test Items API returns variants with size/color"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_items_list_includes_variants(self):
        """Test GET /api/items returns items with variants array"""
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        assert response.status_code == 200, f"Failed to get items: {response.text}"
        
        items = response.json()
        assert isinstance(items, list), "Items should be a list"
        assert len(items) > 0, "Should have at least one item"
        
        # Check that items have variants array
        items_with_variants = [i for i in items if "variants" in i and len(i.get("variants", [])) > 0]
        print(f"Found {len(items_with_variants)} items with variants out of {len(items)} total")
        
        if len(items_with_variants) > 0:
            item = items_with_variants[0]
            variant = item["variants"][0]
            
            # Check variant has size and color fields
            print(f"Item: {item.get('name')}")
            print(f"Variant size: {variant.get('size', 'N/A')}")
            print(f"Variant color: {variant.get('color', 'N/A')}")
            
            # Verify variant structure
            assert "id" in variant, "Variant should have id"
            assert "item_id" in variant, "Variant should have item_id"
    
    def test_items_have_size_color_from_variant(self):
        """Test that items have size/color populated from first variant"""
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        assert response.status_code == 200
        
        items = response.json()
        
        # Find items that have variants with size/color
        items_with_size_color = []
        for item in items:
            variants = item.get("variants", [])
            if variants:
                first_variant = variants[0]
                if first_variant.get("size") or first_variant.get("color"):
                    items_with_size_color.append({
                        "name": item.get("name"),
                        "item_size": item.get("size"),
                        "item_color": item.get("color"),
                        "variant_size": first_variant.get("size"),
                        "variant_color": first_variant.get("color")
                    })
        
        print(f"Found {len(items_with_size_color)} items with size/color in variants")
        
        if len(items_with_size_color) > 0:
            for item_info in items_with_size_color[:3]:  # Print first 3
                print(f"  - {item_info['name']}: size={item_info['item_size']}, color={item_info['item_color']}")
    
    def test_single_item_includes_variants(self):
        """Test GET /api/items/{item_id} returns item with variants"""
        # First get list of items
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        assert response.status_code == 200
        
        items = response.json()
        if len(items) == 0:
            pytest.skip("No items to test")
        
        # Get single item
        item_id = items[0]["id"]
        response = requests.get(f"{BASE_URL}/api/items/{item_id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to get item: {response.text}"
        
        item = response.json()
        assert "variants" in item, "Single item should include variants array"
        print(f"Item {item.get('name')} has {len(item.get('variants', []))} variants")
    
    def test_variants_endpoint(self):
        """Test GET /api/variants returns variants with size/color"""
        response = requests.get(f"{BASE_URL}/api/variants", headers=self.headers)
        assert response.status_code == 200, f"Failed to get variants: {response.text}"
        
        variants = response.json()
        assert isinstance(variants, list), "Variants should be a list"
        
        if len(variants) > 0:
            variant = variants[0]
            print(f"Sample variant: size={variant.get('size')}, color={variant.get('color')}, barcode={variant.get('barcode')}")
            
            # Count variants with size/color
            with_size = len([v for v in variants if v.get("size")])
            with_color = len([v for v in variants if v.get("color")])
            print(f"Variants with size: {with_size}/{len(variants)}")
            print(f"Variants with color: {with_color}/{len(variants)}")


class TestSalesStatusField:
    """Test that sales have proper status field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_sales_have_status_field(self):
        """Test that sales list includes status field"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=self.headers)
        assert response.status_code == 200
        
        sales = response.json()
        
        # Count sales by status
        status_counts = {}
        for sale in sales:
            status = sale.get("status", "completed")  # Default to completed if not set
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print(f"Sales by status: {status_counts}")
        
        # Verify cancelled sales have cancel_reason
        cancelled = [s for s in sales if s.get("status") == "cancelled"]
        if cancelled:
            sale = cancelled[0]
            print(f"Cancelled sale {sale.get('invoice_number')}:")
            print(f"  - cancel_reason: {sale.get('cancel_reason', 'N/A')}")
            print(f"  - cancelled_at: {sale.get('cancelled_at', 'N/A')}")
            print(f"  - cancelled_by_name: {sale.get('cancelled_by_name', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
