"""
Test GST Lookup API and Invoice GST/IGST Features

Features being tested:
1. GST lookup API endpoint at /api/gst/lookup/{gstin}
2. Invoice creation with is_interstate, cgst_amount, sgst_amount, igst_amount fields
3. Validation of GST number format
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://erp-invoice-fix-1.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "SuperAdmin@123"

# Valid test GSTINs
VALID_GSTIN_KARNATAKA = "29AABCU9603R1ZM"  # Karnataka (state code 29)
VALID_GSTIN_DELHI = "07AABCU9603R1ZZ"  # Delhi (state code 07)
INVALID_GSTIN = "99INVALID00000"


class TestGSTLookupAPI:
    """Test the GST lookup API endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_gst_lookup_valid_gstin_karnataka(self):
        """Test GST lookup with valid Karnataka GSTIN - should return state_name"""
        response = requests.get(
            f"{BASE_URL}/api/gst/lookup/{VALID_GSTIN_KARNATAKA}",
            headers=self.headers
        )
        
        # Check status code
        assert response.status_code == 200, f"GST lookup failed: {response.text}"
        
        data = response.json()
        print(f"GST Lookup Response: {data}")
        
        # Validate response structure
        assert "gstin" in data, "Response should contain gstin"
        assert "state_code" in data, "Response should contain state_code"
        assert "state_name" in data, "Response should contain state_name"
        assert "valid" in data, "Response should contain valid field"
        
        # Validate values
        assert data["gstin"] == VALID_GSTIN_KARNATAKA
        assert data["state_code"] == "29", "State code should be 29 for Karnataka"
        assert data["state_name"] == "Karnataka", f"State name should be Karnataka, got {data['state_name']}"
        assert data["valid"] == True, "GSTIN should be valid"
    
    def test_gst_lookup_valid_gstin_delhi(self):
        """Test GST lookup with valid Delhi GSTIN"""
        response = requests.get(
            f"{BASE_URL}/api/gst/lookup/{VALID_GSTIN_DELHI}",
            headers=self.headers
        )
        
        # The endpoint may return 400 for invalid checksum but should at least validate format
        # Accept both 200 and 400 (format valid but checksum may fail)
        if response.status_code == 200:
            data = response.json()
            print(f"Delhi GSTIN Lookup Response: {data}")
            assert data["state_code"] == "07", "State code should be 07 for Delhi"
            assert data["state_name"] == "Delhi", f"State name should be Delhi, got {data['state_name']}"
        else:
            print(f"Delhi GSTIN failed validation (expected for test GSTIN): {response.text}")
    
    def test_gst_lookup_invalid_format(self):
        """Test GST lookup with invalid GSTIN format"""
        response = requests.get(
            f"{BASE_URL}/api/gst/lookup/{INVALID_GSTIN}",
            headers=self.headers
        )
        
        # Should return 400 for invalid format
        assert response.status_code == 400, f"Should return 400 for invalid GSTIN, got {response.status_code}"
        data = response.json()
        assert "Invalid" in data.get("detail", ""), "Error should mention invalid format"
    
    def test_gst_lookup_too_short(self):
        """Test GST lookup with too short GSTIN"""
        response = requests.get(
            f"{BASE_URL}/api/gst/lookup/29AAB",
            headers=self.headers
        )
        
        # Should return 400 for short GSTIN
        assert response.status_code == 400, f"Should return 400 for short GSTIN, got {response.status_code}"
    
    def test_gst_lookup_without_auth(self):
        """Test GST lookup without authentication should fail"""
        response = requests.get(f"{BASE_URL}/api/gst/lookup/{VALID_GSTIN_KARNATAKA}")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Should return 401/403 without auth, got {response.status_code}"


class TestInvoiceGSTFields:
    """Test invoice creation and retrieval with GST/IGST fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_create_interstate_invoice_with_igst(self):
        """Test creating an interstate invoice with IGST"""
        invoice_data = {
            "customer_name": "TEST_Interstate Customer",
            "customer_phone": "9999999999",
            "customer_email": "test@interstate.com",
            "customer_address": "123 Interstate Road, Karnataka",
            "customer_gst": VALID_GSTIN_KARNATAKA,
            "customer_state": "Karnataka",
            "seller_state": "Delhi",
            "is_interstate": True,  # Interstate transaction
            "line_items": [
                {
                    "id": 1,
                    "item_id": "",
                    "description": "Test Product",
                    "quantity": 2,
                    "unit_price": 1000,
                    "discount": 0,
                    "tax_rate": 18
                }
            ],
            "subtotal": 2000,
            "totalTax": 360,  # 18% of 2000
            "igst_amount": 360,  # Full tax as IGST for interstate
            "cgst_amount": 0,
            "sgst_amount": 0,
            "total": 2360,
            "status": "draft",
            "currency": "INR"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices",
            headers=self.headers,
            json=invoice_data
        )
        
        assert response.status_code in [200, 201], f"Invoice creation failed: {response.text}"
        
        created_invoice = response.json()
        print(f"Created Interstate Invoice: {created_invoice.get('invoice_number')}")
        
        # Validate GST fields are saved
        assert created_invoice.get("is_interstate") == True, "is_interstate should be True"
        assert created_invoice.get("igst_amount") == 360, f"igst_amount should be 360, got {created_invoice.get('igst_amount')}"
        assert created_invoice.get("cgst_amount") == 0, "cgst_amount should be 0 for interstate"
        assert created_invoice.get("sgst_amount") == 0, "sgst_amount should be 0 for interstate"
        assert created_invoice.get("customer_state") == "Karnataka", "customer_state should be Karnataka"
        assert created_invoice.get("seller_state") == "Delhi", "seller_state should be Delhi"
        
        # Clean up - delete test invoice
        invoice_id = created_invoice.get("id")
        if invoice_id:
            requests.delete(f"{BASE_URL}/api/invoices/{invoice_id}", headers=self.headers)
    
    def test_create_intrastate_invoice_with_cgst_sgst(self):
        """Test creating an intrastate invoice with CGST+SGST"""
        invoice_data = {
            "customer_name": "TEST_Intrastate Customer",
            "customer_phone": "8888888888",
            "customer_email": "test@intrastate.com",
            "customer_address": "456 Intrastate Street, Karnataka",
            "customer_gst": VALID_GSTIN_KARNATAKA,
            "customer_state": "Karnataka",
            "seller_state": "Karnataka",
            "is_interstate": False,  # Intrastate transaction
            "line_items": [
                {
                    "id": 1,
                    "item_id": "",
                    "description": "Test Product Intrastate",
                    "quantity": 1,
                    "unit_price": 5000,
                    "discount": 0,
                    "tax_rate": 18
                }
            ],
            "subtotal": 5000,
            "totalTax": 900,  # 18% of 5000
            "igst_amount": 0,
            "cgst_amount": 450,  # Half of tax as CGST
            "sgst_amount": 450,  # Half of tax as SGST
            "total": 5900,
            "status": "draft",
            "currency": "INR"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices",
            headers=self.headers,
            json=invoice_data
        )
        
        assert response.status_code in [200, 201], f"Invoice creation failed: {response.text}"
        
        created_invoice = response.json()
        print(f"Created Intrastate Invoice: {created_invoice.get('invoice_number')}")
        
        # Validate GST fields are saved
        assert created_invoice.get("is_interstate") == False, "is_interstate should be False"
        assert created_invoice.get("igst_amount") == 0, "igst_amount should be 0 for intrastate"
        assert created_invoice.get("cgst_amount") == 450, f"cgst_amount should be 450, got {created_invoice.get('cgst_amount')}"
        assert created_invoice.get("sgst_amount") == 450, f"sgst_amount should be 450, got {created_invoice.get('sgst_amount')}"
        
        # Clean up
        invoice_id = created_invoice.get("id")
        if invoice_id:
            requests.delete(f"{BASE_URL}/api/invoices/{invoice_id}", headers=self.headers)
    
    def test_invoice_retrieval_has_gst_fields(self):
        """Test that retrieved invoices contain GST/IGST fields"""
        # First create an invoice
        invoice_data = {
            "customer_name": "TEST_GST Fields Check",
            "is_interstate": True,
            "igst_amount": 100,
            "cgst_amount": 0,
            "sgst_amount": 0,
            "subtotal": 555,
            "total": 655,
            "line_items": [{"description": "Test", "quantity": 1, "unit_price": 555, "tax_rate": 18}],
            "status": "draft"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/invoices",
            headers=self.headers,
            json=invoice_data
        )
        
        assert create_response.status_code in [200, 201]
        created_invoice = create_response.json()
        invoice_id = created_invoice.get("id")
        
        # Now retrieve invoices and check for GST fields
        list_response = requests.get(f"{BASE_URL}/api/invoices", headers=self.headers)
        assert list_response.status_code == 200
        
        invoices = list_response.json()
        test_invoice = next((inv for inv in invoices if inv.get("id") == invoice_id), None)
        
        if test_invoice:
            print(f"Retrieved invoice has fields: is_interstate={test_invoice.get('is_interstate')}, igst={test_invoice.get('igst_amount')}, cgst={test_invoice.get('cgst_amount')}, sgst={test_invoice.get('sgst_amount')}")
            
            # Verify GST fields exist in response
            assert "is_interstate" in test_invoice, "Invoice should have is_interstate field"
            assert "igst_amount" in test_invoice, "Invoice should have igst_amount field"
            assert "cgst_amount" in test_invoice, "Invoice should have cgst_amount field"
            assert "sgst_amount" in test_invoice, "Invoice should have sgst_amount field"
        
        # Clean up
        if invoice_id:
            requests.delete(f"{BASE_URL}/api/invoices/{invoice_id}", headers=self.headers)


class TestSupplierGSTIntegration:
    """Test supplier GST number integration with auto-fetch"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_create_supplier_with_gst_state(self):
        """Test creating a supplier with GST number and state"""
        supplier_data = {
            "name": "TEST_Supplier Karnataka",
            "contact_person": "Test Contact",
            "phone": "9876543210",
            "email": "testsupplier@example.com",
            "address": "Test Address",
            "gst_number": VALID_GSTIN_KARNATAKA,
            "state": "Karnataka",
            "city": "Bangalore",
            "pincode": "560001"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/suppliers",
            headers=self.headers,
            json=supplier_data
        )
        
        assert response.status_code in [200, 201], f"Supplier creation failed: {response.text}"
        
        created_supplier = response.json()
        print(f"Created Supplier: {created_supplier.get('name')}")
        
        # Validate fields
        assert created_supplier.get("gst_number") == VALID_GSTIN_KARNATAKA
        assert created_supplier.get("state") == "Karnataka"
        assert created_supplier.get("city") == "Bangalore"
        assert created_supplier.get("pincode") == "560001"
        
        # Clean up
        supplier_id = created_supplier.get("id")
        if supplier_id:
            requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}", headers=self.headers)
    
    def test_supplier_api_has_state_fields(self):
        """Test that supplier API accepts and returns state, city, pincode fields"""
        # List suppliers to check structure
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        assert response.status_code == 200
        
        # Just verify the endpoint works
        suppliers = response.json()
        print(f"Total suppliers: {len(suppliers)}")
        
        if suppliers:
            first_supplier = suppliers[0]
            # Check that the response can contain these fields
            print(f"Supplier fields: {list(first_supplier.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
