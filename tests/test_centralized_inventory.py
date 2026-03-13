"""
Test Suite for Centralized Inventory System
============================================
Tests the new architectural redesign with:
- central_stock as single source of truth
- stock_movements for audit trail
- All stock operations through InventoryService
- Stock availability checks before sales
- Insufficient stock returns 400 error
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"

# Test variant from the problem statement
TEST_VARIANT_ID = "6374312f-49fb-431f-80e9-24befc0fb057"  # Casual Jeans - 32 Blue
TEST_ITEM_ID = "66afc3a3-e86e-445a-8991-6b9f9270f0ad"


class TestCentralizedInventorySystem:
    """Tests for the centralized inventory management system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
        
        yield
        
        self.session.close()
    
    # ==================== GET STOCK TESTS ====================
    
    def test_get_central_stock_by_variant(self):
        """GET /api/inventory/central/stock - Get stock for a specific variant"""
        response = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "variant_id" in data
        assert "quantity" in data
        assert data["variant_id"] == TEST_VARIANT_ID
        assert isinstance(data["quantity"], int)
        print(f"✓ Stock for variant {TEST_VARIANT_ID}: {data['quantity']}")
    
    def test_get_all_central_stock(self):
        """GET /api/inventory/central/all - Get all centralized stock records"""
        response = self.session.get(f"{BASE_URL}/api/inventory/central/all")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "stocks" in data
        assert "total" in data
        assert isinstance(data["stocks"], list)
        print(f"✓ Total stock records: {data['total']}")
        
        # Verify enriched data structure
        if data["stocks"]:
            stock = data["stocks"][0]
            assert "item_name" in stock or "variant_id" in stock
    
    def test_get_all_central_stock_low_stock_filter(self):
        """GET /api/inventory/central/all - Filter low stock items"""
        response = self.session.get(
            f"{BASE_URL}/api/inventory/central/all",
            params={"low_stock_only": True}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "stocks" in data
        print(f"✓ Low stock items: {data['total']}")
    
    # ==================== CHECK AVAILABILITY TESTS ====================
    
    def test_check_stock_availability_sufficient(self):
        """POST /api/inventory/central/check-availability - Check sufficient stock"""
        # First get current stock
        stock_response = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID}
        )
        current_stock = stock_response.json().get("quantity", 0)
        
        # Check availability for less than current stock
        check_qty = max(1, current_stock - 1) if current_stock > 1 else 1
        
        response = self.session.post(
            f"{BASE_URL}/api/inventory/central/check-availability",
            json=[{"variant_id": TEST_VARIANT_ID, "quantity": check_qty}]
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "available" in data
        assert "items" in data
        
        if current_stock >= check_qty:
            assert data["available"] == True
            print(f"✓ Stock availability check passed: {check_qty} requested, {current_stock} available")
        else:
            print(f"✓ Stock availability check: insufficient stock ({current_stock} < {check_qty})")
    
    def test_check_stock_availability_insufficient(self):
        """POST /api/inventory/central/check-availability - Check insufficient stock"""
        # Request more than any reasonable stock
        response = self.session.post(
            f"{BASE_URL}/api/inventory/central/check-availability",
            json=[{"variant_id": TEST_VARIANT_ID, "quantity": 999999}]
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["available"] == False
        assert "insufficient" in data
        assert len(data["insufficient"]) > 0
        print(f"✓ Insufficient stock correctly detected")
    
    # ==================== ADD STOCK TESTS ====================
    
    def test_add_stock_purchase(self):
        """POST /api/inventory/central/add - Add stock for purchases"""
        # Get current stock first
        stock_before = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID}
        ).json().get("quantity", 0)
        
        # Add stock
        response = self.session.post(
            f"{BASE_URL}/api/inventory/central/add",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": 5,
                "reference_type": "purchase",
                "notes": "Test purchase addition"
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["quantity_added"] == 5
        assert data["new_quantity"] == stock_before + 5
        assert "movement_id" in data
        print(f"✓ Stock added: {stock_before} -> {data['new_quantity']}")
    
    def test_add_stock_invalid_quantity(self):
        """POST /api/inventory/central/add - Reject zero/negative quantity"""
        response = self.session.post(
            f"{BASE_URL}/api/inventory/central/add",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": 0,
                "notes": "Invalid quantity test"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Zero quantity correctly rejected")
    
    # ==================== DEDUCT STOCK TESTS ====================
    
    def test_deduct_stock_success(self):
        """POST /api/inventory/central/deduct - Deduct stock successfully"""
        # Get current stock first
        stock_before = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID}
        ).json().get("quantity", 0)
        
        if stock_before < 1:
            # Add stock first if none available
            self.session.post(
                f"{BASE_URL}/api/inventory/central/add",
                json={"variant_id": TEST_VARIANT_ID, "quantity": 10}
            )
            stock_before = 10
        
        # Deduct stock
        response = self.session.post(
            f"{BASE_URL}/api/inventory/central/deduct",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": 1,
                "reference_type": "sale",
                "notes": "Test deduction"
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["quantity_deducted"] == 1
        print(f"✓ Stock deducted: {stock_before} -> {data['new_quantity']}")
    
    def test_deduct_stock_insufficient_fails(self):
        """POST /api/inventory/central/deduct - FAIL if insufficient stock"""
        # Get current stock
        stock_response = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID}
        )
        current_stock = stock_response.json().get("quantity", 0)
        
        # Try to deduct more than available
        response = self.session.post(
            f"{BASE_URL}/api/inventory/central/deduct",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": current_stock + 1000,
                "notes": "Should fail - insufficient stock"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "Insufficient stock" in response.text
        print(f"✓ Insufficient stock deduction correctly rejected (tried {current_stock + 1000}, have {current_stock})")
    
    def test_deduct_stock_allow_negative(self):
        """POST /api/inventory/central/deduct - Allow negative with flag"""
        # Get current stock
        stock_response = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID}
        )
        current_stock = stock_response.json().get("quantity", 0)
        
        # Deduct with allow_negative=True
        response = self.session.post(
            f"{BASE_URL}/api/inventory/central/deduct",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": current_stock + 1,
                "allow_negative": True,
                "notes": "Test negative stock allowed"
            }
        )
        
        # This should succeed with allow_negative=True
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"✓ Negative stock allowed with flag: new quantity = {data['new_quantity']}")
        
        # Restore stock
        self.session.post(
            f"{BASE_URL}/api/inventory/central/add",
            json={"variant_id": TEST_VARIANT_ID, "quantity": current_stock + 1}
        )
    
    # ==================== ADJUST STOCK TESTS ====================
    
    def test_adjust_stock_set_quantity(self):
        """POST /api/inventory/central/adjust - Manual stock adjustment"""
        # Get current stock
        stock_before = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID}
        ).json().get("quantity", 0)
        
        new_qty = stock_before + 10
        
        response = self.session.post(
            f"{BASE_URL}/api/inventory/central/adjust",
            json={
                "variant_id": TEST_VARIANT_ID,
                "new_quantity": new_qty,
                "reason": "Test adjustment - setting to specific value"
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["new_quantity"] == new_qty
        assert data["previous_quantity"] == stock_before
        assert data["adjustment"] == 10
        print(f"✓ Stock adjusted: {stock_before} -> {new_qty}")
    
    # ==================== TRANSFER STOCK TESTS ====================
    
    def test_transfer_stock_between_warehouses(self):
        """POST /api/inventory/central/transfer - Transfer stock between warehouses"""
        # First, ensure we have stock in a source warehouse
        source_warehouse = "test-warehouse-source"
        dest_warehouse = "test-warehouse-dest"
        
        # Add stock to source warehouse
        add_response = self.session.post(
            f"{BASE_URL}/api/inventory/central/add",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": 20,
                "warehouse_id": source_warehouse,
                "notes": "Setup for transfer test"
            }
        )
        
        if add_response.status_code != 200:
            pytest.skip("Could not setup source warehouse stock")
        
        # Transfer stock
        response = self.session.post(
            f"{BASE_URL}/api/inventory/central/transfer",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": 5,
                "from_warehouse_id": source_warehouse,
                "to_warehouse_id": dest_warehouse,
                "notes": "Test transfer"
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["quantity_transferred"] == 5
        assert data["from_warehouse"] == source_warehouse
        assert data["to_warehouse"] == dest_warehouse
        print(f"✓ Stock transferred: 5 units from {source_warehouse} to {dest_warehouse}")
    
    def test_transfer_stock_insufficient_fails(self):
        """POST /api/inventory/central/transfer - Fail if source has insufficient stock"""
        response = self.session.post(
            f"{BASE_URL}/api/inventory/central/transfer",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": 999999,
                "from_warehouse_id": "empty-warehouse",
                "to_warehouse_id": "dest-warehouse",
                "notes": "Should fail"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Transfer with insufficient stock correctly rejected")
    
    # ==================== STOCK MOVEMENTS (AUDIT TRAIL) TESTS ====================
    
    def test_get_stock_movements(self):
        """GET /api/inventory/central/movements - Get stock movement history"""
        response = self.session.get(f"{BASE_URL}/api/inventory/central/movements")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "movements" in data
        assert "total" in data
        assert isinstance(data["movements"], list)
        
        if data["movements"]:
            movement = data["movements"][0]
            assert "movement_type" in movement
            assert "quantity" in movement
            assert "created_at" in movement
            print(f"✓ Found {data['total']} stock movements")
        else:
            print(f"✓ No movements found (empty audit trail)")
    
    def test_get_stock_movements_by_variant(self):
        """GET /api/inventory/central/movements - Filter by variant"""
        response = self.session.get(
            f"{BASE_URL}/api/inventory/central/movements",
            params={"variant_id": TEST_VARIANT_ID}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All movements should be for the specified variant
        for movement in data["movements"]:
            assert movement["variant_id"] == TEST_VARIANT_ID
        
        print(f"✓ Found {data['total']} movements for variant {TEST_VARIANT_ID}")
    
    def test_get_stock_movements_by_type(self):
        """GET /api/inventory/central/movements - Filter by movement type"""
        response = self.session.get(
            f"{BASE_URL}/api/inventory/central/movements",
            params={"movement_type": "SALE"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All movements should be SALE type
        for movement in data["movements"]:
            assert movement["movement_type"] == "SALE"
        
        print(f"✓ Found {data['total']} SALE movements")
    
    # ==================== STOCK SUMMARY TESTS ====================
    
    def test_get_stock_summary(self):
        """GET /api/inventory/central/summary - Get stock summary statistics"""
        response = self.session.get(f"{BASE_URL}/api/inventory/central/summary")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "total_items" in data
        assert "total_quantity" in data
        assert "out_of_stock" in data
        assert "low_stock" in data
        assert "in_stock" in data
        
        print(f"✓ Stock summary: {data['total_items']} items, {data['total_quantity']} total qty, {data['out_of_stock']} out of stock")
    
    # ==================== MIGRATION TESTS ====================
    
    def test_migrate_stock_data(self):
        """POST /api/inventory/central/migrate - Migrate existing stock to centralized system"""
        response = self.session.post(f"{BASE_URL}/api/inventory/central/migrate")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert "migrated_from_variants" in data
        assert "migrated_from_inventory" in data
        
        print(f"✓ Migration complete: {data['migrated_from_variants']} from variants, {data['migrated_from_inventory']} from inventory")


class TestSalesWithCentralizedInventory:
    """Tests for sales operations using centralized inventory"""
    
    TEST_STORE_ID = "sales-test-store"  # Dedicated store for sales tests
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        self.session.close()
    
    def test_create_sale_deducts_stock(self):
        """POST /api/sales - Create sale should deduct stock via centralized service"""
        # Add stock to the specific store/warehouse for this test
        self.session.post(
            f"{BASE_URL}/api/inventory/central/add",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": 20,
                "warehouse_id": self.TEST_STORE_ID,
                "notes": "Setup for sales test"
            }
        )
        
        # Get current stock for this specific warehouse
        stock_before = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID, "warehouse_id": self.TEST_STORE_ID}
        ).json().get("quantity", 0)
        
        # Create a sale
        sale_data = {
            "store_id": self.TEST_STORE_ID,
            "items": [{
                "item_id": TEST_ITEM_ID,
                "variant_id": TEST_VARIANT_ID,
                "name": "Test Item",
                "quantity": 1,
                "rate": 100,
                "amount": 100
            }],
            "subtotal": 100,
            "discount_amount": 0,
            "tax_amount": 5,
            "total_amount": 105,
            "payment_method": "cash",
            "amount_paid": 105
        }
        
        response = self.session.post(f"{BASE_URL}/api/sales", json=sale_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        sale = response.json()
        
        assert "id" in sale
        assert "invoice_number" in sale
        
        # Verify stock was deducted from the specific warehouse
        stock_after = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID, "warehouse_id": self.TEST_STORE_ID}
        ).json().get("quantity", 0)
        
        assert stock_after == stock_before - 1, f"Stock not deducted: {stock_before} -> {stock_after}"
        print(f"✓ Sale created, stock deducted: {stock_before} -> {stock_after}")
        
        return sale["id"]
    
    def test_create_sale_fails_insufficient_stock(self):
        """POST /api/sales - Sale should FAIL if insufficient stock"""
        # Use a warehouse with no stock
        empty_warehouse = "empty-warehouse-for-test"
        
        # Get current stock (should be 0 or very low)
        stock_response = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID, "warehouse_id": empty_warehouse}
        )
        current_stock = stock_response.json().get("quantity", 0)
        
        # Try to sell more than available
        sale_data = {
            "store_id": empty_warehouse,
            "items": [{
                "item_id": TEST_ITEM_ID,
                "variant_id": TEST_VARIANT_ID,
                "name": "Test Item",
                "quantity": current_stock + 1000,  # More than available
                "rate": 100,
                "amount": (current_stock + 1000) * 100
            }],
            "subtotal": (current_stock + 1000) * 100,
            "discount_amount": 0,
            "tax_amount": 0,
            "total_amount": (current_stock + 1000) * 100,
            "payment_method": "cash",
            "amount_paid": (current_stock + 1000) * 100
        }
        
        response = self.session.post(f"{BASE_URL}/api/sales", json=sale_data)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "Insufficient stock" in response.text or "insufficient" in response.text.lower()
        print(f"✓ Sale correctly rejected due to insufficient stock (tried {current_stock + 1000}, have {current_stock})")
    
    def test_cancel_sale_restores_stock(self):
        """PUT /api/sales/{sale_id}/cancel - Cancel sale should restore stock"""
        # Add stock to the specific store/warehouse for this test
        self.session.post(
            f"{BASE_URL}/api/inventory/central/add",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": 20,
                "warehouse_id": self.TEST_STORE_ID,
                "notes": "Setup for cancel sale test"
            }
        )
        
        # Get current stock for this specific warehouse
        stock_before = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID, "warehouse_id": self.TEST_STORE_ID}
        ).json().get("quantity", 0)
        
        # Create a sale
        sale_data = {
            "store_id": self.TEST_STORE_ID,
            "items": [{
                "item_id": TEST_ITEM_ID,
                "variant_id": TEST_VARIANT_ID,
                "name": "Test Item",
                "quantity": 1,
                "rate": 100,
                "amount": 100
            }],
            "subtotal": 100,
            "discount_amount": 0,
            "tax_amount": 5,
            "total_amount": 105,
            "payment_method": "cash",
            "amount_paid": 105
        }
        
        sale_response = self.session.post(f"{BASE_URL}/api/sales", json=sale_data)
        assert sale_response.status_code == 200, f"Failed to create sale: {sale_response.text}"
        sale_id = sale_response.json()["id"]
        
        # Get stock after sale
        stock_after_sale = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID, "warehouse_id": self.TEST_STORE_ID}
        ).json().get("quantity", 0)
        
        # Cancel the sale
        cancel_response = self.session.put(
            f"{BASE_URL}/api/sales/{sale_id}/cancel",
            params={"reason": "Test cancellation"}
        )
        
        assert cancel_response.status_code == 200, f"Failed to cancel: {cancel_response.text}"
        
        # Verify stock was restored
        stock_after_cancel = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID, "warehouse_id": self.TEST_STORE_ID}
        ).json().get("quantity", 0)
        
        assert stock_after_cancel == stock_after_sale + 1, f"Stock not restored: {stock_after_sale} -> {stock_after_cancel}"
        print(f"✓ Sale cancelled, stock restored: {stock_after_sale} -> {stock_after_cancel}")


class TestSalesReturnsWithCentralizedInventory:
    """Tests for sales returns using centralized inventory"""
    
    TEST_STORE_ID = "returns-test-store"  # Dedicated store for returns tests
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        self.session.close()
    
    def test_sales_return_adds_stock_back(self):
        """POST /api/sales-returns - Sales return should add stock back"""
        # Add stock to the specific store/warehouse for this test
        self.session.post(
            f"{BASE_URL}/api/inventory/central/add",
            json={
                "variant_id": TEST_VARIANT_ID,
                "quantity": 20,
                "warehouse_id": self.TEST_STORE_ID,
                "notes": "Setup for returns test"
            }
        )
        
        # Create a sale
        sale_data = {
            "store_id": self.TEST_STORE_ID,
            "items": [{
                "item_id": TEST_ITEM_ID,
                "variant_id": TEST_VARIANT_ID,
                "name": "Test Item",
                "quantity": 2,
                "rate": 100,
                "amount": 200
            }],
            "subtotal": 200,
            "discount_amount": 0,
            "tax_amount": 10,
            "total_amount": 210,
            "payment_method": "cash",
            "amount_paid": 210
        }
        
        sale_response = self.session.post(f"{BASE_URL}/api/sales", json=sale_data)
        if sale_response.status_code != 200:
            pytest.skip(f"Could not create sale: {sale_response.text}")
        
        sale = sale_response.json()
        sale_id = sale["id"]
        invoice_number = sale.get("invoice_number", "")
        
        # Get stock after sale (from the specific warehouse)
        stock_after_sale = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID, "warehouse_id": self.TEST_STORE_ID}
        ).json().get("quantity", 0)
        
        # Create a sales return
        return_data = {
            "invoice_id": sale_id,
            "invoice_number": invoice_number,
            "type": "return",
            "return_items": [{
                "item_id": TEST_ITEM_ID,
                "variant_id": TEST_VARIANT_ID,
                "name": "Test Item",
                "quantity": 1,
                "rate": 100,
                "amount": 100
            }],
            "exchange_items": [],
            "return_amount": 100,
            "exchange_amount": 0,
            "difference_amount": 100,
            "refund_method": "cash",
            "reason": "Test return"
        }
        
        return_response = self.session.post(f"{BASE_URL}/api/sales-returns", json=return_data)
        
        assert return_response.status_code == 200, f"Failed: {return_response.text}"
        
        # Verify stock was added back (to the specific warehouse)
        stock_after_return = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID, "warehouse_id": self.TEST_STORE_ID}
        ).json().get("quantity", 0)
        
        assert stock_after_return == stock_after_sale + 1, f"Stock not restored: {stock_after_sale} -> {stock_after_return}"
        print(f"✓ Sales return processed, stock restored: {stock_after_sale} -> {stock_after_return}")


class TestLegacyInventoryAdjust:
    """Tests for legacy inventory adjustment endpoint using centralized service"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        self.session.close()
    
    def test_legacy_inventory_adjust_positive(self):
        """POST /api/inventory/adjust - Legacy adjustment with positive quantity"""
        # Get current stock
        stock_before = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID}
        ).json().get("quantity", 0)
        
        response = self.session.post(
            f"{BASE_URL}/api/inventory/adjust",
            params={
                "variant_id": TEST_VARIANT_ID,
                "store_id": "test-store",
                "quantity": 5
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "new_quantity" in data
        print(f"✓ Legacy inventory adjust (positive): {stock_before} + 5 = {data['new_quantity']}")
    
    def test_legacy_inventory_adjust_negative(self):
        """POST /api/inventory/adjust - Legacy adjustment with negative quantity"""
        # Ensure we have stock
        self.session.post(
            f"{BASE_URL}/api/inventory/central/add",
            json={"variant_id": TEST_VARIANT_ID, "quantity": 10}
        )
        
        stock_before = self.session.get(
            f"{BASE_URL}/api/inventory/central/stock",
            params={"variant_id": TEST_VARIANT_ID}
        ).json().get("quantity", 0)
        
        response = self.session.post(
            f"{BASE_URL}/api/inventory/adjust",
            params={
                "variant_id": TEST_VARIANT_ID,
                "store_id": "test-store",
                "quantity": -3
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "new_quantity" in data
        print(f"✓ Legacy inventory adjust (negative): {stock_before} - 3 = {data['new_quantity']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
