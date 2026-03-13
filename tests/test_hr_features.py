"""
Test HR Features: Employee Loans, Employee Upgrade, Fabric Catalogue Categories
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmployeeLoans:
    """Employee Loan Management System Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "SuperAdmin@123"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get first employee for testing
        emp_resp = requests.get(f"{BASE_URL}/api/employees", headers=self.headers)
        assert emp_resp.status_code == 200
        self.employees = emp_resp.json()
        if self.employees:
            self.employee_id = self.employees[0]["id"]
    
    def test_loans_list_api(self):
        """Test GET /api/loans returns list of loans"""
        response = requests.get(f"{BASE_URL}/api/loans", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Loans list returned {len(data)} loans")
    
    def test_loan_eligibility_api(self):
        """Test GET /api/employees/{id}/loan-eligibility checks service years"""
        if not hasattr(self, 'employee_id'):
            pytest.skip("No employee available for test")
        
        response = requests.get(
            f"{BASE_URL}/api/employees/{self.employee_id}/loan-eligibility", 
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "eligible" in data
        assert "years_of_service" in data
        assert "max_loan_amount" in data
        assert "available_loan_amount" in data
        
        print(f"✓ Eligibility check: eligible={data['eligible']}, years={data['years_of_service']:.2f}")
    
    def test_loan_eligibility_requires_2_years(self):
        """Verify 2+ years service requirement is enforced"""
        if not hasattr(self, 'employee_id'):
            pytest.skip("No employee available for test")
        
        response = requests.get(
            f"{BASE_URL}/api/employees/{self.employee_id}/loan-eligibility",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # If years < 2, should not be eligible
        if data["years_of_service"] < 2:
            assert data["eligible"] == False
            assert "2 years" in data.get("reason", "").lower() or "service" in data.get("reason", "").lower()
            print(f"✓ Correctly denied: {data['reason']}")
        else:
            print(f"✓ Employee has {data['years_of_service']:.2f} years of service")


class TestEmployeeUpgrade:
    """Employee Upgrade/Promotion Module Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "SuperAdmin@123"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get first employee for testing
        emp_resp = requests.get(f"{BASE_URL}/api/employees", headers=self.headers)
        assert emp_resp.status_code == 200
        self.employees = emp_resp.json()
        if self.employees:
            self.employee_id = self.employees[0]["id"]
    
    def test_upgrade_history_api(self):
        """Test GET /api/employees/{id}/upgrade-history returns history"""
        if not hasattr(self, 'employee_id'):
            pytest.skip("No employee available for test")
        
        response = requests.get(
            f"{BASE_URL}/api/employees/{self.employee_id}/upgrade-history",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "employee" in data
        assert "history" in data
        assert "current_designation" in data["employee"]
        assert "current_salary" in data["employee"]
        
        print(f"✓ Upgrade history: {len(data['history'])} records found")
        print(f"  Current: {data['employee']['current_designation']} @ ₹{data['employee']['current_salary']}")
    
    def test_upgrade_employee_api(self):
        """Test POST /api/employees/{id}/upgrade updates employee"""
        if not hasattr(self, 'employee_id'):
            pytest.skip("No employee available for test")
        
        # First get current state
        history_resp = requests.get(
            f"{BASE_URL}/api/employees/{self.employee_id}/upgrade-history",
            headers=self.headers
        )
        current_salary = history_resp.json()["employee"]["current_salary"]
        
        # Apply upgrade
        new_salary = float(current_salary or 0) + 1000  # Increment by 1000
        response = requests.post(
            f"{BASE_URL}/api/employees/{self.employee_id}/upgrade",
            headers=self.headers,
            json={
                "designation": "Test Designation",
                "basic_salary": new_salary,
                "effective_date": "2026-02-10",
                "reason": "Pytest upgrade test"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "upgrade" in data
        assert data["upgrade"]["new_salary"] == new_salary
        
        print(f"✓ Upgrade successful: {data['message']}")


class TestFabricCatalogue:
    """Fabric Catalogue Categories Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "SuperAdmin@123"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_fabric_categories_api(self):
        """Test GET /api/fabrics/categories returns categories"""
        response = requests.get(f"{BASE_URL}/api/fabrics/categories", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "categories" in data
        categories = data["categories"]
        assert len(categories) > 0
        
        # Verify category structure
        for cat in categories:
            assert "id" in cat
            assert "name" in cat
        
        print(f"✓ Found {len(categories)} fabric categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
