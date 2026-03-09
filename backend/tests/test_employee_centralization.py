"""
Employee Module Centralization Tests
Tests:
1. Auto-generated employee codes (next-code API)
2. Unique employee_code validation (duplicate prevention)
3. Full employee profile endpoint
4. Employee CRUD operations
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "bedarfirdous@gmail.com"
ADMIN_PASSWORD = "Admin@123"


class TestEmployeeCentralization:
    """Tests for employee centralization features"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}

    # Test 1: Get next employee code
    def test_get_next_employee_code(self, auth_headers):
        """Test that /api/employees/next-code returns next available code"""
        response = requests.get(f"{BASE_URL}/api/employees/next-code", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should return next_code field
        assert "next_code" in data, "Response should contain 'next_code'"
        
        # Code should be in EMP format (e.g., EMP0001, EMP0002, EMP0003)
        next_code = data["next_code"]
        assert next_code.startswith("EMP"), f"Code should start with EMP, got: {next_code}"
        
        # Should be a valid format EMPXXXX
        code_num = next_code.replace("EMP", "")
        assert code_num.isdigit(), f"Code suffix should be numeric: {next_code}"
        
        print(f"✓ Next employee code: {next_code}")
        return next_code

    # Test 2: List employees to get existing codes
    def test_list_employees(self, auth_headers):
        """Test listing employees to verify existing data"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        employees = response.json()
        
        assert isinstance(employees, list), "Response should be a list"
        
        print(f"✓ Found {len(employees)} employees")
        for emp in employees[:5]:  # Print first 5
            print(f"  - {emp.get('employee_code', 'N/A')}: {emp.get('name', 'N/A')}")
        
        return employees

    # Test 3: Create employee with unique code
    def test_create_employee_unique_code(self, auth_headers):
        """Test creating employee with auto-generated unique code"""
        # First get the next code
        response = requests.get(f"{BASE_URL}/api/employees/next-code", headers=auth_headers)
        assert response.status_code == 200
        next_code = response.json()["next_code"]
        
        # Create a test employee with unique code
        test_unique_id = str(uuid.uuid4())[:8]
        employee_data = {
            "employee_code": f"TEST_{next_code}_{test_unique_id}",
            "name": f"Test Employee {test_unique_id}",
            "email": f"test.emp.{test_unique_id}@test.com",
            "phone": "9999999999",
            "store_id": "",
            "department": "general",
            "designation": "Test Position",
            "date_of_joining": "2025-01-15",
            "gender": "other",
            "address": "Test Address",
            "bank_account": "",
            "bank_name": "",
            "ifsc_code": "",
            "pan_number": "",
            "aadhar_number": ""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/employees",
            headers=auth_headers,
            json=employee_data
        )
        
        assert response.status_code == 200, f"Failed to create employee: {response.text}"
        created = response.json()
        
        assert created.get("id"), "Created employee should have an ID"
        assert created.get("employee_code") == employee_data["employee_code"]
        
        print(f"✓ Created employee: {created.get('employee_code')} - {created.get('name')}")
        
        # Clean up - delete test employee
        delete_response = requests.delete(
            f"{BASE_URL}/api/employees/{created['id']}",
            headers=auth_headers
        )
        print(f"  Cleanup: Deleted test employee (status: {delete_response.status_code})")
        
        return created["id"]

    # Test 4: Test duplicate employee code validation
    def test_duplicate_employee_code_validation(self, auth_headers):
        """Test that creating employee with duplicate code fails"""
        # First, get list of employees to find an existing code
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        
        if not employees:
            pytest.skip("No existing employees to test duplicate validation")
        
        # Get an existing employee code
        existing_code = employees[0].get("employee_code")
        if not existing_code:
            pytest.skip("No existing employee with code found")
        
        # Try to create another employee with the same code
        test_unique_id = str(uuid.uuid4())[:8]
        duplicate_data = {
            "employee_code": existing_code,  # Use existing code - should fail
            "name": f"Duplicate Test {test_unique_id}",
            "email": f"dup.{test_unique_id}@test.com",
            "phone": "8888888888",
            "store_id": "",
            "department": "general",
            "designation": "Duplicate Test",
            "date_of_joining": "2025-01-15",
            "gender": "other",
            "address": "",
            "bank_account": "",
            "bank_name": "",
            "ifsc_code": "",
            "pan_number": "",
            "aadhar_number": ""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/employees",
            headers=auth_headers,
            json=duplicate_data
        )
        
        # Should fail with 400 error
        assert response.status_code == 400, f"Expected 400 for duplicate code, got {response.status_code}: {response.text}"
        
        error_data = response.json()
        assert "already exists" in error_data.get("detail", "").lower(), \
            f"Error should mention code already exists: {error_data}"
        
        print(f"✓ Duplicate code validation working: {existing_code} correctly rejected")

    # Test 5: Get employee full profile
    def test_get_employee_full_profile(self, auth_headers):
        """Test /api/employees/{id}/full-profile returns comprehensive data"""
        # First get list of employees
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        
        if not employees:
            pytest.skip("No employees to test full profile")
        
        # Get first employee's ID
        employee_id = employees[0]["id"]
        employee_code = employees[0].get("employee_code", "N/A")
        
        # Get full profile
        response = requests.get(
            f"{BASE_URL}/api/employees/{employee_id}/full-profile",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to get full profile: {response.text}"
        profile = response.json()
        
        # Verify required fields in response
        assert "employee" in profile, "Profile should contain 'employee' data"
        assert "attendance_summary" in profile, "Profile should contain 'attendance_summary'"
        assert "salary" in profile, "Profile should contain 'salary' data"
        assert "performance" in profile, "Profile should contain 'performance' data"
        
        # Verify attendance summary structure
        attendance = profile["attendance_summary"]
        assert "present" in attendance, "Attendance should have 'present' count"
        assert "absent" in attendance, "Attendance should have 'absent' count"
        assert "late" in attendance, "Attendance should have 'late' count"
        
        # Verify performance structure
        performance = profile["performance"]
        assert "average_rating" in performance, "Performance should have 'average_rating'"
        assert "total_reviews" in performance, "Performance should have 'total_reviews'"
        
        print(f"✓ Full profile retrieved for {employee_code}:")
        print(f"  - Employee: {profile['employee'].get('name')}")
        print(f"  - Present days (30d): {attendance.get('present', 0)}")
        print(f"  - Absent days (30d): {attendance.get('absent', 0)}")
        print(f"  - Average rating: {performance.get('average_rating', 0)}/5")
        
        return profile

    # Test 6: Get non-existent employee profile (404)
    def test_get_nonexistent_employee_profile(self, auth_headers):
        """Test that getting profile of non-existent employee returns 404"""
        fake_id = "non-existent-employee-id-12345"
        
        response = requests.get(
            f"{BASE_URL}/api/employees/{fake_id}/full-profile",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent employee, got {response.status_code}"
        print("✓ Non-existent employee correctly returns 404")

    # Test 7: Verify next code increments correctly
    def test_next_code_sequence(self, auth_headers):
        """Test that next code is properly sequenced based on existing employees"""
        # Get current next code
        response = requests.get(f"{BASE_URL}/api/employees/next-code", headers=auth_headers)
        assert response.status_code == 200
        first_next_code = response.json()["next_code"]
        
        # Create an employee with that code
        test_unique_id = str(uuid.uuid4())[:8]
        employee_data = {
            "employee_code": first_next_code,
            "name": f"Sequence Test {test_unique_id}",
            "email": f"seq.{test_unique_id}@test.com",
            "phone": "7777777777",
            "store_id": "",
            "department": "general",
            "designation": "Sequence Test",
            "date_of_joining": "2025-01-15",
            "gender": "other",
            "address": "",
            "bank_account": "",
            "bank_name": "",
            "ifsc_code": "",
            "pan_number": "",
            "aadhar_number": ""
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/employees",
            headers=auth_headers,
            json=employee_data
        )
        
        assert create_response.status_code == 200, f"Failed to create: {create_response.text}"
        created = create_response.json()
        
        # Get next code again - should be incremented
        response = requests.get(f"{BASE_URL}/api/employees/next-code", headers=auth_headers)
        assert response.status_code == 200
        second_next_code = response.json()["next_code"]
        
        # Extract numbers and compare
        first_num = int(first_next_code.replace("EMP", ""))
        second_num = int(second_next_code.replace("EMP", ""))
        
        assert second_num > first_num, f"Next code should increment: {first_next_code} -> {second_next_code}"
        
        print(f"✓ Next code sequence: {first_next_code} -> {second_next_code}")
        
        # Cleanup
        delete_response = requests.delete(
            f"{BASE_URL}/api/employees/{created['id']}",
            headers=auth_headers
        )
        print(f"  Cleanup: Deleted test employee (status: {delete_response.status_code})")


class TestEmployeeUpdate:
    """Tests for employee update functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}

    def test_update_employee_with_same_code(self, auth_headers):
        """Test that updating employee with their own code works"""
        # Get existing employee
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        
        if not employees:
            pytest.skip("No employees to test update")
        
        employee = employees[0]
        
        # Update with same code (should work)
        update_data = {
            "employee_code": employee.get("employee_code"),
            "name": employee.get("name"),
            "email": employee.get("email", ""),
            "phone": employee.get("phone", ""),
            "store_id": employee.get("store_id", ""),
            "department": employee.get("department", "general"),
            "designation": f"{employee.get('designation', '')} Updated",
            "date_of_joining": employee.get("date_of_joining", ""),
            "gender": employee.get("gender", "other"),
            "address": employee.get("address", ""),
            "bank_account": employee.get("bank_account", ""),
            "bank_name": employee.get("bank_name", ""),
            "ifsc_code": employee.get("ifsc_code", ""),
            "pan_number": employee.get("pan_number", ""),
            "aadhar_number": employee.get("aadhar_number", "")
        }
        
        response = requests.put(
            f"{BASE_URL}/api/employees/{employee['id']}",
            headers=auth_headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        print(f"✓ Employee update with same code works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
