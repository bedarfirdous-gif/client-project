"""
Test Smart Scanner Excel upload, Import confirmation, and Upload History endpoints
Tests the bug fix for 'Body' import in FastAPI
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSmartScannerAndUploadHistory:
    """Test Smart Scanner and Upload History features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get stores for testing
        stores_response = self.session.get(f"{BASE_URL}/api/stores")
        if stores_response.status_code == 200:
            stores = stores_response.json()
            self.store_id = stores[0]["id"] if stores else ""
        else:
            self.store_id = ""
    
    def test_01_excel_upload_endpoint(self):
        """Test /api/smart-scanner/excel endpoint with CSV file"""
        # Create a simple CSV content
        csv_content = """SKU,Name,Category,Brand,Size,Color,MRP,Selling Price,Cost Price,Quantity,Reorder Level,GST Rate
TEST_SKU001,Test Product 1,Electronics,TestBrand,M,Blue,999,899,500,100,10,18
TEST_SKU002,Test Product 2,Clothing,TestBrand2,L,Red,1999,1799,1000,50,5,18
"""
        
        # Create file-like object
        files = {
            'file': ('test_inventory.csv', io.BytesIO(csv_content.encode()), 'text/csv')
        }
        
        # Remove Content-Type header for multipart form
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/smart-scanner/excel",
            files=files,
            data={'store_id': self.store_id},
            headers=headers
        )
        
        print(f"Excel upload response status: {response.status_code}")
        print(f"Excel upload response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Excel upload failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "items" in data, "Response should contain items"
        assert len(data["items"]) >= 2, f"Should have at least 2 items, got {len(data['items'])}"
        
        # Verify item structure
        item = data["items"][0]
        assert "name" in item, "Item should have name"
        assert "sku" in item, "Item should have sku"
        assert "mrp" in item, "Item should have mrp"
        
        print(f"✓ Excel upload successful - found {len(data['items'])} items")
        return data["items"]
    
    def test_02_smart_scanner_import_with_json_body(self):
        """Test /api/smart-scanner/import endpoint with JSON body - tests Body import fix"""
        # This is the main bug fix test - the endpoint should accept JSON body
        items_to_import = [
            {
                "name": "TEST_Import_Product_1",
                "sku": f"TEST_IMP_{os.urandom(4).hex().upper()}",
                "category": "Test Category",
                "brand": "Test Brand",
                "mrp": 999,
                "selling_price": 899,
                "cost_price": 500,
                "quantity": 50
            },
            {
                "name": "TEST_Import_Product_2",
                "sku": f"TEST_IMP_{os.urandom(4).hex().upper()}",
                "category": "Test Category",
                "brand": "Test Brand",
                "mrp": 1499,
                "selling_price": 1299,
                "cost_price": 800,
                "quantity": 30
            }
        ]
        
        response = self.session.post(
            f"{BASE_URL}/api/smart-scanner/import",
            json={
                "items": items_to_import,
                "store_id": self.store_id
            }
        )
        
        print(f"Import response status: {response.status_code}")
        print(f"Import response: {response.text[:500]}")
        
        # This is the critical test - if Body wasn't imported, this would fail with 422
        assert response.status_code == 200, f"Import failed (Body import issue?): {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Import should be successful"
        assert data.get("imported", 0) >= 2, f"Should have imported at least 2 items, got {data.get('imported')}"
        assert "upload_number" in data, "Response should contain upload_number"
        
        print(f"✓ Import successful - imported {data.get('imported')} items, upload #{data.get('upload_number')}")
        return data
    
    def test_03_upload_history_list(self):
        """Test /api/upload-history endpoint - list upload history"""
        response = self.session.get(f"{BASE_URL}/api/upload-history")
        
        print(f"Upload history response status: {response.status_code}")
        
        assert response.status_code == 200, f"Upload history failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Upload history retrieved - {len(data)} records found")
        
        # If we have records, verify structure
        if len(data) > 0:
            record = data[0]
            assert "id" in record, "Record should have id"
            assert "upload_number" in record, "Record should have upload_number"
            assert "status" in record, "Record should have status"
            assert "created_at" in record, "Record should have created_at"
            print(f"  Latest upload: #{record.get('upload_number')} - {record.get('status')}")
        
        return data
    
    def test_04_upload_history_delete(self):
        """Test /api/upload-history/{id} DELETE endpoint"""
        # First get history to find an ID to delete
        history_response = self.session.get(f"{BASE_URL}/api/upload-history")
        assert history_response.status_code == 200
        
        history = history_response.json()
        
        if len(history) == 0:
            # Create one first
            self.test_02_smart_scanner_import_with_json_body()
            history_response = self.session.get(f"{BASE_URL}/api/upload-history")
            history = history_response.json()
        
        if len(history) > 0:
            upload_id = history[0]["id"]
            
            response = self.session.delete(f"{BASE_URL}/api/upload-history/{upload_id}")
            
            print(f"Delete upload history response status: {response.status_code}")
            
            assert response.status_code == 200, f"Delete failed: {response.text}"
            
            data = response.json()
            assert data.get("success") == True, "Delete should be successful"
            
            print(f"✓ Upload history record deleted successfully")
        else:
            print("⚠ No upload history records to delete")
    
    def test_05_import_empty_items_validation(self):
        """Test import endpoint with empty items - should return 400"""
        response = self.session.post(
            f"{BASE_URL}/api/smart-scanner/import",
            json={
                "items": [],
                "store_id": self.store_id
            }
        )
        
        print(f"Empty import response status: {response.status_code}")
        
        # Should return 400 for empty items
        assert response.status_code == 400, f"Should reject empty items, got {response.status_code}"
        print("✓ Empty items validation working correctly")
    
    def test_06_verify_imported_items_in_database(self):
        """Verify that imported items actually exist in the items collection"""
        # First import some items
        test_sku = f"TEST_VERIFY_{os.urandom(4).hex().upper()}"
        
        import_response = self.session.post(
            f"{BASE_URL}/api/smart-scanner/import",
            json={
                "items": [{
                    "name": "TEST_Verify_Product",
                    "sku": test_sku,
                    "category": "Verification Test",
                    "mrp": 500,
                    "selling_price": 450,
                    "quantity": 10
                }],
                "store_id": self.store_id
            }
        )
        
        assert import_response.status_code == 200, f"Import failed: {import_response.text}"
        
        # Now search for the item
        items_response = self.session.get(f"{BASE_URL}/api/items?search={test_sku}")
        
        assert items_response.status_code == 200, f"Items search failed: {items_response.text}"
        
        items = items_response.json()
        
        # Find our test item
        found = any(item.get("sku") == test_sku for item in items)
        assert found, f"Imported item with SKU {test_sku} not found in items"
        
        print(f"✓ Imported item verified in database - SKU: {test_sku}")


class TestSmartScannerExcelFormats:
    """Test different Excel/CSV format handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - get auth token"""
        self.session = requests.Session()
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data["access_token"]
        
        # Get store
        stores_response = self.session.get(
            f"{BASE_URL}/api/stores",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        if stores_response.status_code == 200:
            stores = stores_response.json()
            self.store_id = stores[0]["id"] if stores else ""
        else:
            self.store_id = ""
    
    def test_csv_with_different_column_names(self):
        """Test CSV with alternative column names (item_name, product_code, etc.)"""
        csv_content = """item_name,product_code,category_name,brand_name,selling,cost,qty
Test Alt Product,ALT001,Alt Category,Alt Brand,999,500,25
"""
        
        files = {'file': ('alt_columns.csv', io.BytesIO(csv_content.encode()), 'text/csv')}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/smart-scanner/excel",
            files=files,
            data={'store_id': self.store_id},
            headers=headers
        )
        
        assert response.status_code == 200, f"Alt column CSV failed: {response.text}"
        
        data = response.json()
        assert len(data.get("items", [])) >= 1, "Should parse at least 1 item"
        
        item = data["items"][0]
        assert item.get("name") == "Test Alt Product", "Name should be mapped from item_name"
        assert item.get("sku") == "ALT001", "SKU should be mapped from product_code"
        
        print("✓ Alternative column names mapped correctly")
    
    def test_csv_with_empty_sku(self):
        """Test CSV where SKU is empty - should auto-generate"""
        csv_content = """Name,SKU,Category,MRP,Selling Price,Quantity
Product Without SKU,,Test Cat,500,450,10
"""
        
        files = {'file': ('no_sku.csv', io.BytesIO(csv_content.encode()), 'text/csv')}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/smart-scanner/excel",
            files=files,
            data={'store_id': self.store_id},
            headers=headers
        )
        
        assert response.status_code == 200, f"Empty SKU CSV failed: {response.text}"
        
        data = response.json()
        assert len(data.get("items", [])) >= 1, "Should parse at least 1 item"
        
        item = data["items"][0]
        assert item.get("sku"), "SKU should be auto-generated when empty"
        
        print(f"✓ Empty SKU auto-generated: {item.get('sku')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
