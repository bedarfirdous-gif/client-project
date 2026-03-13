"""
Backend API Tests for Purchase Invoices and Discount Management
Tests CRUD operations for:
- Purchase Invoices (create, read, update payment status, delete)
- Item Discounts (create, read, delete)
- BOGO Offers (create, read, delete)
- Tiered Discounts (create, read, delete)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "demo@brandmafia.com"
        return data["access_token"]


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for all tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@brandmafia.com",
        "password": "demo123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


# ============== PURCHASE INVOICES TESTS ==============

class TestPurchaseInvoices:
    """Purchase Invoice CRUD tests"""
    
    def test_list_purchase_invoices(self, auth_headers):
        """Test listing purchase invoices"""
        response = requests.get(f"{BASE_URL}/api/purchase-invoices", headers=auth_headers)
        assert response.status_code == 200, f"Failed to list invoices: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} purchase invoices")
    
    def test_get_suppliers_for_invoice(self, auth_headers):
        """Test getting suppliers list (needed for invoice creation)"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get suppliers: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} suppliers")
        return data
    
    def test_get_stores_for_invoice(self, auth_headers):
        """Test getting stores list (needed for invoice creation)"""
        response = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get stores: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} stores")
        return data
    
    def test_get_variants_for_invoice(self, auth_headers):
        """Test getting variants list (needed for line items)"""
        response = requests.get(f"{BASE_URL}/api/variants", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get variants: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} variants")
        return data
    
    def test_create_purchase_invoice_without_items(self, auth_headers):
        """Test creating purchase invoice without items (should fail or create empty)"""
        # First get a supplier and store
        suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers).json()
        stores = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers).json()
        
        if not suppliers or not stores:
            pytest.skip("No suppliers or stores available for testing")
        
        payload = {
            "supplier_id": suppliers[0]["id"],
            "store_id": stores[0]["id"],
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
            "items": [],
            "subtotal": 0,
            "tax_amount": 0,
            "discount_amount": 0,
            "total_amount": 0,
            "payment_status": "pending",
            "notes": "TEST_empty_invoice"
        }
        
        response = requests.post(f"{BASE_URL}/api/purchase-invoices", headers=auth_headers, json=payload)
        # Should either succeed with empty items or fail validation
        print(f"Create empty invoice response: {response.status_code}")
        if response.status_code in [200, 201]:
            data = response.json()
            # Clean up
            requests.delete(f"{BASE_URL}/api/purchase-invoices/{data['id']}", headers=auth_headers)
    
    def test_create_purchase_invoice_with_items(self, auth_headers):
        """Test creating purchase invoice with line items"""
        # Get required data
        suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers).json()
        stores = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers).json()
        variants = requests.get(f"{BASE_URL}/api/variants", headers=auth_headers).json()
        items = requests.get(f"{BASE_URL}/api/items", headers=auth_headers).json()
        
        if not suppliers:
            # Create a test supplier
            supplier_resp = requests.post(f"{BASE_URL}/api/suppliers", headers=auth_headers, json={
                "name": "TEST_Supplier",
                "contact_person": "Test Contact",
                "phone": "1234567890"
            })
            suppliers = [supplier_resp.json()] if supplier_resp.status_code in [200, 201] else []
        
        if not stores:
            pytest.skip("No stores available for testing")
        
        # Create line items
        line_items = []
        if variants:
            variant = variants[0]
            line_items.append({
                "variant_id": variant["id"],
                "item_id": variant.get("item_id", items[0]["id"] if items else ""),
                "quantity": 5,
                "rate": 100,
                "amount": 500
            })
        elif items:
            line_items.append({
                "variant_id": "",
                "item_id": items[0]["id"],
                "quantity": 5,
                "rate": 100,
                "amount": 500
            })
        
        payload = {
            "supplier_id": suppliers[0]["id"],
            "store_id": stores[0]["id"],
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
            "items": line_items,
            "subtotal": 500,
            "tax_amount": 50,
            "discount_amount": 0,
            "total_amount": 550,
            "payment_status": "pending",
            "notes": "TEST_purchase_invoice"
        }
        
        response = requests.post(f"{BASE_URL}/api/purchase-invoices", headers=auth_headers, json=payload)
        assert response.status_code in [200, 201], f"Failed to create invoice: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "invoice_number" in data
        assert data["supplier_id"] == suppliers[0]["id"]
        assert data["store_id"] == stores[0]["id"]
        assert data["total_amount"] == 550
        assert data["payment_status"] == "pending"
        print(f"Created purchase invoice: {data['invoice_number']}")
    
    def test_get_purchase_invoice_by_id(self, auth_headers):
        """Test getting a specific purchase invoice"""
        # First create one
        suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers).json()
        stores = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers).json()
        
        if not suppliers or not stores:
            pytest.skip("No suppliers or stores available")
        
        create_payload = {
            "supplier_id": suppliers[0]["id"],
            "store_id": stores[0]["id"],
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
            "items": [{"variant_id": "", "item_id": "", "quantity": 1, "rate": 100, "amount": 100}],
            "subtotal": 100,
            "total_amount": 100,
            "payment_status": "pending",
            "notes": "TEST_get_invoice"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/purchase-invoices", headers=auth_headers, json=create_payload)
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Could not create invoice for testing")
        
        invoice_id = create_resp.json()["id"]
        
        # Get by ID
        response = requests.get(f"{BASE_URL}/api/purchase-invoices/{invoice_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get invoice: {response.text}"
        
        data = response.json()
        assert data["id"] == invoice_id
        print(f"Retrieved invoice: {data['invoice_number']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/purchase-invoices/{invoice_id}", headers=auth_headers)
    
    def test_update_payment_status(self, auth_headers):
        """Test updating payment status of purchase invoice"""
        # Create invoice first
        suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers).json()
        stores = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers).json()
        
        if not suppliers or not stores:
            pytest.skip("No suppliers or stores available")
        
        create_payload = {
            "supplier_id": suppliers[0]["id"],
            "store_id": stores[0]["id"],
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
            "items": [{"variant_id": "", "item_id": "", "quantity": 1, "rate": 200, "amount": 200}],
            "subtotal": 200,
            "total_amount": 200,
            "payment_status": "pending",
            "notes": "TEST_payment_update"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/purchase-invoices", headers=auth_headers, json=create_payload)
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Could not create invoice for testing")
        
        invoice_id = create_resp.json()["id"]
        
        # Update payment status to paid
        response = requests.put(
            f"{BASE_URL}/api/purchase-invoices/{invoice_id}/payment?payment_status=paid",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to update payment: {response.text}"
        
        data = response.json()
        assert data["payment_status"] == "paid"
        print(f"Updated payment status to: {data['payment_status']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/purchase-invoices/{invoice_id}", headers=auth_headers)
    
    def test_delete_purchase_invoice(self, auth_headers):
        """Test deleting a purchase invoice"""
        # Create invoice first
        suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers).json()
        stores = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers).json()
        
        if not suppliers or not stores:
            pytest.skip("No suppliers or stores available")
        
        create_payload = {
            "supplier_id": suppliers[0]["id"],
            "store_id": stores[0]["id"],
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
            "items": [],
            "subtotal": 0,
            "total_amount": 0,
            "payment_status": "pending",
            "notes": "TEST_delete_invoice"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/purchase-invoices", headers=auth_headers, json=create_payload)
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Could not create invoice for testing")
        
        invoice_id = create_resp.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/purchase-invoices/{invoice_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed to delete invoice: {response.text}"
        
        # Verify deletion
        get_resp = requests.get(f"{BASE_URL}/api/purchase-invoices/{invoice_id}", headers=auth_headers)
        assert get_resp.status_code == 404, "Invoice should not exist after deletion"
        print("Invoice deleted successfully")


# ============== ITEM DISCOUNTS TESTS ==============

class TestItemDiscounts:
    """Item Discount CRUD tests"""
    
    def test_list_item_discounts(self, auth_headers):
        """Test listing item discounts"""
        response = requests.get(f"{BASE_URL}/api/item-discounts?active_only=false", headers=auth_headers)
        assert response.status_code == 200, f"Failed to list discounts: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} item discounts")
    
    def test_create_item_discount_percentage(self, auth_headers):
        """Test creating a percentage-based item discount"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "discount_type": "percentage",
            "discount_value": 15,
            "min_quantity": 1,
            "valid_from": today,
            "valid_until": next_month,
            "description": "TEST_15% off all items",
            "active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/item-discounts", headers=auth_headers, json=payload)
        assert response.status_code in [200, 201], f"Failed to create discount: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["discount_type"] == "percentage"
        assert data["discount_value"] == 15
        assert data["active"] == True
        print(f"Created item discount: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/item-discounts/{data['id']}", headers=auth_headers)
    
    def test_create_item_discount_fixed(self, auth_headers):
        """Test creating a fixed amount item discount"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "discount_type": "fixed",
            "discount_value": 100,
            "min_quantity": 2,
            "valid_from": today,
            "valid_until": next_month,
            "description": "TEST_₹100 off on 2+ items",
            "active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/item-discounts", headers=auth_headers, json=payload)
        assert response.status_code in [200, 201], f"Failed to create discount: {response.text}"
        
        data = response.json()
        assert data["discount_type"] == "fixed"
        assert data["discount_value"] == 100
        assert data["min_quantity"] == 2
        print(f"Created fixed discount: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/item-discounts/{data['id']}", headers=auth_headers)
    
    def test_delete_item_discount(self, auth_headers):
        """Test deleting an item discount"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Create first
        create_resp = requests.post(f"{BASE_URL}/api/item-discounts", headers=auth_headers, json={
            "discount_type": "percentage",
            "discount_value": 5,
            "valid_from": today,
            "valid_until": next_month,
            "description": "TEST_to_delete",
            "active": True
        })
        
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Could not create discount for testing")
        
        discount_id = create_resp.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/item-discounts/{discount_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed to delete discount: {response.text}"
        print("Item discount deleted successfully")


# ============== BOGO OFFERS TESTS ==============

class TestBOGOOffers:
    """BOGO Offer CRUD tests"""
    
    def test_list_bogo_offers(self, auth_headers):
        """Test listing BOGO offers"""
        response = requests.get(f"{BASE_URL}/api/bogo-offers?active_only=false", headers=auth_headers)
        assert response.status_code == 200, f"Failed to list BOGO offers: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} BOGO offers")
    
    def test_create_bogo_offer_buy2_get1_free(self, auth_headers):
        """Test creating Buy 2 Get 1 Free offer"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "name": "TEST_Buy 2 Get 1 Free",
            "buy_quantity": 2,
            "get_quantity": 1,
            "get_discount_percent": 100,  # 100% = free
            "valid_from": today,
            "valid_until": next_month,
            "description": "Buy any 2 items and get 1 free",
            "active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/bogo-offers", headers=auth_headers, json=payload)
        assert response.status_code in [200, 201], f"Failed to create BOGO: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Buy 2 Get 1 Free"
        assert data["buy_quantity"] == 2
        assert data["get_quantity"] == 1
        assert data["get_discount_percent"] == 100
        print(f"Created BOGO offer: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bogo-offers/{data['id']}", headers=auth_headers)
    
    def test_create_bogo_offer_buy1_get1_half(self, auth_headers):
        """Test creating Buy 1 Get 1 at 50% offer"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "name": "TEST_Buy 1 Get 1 @ 50%",
            "buy_quantity": 1,
            "get_quantity": 1,
            "get_discount_percent": 50,  # 50% off second item
            "valid_from": today,
            "valid_until": next_month,
            "description": "Buy 1 get second at half price",
            "active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/bogo-offers", headers=auth_headers, json=payload)
        assert response.status_code in [200, 201], f"Failed to create BOGO: {response.text}"
        
        data = response.json()
        assert data["get_discount_percent"] == 50
        print(f"Created BOGO offer: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bogo-offers/{data['id']}", headers=auth_headers)
    
    def test_delete_bogo_offer(self, auth_headers):
        """Test deleting a BOGO offer"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Create first
        create_resp = requests.post(f"{BASE_URL}/api/bogo-offers", headers=auth_headers, json={
            "name": "TEST_to_delete_bogo",
            "buy_quantity": 3,
            "get_quantity": 1,
            "get_discount_percent": 100,
            "valid_from": today,
            "valid_until": next_month,
            "active": True
        })
        
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Could not create BOGO for testing")
        
        offer_id = create_resp.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/bogo-offers/{offer_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed to delete BOGO: {response.text}"
        print("BOGO offer deleted successfully")


# ============== TIERED DISCOUNTS TESTS ==============

class TestTieredDiscounts:
    """Tiered Discount CRUD tests"""
    
    def test_list_tiered_discounts(self, auth_headers):
        """Test listing tiered discounts"""
        response = requests.get(f"{BASE_URL}/api/tiered-discounts?active_only=false", headers=auth_headers)
        assert response.status_code == 200, f"Failed to list tiered discounts: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} tiered discounts")
    
    def test_create_tiered_discount_fixed(self, auth_headers):
        """Test creating tiered discount with fixed amounts"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "name": "TEST_Spend More Save More",
            "discount_type": "cart_total",
            "tiers": [
                {"min": 1000, "discount": 100, "is_percent": False},
                {"min": 2000, "discount": 250, "is_percent": False},
                {"min": 5000, "discount": 750, "is_percent": False}
            ],
            "valid_from": today,
            "valid_until": next_month,
            "stackable": False,
            "description": "Spend more to save more",
            "active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/tiered-discounts", headers=auth_headers, json=payload)
        assert response.status_code in [200, 201], f"Failed to create tiered discount: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Spend More Save More"
        assert len(data["tiers"]) == 3
        assert data["tiers"][0]["min"] == 1000
        print(f"Created tiered discount: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tiered-discounts/{data['id']}", headers=auth_headers)
    
    def test_create_tiered_discount_percentage(self, auth_headers):
        """Test creating tiered discount with percentage"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "name": "TEST_Percentage Tiers",
            "discount_type": "cart_total",
            "tiers": [
                {"min": 500, "discount": 5, "is_percent": True},
                {"min": 1500, "discount": 10, "is_percent": True},
                {"min": 3000, "discount": 15, "is_percent": True}
            ],
            "valid_from": today,
            "valid_until": next_month,
            "stackable": True,
            "description": "Percentage based tiers",
            "active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/tiered-discounts", headers=auth_headers, json=payload)
        assert response.status_code in [200, 201], f"Failed to create tiered discount: {response.text}"
        
        data = response.json()
        assert data["stackable"] == True
        assert data["tiers"][0]["is_percent"] == True
        print(f"Created tiered discount: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tiered-discounts/{data['id']}", headers=auth_headers)
    
    def test_delete_tiered_discount(self, auth_headers):
        """Test deleting a tiered discount"""
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Create first
        create_resp = requests.post(f"{BASE_URL}/api/tiered-discounts", headers=auth_headers, json={
            "name": "TEST_to_delete_tiered",
            "discount_type": "cart_total",
            "tiers": [{"min": 100, "discount": 10, "is_percent": False}],
            "valid_from": today,
            "valid_until": next_month,
            "active": True
        })
        
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Could not create tiered discount for testing")
        
        discount_id = create_resp.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/tiered-discounts/{discount_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed to delete tiered discount: {response.text}"
        print("Tiered discount deleted successfully")


# ============== CLEANUP TEST DATA ==============

class TestCleanup:
    """Cleanup any remaining test data"""
    
    def test_cleanup_test_invoices(self, auth_headers):
        """Clean up any TEST_ prefixed invoices"""
        response = requests.get(f"{BASE_URL}/api/purchase-invoices", headers=auth_headers)
        if response.status_code == 200:
            invoices = response.json()
            for inv in invoices:
                if inv.get("notes", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/purchase-invoices/{inv['id']}", headers=auth_headers)
                    print(f"Cleaned up test invoice: {inv['invoice_number']}")
    
    def test_cleanup_test_discounts(self, auth_headers):
        """Clean up any TEST_ prefixed discounts"""
        # Item discounts
        response = requests.get(f"{BASE_URL}/api/item-discounts?active_only=false", headers=auth_headers)
        if response.status_code == 200:
            for d in response.json():
                if d.get("description", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/item-discounts/{d['id']}", headers=auth_headers)
        
        # BOGO offers
        response = requests.get(f"{BASE_URL}/api/bogo-offers?active_only=false", headers=auth_headers)
        if response.status_code == 200:
            for o in response.json():
                if o.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/bogo-offers/{o['id']}", headers=auth_headers)
        
        # Tiered discounts
        response = requests.get(f"{BASE_URL}/api/tiered-discounts?active_only=false", headers=auth_headers)
        if response.status_code == 200:
            for d in response.json():
                if d.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/tiered-discounts/{d['id']}", headers=auth_headers)
        
        print("Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
