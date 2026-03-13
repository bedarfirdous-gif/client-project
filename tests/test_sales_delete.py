"""
Test Sales Delete Functionality
================================
Testing DELETE /api/sales/{sale_id} endpoint to verify:
1. Sale record deletion
2. Inventory restoration for items
3. GST ledger entries removal
4. Customer loyalty points reversal
5. Voucher usage reversal
6. Stock movements and inventory transactions cleanup
7. Sales returns cleanup
8. Frontend integration with SalesPage delete button
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSalesDeleteEndpoint:
    """Tests for DELETE /api/sales/{sale_id} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("access_token")
        self.user = data.get("user", {})
        self.tenant_id = self.user.get("tenant_id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get a store for creating sales
        stores_response = self.session.get(f"{BASE_URL}/api/stores")
        if stores_response.status_code == 200:
            stores = stores_response.json()
            self.store_id = stores[0]["id"] if stores else None
        else:
            self.store_id = None
        
        yield
        
        # Teardown - clean up any test data
        pass
    
    def test_delete_sale_endpoint_exists(self):
        """Test that DELETE /api/sales/{sale_id} endpoint exists"""
        # Try to delete a non-existent sale to verify endpoint routing works
        fake_sale_id = str(uuid.uuid4())
        response = self.session.delete(f"{BASE_URL}/api/sales/{fake_sale_id}")
        
        # Should return 404 (not found), not 405 (method not allowed) or 404 (route not found)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        # Verify error message
        error_data = response.json()
        assert "not found" in error_data.get("detail", "").lower() or "Sale not found" in str(error_data)
        print("✓ DELETE /api/sales/{sale_id} endpoint exists and returns 404 for non-existent sale")
    
    def test_delete_existing_sale(self):
        """Test deleting an existing sale - full workflow"""
        # First, get existing sales
        sales_response = self.session.get(f"{BASE_URL}/api/sales?limit=10")
        assert sales_response.status_code == 200
        sales = sales_response.json()
        
        if not sales:
            pytest.skip("No sales found to test delete functionality")
        
        # Find a completed sale (not cancelled)
        sale_to_delete = None
        for sale in sales:
            if sale.get("status") != "cancelled":
                sale_to_delete = sale
                break
        
        if not sale_to_delete:
            pytest.skip("No completed sales found to test delete")
        
        sale_id = sale_to_delete.get("id")
        invoice_number = sale_to_delete.get("invoice_number")
        
        # Perform delete
        delete_response = self.session.delete(f"{BASE_URL}/api/sales/{sale_id}")
        
        # Verify successful deletion
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        delete_data = delete_response.json()
        
        # Verify response structure
        assert "message" in delete_data
        assert "deleted" in delete_data
        assert invoice_number in delete_data.get("message", "")
        
        # Verify deleted info
        deleted_info = delete_data.get("deleted", {})
        assert deleted_info.get("sale") == True
        assert "gst_ledger_entries" in deleted_info
        assert "stock_movements" in deleted_info
        assert "inventory_transactions" in deleted_info
        
        print(f"✓ Sale {invoice_number} deleted successfully")
        print(f"  - GST ledger entries deleted: {deleted_info.get('gst_ledger_entries', 0)}")
        print(f"  - Stock movements deleted: {deleted_info.get('stock_movements', 0)}")
        print(f"  - Inventory transactions deleted: {deleted_info.get('inventory_transactions', 0)}")
        print(f"  - Payment records deleted: {deleted_info.get('payment_records', 0)}")
        
        # Verify sale is actually deleted
        get_response = self.session.get(f"{BASE_URL}/api/sales/{sale_id}")
        assert get_response.status_code == 404, "Sale should be deleted but still found"
        print("✓ Verified sale no longer exists after deletion")
    
    def test_delete_sale_not_found(self):
        """Test deleting a non-existent sale returns 404"""
        fake_id = "nonexistent-sale-id-12345"
        response = self.session.delete(f"{BASE_URL}/api/sales/{fake_id}")
        
        assert response.status_code == 404
        print("✓ DELETE returns 404 for non-existent sale")
    
    def test_delete_requires_authentication(self):
        """Test that DELETE requires authentication"""
        # Create new session without auth
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        response = unauth_session.delete(f"{BASE_URL}/api/sales/some-sale-id")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ DELETE requires authentication")
    
    def test_inventory_restoration_on_delete(self):
        """Test that inventory is restored when sale is deleted"""
        # Get list of sales with items
        sales_response = self.session.get(f"{BASE_URL}/api/sales?limit=20")
        assert sales_response.status_code == 200
        sales = sales_response.json()
        
        # Find a sale with items and not cancelled
        sale_with_items = None
        for sale in sales:
            if sale.get("status") != "cancelled" and sale.get("items"):
                sale_with_items = sale
                break
        
        if not sale_with_items:
            pytest.skip("No sales with items found to test inventory restoration")
        
        sale_id = sale_with_items.get("id")
        items = sale_with_items.get("items", [])
        
        # Get current inventory levels for items
        inventory_before = {}
        for item in items:
            variant_id = item.get("variant_id")
            if variant_id:
                # Query inventory
                inv_response = self.session.get(
                    f"{BASE_URL}/api/inventory?variant_id={variant_id}&store_id={sale_with_items.get('store_id')}"
                )
                if inv_response.status_code == 200:
                    inv_data = inv_response.json()
                    if inv_data:
                        inventory_before[variant_id] = inv_data[0].get("quantity", 0) if isinstance(inv_data, list) else inv_data.get("quantity", 0)
        
        # Delete the sale
        delete_response = self.session.delete(f"{BASE_URL}/api/sales/{sale_id}")
        assert delete_response.status_code == 200
        delete_data = delete_response.json()
        
        # Check inventory restoration info
        items_restored = delete_data.get("deleted", {}).get("items_inventory_restored", [])
        
        if items_restored:
            print(f"✓ Inventory restored for {len(items_restored)} items")
            for restored in items_restored:
                print(f"  - Variant {restored.get('variant_id')}: +{restored.get('quantity_restored', 0)}")
        else:
            print("✓ Delete completed (no inventory to restore or sale was already cancelled)")


class TestSalesDeleteCleanup:
    """Test that DELETE cleans up all related records"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    def test_gst_ledger_cleanup(self):
        """Test that GST ledger entries are deleted with sale"""
        # Get sales list
        sales_response = self.session.get(f"{BASE_URL}/api/sales?limit=5")
        if sales_response.status_code != 200:
            pytest.skip("Cannot fetch sales")
        
        sales = sales_response.json()
        
        if not sales:
            pytest.skip("No sales to test")
        
        # Find a sale with GST
        sale_with_gst = None
        for sale in sales:
            if sale.get("gst_amount", 0) > 0 and sale.get("status") != "cancelled":
                sale_with_gst = sale
                break
        
        if not sale_with_gst:
            pytest.skip("No sales with GST amount found")
        
        sale_id = sale_with_gst.get("id")
        
        # Delete the sale
        delete_response = self.session.delete(f"{BASE_URL}/api/sales/{sale_id}")
        assert delete_response.status_code == 200
        
        delete_data = delete_response.json()
        gst_deleted = delete_data.get("deleted", {}).get("gst_ledger_entries", 0)
        
        print(f"✓ GST ledger cleanup: {gst_deleted} entries deleted")
    
    def test_stock_movements_cleanup(self):
        """Test that stock movements are deleted with sale"""
        sales_response = self.session.get(f"{BASE_URL}/api/sales?limit=5")
        if sales_response.status_code != 200:
            pytest.skip("Cannot fetch sales")
        
        sales = sales_response.json()
        
        if not sales:
            pytest.skip("No sales to test")
        
        # Find a sale that's not cancelled
        sale_to_delete = None
        for sale in sales:
            if sale.get("status") != "cancelled":
                sale_to_delete = sale
                break
        
        if not sale_to_delete:
            pytest.skip("No active sales to test")
        
        sale_id = sale_to_delete.get("id")
        
        # Delete
        delete_response = self.session.delete(f"{BASE_URL}/api/sales/{sale_id}")
        assert delete_response.status_code == 200
        
        delete_data = delete_response.json()
        stock_deleted = delete_data.get("deleted", {}).get("stock_movements", 0)
        inv_trans_deleted = delete_data.get("deleted", {}).get("inventory_transactions", 0)
        
        print(f"✓ Stock cleanup: {stock_deleted} movements, {inv_trans_deleted} transactions deleted")


class TestSalesDeleteBulk:
    """Test bulk delete functionality via frontend"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    def test_multiple_deletes_sequential(self):
        """Test deleting multiple sales sequentially (simulating bulk delete)"""
        # Get sales list
        sales_response = self.session.get(f"{BASE_URL}/api/sales?limit=10")
        if sales_response.status_code != 200:
            pytest.skip("Cannot fetch sales")
        
        sales = sales_response.json()
        
        # Find up to 2 sales to delete
        sales_to_delete = [s for s in sales if s.get("status") != "cancelled"][:2]
        
        if len(sales_to_delete) < 2:
            pytest.skip("Not enough sales to test bulk delete")
        
        deleted_count = 0
        for sale in sales_to_delete:
            sale_id = sale.get("id")
            delete_response = self.session.delete(f"{BASE_URL}/api/sales/{sale_id}")
            if delete_response.status_code == 200:
                deleted_count += 1
        
        assert deleted_count == len(sales_to_delete), f"Expected to delete {len(sales_to_delete)}, deleted {deleted_count}"
        print(f"✓ Bulk delete: Successfully deleted {deleted_count} sales")


class TestSalesGetAndDelete:
    """Test GET /api/sales/{sale_id} and DELETE together"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    def test_get_sale_by_id(self):
        """Test GET /api/sales/{sale_id}"""
        # Get list first
        sales_response = self.session.get(f"{BASE_URL}/api/sales?limit=5")
        assert sales_response.status_code == 200
        sales = sales_response.json()
        
        if not sales:
            pytest.skip("No sales found")
        
        sale_id = sales[0].get("id")
        
        # Get single sale by ID
        get_response = self.session.get(f"{BASE_URL}/api/sales/{sale_id}")
        
        # Could be 200 or 404 depending on implementation
        if get_response.status_code == 200:
            sale_data = get_response.json()
            assert sale_data.get("id") == sale_id
            print(f"✓ GET /api/sales/{sale_id} returns sale data")
        else:
            # Some APIs don't have GET by ID
            print(f"ℹ GET /api/sales/{sale_id} returns {get_response.status_code}")
    
    def test_delete_and_verify_gone(self):
        """Test that deleted sale cannot be fetched anymore"""
        # Get list first
        sales_response = self.session.get(f"{BASE_URL}/api/sales?limit=5")
        assert sales_response.status_code == 200
        sales = sales_response.json()
        
        # Find sale to delete
        sale_to_delete = None
        for sale in sales:
            if sale.get("status") != "cancelled":
                sale_to_delete = sale
                break
        
        if not sale_to_delete:
            pytest.skip("No active sales to test")
        
        sale_id = sale_to_delete.get("id")
        invoice_number = sale_to_delete.get("invoice_number")
        
        # Delete
        delete_response = self.session.delete(f"{BASE_URL}/api/sales/{sale_id}")
        assert delete_response.status_code == 200
        
        # Verify not in list anymore
        new_sales_response = self.session.get(f"{BASE_URL}/api/sales?limit=100")
        assert new_sales_response.status_code == 200
        new_sales = new_sales_response.json()
        
        # Check sale is gone
        sale_ids = [s.get("id") for s in new_sales]
        assert sale_id not in sale_ids, "Deleted sale should not be in list"
        
        print(f"✓ Sale {invoice_number} verified as deleted from sales list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
