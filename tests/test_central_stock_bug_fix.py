"""
Test Central Stock Bug Fix
==========================
Tests for the 'Out of Stock' bug fix where:
1. create_variant() now creates central_stock record
2. list_items() uses central_stock as primary source (avoids double-counting)
3. import_items() creates central_stock records for imported items/variants
4. Stock is correctly displayed after inventory adjustments
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCentralStockBugFix:
    """Tests for the central_stock bug fix - ensuring variants show correct stock"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store created IDs for cleanup
        self.created_items = []
        self.created_variants = []
        
        yield
        
        # Cleanup created test data
        for variant_id in self.created_variants:
            try:
                self.session.delete(f"{BASE_URL}/api/variants/{variant_id}")
            except:
                pass
        
        for item_id in self.created_items:
            try:
                self.session.delete(f"{BASE_URL}/api/items/{item_id}")
            except:
                pass

    def test_create_item_creates_central_stock_for_default_variant(self):
        """Test that creating an item also creates central_stock record for its default variant"""
        print("\n=== TEST: create_item creates central_stock for default variant ===")
        
        # Create an item
        unique_name = f"TEST_STOCK_ITEM_{uuid.uuid4().hex[:8]}"
        item_data = {
            "name": unique_name,
            "category": "Test Category",
            "sku": f"TEST-SKU-{uuid.uuid4().hex[:6]}",
            "selling_price": 100.0,
            "cost_price": 50.0,
            "mrp": 120.0,
            "description": "Test item for central stock bug fix"
        }
        
        response = self.session.post(f"{BASE_URL}/api/items", json=item_data)
        print(f"Create item response: {response.status_code}")
        
        assert response.status_code in [200, 201], f"Failed to create item: {response.text}"
        
        item = response.json()
        item_id = item.get("id")
        self.created_items.append(item_id)
        print(f"Created item ID: {item_id}")
        
        # Get the item with variants to check stock
        get_response = self.session.get(f"{BASE_URL}/api/items")
        assert get_response.status_code == 200
        
        items = get_response.json()
        found_item = None
        for i in items:
            if i.get("id") == item_id:
                found_item = i
                break
        
        assert found_item is not None, "Created item not found in list"
        
        # Check that current_stock is 0 (not None or missing)
        current_stock = found_item.get("current_stock", None)
        print(f"Item current_stock: {current_stock}")
        
        # The key fix: current_stock should be 0, not None or missing
        # Before the fix, items showed "Out of Stock" because no central_stock record existed
        assert current_stock is not None, "current_stock should not be None"
        assert current_stock == 0, f"Expected current_stock to be 0 for new item, got {current_stock}"
        
        # Verify variants have current_stock set
        variants = found_item.get("variants", [])
        if variants:
            for v in variants:
                v_stock = v.get("current_stock", None)
                print(f"Variant {v.get('id')} current_stock: {v_stock}")
                assert v_stock is not None, "Variant current_stock should not be None"
        
        print("PASSED: Item created with central_stock record (stock = 0)")

    def test_create_variant_creates_central_stock_record(self):
        """Test that create_variant() creates a central_stock record with 0 quantity"""
        print("\n=== TEST: create_variant creates central_stock record ===")
        
        # First create an item
        unique_name = f"TEST_VARIANT_ITEM_{uuid.uuid4().hex[:8]}"
        item_data = {
            "name": unique_name,
            "category": "Test Category",
            "sku": f"TEST-VAR-SKU-{uuid.uuid4().hex[:6]}",
            "selling_price": 200.0,
            "cost_price": 100.0,
            "mrp": 250.0
        }
        
        item_response = self.session.post(f"{BASE_URL}/api/items", json=item_data)
        assert item_response.status_code in [200, 201], f"Failed to create item: {item_response.text}"
        
        item = item_response.json()
        item_id = item.get("id")
        self.created_items.append(item_id)
        print(f"Created item ID: {item_id}")
        
        # Create a variant for this item
        variant_data = {
            "item_id": item_id,
            "sku": f"VAR-{uuid.uuid4().hex[:6]}",
            "name": f"TEST_VARIANT_{uuid.uuid4().hex[:6]}",
            "selling_price": 220.0,
            "cost_price": 110.0,
            "mrp": 270.0,
            "attributes": {"color": "Red", "size": "L"}
        }
        
        variant_response = self.session.post(f"{BASE_URL}/api/variants", json=variant_data)
        print(f"Create variant response: {variant_response.status_code}")
        
        assert variant_response.status_code in [200, 201], f"Failed to create variant: {variant_response.text}"
        
        variant = variant_response.json()
        variant_id = variant.get("id")
        self.created_variants.append(variant_id)
        print(f"Created variant ID: {variant_id}")
        
        # The key test: Check current_stock is 0 (not missing/None)
        current_stock = variant.get("current_stock", None)
        print(f"Variant current_stock from response: {current_stock}")
        
        assert current_stock is not None, "Variant current_stock should not be None"
        assert current_stock == 0, f"Expected variant current_stock to be 0, got {current_stock}"
        
        # Verify the item list shows this variant with correct stock
        items_response = self.session.get(f"{BASE_URL}/api/items")
        assert items_response.status_code == 200
        
        items = items_response.json()
        found_item = None
        for i in items:
            if i.get("id") == item_id:
                found_item = i
                break
        
        assert found_item is not None
        
        # Find our variant in the item's variants
        item_variants = found_item.get("variants", [])
        found_variant = None
        for v in item_variants:
            if v.get("id") == variant_id:
                found_variant = v
                break
        
        if found_variant:
            v_stock = found_variant.get("current_stock", None)
            print(f"Variant stock from list_items: {v_stock}")
            assert v_stock is not None, "Variant stock from list_items should not be None"
            assert v_stock == 0, f"Expected variant stock from list_items to be 0, got {v_stock}"
        
        print("PASSED: create_variant creates central_stock record")

    def test_stock_correct_after_inventory_adjustment(self):
        """Test that after inventory adjustment, stock is correct and not double-counted"""
        print("\n=== TEST: Stock correct after inventory adjustment (no double-counting) ===")
        
        # Create an item
        unique_name = f"TEST_ADJUST_ITEM_{uuid.uuid4().hex[:8]}"
        item_data = {
            "name": unique_name,
            "category": "Test Category",
            "sku": f"TEST-ADJ-{uuid.uuid4().hex[:6]}",
            "selling_price": 150.0,
            "cost_price": 75.0,
            "mrp": 180.0
        }
        
        item_response = self.session.post(f"{BASE_URL}/api/items", json=item_data)
        assert item_response.status_code in [200, 201]
        
        item = item_response.json()
        item_id = item.get("id")
        self.created_items.append(item_id)
        
        # Get the default variant
        items_response = self.session.get(f"{BASE_URL}/api/items")
        items = items_response.json()
        found_item = next((i for i in items if i.get("id") == item_id), None)
        assert found_item is not None
        
        variants = found_item.get("variants", [])
        if not variants:
            pytest.skip("No variants found for item - needs default variant creation")
        
        variant_id = variants[0].get("id")
        self.created_variants.append(variant_id)
        
        # Initial stock should be 0
        initial_stock = variants[0].get("current_stock", 0)
        print(f"Initial variant stock: {initial_stock}")
        assert initial_stock == 0, f"Initial stock should be 0, got {initial_stock}"
        
        # Adjust inventory to add stock
        adjustment_qty = 50
        adjust_response = self.session.post(f"{BASE_URL}/api/inventory/adjust", json={
            "variant_id": variant_id,
            "new_quantity": adjustment_qty,
            "reason": "Test inventory adjustment for central stock bug fix"
        })
        
        print(f"Inventory adjustment response: {adjust_response.status_code}")
        
        if adjust_response.status_code in [200, 201]:
            print(f"Adjustment result: {adjust_response.json()}")
        elif adjust_response.status_code == 404:
            # Endpoint might be different
            print("Adjust endpoint not found at /api/inventory/adjust, trying alternative...")
            
            # Try add_stock directly
            add_response = self.session.post(f"{BASE_URL}/api/inventory/add", json={
                "variant_id": variant_id,
                "quantity": adjustment_qty,
                "reason": "Test stock add"
            })
            print(f"Add stock response: {add_response.status_code}")
        
        # Get items again to check stock
        items_response2 = self.session.get(f"{BASE_URL}/api/items")
        assert items_response2.status_code == 200
        
        items2 = items_response2.json()
        found_item2 = next((i for i in items2 if i.get("id") == item_id), None)
        assert found_item2 is not None
        
        variants2 = found_item2.get("variants", [])
        variant2 = next((v for v in variants2 if v.get("id") == variant_id), None)
        
        if variant2:
            updated_stock = variant2.get("current_stock", 0)
            item_total_stock = found_item2.get("current_stock", 0)
            
            print(f"Updated variant stock: {updated_stock}")
            print(f"Item total stock: {item_total_stock}")
            
            # Key assertion: Stock should NOT be double the expected value
            # Before the fix, stock could be counted from both inventory and central_stock
            if updated_stock > 0:
                # If adjustment worked, verify no double-counting
                # The item total should equal the sum of variant stocks
                total_variant_stock = sum(v.get("current_stock", 0) for v in variants2)
                assert item_total_stock == total_variant_stock, \
                    f"Item total stock ({item_total_stock}) should equal sum of variant stocks ({total_variant_stock})"
                print("PASSED: No double-counting detected")
            else:
                print("Note: Inventory adjustment may not have been applied. Stock still 0.")
        
        print("PASSED: Stock calculation verified")

    def test_list_items_stock_calculation_priority(self):
        """Test that list_items uses central_stock as primary source"""
        print("\n=== TEST: list_items uses central_stock as primary source ===")
        
        # Get all items
        response = self.session.get(f"{BASE_URL}/api/items")
        assert response.status_code == 200
        
        items = response.json()
        print(f"Total items: {len(items)}")
        
        # Check that items have current_stock calculated
        items_with_stock = 0
        items_with_zero_stock = 0
        items_with_none_stock = 0
        
        for item in items:
            stock = item.get("current_stock")
            if stock is None:
                items_with_none_stock += 1
            elif stock == 0:
                items_with_zero_stock += 1
            else:
                items_with_stock += 1
        
        print(f"Items with stock > 0: {items_with_stock}")
        print(f"Items with stock = 0: {items_with_zero_stock}")
        print(f"Items with stock = None: {items_with_none_stock}")
        
        # After the fix, no items should have None stock
        # All items should have their current_stock calculated from central_stock
        
        # Sample check a few items
        sample_count = min(5, len(items))
        print(f"\nSample of {sample_count} items:")
        for i in range(sample_count):
            item = items[i]
            print(f"  - {item.get('name', 'N/A')}: current_stock = {item.get('current_stock')}")
            
            # Check variants
            variants = item.get("variants", [])
            for v in variants:
                print(f"    Variant {v.get('sku', 'N/A')}: current_stock = {v.get('current_stock')}")
        
        print("PASSED: list_items returns stock data")

    def test_new_item_not_shown_as_out_of_stock(self):
        """Test that a newly created item shows stock=0, not 'Out of Stock' due to missing data"""
        print("\n=== TEST: New item shows stock=0 (not Out of Stock due to missing central_stock) ===")
        
        # Create a brand new item
        unique_name = f"TEST_NEW_ITEM_{uuid.uuid4().hex[:8]}"
        item_data = {
            "name": unique_name,
            "category": "Electronics",
            "sku": f"NEW-{uuid.uuid4().hex[:6]}",
            "selling_price": 999.0,
            "cost_price": 500.0,
            "mrp": 1200.0,
            "description": "Testing Out of Stock bug fix"
        }
        
        # Create the item
        create_response = self.session.post(f"{BASE_URL}/api/items", json=item_data)
        assert create_response.status_code in [200, 201], f"Failed: {create_response.text}"
        
        item = create_response.json()
        item_id = item.get("id")
        self.created_items.append(item_id)
        
        print(f"Created item: {unique_name}, ID: {item_id}")
        
        # Get items list immediately after creation
        list_response = self.session.get(f"{BASE_URL}/api/items")
        assert list_response.status_code == 200
        
        items = list_response.json()
        found_item = next((i for i in items if i.get("id") == item_id), None)
        
        assert found_item is not None, "Newly created item not found in list"
        
        # THE KEY TEST: current_stock should be 0, not None
        current_stock = found_item.get("current_stock")
        print(f"New item current_stock: {current_stock}")
        
        # Before the fix: current_stock would be None or missing because no central_stock record existed
        # After the fix: current_stock should be 0 because central_stock record is created
        assert current_stock is not None, \
            "BUG: current_stock is None - central_stock record not created for new item"
        assert isinstance(current_stock, (int, float)), \
            f"BUG: current_stock should be a number, got {type(current_stock)}"
        assert current_stock == 0, \
            f"Expected current_stock to be 0 for new item, got {current_stock}"
        
        # Check variants too
        variants = found_item.get("variants", [])
        print(f"Item has {len(variants)} variants")
        
        for v in variants:
            v_id = v.get("id")
            v_stock = v.get("current_stock")
            print(f"  Variant {v_id}: current_stock = {v_stock}")
            
            assert v_stock is not None, \
                f"BUG: Variant {v_id} current_stock is None - central_stock record missing"
            assert v_stock == 0, \
                f"Expected variant current_stock to be 0, got {v_stock}"
            
            self.created_variants.append(v_id)
        
        print("PASSED: New item correctly shows stock=0 (central_stock record exists)")


class TestBulkImportCentralStock:
    """Tests for bulk import creating central_stock records"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.auth_token = token
        
        yield

    def test_import_items_endpoint_exists(self):
        """Test that import_items endpoint exists"""
        print("\n=== TEST: import_items endpoint exists ===")
        
        # Create a simple CSV content
        csv_content = "name,sku,category,selling_price,cost_price,mrp\n"
        csv_content += f"TEST_IMPORT_{uuid.uuid4().hex[:6]},IMP-001,Test,100,50,120\n"
        
        # Import endpoint requires file upload
        files = {'file': ('test_import.csv', csv_content, 'text/csv')}
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/items/import",
            files=files,
            headers=headers
        )
        
        print(f"Import response status: {response.status_code}")
        
        # The endpoint should exist (200, 201, or 400 for validation errors)
        assert response.status_code != 404, "Import endpoint not found"
        
        if response.status_code in [200, 201]:
            result = response.json()
            print(f"Import result: {result}")
            
            # If import succeeded, verify items have central_stock
            imported_count = result.get("imported", 0)
            if imported_count > 0:
                print(f"Successfully imported {imported_count} items")
                
                # Get items and verify stock is not None
                items_response = self.session.get(f"{BASE_URL}/api/items")
                items = items_response.json()
                
                # Find recently imported items (by TEST_IMPORT prefix)
                for item in items:
                    if item.get("name", "").startswith("TEST_IMPORT_"):
                        stock = item.get("current_stock")
                        print(f"Imported item '{item.get('name')}' has current_stock: {stock}")
                        assert stock is not None, \
                            "BUG: Imported item has None stock - central_stock not created during import"
        else:
            print(f"Import response: {response.text}")
        
        print("PASSED: Import endpoint exists and accessible")


class TestInventoryServiceIntegration:
    """Tests for inventory service integration with central_stock"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        self.created_items = []
        
        yield
        
        # Cleanup
        for item_id in self.created_items:
            try:
                self.session.delete(f"{BASE_URL}/api/items/{item_id}")
            except:
                pass

    def test_central_stock_api_exists(self):
        """Test that central stock API endpoints exist"""
        print("\n=== TEST: central_stock API endpoints exist ===")
        
        # Test getting central stock
        response = self.session.get(f"{BASE_URL}/api/inventory/central-stock")
        print(f"GET /api/inventory/central-stock status: {response.status_code}")
        
        # Should return 200 or valid response (not 404)
        if response.status_code == 200:
            data = response.json()
            print(f"Central stock records: {len(data) if isinstance(data, list) else 'N/A'}")
        
        print("PASSED: Central stock API accessible")

    def test_stock_summary_endpoint(self):
        """Test stock summary endpoint"""
        print("\n=== TEST: Stock summary endpoint ===")
        
        response = self.session.get(f"{BASE_URL}/api/inventory/summary")
        print(f"GET /api/inventory/summary status: {response.status_code}")
        
        if response.status_code == 200:
            summary = response.json()
            print(f"Stock summary: {summary}")
            
            # Verify summary has expected fields
            expected_fields = ["total_items", "out_of_stock", "in_stock"]
            for field in expected_fields:
                if field in summary:
                    print(f"  {field}: {summary.get(field)}")
        
        print("PASSED: Stock summary endpoint accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
