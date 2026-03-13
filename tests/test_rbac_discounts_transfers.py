"""
Test suite for RBAC Permissions, Discount Management, Stock Transfers, and Dashboard features
Tests: RBAC role assignment, Item Discounts, BOGO, Tiered Discounts, Stock Transfer Receive flow
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get auth headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_login_success(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print("SUCCESS: Admin login works")


class TestRBACPermissions:
    """RBAC Permissions tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_list_users(self, headers):
        """Test listing users for RBAC"""
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        print(f"SUCCESS: Listed {len(users)} users")
    
    def test_list_roles(self, headers):
        """Test listing custom roles"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=headers)
        assert response.status_code == 200
        roles = response.json()
        assert isinstance(roles, list)
        print(f"SUCCESS: Listed {len(roles)} custom roles")
    
    def test_create_custom_role(self, headers):
        """Test creating a custom role"""
        role_data = {
            "name": f"TEST_Role_{uuid.uuid4().hex[:8]}",
            "description": "Test role for RBAC testing",
            "permissions": {
                "dashboard": True,
                "pos": True,
                "items": True,
                "inventory": True,
                "customers": True
            }
        }
        response = requests.post(f"{BASE_URL}/api/roles", headers=headers, json=role_data)
        assert response.status_code == 200
        role = response.json()
        assert role["name"] == role_data["name"]
        assert role["permissions"]["dashboard"] == True
        print(f"SUCCESS: Created custom role: {role['name']}")
        return role
    
    def test_update_user_permissions(self, headers):
        """Test updating user permissions"""
        # First get a non-admin user
        users_response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        users = users_response.json()
        
        # Find a non-admin user or create one
        non_admin = next((u for u in users if u.get("role") != "admin"), None)
        
        if non_admin:
            # Update permissions
            permissions_data = {
                "permissions": {
                    "dashboard": True,
                    "pos": True,
                    "items": True,
                    "inventory": False
                },
                "assigned_role_id": None
            }
            response = requests.put(
                f"{BASE_URL}/api/users/{non_admin['id']}/permissions",
                headers=headers,
                json=permissions_data
            )
            assert response.status_code == 200
            print(f"SUCCESS: Updated permissions for user {non_admin['name']}")
        else:
            print("SKIP: No non-admin user found to test permission update")
    
    def test_get_permission_modules(self, headers):
        """Test getting permission modules list"""
        response = requests.get(f"{BASE_URL}/api/permission-modules", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # API returns dict with 'modules', 'roles', 'default_permissions'
        assert isinstance(data, dict)
        assert "modules" in data
        assert isinstance(data["modules"], list)
        assert len(data["modules"]) > 0
        print(f"SUCCESS: Got {len(data['modules'])} permission modules")


class TestItemDiscounts:
    """Item Discount tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_list_item_discounts(self, headers):
        """Test listing item discounts"""
        response = requests.get(f"{BASE_URL}/api/item-discounts", headers=headers)
        assert response.status_code == 200
        discounts = response.json()
        assert isinstance(discounts, list)
        print(f"SUCCESS: Listed {len(discounts)} item discounts")
    
    def test_create_item_discount_all_items(self, headers):
        """Test creating item discount for all items"""
        discount_data = {
            "discount_type": "percentage",
            "discount_value": 10,
            "min_quantity": 1,
            "valid_from": datetime.now().strftime("%Y-%m-%d"),
            "valid_until": "2026-12-31",
            "description": "TEST_AllItems_Discount",
            "active": True
        }
        response = requests.post(f"{BASE_URL}/api/item-discounts", headers=headers, json=discount_data)
        assert response.status_code == 200
        discount = response.json()
        assert discount["discount_type"] == "percentage"
        assert discount["discount_value"] == 10
        print(f"SUCCESS: Created item discount for all items")
        return discount
    
    def test_create_item_discount_selected_items(self, headers):
        """Test creating item discount for selected items"""
        # First get some items
        items_response = requests.get(f"{BASE_URL}/api/items", headers=headers)
        items = items_response.json()
        
        item_id = items[0]["id"] if items else None
        
        discount_data = {
            "item_id": item_id,
            "discount_type": "percentage",
            "discount_value": 15,
            "min_quantity": 1,
            "valid_from": datetime.now().strftime("%Y-%m-%d"),
            "valid_until": "2026-12-31",
            "description": "TEST_SelectedItems_Discount",
            "active": True
        }
        response = requests.post(f"{BASE_URL}/api/item-discounts", headers=headers, json=discount_data)
        assert response.status_code == 200
        discount = response.json()
        assert discount["discount_type"] == "percentage"
        print(f"SUCCESS: Created item discount for selected item")
        return discount


class TestBOGOOffers:
    """BOGO (Buy One Get One) offers tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_list_bogo_offers(self, headers):
        """Test listing BOGO offers"""
        response = requests.get(f"{BASE_URL}/api/bogo-offers", headers=headers)
        assert response.status_code == 200
        offers = response.json()
        assert isinstance(offers, list)
        print(f"SUCCESS: Listed {len(offers)} BOGO offers")
    
    def test_create_bogo_offer(self, headers):
        """Test creating BOGO offer with item selection"""
        # Get items first
        items_response = requests.get(f"{BASE_URL}/api/items", headers=headers)
        items = items_response.json()
        
        item_ids = [item["id"] for item in items[:2]] if items else []
        
        bogo_data = {
            "name": f"TEST_BOGO_{uuid.uuid4().hex[:6]}",
            "buy_item_ids": item_ids,
            "buy_quantity": 2,
            "get_item_ids": [],
            "get_quantity": 1,
            "get_discount_percent": 100,
            "valid_from": datetime.now().strftime("%Y-%m-%d"),
            "valid_until": "2026-12-31",
            "usage_limit": 0,
            "description": "Buy 2 Get 1 Free",
            "active": True
        }
        response = requests.post(f"{BASE_URL}/api/bogo-offers", headers=headers, json=bogo_data)
        assert response.status_code == 200
        offer = response.json()
        assert offer["name"] == bogo_data["name"]
        assert offer["buy_quantity"] == 2
        assert offer["get_quantity"] == 1
        print(f"SUCCESS: Created BOGO offer: {offer['name']}")
        return offer


class TestTieredDiscounts:
    """Tiered Discount tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_list_tiered_discounts(self, headers):
        """Test listing tiered discounts"""
        response = requests.get(f"{BASE_URL}/api/tiered-discounts", headers=headers)
        assert response.status_code == 200
        discounts = response.json()
        assert isinstance(discounts, list)
        print(f"SUCCESS: Listed {len(discounts)} tiered discounts")
    
    def test_create_tiered_discount(self, headers):
        """Test creating tiered discount with multiple tiers"""
        tiered_data = {
            "name": f"TEST_Tiered_{uuid.uuid4().hex[:6]}",
            "discount_type": "cart_total",
            "tiers": [
                {"min": 500, "discount": 50, "is_percent": False},
                {"min": 1000, "discount": 10, "is_percent": True},
                {"min": 2000, "discount": 15, "is_percent": True}
            ],
            "applicable_item_ids": [],
            "applicable_category_ids": [],
            "valid_from": datetime.now().strftime("%Y-%m-%d"),
            "valid_until": "2026-12-31",
            "stackable": False,
            "description": "Tiered discount test",
            "active": True
        }
        response = requests.post(f"{BASE_URL}/api/tiered-discounts", headers=headers, json=tiered_data)
        assert response.status_code == 200
        discount = response.json()
        assert discount["name"] == tiered_data["name"]
        assert len(discount["tiers"]) == 3
        print(f"SUCCESS: Created tiered discount with {len(discount['tiers'])} tiers")
        return discount


class TestStockTransfers:
    """Stock Transfer tests including receive flow"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_list_stock_transfers(self, headers):
        """Test listing stock transfers"""
        response = requests.get(f"{BASE_URL}/api/stock-transfers", headers=headers)
        assert response.status_code == 200
        transfers = response.json()
        assert isinstance(transfers, list)
        print(f"SUCCESS: Listed {len(transfers)} stock transfers")
        return transfers
    
    def test_create_stock_transfer(self, headers):
        """Test creating a stock transfer"""
        # Get stores first
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        stores = stores_response.json()
        
        if len(stores) < 2:
            print("SKIP: Need at least 2 stores for stock transfer test")
            return None
        
        # Get items with inventory
        items_response = requests.get(f"{BASE_URL}/api/items", headers=headers)
        items = items_response.json()
        
        if not items:
            print("SKIP: No items available for stock transfer")
            return None
        
        transfer_data = {
            "from_store_id": stores[0]["id"],
            "to_store_id": stores[1]["id"],
            "items": [
                {
                    "item_id": items[0]["id"],
                    "item_name": items[0]["name"],
                    "quantity": 5
                }
            ],
            "notes": "Test transfer for testing"
        }
        response = requests.post(f"{BASE_URL}/api/stock-transfers", headers=headers, json=transfer_data)
        assert response.status_code == 200
        transfer = response.json()
        assert transfer["status"] == "pending"
        print(f"SUCCESS: Created stock transfer {transfer['transfer_number']}")
        return transfer
    
    def test_approve_stock_transfer(self, headers):
        """Test approving a stock transfer"""
        # Get pending transfers
        transfers_response = requests.get(f"{BASE_URL}/api/stock-transfers?status=pending", headers=headers)
        transfers = transfers_response.json()
        
        pending = [t for t in transfers if t.get("status") == "pending"]
        
        if not pending:
            print("SKIP: No pending transfers to approve")
            return None
        
        transfer_id = pending[0]["id"]
        response = requests.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/approve", headers=headers)
        assert response.status_code == 200
        print(f"SUCCESS: Approved stock transfer {pending[0]['transfer_number']}")
        return response.json()
    
    def test_receive_stock_transfer(self, headers):
        """Test receiving a stock transfer (receive flow)"""
        # Get approved transfers
        transfers_response = requests.get(f"{BASE_URL}/api/stock-transfers?status=approved", headers=headers)
        transfers = transfers_response.json()
        
        approved = [t for t in transfers if t.get("status") == "approved"]
        
        if not approved:
            print("SKIP: No approved transfers to receive")
            return None
        
        transfer = approved[0]
        transfer_id = transfer["id"]
        
        # Prepare received items with quantities
        received_items = []
        for item in transfer.get("items", []):
            received_items.append({
                "item_id": item.get("item_id"),
                "expected_quantity": item.get("quantity", 0),
                "received_quantity": item.get("quantity", 0)  # Match expected
            })
        
        receive_data = {
            "received_items": received_items,
            "notes": "Received in full"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/stock-transfers/{transfer_id}/receive",
            headers=headers,
            json=receive_data
        )
        assert response.status_code == 200
        result = response.json()
        print(f"SUCCESS: Received stock transfer {transfer['transfer_number']}")
        return result
    
    def test_get_pending_receipt_transfers(self, headers):
        """Test getting transfers pending receipt"""
        response = requests.get(f"{BASE_URL}/api/stock-transfers/pending-receipt", headers=headers)
        assert response.status_code == 200
        transfers = response.json()
        assert isinstance(transfers, list)
        print(f"SUCCESS: Got {len(transfers)} transfers pending receipt")


class TestDashboard:
    """Dashboard tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_dashboard_stats(self, headers):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        stats = response.json()
        assert "total_items" in stats
        assert "today_revenue" in stats
        assert "today_orders" in stats
        assert "total_customers" in stats
        print(f"SUCCESS: Dashboard stats - Items: {stats['total_items']}, Revenue: {stats['today_revenue']}")
    
    def test_recent_sales(self, headers):
        """Test recent sales endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/recent-sales", headers=headers)
        assert response.status_code == 200
        sales = response.json()
        assert isinstance(sales, list)
        print(f"SUCCESS: Got {len(sales)} recent sales")
    
    def test_low_stock_items(self, headers):
        """Test low stock items endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/low-stock", headers=headers)
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        print(f"SUCCESS: Got {len(items)} low stock items")


class TestInvoices:
    """Invoice tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_list_invoices(self, headers):
        """Test listing invoices"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=headers)
        assert response.status_code == 200
        invoices = response.json()
        assert isinstance(invoices, list)
        print(f"SUCCESS: Listed {len(invoices)} invoices")
    
    def test_get_invoice_settings(self, headers):
        """Test getting invoice settings"""
        response = requests.get(f"{BASE_URL}/api/invoice-settings", headers=headers)
        assert response.status_code == 200
        settings = response.json()
        print(f"SUCCESS: Got invoice settings")


# Cleanup test data
class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_cleanup_test_roles(self, headers):
        """Cleanup test roles"""
        roles_response = requests.get(f"{BASE_URL}/api/roles", headers=headers)
        roles = roles_response.json()
        
        deleted = 0
        for role in roles:
            if role.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/roles/{role['id']}", headers=headers)
                deleted += 1
        
        print(f"CLEANUP: Deleted {deleted} test roles")
    
    def test_cleanup_test_discounts(self, headers):
        """Cleanup test item discounts"""
        discounts_response = requests.get(f"{BASE_URL}/api/item-discounts", headers=headers)
        discounts = discounts_response.json()
        
        deleted = 0
        for discount in discounts:
            if discount.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/item-discounts/{discount['id']}", headers=headers)
                deleted += 1
        
        print(f"CLEANUP: Deleted {deleted} test item discounts")
    
    def test_cleanup_test_bogo(self, headers):
        """Cleanup test BOGO offers"""
        offers_response = requests.get(f"{BASE_URL}/api/bogo-offers", headers=headers)
        offers = offers_response.json()
        
        deleted = 0
        for offer in offers:
            if offer.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/bogo-offers/{offer['id']}", headers=headers)
                deleted += 1
        
        print(f"CLEANUP: Deleted {deleted} test BOGO offers")
    
    def test_cleanup_test_tiered(self, headers):
        """Cleanup test tiered discounts"""
        discounts_response = requests.get(f"{BASE_URL}/api/tiered-discounts", headers=headers)
        discounts = discounts_response.json()
        
        deleted = 0
        for discount in discounts:
            if discount.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/tiered-discounts/{discount['id']}", headers=headers)
                deleted += 1
        
        print(f"CLEANUP: Deleted {deleted} test tiered discounts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
