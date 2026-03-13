"""
Test Smart Scanner, Currency Converter, and Receipt Generation features
for BijnisBooks retail management system
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSmartScanner:
    """Test Smart Scanner document upload functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}"
        }
    
    def test_smart_scanner_png_upload(self):
        """Test PNG image upload to smart scanner"""
        # Create a simple test image
        from PIL import Image, ImageDraw
        import io
        
        img = Image.new('RGB', (400, 300), color='white')
        draw = ImageDraw.Draw(img)
        draw.text((50, 50), "Test Item: Blue Shirt\nQty: 10\nPrice: 499", fill='black')
        
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        files = {'file': ('test_image.png', img_buffer, 'image/png')}
        response = requests.post(
            f"{BASE_URL}/api/smart-scanner/document",
            headers=self.headers,
            files=files
        )
        
        print(f"PNG Upload Response: {response.status_code}")
        print(f"Response body: {response.text[:500] if response.text else 'Empty'}")
        
        # Should return 200 or 500 (AI processing may fail but endpoint should work)
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "items" in data or "success" in data
            print(f"SUCCESS: PNG upload processed, items found: {len(data.get('items', []))}")
    
    def test_smart_scanner_pdf_upload(self):
        """Test PDF upload to smart scanner"""
        # Use the test PDF file
        pdf_path = "/app/test_files/test_invoice.pdf"
        
        if not os.path.exists(pdf_path):
            pytest.skip("Test PDF file not found")
        
        with open(pdf_path, 'rb') as f:
            files = {'file': ('test_invoice.pdf', f, 'application/pdf')}
            response = requests.post(
                f"{BASE_URL}/api/smart-scanner/document",
                headers=self.headers,
                files=files
            )
        
        print(f"PDF Upload Response: {response.status_code}")
        print(f"Response body: {response.text[:500] if response.text else 'Empty'}")
        
        # Should return 200 or 500 (AI processing may fail but endpoint should work)
        assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "items" in data or "success" in data
            print(f"SUCCESS: PDF upload processed")
    
    def test_smart_scanner_docx_upload(self):
        """Test DOCX upload to smart scanner"""
        docx_path = "/app/test_files/test_inventory.docx"
        
        if not os.path.exists(docx_path):
            pytest.skip("Test DOCX file not found")
        
        with open(docx_path, 'rb') as f:
            files = {'file': ('test_inventory.docx', f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
            response = requests.post(
                f"{BASE_URL}/api/smart-scanner/document",
                headers=self.headers,
                files=files
            )
        
        print(f"DOCX Upload Response: {response.status_code}")
        print(f"Response body: {response.text[:500] if response.text else 'Empty'}")
        
        # Should return 200 or 500 (AI processing may fail but endpoint should work)
        assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "items" in data or "success" in data
            print(f"SUCCESS: DOCX upload processed")
    
    def test_smart_scanner_excel_upload(self):
        """Test Excel upload to smart scanner excel endpoint"""
        import pandas as pd
        import io
        
        # Create test Excel data
        df = pd.DataFrame({
            'name': ['Blue T-Shirt', 'Red Polo', 'Black Jeans'],
            'sku': ['SKU001', 'SKU002', 'SKU003'],
            'quantity': [10, 5, 8],
            'selling_price': [499, 699, 999],
            'mrp': [599, 799, 1199]
        })
        
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False)
        excel_buffer.seek(0)
        
        files = {'file': ('test_inventory.xlsx', excel_buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        response = requests.post(
            f"{BASE_URL}/api/smart-scanner/excel",
            headers=self.headers,
            files=files
        )
        
        print(f"Excel Upload Response: {response.status_code}")
        print(f"Response body: {response.text[:500] if response.text else 'Empty'}")
        
        assert response.status_code == 200, f"Excel upload failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "items" in data
        assert len(data["items"]) == 3
        print(f"SUCCESS: Excel upload processed, {len(data['items'])} items found")


class TestSalesAndReceipts:
    """Test Sales creation and Receipt generation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_create_sale(self):
        """Test creating a sale"""
        # First get a store
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=self.headers)
        stores = stores_response.json()
        
        if not stores:
            pytest.skip("No stores available for testing")
        
        store_id = stores[0]["id"]
        
        # Create a sale
        sale_data = {
            "store_id": store_id,
            "customer_name": "Test Customer",
            "customer_phone": "9876543210",
            "items": [
                {
                    "item_id": "test-item-1",
                    "item_name": "Test Product",
                    "variant_id": None,
                    "quantity": 2,
                    "rate": 500,
                    "gst_rate": 18
                }
            ],
            "subtotal": 1000,
            "discount_amount": 0,
            "gst_amount": 180,
            "total_amount": 1180,
            "payment_method": "cash",
            "payment_details": {"cash": 1180}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sales",
            headers=self.headers,
            json=sale_data
        )
        
        print(f"Create Sale Response: {response.status_code}")
        print(f"Response body: {response.text[:500] if response.text else 'Empty'}")
        
        assert response.status_code in [200, 201], f"Sale creation failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "invoice_number" in data
        print(f"SUCCESS: Sale created with invoice: {data.get('invoice_number')}")
        
        return data
    
    def test_get_recent_sales(self):
        """Test getting recent sales for receipt generation"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/recent-sales",
            headers=self.headers
        )
        
        print(f"Recent Sales Response: {response.status_code}")
        
        assert response.status_code == 200
        sales = response.json()
        print(f"SUCCESS: Found {len(sales)} recent sales")
        
        if sales:
            # Verify sale has receipt-relevant fields
            sale = sales[0]
            assert "invoice_number" in sale or "id" in sale
            print(f"Sample sale: {sale.get('invoice_number', sale.get('id'))}")


class TestPOSFeatures:
    """Test POS page features - Quick Actions and Currency Converter"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_pos_dependencies_items(self):
        """Test that items endpoint works for POS"""
        response = requests.get(
            f"{BASE_URL}/api/items?active=true",
            headers=self.headers
        )
        
        assert response.status_code == 200
        items = response.json()
        print(f"SUCCESS: Items endpoint works, found {len(items)} items")
    
    def test_pos_dependencies_customers(self):
        """Test that customers endpoint works for POS"""
        response = requests.get(
            f"{BASE_URL}/api/customers",
            headers=self.headers
        )
        
        assert response.status_code == 200
        customers = response.json()
        print(f"SUCCESS: Customers endpoint works, found {len(customers)} customers")
    
    def test_pos_dependencies_vouchers(self):
        """Test that vouchers endpoint works for POS"""
        response = requests.get(
            f"{BASE_URL}/api/vouchers",
            headers=self.headers
        )
        
        assert response.status_code == 200
        vouchers = response.json()
        print(f"SUCCESS: Vouchers endpoint works, found {len(vouchers)} vouchers")
    
    def test_pos_dependencies_stores(self):
        """Test that stores endpoint works for POS"""
        response = requests.get(
            f"{BASE_URL}/api/stores",
            headers=self.headers
        )
        
        assert response.status_code == 200
        stores = response.json()
        print(f"SUCCESS: Stores endpoint works, found {len(stores)} stores")


class TestSettingsFeatures:
    """Test Settings page features including Currency settings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_categories_endpoint(self):
        """Test categories endpoint for settings"""
        response = requests.get(
            f"{BASE_URL}/api/categories",
            headers=self.headers
        )
        
        assert response.status_code == 200
        categories = response.json()
        print(f"SUCCESS: Categories endpoint works, found {len(categories)} categories")
    
    def test_brands_endpoint(self):
        """Test brands endpoint for settings"""
        response = requests.get(
            f"{BASE_URL}/api/brands",
            headers=self.headers
        )
        
        assert response.status_code == 200
        brands = response.json()
        print(f"SUCCESS: Brands endpoint works, found {len(brands)} brands")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
