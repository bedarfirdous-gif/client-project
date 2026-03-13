"""
Unit Tests for Modular Routers

Tests the new modular routers created during the backend refactoring:
- purchase_orders.py
- quotations.py
- sales_orders.py
- stock.py
- reports.py
- hr.py
- settings.py
"""

import pytest
import httpx
import os
from datetime import datetime

# Configuration
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://erp-invoice-fix-1.preview.emergentagent.com")
TEST_USER = {"email": "superadmin@bijnisbooks.com", "password": "admin123"}


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    with httpx.Client(timeout=30) as client:
        response = client.post(
            f"{API_URL}/api/auth/login",
            json=TEST_USER
        )
        assert response.status_code == 200
        return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestPurchaseOrdersRouter:
    """Tests for /api/purchase-orders endpoints"""
    
    def test_list_purchase_orders(self, auth_headers):
        """Test listing purchase orders"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/purchase-orders",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_create_purchase_order(self, auth_headers):
        """Test creating a purchase order"""
        with httpx.Client(timeout=30) as client:
            po_data = {
                "supplier_id": "test-supplier",
                "items": [
                    {"item_id": "item1", "name": "Test Item", "quantity": 10, "cost_price": 100}
                ],
                "notes": "Test purchase order"
            }
            response = client.post(
                f"{API_URL}/api/purchase-orders",
                headers=auth_headers,
                json=po_data
            )
            assert response.status_code == 200
            data = response.json()
            # Handle both response formats (server.py vs modular router)
            po = data.get("purchase_order", data)
            assert po.get("po_number", "").startswith("PO-") or "id" in po


class TestQuotationsRouter:
    """Tests for /api/quotations endpoints"""
    
    def test_list_quotations(self, auth_headers):
        """Test listing quotations"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/quotations",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_create_quotation(self, auth_headers):
        """Test creating a quotation"""
        with httpx.Client(timeout=30) as client:
            quote_data = {
                "customer_name": "Test Customer",
                "customer_phone": "9876543210",
                "items": [
                    {"name": "Test Item", "quantity": 2, "price": 500}
                ],
                "notes": "Test quotation"
            }
            response = client.post(
                f"{API_URL}/api/quotations",
                headers=auth_headers,
                json=quote_data
            )
            assert response.status_code == 200
            data = response.json()
            # Handle both response formats
            quote = data.get("quotation", data)
            assert quote.get("quotation_number", "").startswith("QT-") or "id" in quote


class TestSalesOrdersRouter:
    """Tests for /api/sales-orders endpoints"""
    
    def test_list_sales_orders(self, auth_headers):
        """Test listing sales orders"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/sales-orders",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_create_sales_order(self, auth_headers):
        """Test creating a sales order"""
        with httpx.Client(timeout=30) as client:
            order_data = {
                "customer_name": "Test Customer",
                "customer_phone": "9876543210",
                "items": [
                    {"name": "Test Item", "quantity": 1, "price": 1000}
                ],
                "notes": "Test sales order"
            }
            response = client.post(
                f"{API_URL}/api/sales-orders",
                headers=auth_headers,
                json=order_data
            )
            assert response.status_code == 200
            data = response.json()
            # Handle both response formats
            order = data.get("order", data)
            assert order.get("order_number", "").startswith("SO-") or "id" in order


class TestStockRouter:
    """Tests for /api/stock-* endpoints"""
    
    def test_list_stock_transfers(self, auth_headers):
        """Test listing stock transfers"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/stock-transfers",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_list_stock_alerts(self, auth_headers):
        """Test listing stock alerts"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/stock-alerts",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_get_stock_alerts_count(self, auth_headers):
        """Test getting stock alerts count"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/stock-alerts/count",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "count" in data


class TestReportsRouter:
    """Tests for /api/reports/* endpoints"""
    
    def test_sales_summary_report(self, auth_headers):
        """Test sales summary report"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/reports/sales/summary",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            # Handle both response formats
            assert "summary" in data or "total_sales" in data or "total_amount" in data
    
    def test_daily_sales_report(self, auth_headers):
        """Test daily sales report"""
        with httpx.Client(timeout=30) as client:
            today = datetime.now().strftime("%Y-%m-%d")
            response = client.get(
                f"{API_URL}/api/reports/sales/daily?date={today}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            # Handle both response formats
            assert "date" in data or "period" in data or "by_date" in data
    
    def test_purchase_summary_report(self, auth_headers):
        """Test purchase summary report"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/reports/purchases/summary",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "summary" in data
    
    def test_stock_levels_report(self, auth_headers):
        """Test stock levels report"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/reports/inventory/stock-levels",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "summary" in data
    
    def test_profit_loss_report(self, auth_headers):
        """Test profit/loss report"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/reports/financial/profit-loss",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "profit" in data


class TestHRRouter:
    """Tests for /api/attendance, /api/leaves, /api/shifts endpoints"""
    
    def test_list_attendance(self, auth_headers):
        """Test listing attendance records"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/attendance",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_list_leaves(self, auth_headers):
        """Test listing leave requests"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/leaves",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_list_shifts(self, auth_headers):
        """Test listing shifts"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/shifts",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)


class TestSettingsRouter:
    """Tests for /api/settings/* endpoints"""
    
    def test_list_stores(self, auth_headers):
        """Test listing stores"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/settings/stores",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_get_business_profile(self, auth_headers):
        """Test getting business profile"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/settings/business",
                headers=auth_headers
            )
            assert response.status_code == 200
    
    def test_get_tax_settings(self, auth_headers):
        """Test getting tax settings"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/settings/tax",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "gst_enabled" in data or data == {}
    
    def test_get_payment_settings(self, auth_headers):
        """Test getting payment settings"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/settings/payment",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "payment_methods" in data or data == {}
    
    def test_get_notification_settings(self, auth_headers):
        """Test getting notification settings"""
        with httpx.Client(timeout=30) as client:
            response = client.get(
                f"{API_URL}/api/settings/notifications",
                headers=auth_headers
            )
            assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
