"""
Tests for Barcode Scanner and Expenditure Module features
- Tests expense CRUD operations
- Tests expense summary and categories
- Tests expense trends API
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "SuperAdmin@123"


class TestAuth:
    """Authentication tests"""
    
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
    def headers(self, auth_token):
        """Return auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Login successful for user: {data['user'].get('email')}")


class TestExpenseCategories:
    """Test expense categories API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_expense_categories(self, headers):
        """Test /api/expenses/categories returns all categories"""
        response = requests.get(f"{BASE_URL}/api/expenses/categories", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        
        # Verify expected categories exist
        expected_cats = ["rent", "utilities", "salaries", "marketing", "supplies", 
                        "maintenance", "transport", "inventory", "taxes", "insurance", "other"]
        for cat in expected_cats:
            assert cat in categories, f"Missing category: {cat}"
            assert "name" in categories[cat]
            assert "color" in categories[cat]
        
        print(f"Categories API returned {len(categories)} categories")


class TestExpenseCRUD:
    """Test expense CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def test_expense_id(self, headers):
        """Create a test expense and return its ID, cleanup after tests"""
        # Create test expense
        today = datetime.now().strftime("%Y-%m-%d")
        expense_data = {
            "title": "TEST_Expense_Pytest",
            "amount": 1500.50,
            "category": "supplies",
            "expense_type": "daily",
            "date": today,
            "description": "Test expense created by pytest",
            "payment_method": "cash",
            "vendor_name": "TEST_Vendor"
        }
        
        response = requests.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        expense = response.json()
        expense_id = expense["id"]
        
        yield expense_id
        
        # Cleanup - delete the test expense
        requests.delete(f"{BASE_URL}/api/expenses/{expense_id}", headers=headers)
    
    def test_create_expense(self, headers):
        """Test creating a new expense"""
        today = datetime.now().strftime("%Y-%m-%d")
        expense_data = {
            "title": "TEST_Office Supplies Purchase",
            "amount": 2500.00,
            "category": "supplies",
            "expense_type": "one_time",
            "date": today,
            "description": "Purchased office supplies for testing",
            "payment_method": "bank_transfer",
            "vendor_name": "TEST_Office Mart",
            "reference_number": "INV-TEST-001"
        }
        
        response = requests.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        expense = response.json()
        assert expense["title"] == expense_data["title"]
        assert expense["amount"] == expense_data["amount"]
        assert expense["category"] == expense_data["category"]
        assert expense["expense_type"] == expense_data["expense_type"]
        assert "id" in expense
        
        print(f"Created expense: {expense['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/expenses/{expense['id']}", headers=headers)
    
    def test_list_expenses(self, headers, test_expense_id):
        """Test listing expenses"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=headers)
        assert response.status_code == 200, f"List failed: {response.text}"
        
        data = response.json()
        assert "expenses" in data
        assert "total" in data
        
        print(f"Listed {len(data['expenses'])} expenses, total: {data['total']}")
    
    def test_get_expense_by_id(self, headers, test_expense_id):
        """Test getting a specific expense"""
        response = requests.get(f"{BASE_URL}/api/expenses/{test_expense_id}", headers=headers)
        assert response.status_code == 200, f"Get failed: {response.text}"
        
        expense = response.json()
        assert expense["id"] == test_expense_id
        assert "title" in expense
        assert "amount" in expense
        
        print(f"Retrieved expense: {expense['title']}")
    
    def test_update_expense(self, headers, test_expense_id):
        """Test updating an expense"""
        update_data = {
            "title": "TEST_Updated Expense Title",
            "amount": 2000.00,
            "description": "Updated by pytest"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/expenses/{test_expense_id}",
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        updated = response.json()
        assert updated["title"] == update_data["title"]
        assert updated["amount"] == update_data["amount"]
        
        print(f"Updated expense: {updated['id']}")
    
    def test_delete_expense(self, headers):
        """Test deleting an expense (soft delete to recycle bin)"""
        # Create an expense to delete
        today = datetime.now().strftime("%Y-%m-%d")
        expense_data = {
            "title": "TEST_To Be Deleted",
            "amount": 100.00,
            "category": "other",
            "expense_type": "daily",
            "date": today
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=headers)
        assert create_resp.status_code == 200
        expense_id = create_resp.json()["id"]
        
        # Delete the expense
        delete_resp = requests.delete(f"{BASE_URL}/api/expenses/{expense_id}", headers=headers)
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        
        # Verify it's gone
        get_resp = requests.get(f"{BASE_URL}/api/expenses/{expense_id}", headers=headers)
        assert get_resp.status_code == 404, "Deleted expense should return 404"
        
        print(f"Deleted expense: {expense_id}")
    
    def test_filter_by_category(self, headers):
        """Test filtering expenses by category"""
        response = requests.get(
            f"{BASE_URL}/api/expenses?category=supplies",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        for exp in data["expenses"]:
            assert exp["category"] == "supplies"
        
        print(f"Filtered by category 'supplies': {len(data['expenses'])} results")
    
    def test_filter_by_expense_type(self, headers):
        """Test filtering expenses by expense type"""
        response = requests.get(
            f"{BASE_URL}/api/expenses?expense_type=daily",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        for exp in data["expenses"]:
            assert exp["expense_type"] == "daily"
        
        print(f"Filtered by type 'daily': {len(data['expenses'])} results")


class TestExpenseSummary:
    """Test expense summary API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_summary_month(self, headers):
        """Test expense summary for current month"""
        response = requests.get(
            f"{BASE_URL}/api/expenses/summary?period=month",
            headers=headers
        )
        assert response.status_code == 200, f"Summary failed: {response.text}"
        
        data = response.json()
        assert "total_expenses" in data
        assert "total_revenue" in data
        assert "net_profit" in data
        assert "by_category" in data
        assert "by_store" in data
        assert "by_type" in data
        
        print(f"Monthly Summary - Expenses: {data['total_expenses']}, Revenue: {data['total_revenue']}, Net Profit: {data['net_profit']}")
    
    def test_get_summary_day(self, headers):
        """Test expense summary for today"""
        response = requests.get(
            f"{BASE_URL}/api/expenses/summary?period=day",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "day"
        assert "date_range" in data
        
        print(f"Daily Summary - Expenses: {data['total_expenses']}")
    
    def test_get_summary_year(self, headers):
        """Test expense summary for current year"""
        response = requests.get(
            f"{BASE_URL}/api/expenses/summary?period=year",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "year"
        
        print(f"Yearly Summary - Expenses: {data['total_expenses']}, Profit Margin: {data.get('profit_margin', 0)}%")


class TestExpenseTrends:
    """Test expense trends API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_trends(self, headers):
        """Test expense trends over 6 months"""
        response = requests.get(
            f"{BASE_URL}/api/expenses/trends?months=6",
            headers=headers
        )
        assert response.status_code == 200, f"Trends failed: {response.text}"
        
        data = response.json()
        assert "trends" in data
        assert "total_expense" in data
        assert "avg_monthly" in data
        
        print(f"Trends - Total: {data['total_expense']}, Avg Monthly: {data['avg_monthly']}")


class TestInvalidExpenseOperations:
    """Test error handling for invalid operations"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_create_expense_invalid_category(self, headers):
        """Test creating expense with invalid category"""
        expense_data = {
            "title": "TEST_Invalid",
            "amount": 100.00,
            "category": "invalid_category",
            "expense_type": "daily",
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=headers)
        assert response.status_code == 400, "Should fail with invalid category"
        print("Correctly rejected invalid category")
    
    def test_create_expense_invalid_type(self, headers):
        """Test creating expense with invalid expense type"""
        expense_data = {
            "title": "TEST_Invalid Type",
            "amount": 100.00,
            "category": "supplies",
            "expense_type": "invalid_type",
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=headers)
        assert response.status_code == 400, "Should fail with invalid expense type"
        print("Correctly rejected invalid expense type")
    
    def test_get_nonexistent_expense(self, headers):
        """Test getting a non-existent expense"""
        response = requests.get(
            f"{BASE_URL}/api/expenses/nonexistent-id-12345",
            headers=headers
        )
        assert response.status_code == 404
        print("Correctly returned 404 for non-existent expense")


class TestItemsForBarcode:
    """Test items API for barcode scanning"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_list_items(self, headers):
        """Test listing items (used by barcode scanner)"""
        response = requests.get(f"{BASE_URL}/api/items", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        items = response.json()
        assert isinstance(items, list)
        print(f"Listed {len(items)} items for barcode scanning")
    
    def test_list_variants(self, headers):
        """Test listing variants (used by barcode scanner)"""
        response = requests.get(f"{BASE_URL}/api/variants", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        variants = response.json()
        assert isinstance(variants, list)
        print(f"Listed {len(variants)} variants for barcode scanning")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
