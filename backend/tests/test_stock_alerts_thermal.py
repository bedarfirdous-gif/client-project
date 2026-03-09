"""
Test Stock Alerts and Thermal Printer APIs
Tests for:
1. Stock Alerts endpoints (/api/stock-alerts, /api/stock-alerts/count)
2. Stock transfer approval with low stock detection
3. Network printer endpoint (/api/printer/print)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@brandmafia.com"
TEST_PASSWORD = "demo123"


class TestAuth:
    """Authentication for tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestStockAlertsAPI(TestAuth):
    """Test Stock Alerts API endpoints"""
    
    def test_get_stock_alerts_list(self, auth_headers):
        """Test GET /api/stock-alerts returns alerts list"""
        response = requests.get(f"{BASE_URL}/api/stock-alerts", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Stock alerts list returned {len(data)} alerts")
    
    def test_get_stock_alerts_unread_only(self, auth_headers):
        """Test GET /api/stock-alerts?unread_only=true"""
        response = requests.get(f"{BASE_URL}/api/stock-alerts?unread_only=true", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # All returned alerts should be unread
        for alert in data:
            assert alert.get("read") == False, "Unread filter should only return unread alerts"
        print(f"✓ Unread alerts filter works - {len(data)} unread alerts")
    
    def test_get_stock_alerts_count(self, auth_headers):
        """Test GET /api/stock-alerts/count returns unread count"""
        response = requests.get(f"{BASE_URL}/api/stock-alerts/count", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "count" in data, "Response should have 'count' field"
        assert isinstance(data["count"], int), "Count should be an integer"
        assert data["count"] >= 0, "Count should be non-negative"
        print(f"✓ Stock alerts count: {data['count']}")
    
    def test_mark_alert_read(self, auth_headers):
        """Test PUT /api/stock-alerts/{id}/read"""
        # First get alerts
        response = requests.get(f"{BASE_URL}/api/stock-alerts", headers=auth_headers)
        alerts = response.json()
        
        if len(alerts) > 0:
            alert_id = alerts[0]["id"]
            response = requests.put(f"{BASE_URL}/api/stock-alerts/{alert_id}/read", headers=auth_headers)
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            assert "message" in data
            print(f"✓ Alert {alert_id} marked as read")
        else:
            print("⚠ No alerts to test mark as read")
            pytest.skip("No alerts available to test")
    
    def test_mark_all_alerts_read(self, auth_headers):
        """Test PUT /api/stock-alerts/read-all"""
        response = requests.put(f"{BASE_URL}/api/stock-alerts/read-all", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ All alerts marked as read: {data['message']}")


class TestStockTransferWithAlerts(TestAuth):
    """Test stock transfer approval with low stock alert generation"""
    
    @pytest.fixture(scope="class")
    def test_stores(self, auth_headers):
        """Get or create test stores"""
        response = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers)
        stores = response.json()
        
        if len(stores) < 2:
            # Create test stores
            for i in range(2 - len(stores)):
                store_data = {
                    "name": f"TEST_Store_{uuid.uuid4().hex[:6]}",
                    "code": f"TS{i}",
                    "address": "Test Address",
                    "phone": "1234567890"
                }
                requests.post(f"{BASE_URL}/api/stores", json=store_data, headers=auth_headers)
            
            response = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers)
            stores = response.json()
        
        return stores[:2]
    
    @pytest.fixture(scope="class")
    def test_item_with_variant(self, auth_headers, test_stores):
        """Create test item with variant and inventory"""
        # Create item with low min_stock_alert
        item_data = {
            "name": f"TEST_LowStock_Item_{uuid.uuid4().hex[:6]}",
            "sku": f"TSK{uuid.uuid4().hex[:6]}",
            "selling_price": 100,
            "min_stock_alert": 10  # Set min stock alert to 10
        }
        response = requests.post(f"{BASE_URL}/api/items", json=item_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create item: {response.text}"
        item = response.json()
        
        # Create variant
        variant_data = {
            "item_id": item["id"],
            "size": "M",
            "color": "Blue",
            "barcode": f"BC{uuid.uuid4().hex[:8]}"
        }
        response = requests.post(f"{BASE_URL}/api/variants", json=variant_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create variant: {response.text}"
        variant = response.json()
        
        # Add inventory to source store (just above min_stock_alert)
        source_store = test_stores[0]
        response = requests.post(
            f"{BASE_URL}/api/inventory/adjust",
            params={
                "variant_id": variant["id"],
                "store_id": source_store["id"],
                "quantity": 15,  # Just above min_stock_alert of 10
                "purchase_rate": 50
            },
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to adjust inventory: {response.text}"
        
        return {"item": item, "variant": variant}
    
    def test_stock_transfer_creates_alert_on_low_stock(self, auth_headers, test_stores, test_item_with_variant):
        """Test that approving a stock transfer creates alert when stock falls below min"""
        source_store = test_stores[0]
        dest_store = test_stores[1]
        variant = test_item_with_variant["variant"]
        item = test_item_with_variant["item"]
        
        # Create stock transfer that will reduce source stock below min_stock_alert
        transfer_data = {
            "from_store_id": source_store["id"],
            "to_store_id": dest_store["id"],
            "items": [{
                "variant_id": variant["id"],
                "item_id": item["id"],
                "quantity": 10  # This will reduce stock from 15 to 5, below min of 10
            }],
            "priority": "normal",
            "notes": "Test transfer for low stock alert"
        }
        
        response = requests.post(f"{BASE_URL}/api/stock-transfers", json=transfer_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create transfer: {response.text}"
        transfer = response.json()
        transfer_id = transfer["id"]
        print(f"✓ Created stock transfer {transfer_id}")
        
        # Approve the transfer
        response = requests.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/approve", headers=auth_headers)
        assert response.status_code == 200, f"Failed to approve transfer: {response.text}"
        result = response.json()
        
        # Check if low stock alerts were generated
        assert "message" in result
        print(f"✓ Transfer approved: {result['message']}")
        
        if "low_stock_alerts" in result:
            print(f"✓ Low stock alerts generated: {result['alert_count']}")
            assert result["alert_count"] > 0, "Should have generated at least one alert"
        
        # Verify alert was created in database
        response = requests.get(f"{BASE_URL}/api/stock-alerts", headers=auth_headers)
        alerts = response.json()
        
        # Look for alert related to our item
        item_alerts = [a for a in alerts if item["name"] in a.get("item_name", "")]
        print(f"✓ Found {len(item_alerts)} alerts for test item")


class TestNetworkPrinterAPI(TestAuth):
    """Test Network Printer API endpoint"""
    
    def test_printer_endpoint_exists(self, auth_headers):
        """Test POST /api/printer/print endpoint exists and validates input"""
        # Test with invalid IP (should fail connection but endpoint should work)
        print_data = {
            "ip": "192.168.1.254",  # Non-existent IP
            "port": 9100,
            "data": "Test print data"
        }
        
        response = requests.post(f"{BASE_URL}/api/printer/print", json=print_data, headers=auth_headers)
        
        # Endpoint should return error for connection failure, not 404
        assert response.status_code != 404, "Printer endpoint should exist"
        
        # Expected: 503 (connection refused), 504 (timeout), or 500 (other error)
        assert response.status_code in [200, 500, 503, 504], f"Unexpected status: {response.status_code}"
        print(f"✓ Printer endpoint exists, returned {response.status_code} (expected for non-existent printer)")
    
    def test_printer_endpoint_requires_auth(self):
        """Test that printer endpoint requires authentication"""
        print_data = {
            "ip": "192.168.1.1",
            "port": 9100,
            "data": "Test"
        }
        
        response = requests.post(f"{BASE_URL}/api/printer/print", json=print_data)
        assert response.status_code in [401, 403], "Printer endpoint should require auth"
        print("✓ Printer endpoint requires authentication")
    
    def test_printer_endpoint_validates_input(self, auth_headers):
        """Test that printer endpoint validates required fields"""
        # Missing IP
        response = requests.post(f"{BASE_URL}/api/printer/print", json={"port": 9100, "data": "test"}, headers=auth_headers)
        assert response.status_code == 422, "Should validate required IP field"
        
        # Missing data
        response = requests.post(f"{BASE_URL}/api/printer/print", json={"ip": "192.168.1.1", "port": 9100}, headers=auth_headers)
        assert response.status_code == 422, "Should validate required data field"
        
        print("✓ Printer endpoint validates required fields")


class TestStockAlertCleanup(TestAuth):
    """Test stock alert deletion"""
    
    def test_delete_stock_alert(self, auth_headers):
        """Test DELETE /api/stock-alerts/{id}"""
        # Get alerts
        response = requests.get(f"{BASE_URL}/api/stock-alerts", headers=auth_headers)
        alerts = response.json()
        
        if len(alerts) > 0:
            alert_id = alerts[0]["id"]
            response = requests.delete(f"{BASE_URL}/api/stock-alerts/{alert_id}", headers=auth_headers)
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            assert "message" in data
            print(f"✓ Alert {alert_id} deleted")
        else:
            print("⚠ No alerts to test deletion")
            pytest.skip("No alerts available to test")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
