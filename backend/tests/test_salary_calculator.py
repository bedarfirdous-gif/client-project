"""
Backend tests for Salary Calculator Auto-Calculate API
Tests the /api/salary-calculator/auto-calculate endpoint

Bug Fix Verified:
- Fixed AttributeError where employee.get('salary_info', {}) could return None
- Changed to: employee.get("salary_info") or {}
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://erp-invoice-fix-1.preview.emergentagent.com').rstrip('/')


class TestSalaryCalculatorAutoCalculate:
    """Tests for the Salary Calculator Auto-Calculate API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "superadmin@bijnisbooks.com",
                "password": "SuperAdmin@123"
            }
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_employees_list(self):
        """Test: Get list of employees"""
        response = requests.get(
            f"{BASE_URL}/api/employees",
            headers=self.headers
        )
        assert response.status_code == 200
        employees = response.json()
        assert isinstance(employees, list)
        assert len(employees) >= 2, "Expected at least 2 employees (ahmad and Test Employee)"
        
        # Verify test employees exist
        employee_names = [emp.get("name") for emp in employees]
        print(f"Found employees: {employee_names}")
        assert "Test Employee" in employee_names, "Test Employee should exist"
    
    def test_auto_calculate_with_salary_info_configured(self):
        """Test: Auto-calculate for employee WITH salary_info configured (Test Employee)"""
        # Test Employee ID: 15083432-22e4-4159-9561-2542231a5e96
        employee_id = "15083432-22e4-4159-9561-2542231a5e96"
        
        response = requests.get(
            f"{BASE_URL}/api/salary-calculator/auto-calculate",
            params={
                "employee_id": employee_id,
                "month": 1,
                "year": 2026,
                "working_hours_per_day": 8
            },
            headers=self.headers
        )
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "employee" in data
        assert "period" in data
        assert "attendance" in data
        assert "salary_structure" in data
        assert "calculations" in data
        assert "summary" in data
        
        # Validate employee data
        assert data["employee"]["id"] == employee_id
        assert data["employee"]["name"] == "Test Employee"
        
        # Validate salary_structure pulled from employee profile
        assert data["salary_structure"]["basic_salary"] == 20000
        assert data["salary_structure"]["hra"] == 3000
        assert data["salary_structure"]["da"] == 2000
        assert data["salary_structure"]["daily_allowance_rate"] == 200
        assert data["salary_structure"]["monthly_salary"] == 25000  # 20000 + 3000 + 2000
        
        # Validate calculations
        assert "gross_salary" in data["calculations"]
        assert "per_day_rate" in data["calculations"]
        assert "absent_deduction" in data["calculations"]
        assert "hourly_rate" in data["calculations"]
        assert "combined_final_salary" in data["calculations"]
        assert "net_salary" in data["calculations"]
        
        print(f"Auto-calculate result for Test Employee:")
        print(f"  Monthly Salary: {data['salary_structure']['monthly_salary']}")
        print(f"  Gross Salary: {data['calculations']['gross_salary']}")
        print(f"  Absent Days: {data['attendance']['absent_days']}")
        print(f"  Late Hours: {data['attendance']['total_late_hours']}")
        print(f"  Net Salary: {data['calculations']['net_salary']}")
    
    def test_auto_calculate_with_null_salary_info_bug_fix(self):
        """
        Test: Auto-calculate for employee with salary_info = null (ahmad)
        This was the bug case - employee.get('salary_info', {}) returned None causing AttributeError
        Fix: Changed to employee.get("salary_info") or {}
        """
        # ahmad employee ID: 88056ab4-5f68-41e5-b2d4-59fb2dbf34c9
        employee_id = "88056ab4-5f68-41e5-b2d4-59fb2dbf34c9"
        
        response = requests.get(
            f"{BASE_URL}/api/salary-calculator/auto-calculate",
            params={
                "employee_id": employee_id,
                "month": 1,
                "year": 2026,
                "working_hours_per_day": 8
            },
            headers=self.headers
        )
        
        # Bug fix verification: Should NOT return 500 error
        assert response.status_code == 200, f"BUG: API failed for null salary_info employee: {response.text}"
        data = response.json()
        
        # Validate structure still exists with defaults
        assert data["employee"]["name"] == "ahmad"
        assert "salary_structure" in data
        assert "calculations" in data
        
        # With null salary_info, should default to 0 values
        assert data["salary_structure"]["basic_salary"] == 0
        assert data["salary_structure"]["monthly_salary"] == 0
        assert data["salary_structure"]["daily_allowance_rate"] == 100  # default
        
        print(f"✅ Bug fix verified: API handles null salary_info correctly")
        print(f"  Employee: {data['employee']['name']}")
        print(f"  Monthly Salary: {data['salary_structure']['monthly_salary']} (defaulted to 0)")
        print(f"  Daily Allowance Rate: {data['salary_structure']['daily_allowance_rate']} (default 100)")
    
    def test_auto_calculate_invalid_employee_id(self):
        """Test: Auto-calculate for non-existent employee should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/salary-calculator/auto-calculate",
            params={
                "employee_id": "non-existent-id",
                "month": 1,
                "year": 2026
            },
            headers=self.headers
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_auto_calculate_attendance_data(self):
        """Test: Verify attendance records are correctly aggregated"""
        employee_id = "15083432-22e4-4159-9561-2542231a5e96"
        
        response = requests.get(
            f"{BASE_URL}/api/salary-calculator/auto-calculate",
            params={
                "employee_id": employee_id,
                "month": 2,  # February 2026
                "year": 2026,
                "working_hours_per_day": 8
            },
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate attendance structure
        attendance = data["attendance"]
        assert "total_records" in attendance
        assert "present_days" in attendance
        assert "absent_days" in attendance
        assert "half_days" in attendance
        assert "leave_days" in attendance
        assert "worked_days" in attendance
        assert "total_late_minutes" in attendance
        assert "total_late_hours" in attendance
        assert "late_entries" in attendance
        
        # Verify worked_days calculation
        assert attendance["worked_days"] == attendance["present_days"] + (attendance["half_days"] * 0.5)
        
        print(f"Attendance for Feb 2026:")
        print(f"  Total Records: {attendance['total_records']}")
        print(f"  Present Days: {attendance['present_days']}")
        print(f"  Absent Days: {attendance['absent_days']}")
        print(f"  Late Hours: {attendance['total_late_hours']}")
    
    def test_auto_calculate_period_parameters(self):
        """Test: Verify period parameters are correctly returned"""
        employee_id = "15083432-22e4-4159-9561-2542231a5e96"
        
        response = requests.get(
            f"{BASE_URL}/api/salary-calculator/auto-calculate",
            params={
                "employee_id": employee_id,
                "month": 3,
                "year": 2026,
                "working_hours_per_day": 9  # Custom working hours
            },
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"]["month"] == 3
        assert data["period"]["year"] == 2026
        assert data["period"]["working_hours_per_day"] == 8  # Should use employee's setting
        assert data["period"]["working_days_per_month"] == 26
    
    def test_auto_calculate_hourly_deduction(self):
        """Test: Verify hourly rate and late hours deduction calculation"""
        employee_id = "15083432-22e4-4159-9561-2542231a5e96"
        
        response = requests.get(
            f"{BASE_URL}/api/salary-calculator/auto-calculate",
            params={
                "employee_id": employee_id,
                "month": 2,
                "year": 2026,
                "working_hours_per_day": 8
            },
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        calc = data["calculations"]
        
        # Verify hourly calculations
        total_monthly_hours = 26 * 8  # 208
        assert calc["total_monthly_hours"] == total_monthly_hours
        
        # Hourly rate = gross_salary / total_monthly_hours
        if calc["gross_salary"] > 0:
            expected_hourly_rate = round(calc["gross_salary"] / total_monthly_hours, 2)
            assert abs(calc["hourly_rate"] - expected_hourly_rate) < 0.1
        
        # Late hours deduction = late_hours * hourly_rate
        late_hours = data["attendance"]["total_late_hours"]
        expected_late_deduction = round(late_hours * calc["hourly_rate"], 2)
        assert abs(calc["late_hours_deduction"] - expected_late_deduction) < 0.1
        
        print(f"Hourly calculations:")
        print(f"  Total Monthly Hours: {calc['total_monthly_hours']}")
        print(f"  Hourly Rate: ₹{calc['hourly_rate']}")
        print(f"  Late Hours: {late_hours}")
        print(f"  Late Hours Deduction: ₹{calc['late_hours_deduction']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
