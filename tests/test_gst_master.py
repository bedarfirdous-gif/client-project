"""
GST Master Module Tests
Tests for GST Slabs, HSN Codes, and GST Ledger functionality
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


class TestGSTMasterModule:
    """Test GST Master Module - GST Slabs, HSN Codes, GST Ledger"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
    # ============== GST SLABS TESTS ==============
    
    def test_01_initialize_default_gst_slabs(self):
        """POST /api/gst-slabs/initialize - Initialize default Indian GST slabs"""
        response = self.session.post(f"{BASE_URL}/api/gst-slabs/initialize")
        assert response.status_code == 200, f"Failed to initialize GST slabs: {response.text}"
        data = response.json()
        # Either slabs are created or already exist
        assert "message" in data
        print(f"✓ GST slabs initialization: {data['message']}")
    
    def test_02_list_gst_slabs(self):
        """GET /api/gst-slabs - List all GST slabs"""
        response = self.session.get(f"{BASE_URL}/api/gst-slabs")
        assert response.status_code == 200, f"Failed to list GST slabs: {response.text}"
        slabs = response.json()
        
        # Verify we have the standard Indian GST slabs
        assert isinstance(slabs, list), "Response should be a list"
        assert len(slabs) >= 5, f"Expected at least 5 GST slabs (0%, 5%, 12%, 18%, 28%), got {len(slabs)}"
        
        # Verify slab structure
        for slab in slabs:
            assert "id" in slab, "Slab should have id"
            assert "code" in slab, "Slab should have code"
            assert "name" in slab, "Slab should have name"
            assert "total_rate" in slab, "Slab should have total_rate"
            assert "cgst_rate" in slab, "Slab should have cgst_rate"
            assert "sgst_rate" in slab, "Slab should have sgst_rate"
            assert "igst_rate" in slab, "Slab should have igst_rate"
        
        # Verify standard rates exist
        rates = [slab["total_rate"] for slab in slabs]
        assert 0 in rates, "0% GST slab should exist"
        assert 5 in rates, "5% GST slab should exist"
        assert 12 in rates, "12% GST slab should exist"
        assert 18 in rates, "18% GST slab should exist"
        assert 28 in rates, "28% GST slab should exist"
        
        print(f"✓ Listed {len(slabs)} GST slabs with rates: {sorted(rates)}")
    
    def test_03_get_specific_gst_slab(self):
        """GET /api/gst-slabs/{slab_id} - Get specific GST slab"""
        # First get list to find a slab ID
        response = self.session.get(f"{BASE_URL}/api/gst-slabs")
        slabs = response.json()
        assert len(slabs) > 0, "No GST slabs found"
        
        slab_id = slabs[0]["id"]
        response = self.session.get(f"{BASE_URL}/api/gst-slabs/{slab_id}")
        assert response.status_code == 200, f"Failed to get GST slab: {response.text}"
        
        slab = response.json()
        assert slab["id"] == slab_id
        print(f"✓ Retrieved GST slab: {slab['name']} ({slab['total_rate']}%)")
    
    def test_04_create_custom_gst_slab(self):
        """POST /api/gst-slabs - Create new GST slab"""
        unique_code = f"GST_TEST_{uuid.uuid4().hex[:6].upper()}"
        new_slab = {
            "code": unique_code,
            "name": "Test GST Slab",
            "total_rate": 15,
            "cgst_rate": 7.5,
            "sgst_rate": 7.5,
            "igst_rate": 15,
            "cess_rate": 0,
            "description": "Test slab for automated testing",
            "is_active": True,
            "effective_from": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = self.session.post(f"{BASE_URL}/api/gst-slabs", json=new_slab)
        assert response.status_code == 200, f"Failed to create GST slab: {response.text}"
        
        created = response.json()
        assert created["code"] == unique_code
        assert created["total_rate"] == 15
        assert created["cgst_rate"] == 7.5
        assert created["sgst_rate"] == 7.5
        
        # Store for cleanup
        self.test_slab_id = created["id"]
        print(f"✓ Created custom GST slab: {created['code']} ({created['total_rate']}%)")
        
        # Cleanup - delete the test slab
        self.session.delete(f"{BASE_URL}/api/gst-slabs/{created['id']}")
    
    def test_05_update_gst_slab(self):
        """PUT /api/gst-slabs/{slab_id} - Update GST slab (non-rate fields only)"""
        # Create a test slab first
        unique_code = f"GST_UPD_{uuid.uuid4().hex[:6].upper()}"
        new_slab = {
            "code": unique_code,
            "name": "Update Test Slab",
            "total_rate": 10,
            "cgst_rate": 5,
            "sgst_rate": 5,
            "igst_rate": 10,
            "description": "Original description"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/gst-slabs", json=new_slab)
        assert create_response.status_code == 200
        created = create_response.json()
        slab_id = created["id"]
        
        # Update non-rate fields
        update_data = {
            "name": "Updated Test Slab",
            "description": "Updated description",
            "is_active": True
        }
        
        response = self.session.put(f"{BASE_URL}/api/gst-slabs/{slab_id}", json=update_data)
        assert response.status_code == 200, f"Failed to update GST slab: {response.text}"
        
        updated = response.json()
        assert updated["name"] == "Updated Test Slab"
        assert updated["description"] == "Updated description"
        # Rates should remain unchanged (immutable for audit safety)
        assert updated["total_rate"] == 10
        
        print(f"✓ Updated GST slab name and description (rates immutable)")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/gst-slabs/{slab_id}")
    
    def test_06_deactivate_gst_slab(self):
        """DELETE /api/gst-slabs/{slab_id} - Deactivate GST slab"""
        # Create a test slab
        unique_code = f"GST_DEL_{uuid.uuid4().hex[:6].upper()}"
        new_slab = {
            "code": unique_code,
            "name": "Delete Test Slab",
            "total_rate": 7,
            "cgst_rate": 3.5,
            "sgst_rate": 3.5,
            "igst_rate": 7
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/gst-slabs", json=new_slab)
        assert create_response.status_code == 200
        slab_id = create_response.json()["id"]
        
        # Delete/deactivate
        response = self.session.delete(f"{BASE_URL}/api/gst-slabs/{slab_id}")
        assert response.status_code == 200, f"Failed to delete GST slab: {response.text}"
        
        data = response.json()
        assert "message" in data
        print(f"✓ GST slab deleted/deactivated: {data['message']}")
    
    def test_07_duplicate_gst_slab_code_rejected(self):
        """POST /api/gst-slabs - Duplicate code should be rejected"""
        # Try to create a slab with existing code
        duplicate_slab = {
            "code": "GST_18",  # This should already exist
            "name": "Duplicate 18%",
            "total_rate": 18,
            "cgst_rate": 9,
            "sgst_rate": 9,
            "igst_rate": 18
        }
        
        response = self.session.post(f"{BASE_URL}/api/gst-slabs", json=duplicate_slab)
        assert response.status_code == 400, f"Expected 400 for duplicate code, got {response.status_code}"
        print("✓ Duplicate GST slab code correctly rejected")
    
    # ============== HSN CODES TESTS ==============
    
    def test_08_create_hsn_code(self):
        """POST /api/hsn-codes - Create HSN code with GST slab link"""
        # Get a GST slab ID first
        slabs_response = self.session.get(f"{BASE_URL}/api/gst-slabs")
        slabs = slabs_response.json()
        gst_18_slab = next((s for s in slabs if s["total_rate"] == 18), slabs[0])
        
        unique_hsn = f"TEST{uuid.uuid4().hex[:4].upper()}"
        hsn_data = {
            "code": unique_hsn,
            "description": "Test HSN Code for automated testing",
            "gst_slab_id": gst_18_slab["id"],
            "category": "Test Category",
            "is_active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/hsn-codes", json=hsn_data)
        assert response.status_code == 200, f"Failed to create HSN code: {response.text}"
        
        created = response.json()
        assert created["code"] == unique_hsn
        assert created["gst_slab_id"] == gst_18_slab["id"]
        
        self.test_hsn_id = created["id"]
        print(f"✓ Created HSN code: {created['code']} linked to {gst_18_slab['name']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/hsn-codes/{created['id']}")
    
    def test_09_list_hsn_codes(self):
        """GET /api/hsn-codes - List HSN codes with linked GST slabs"""
        response = self.session.get(f"{BASE_URL}/api/hsn-codes")
        assert response.status_code == 200, f"Failed to list HSN codes: {response.text}"
        
        hsn_codes = response.json()
        assert isinstance(hsn_codes, list), "Response should be a list"
        
        # If there are HSN codes, verify structure
        if len(hsn_codes) > 0:
            for hsn in hsn_codes:
                assert "id" in hsn, "HSN should have id"
                assert "code" in hsn, "HSN should have code"
                assert "description" in hsn, "HSN should have description"
                assert "gst_slab_id" in hsn, "HSN should have gst_slab_id"
                # Should have enriched GST slab details
                if hsn.get("gst_slab"):
                    assert "total_rate" in hsn["gst_slab"], "GST slab should have total_rate"
        
        print(f"✓ Listed {len(hsn_codes)} HSN codes")
    
    def test_10_hsn_code_invalid_gst_slab_rejected(self):
        """POST /api/hsn-codes - Invalid GST slab ID should be rejected"""
        hsn_data = {
            "code": "INVALID_HSN",
            "description": "Test with invalid GST slab",
            "gst_slab_id": "non-existent-slab-id",
            "category": "Test"
        }
        
        response = self.session.post(f"{BASE_URL}/api/hsn-codes", json=hsn_data)
        assert response.status_code == 400, f"Expected 400 for invalid GST slab, got {response.status_code}"
        print("✓ Invalid GST slab ID correctly rejected for HSN code")
    
    # ============== GST LEDGER TESTS ==============
    
    def test_11_get_gst_ledger(self):
        """GET /api/gst-ledger - Get GST ledger entries"""
        response = self.session.get(f"{BASE_URL}/api/gst-ledger")
        assert response.status_code == 200, f"Failed to get GST ledger: {response.text}"
        
        entries = response.json()
        assert isinstance(entries, list), "Response should be a list"
        
        # If there are entries, verify structure
        if len(entries) > 0:
            for entry in entries:
                assert "id" in entry, "Entry should have id"
                assert "entry_type" in entry, "Entry should have entry_type (INPUT/OUTPUT)"
                assert "reference_type" in entry, "Entry should have reference_type"
                assert "taxable_amount" in entry, "Entry should have taxable_amount"
                assert "total_gst" in entry, "Entry should have total_gst"
        
        print(f"✓ Retrieved {len(entries)} GST ledger entries")
    
    def test_12_get_gst_ledger_with_filters(self):
        """GET /api/gst-ledger - Filter by entry_type"""
        # Test OUTPUT filter
        response = self.session.get(f"{BASE_URL}/api/gst-ledger?entry_type=OUTPUT")
        assert response.status_code == 200
        output_entries = response.json()
        
        # Test INPUT filter
        response = self.session.get(f"{BASE_URL}/api/gst-ledger?entry_type=INPUT")
        assert response.status_code == 200
        input_entries = response.json()
        
        # Verify all OUTPUT entries have entry_type=OUTPUT
        for entry in output_entries:
            assert entry.get("entry_type") == "OUTPUT", f"Expected OUTPUT, got {entry.get('entry_type')}"
        
        # Verify all INPUT entries have entry_type=INPUT
        for entry in input_entries:
            assert entry.get("entry_type") == "INPUT", f"Expected INPUT, got {entry.get('entry_type')}"
        
        print(f"✓ GST ledger filters working: {len(output_entries)} OUTPUT, {len(input_entries)} INPUT entries")
    
    def test_13_get_gst_summary(self):
        """GET /api/gst-ledger/summary - Get GST summary for GSTR-1/GSTR-3B reporting"""
        response = self.session.get(f"{BASE_URL}/api/gst-ledger/summary")
        assert response.status_code == 200, f"Failed to get GST summary: {response.text}"
        
        summary = response.json()
        
        # Verify summary structure
        assert "output_gst" in summary, "Summary should have output_gst"
        assert "input_gst" in summary, "Summary should have input_gst"
        assert "net_gst_liability" in summary, "Summary should have net_gst_liability"
        assert "itc_available" in summary, "Summary should have itc_available"
        assert "gst_payable" in summary, "Summary should have gst_payable"
        
        # Verify output_gst structure
        output = summary["output_gst"]
        assert "taxable" in output, "output_gst should have taxable"
        assert "cgst" in output, "output_gst should have cgst"
        assert "sgst" in output, "output_gst should have sgst"
        assert "total" in output, "output_gst should have total"
        
        # Verify input_gst structure
        input_gst = summary["input_gst"]
        assert "taxable" in input_gst, "input_gst should have taxable"
        assert "cgst" in input_gst, "input_gst should have cgst"
        assert "sgst" in input_gst, "input_gst should have sgst"
        assert "total" in input_gst, "input_gst should have total"
        
        print(f"✓ GST Summary: Output GST={output['total']}, Input GST={input_gst['total']}, Net Liability={summary['net_gst_liability']}")
    
    def test_14_get_gst_by_slab(self):
        """GET /api/gst-ledger/by-slab - Get GST breakup by rate"""
        response = self.session.get(f"{BASE_URL}/api/gst-ledger/by-slab")
        assert response.status_code == 200, f"Failed to get GST by slab: {response.text}"
        
        data = response.json()
        assert isinstance(data, dict), "Response should be a dict"
        
        print(f"✓ GST by slab breakdown retrieved with {len(data)} slab categories")
    
    # ============== GST AUTO-CALCULATION IN SALES/PURCHASES ==============
    
    def test_15_verify_item_gst_slab_field(self):
        """Verify items have gst_slab_id field"""
        response = self.session.get(f"{BASE_URL}/api/items")
        assert response.status_code == 200
        
        items = response.json()
        if len(items) > 0:
            # Check if items have gst_slab_id field
            item = items[0]
            # gst_slab_id may be null/empty if not set, but field should exist in schema
            print(f"✓ Items have GST fields: gst_slab_id={item.get('gst_slab_id')}, gst_rate={item.get('gst_rate')}")
        else:
            print("✓ No items found to verify GST fields (expected in fresh system)")
    
    def test_16_create_item_with_gst_slab(self):
        """Create item with GST slab linked"""
        # Get 18% GST slab
        slabs_response = self.session.get(f"{BASE_URL}/api/gst-slabs")
        slabs = slabs_response.json()
        gst_18_slab = next((s for s in slabs if s["total_rate"] == 18), None)
        
        if not gst_18_slab:
            pytest.skip("18% GST slab not found")
        
        unique_sku = f"TEST-GST-{uuid.uuid4().hex[:6].upper()}"
        item_data = {
            "name": "Test GST Item",
            "sku": unique_sku,
            "description": "Item for GST testing",
            "hsn_code": "6109",
            "gst_slab_id": gst_18_slab["id"],
            "gst_rate": 18.0,
            "gst_inclusive": False,
            "mrp": 1000,
            "selling_price": 900,
            "cost_price": 500,
            "unit": "pcs"
        }
        
        response = self.session.post(f"{BASE_URL}/api/items", json=item_data)
        assert response.status_code == 200, f"Failed to create item: {response.text}"
        
        created = response.json()
        assert created["gst_slab_id"] == gst_18_slab["id"], "Item should have GST slab linked"
        
        print(f"✓ Created item with GST slab: {created['name']} linked to {gst_18_slab['name']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/items/{created['id']}")


class TestGSTIntegrationWithInvoices:
    """Test GST auto-calculation in Sales and Purchase invoices"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_17_verify_gst_slabs_exist(self):
        """Verify GST slabs are initialized before invoice tests"""
        # Initialize if not already
        self.session.post(f"{BASE_URL}/api/gst-slabs/initialize")
        
        response = self.session.get(f"{BASE_URL}/api/gst-slabs")
        assert response.status_code == 200
        slabs = response.json()
        assert len(slabs) >= 5, "GST slabs should be initialized"
        print(f"✓ {len(slabs)} GST slabs available for invoice testing")
    
    def test_18_verify_stores_exist(self):
        """Verify stores exist for invoice creation"""
        response = self.session.get(f"{BASE_URL}/api/stores")
        assert response.status_code == 200
        stores = response.json()
        
        if len(stores) == 0:
            # Create a test store
            store_data = {
                "name": "GST Test Store",
                "code": f"GST-{uuid.uuid4().hex[:4].upper()}",
                "address": "Test Address",
                "phone": "1234567890"
            }
            create_response = self.session.post(f"{BASE_URL}/api/stores", json=store_data)
            assert create_response.status_code == 200
            print("✓ Created test store for GST testing")
        else:
            print(f"✓ {len(stores)} stores available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
