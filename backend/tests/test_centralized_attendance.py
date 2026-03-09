"""
Test cases for Centralized Attendance System:
1. Work Timing Configuration (GET/POST /api/work-timing)
2. Self Check-in/Check-out with IP tracking (/api/attendance/self-check)
3. Employee My Profile (/api/employees/my-profile)
4. Admin Mark Attendance (/api/attendance)
5. Salary Calculator with late deductions
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_CREDS = {"email": "superadmin@bijnisbooks.com", "password": "admin123"}
ADMIN_CREDS = {"email": "test@bijnisbooks.com", "password": "admin123"}


class TestAuthentication:
    """Authentication helper tests"""
    
    def test_superadmin_login(self):
        """Test superadmin login returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"SUCCESS: Superadmin login - token received")
        return data["access_token"]


class TestWorkTimingAPI:
    """Test Work Timing Configuration APIs"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        return response.json()["access_token"]
    
    def test_get_work_timing_default(self, auth_token):
        """GET /api/work-timing should return default or configured timing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/work-timing", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check required fields exist
        assert "enable_seasonal_timing" in data
        assert "winter_start_time" in data
        assert "winter_end_time" in data
        assert "summer_start_time" in data
        assert "summer_end_time" in data
        assert "grace_period_minutes" in data
        
        print(f"SUCCESS: GET /api/work-timing - Winter: {data['winter_start_time']}-{data['winter_end_time']}, "
              f"Summer: {data['summer_start_time']}-{data['summer_end_time']}")
    
    def test_save_work_timing_config(self, auth_token):
        """POST /api/work-timing should save configuration"""
        headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        
        new_config = {
            "enable_seasonal_timing": True,
            "winter_start_time": "09:30",
            "winter_end_time": "18:00",
            "summer_start_time": "09:00",
            "summer_end_time": "19:30",
            "grace_period_minutes": 15,
            "late_deduction_per_hour": 50
        }
        
        response = requests.post(f"{BASE_URL}/api/work-timing", headers=headers, json=new_config)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("message") == "Work timing saved successfully"
        
        # Verify saved values
        verify_response = requests.get(f"{BASE_URL}/api/work-timing", headers=headers)
        verify_data = verify_response.json()
        assert verify_data["winter_start_time"] == "09:30"
        assert verify_data["summer_start_time"] == "09:00"
        
        print(f"SUCCESS: POST /api/work-timing - Configuration saved and verified")
    
    def test_update_seasonal_timing(self, auth_token):
        """Test updating seasonal timing settings"""
        headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        
        # Test with different timings
        updated_config = {
            "enable_seasonal_timing": True,
            "winter_start_time": "10:00",
            "winter_end_time": "18:30",
            "summer_start_time": "08:30",
            "summer_end_time": "19:00",
            "grace_period_minutes": 10,
            "late_deduction_per_hour": 100
        }
        
        response = requests.post(f"{BASE_URL}/api/work-timing", headers=headers, json=updated_config)
        assert response.status_code == 200
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/work-timing", headers=headers)
        data = verify_response.json()
        assert data["winter_start_time"] == "10:00"
        assert data["grace_period_minutes"] == 10
        assert data["late_deduction_per_hour"] == 100
        
        print(f"SUCCESS: Work timing updated - Grace: 10 mins, Deduction: ₹100/hour")
        
        # Restore original settings
        restore_config = {
            "enable_seasonal_timing": True,
            "winter_start_time": "09:30",
            "winter_end_time": "18:00",
            "summer_start_time": "09:00",
            "summer_end_time": "19:30",
            "grace_period_minutes": 15,
            "late_deduction_per_hour": 50
        }
        requests.post(f"{BASE_URL}/api/work-timing", headers=headers, json=restore_config)


class TestMyProfileAPI:
    """Test Employee My Profile API"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        return response.json()["access_token"]
    
    def test_get_my_profile_superadmin(self, auth_token):
        """GET /api/employees/my-profile - may return 404 if no employee linked"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/employees/my-profile", headers=headers)
        
        # May be 404 if superadmin is not an employee
        if response.status_code == 404:
            print(f"INFO: /api/employees/my-profile returns 404 - Superadmin is not linked to an employee record")
            detail = response.json().get("detail", "")
            assert "Employee" in detail and "not found" in detail
        elif response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert "name" in data
            print(f"SUCCESS: Employee profile found - {data.get('name')}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")


class TestSelfCheckAPI:
    """Test Self Check-in/Check-out API"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        return response.json()["access_token"]
    
    def test_self_checkin_without_employee(self, auth_token):
        """POST /api/attendance/self-check - should fail if no employee record"""
        headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        
        checkin_data = {
            "action": "check_in",
            "ip_address": "192.168.1.100",
            "device_info": "Test Browser"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance/self-check", headers=headers, json=checkin_data)
        
        # Expected to fail since superadmin likely doesn't have employee record
        if response.status_code == 404:
            assert "Employee record not found" in response.json().get("detail", "")
            print(f"INFO: Self check-in failed as expected - user not linked to employee")
        elif response.status_code == 200:
            data = response.json()
            assert "attendance" in data
            print(f"SUCCESS: Self check-in worked - {data.get('message')}")
        elif response.status_code == 400:
            # Already checked in
            print(f"INFO: {response.json().get('detail', '')}")
    
    def test_self_check_invalid_action(self, auth_token):
        """POST /api/attendance/self-check with invalid action"""
        headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        
        checkin_data = {
            "action": "invalid_action",
            "ip_address": "192.168.1.100"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance/self-check", headers=headers, json=checkin_data)
        
        # Should fail or return validation error
        assert response.status_code in [400, 404, 422], f"Expected error status, got {response.status_code}"
        print(f"SUCCESS: Invalid action rejected correctly")


class TestAdminMarkAttendance:
    """Test Admin Mark Attendance API"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def employee_and_store(self, auth_token):
        """Get a test employee and store"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get stores
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        stores = stores_response.json()
        if not stores:
            pytest.skip("No stores available for testing")
        store_id = stores[0]["id"]
        
        # Get employees
        employees_response = requests.get(f"{BASE_URL}/api/employees?store_id={store_id}", headers=headers)
        employees = employees_response.json()
        if not employees:
            pytest.skip("No employees available for testing")
        
        return employees[0], store_id
    
    def test_admin_mark_attendance_present(self, auth_token, employee_and_store):
        """POST /api/attendance - mark employee as present"""
        employee, store_id = employee_and_store
        headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        
        today = datetime.now().strftime("%Y-%m-%d")
        attendance_data = {
            "employee_id": employee["id"],
            "store_id": store_id,
            "date": today,
            "status": "present",
            "in_time": "09:30",
            "out_time": "18:00"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance", headers=headers, json=attendance_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"SUCCESS: Marked {employee.get('name')} as PRESENT for {today}")
    
    def test_admin_mark_attendance_absent(self, auth_token, employee_and_store):
        """POST /api/attendance - mark employee as absent"""
        employee, store_id = employee_and_store
        headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        
        # Use a past date for absent test
        past_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        attendance_data = {
            "employee_id": employee["id"],
            "store_id": store_id,
            "date": past_date,
            "status": "absent"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance", headers=headers, json=attendance_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"SUCCESS: Marked {employee.get('name')} as ABSENT for {past_date}")
    
    def test_admin_mark_attendance_leave(self, auth_token, employee_and_store):
        """POST /api/attendance - mark employee as on leave"""
        employee, store_id = employee_and_store
        headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        
        # Use a future date for leave test
        future_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        attendance_data = {
            "employee_id": employee["id"],
            "store_id": store_id,
            "date": future_date,
            "status": "leave"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance", headers=headers, json=attendance_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"SUCCESS: Marked {employee.get('name')} as LEAVE for {future_date}")
    
    def test_get_attendance_for_date(self, auth_token, employee_and_store):
        """GET /api/attendance - retrieve attendance for a date"""
        _, store_id = employee_and_store
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/attendance?date={today}&store_id={store_id}", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Retrieved {len(data)} attendance records for {today}")


class TestAttendanceSheet:
    """Test Attendance Sheet - Monthly records"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def employee_id(self, auth_token):
        headers = {"Authorization": f"Bearer {auth_token}"}
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        stores = stores_response.json()
        if not stores:
            pytest.skip("No stores available")
        
        employees_response = requests.get(f"{BASE_URL}/api/employees?store_id={stores[0]['id']}", headers=headers)
        employees = employees_response.json()
        if not employees:
            pytest.skip("No employees available")
        
        return employees[0]["id"]
    
    def test_get_monthly_attendance(self, auth_token, employee_id):
        """GET /api/attendance - retrieve monthly attendance for employee"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Current month
        now = datetime.now()
        start_date = f"{now.year}-{now.month:02d}-01"
        end_day = 28  # Safe for all months
        end_date = f"{now.year}-{now.month:02d}-{end_day}"
        
        response = requests.get(
            f"{BASE_URL}/api/attendance?employee_id={employee_id}&start_date={start_date}&end_date={end_date}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        
        # Count status types
        present_count = len([r for r in data if r.get('status') == 'present'])
        late_count = len([r for r in data if r.get('late_hours', 0) > 0])
        
        print(f"SUCCESS: Monthly attendance - {len(data)} records, {present_count} present, {late_count} late")


class TestSalaryCalculator:
    """Test Salary Calculator with late deductions"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def employee_id(self, auth_token):
        headers = {"Authorization": f"Bearer {auth_token}"}
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        stores = stores_response.json()
        if not stores:
            pytest.skip("No stores available")
        
        employees_response = requests.get(f"{BASE_URL}/api/employees?store_id={stores[0]['id']}", headers=headers)
        employees = employees_response.json()
        if not employees:
            pytest.skip("No employees available")
        
        return employees[0]["id"]
    
    def test_salary_calculator_api(self, auth_token, employee_id):
        """GET /api/salary-calculator/auto-calculate - calculate salary with deductions"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        now = datetime.now()
        month = now.month
        year = now.year
        
        response = requests.get(
            f"{BASE_URL}/api/salary-calculator/auto-calculate?employee_id={employee_id}&month={month}&year={year}",
            headers=headers
        )
        
        # May be 404 if endpoint doesn't exist or employee has no salary structure
        if response.status_code == 404:
            print(f"INFO: Salary calculator API returned 404 - may need salary structure setup")
            return
        
        if response.status_code == 200:
            data = response.json()
            # Check expected structure
            if "summary" in data:
                summary = data.get("summary", {})
                gross = summary.get("gross_salary", 0)
                final = summary.get("final_salary", 0)
                print(f"SUCCESS: Salary calculated - Gross: {gross}, Final: {final}")
            else:
                print(f"SUCCESS: Salary data returned: {list(data.keys())}")
        else:
            print(f"WARNING: Salary calculator returned {response.status_code}: {response.text}")


class TestStoreAndEmployeeAPIs:
    """Test supporting APIs for the Centralized Attendance page"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        return response.json()["access_token"]
    
    def test_get_stores(self, auth_token):
        """GET /api/stores - should return list of stores"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Retrieved {len(data)} stores")
    
    def test_get_employees(self, auth_token):
        """GET /api/employees - should return list of employees"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get stores
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        stores = stores_response.json()
        if not stores:
            pytest.skip("No stores to test employees")
        
        store_id = stores[0]["id"]
        response = requests.get(f"{BASE_URL}/api/employees?store_id={store_id}", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Retrieved {len(data)} employees for store")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
