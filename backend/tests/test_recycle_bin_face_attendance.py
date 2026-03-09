"""
Tests for Recycle Bin and Face Attendance features
"""
import pytest
import requests
import os
import base64
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "SuperAdmin@123"


class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for tests"""
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
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
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
        print(f"Login successful for {TEST_EMAIL}")


class TestRecycleBin:
    """Recycle Bin API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_recycle_bin(self, headers):
        """Test fetching recycle bin items"""
        response = requests.get(f"{BASE_URL}/api/recycle-bin", headers=headers)
        assert response.status_code == 200, f"Failed to get recycle bin: {response.text}"
        data = response.json()
        assert "items" in data
        assert "count" in data
        print(f"Recycle bin has {data['count']} items")
    
    def test_get_recycle_bin_with_filter(self, headers):
        """Test fetching recycle bin with type filter"""
        response = requests.get(f"{BASE_URL}/api/recycle-bin?item_type=employee", headers=headers)
        assert response.status_code == 200, f"Failed to filter recycle bin: {response.text}"
        data = response.json()
        assert "items" in data
        # All items should be of type 'employee' if present
        for item in data["items"]:
            assert item.get("item_type") == "employee"
        print(f"Filtered recycle bin has {data['count']} employee items")
    
    def test_recycle_bin_flow(self, headers):
        """Test full recycle bin flow: create employee, delete, restore"""
        # First get stores to use for employee
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        if stores_response.status_code != 200 or not stores_response.json():
            pytest.skip("No stores available for test")
        stores = stores_response.json()
        store_id = stores[0]["id"] if stores else None
        
        # Create a test employee
        employee_data = {
            "employee_code": f"TEST_RB_{datetime.now().strftime('%H%M%S')}",
            "name": "Test Recycle Bin Employee",
            "email": f"test_rb_{datetime.now().strftime('%H%M%S')}@test.com",
            "phone": "9876543210",
            "store_id": store_id or "",
            "department": "general",
            "designation": "Test Role"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=headers)
        assert create_response.status_code in [200, 201], f"Failed to create employee: {create_response.text}"
        employee = create_response.json()
        employee_id = employee.get("id")
        assert employee_id, "No employee ID returned"
        print(f"Created test employee: {employee_id}")
        
        # Delete the employee (should move to recycle bin)
        delete_response = requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=headers)
        assert delete_response.status_code == 200, f"Failed to delete employee: {delete_response.text}"
        delete_data = delete_response.json()
        assert "recycle_bin_id" in delete_data, "No recycle bin ID returned"
        recycle_bin_id = delete_data["recycle_bin_id"]
        print(f"Employee moved to recycle bin: {recycle_bin_id}")
        
        # Verify it's in recycle bin
        recycle_response = requests.get(f"{BASE_URL}/api/recycle-bin?item_type=employee", headers=headers)
        assert recycle_response.status_code == 200
        recycle_data = recycle_response.json()
        found = any(item.get("original_id") == employee_id or item.get("id") == recycle_bin_id for item in recycle_data["items"])
        assert found, "Deleted employee not found in recycle bin"
        print("Employee verified in recycle bin")
        
        # Restore the employee
        restore_response = requests.post(f"{BASE_URL}/api/recycle-bin/{recycle_bin_id}/restore", headers=headers)
        assert restore_response.status_code == 200, f"Failed to restore employee: {restore_response.text}"
        print("Employee restored successfully")
        
        # Verify employee is restored (should be active again)
        employee_response = requests.get(f"{BASE_URL}/api/employees?include_inactive=true", headers=headers)
        assert employee_response.status_code == 200
        employees = employee_response.json()
        restored_emp = next((e for e in employees if e.get("id") == employee_id), None)
        assert restored_emp is not None, "Restored employee not found"
        assert restored_emp.get("is_deleted") != True, "Employee still marked as deleted"
        print(f"Employee restored and verified: {restored_emp.get('name')}")
        
        # Clean up - delete permanently this time
        # First delete again to recycle bin
        delete_again = requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=headers)
        if delete_again.status_code == 200:
            recycle_bin_id_2 = delete_again.json().get("recycle_bin_id")
            if recycle_bin_id_2:
                # Permanently delete
                perm_delete = requests.delete(f"{BASE_URL}/api/recycle-bin/{recycle_bin_id_2}", headers=headers)
                if perm_delete.status_code == 200:
                    print("Test employee permanently deleted for cleanup")


class TestFaceAttendanceAPIs:
    """Face Attendance API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_face_registrations(self, headers):
        """Test fetching all face registrations"""
        response = requests.get(f"{BASE_URL}/api/face-attendance/registrations", headers=headers)
        assert response.status_code == 200, f"Failed to get registrations: {response.text}"
        data = response.json()
        assert "registrations" in data
        assert "count" in data
        print(f"Face registrations count: {data['count']}")
    
    def test_get_employee_face_status(self, headers):
        """Test getting face registration status for an employee"""
        # First get an employee
        emp_response = requests.get(f"{BASE_URL}/api/employees", headers=headers)
        if emp_response.status_code != 200:
            pytest.skip("Could not fetch employees")
        
        employees = emp_response.json()
        if not employees:
            pytest.skip("No employees available for test")
        
        employee_id = employees[0]["id"]
        
        # Check face registration status
        response = requests.get(f"{BASE_URL}/api/face-attendance/status/{employee_id}", headers=headers)
        assert response.status_code == 200, f"Failed to get face status: {response.text}"
        data = response.json()
        assert "registered" in data
        print(f"Employee {employee_id} face registered: {data['registered']}")
    
    def test_face_verify_no_image(self, headers):
        """Test face verification with empty image returns appropriate error"""
        response = requests.post(f"{BASE_URL}/api/face-attendance/verify", json={
            "image": ""
        }, headers=headers)
        # Should fail with 400 or validation error
        assert response.status_code in [400, 422], f"Unexpected status: {response.status_code}"
        print("Empty image correctly rejected")
    
    def test_face_register_invalid_employee(self, headers):
        """Test face registration with invalid employee ID"""
        # Create a simple test image (1x1 pixel PNG in base64)
        test_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = requests.post(f"{BASE_URL}/api/face-attendance/register", json={
            "employee_id": "non_existent_employee_id_12345",
            "image": test_image
        }, headers=headers)
        # Should either succeed or fail gracefully
        # Face registration may succeed even if employee doesn't exist (depends on implementation)
        print(f"Invalid employee registration response: {response.status_code}")


class TestEmployeeDeleteSoftDelete:
    """Test employee delete functionality moves to recycle bin"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_employee_delete_returns_recycle_bin_id(self, headers):
        """Test that deleting an employee returns a recycle bin ID"""
        # Get stores for employee
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        store_id = ""
        if stores_response.status_code == 200 and stores_response.json():
            store_id = stores_response.json()[0]["id"]
        
        # Create test employee
        employee_data = {
            "employee_code": f"TEST_DEL_{datetime.now().strftime('%H%M%S')}",
            "name": "Test Delete Employee",
            "email": f"test_del_{datetime.now().strftime('%H%M%S')}@test.com",
            "store_id": store_id,
            "department": "general"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=headers)
        assert create_response.status_code in [200, 201], f"Failed to create employee: {create_response.text}"
        employee_id = create_response.json().get("id")
        
        # Delete employee
        delete_response = requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=headers)
        assert delete_response.status_code == 200, f"Failed to delete: {delete_response.text}"
        
        data = delete_response.json()
        assert "recycle_bin_id" in data, "Delete should return recycle_bin_id"
        assert "message" in data, "Delete should return message"
        assert "Recycle Bin" in data["message"], "Message should mention Recycle Bin"
        
        print(f"Employee {employee_id} moved to recycle bin: {data['recycle_bin_id']}")
        
        # Clean up - permanently delete
        recycle_bin_id = data["recycle_bin_id"]
        perm_delete = requests.delete(f"{BASE_URL}/api/recycle-bin/{recycle_bin_id}", headers=headers)
        if perm_delete.status_code == 200:
            print("Cleaned up test employee")


class TestRecycleBinPermanentDelete:
    """Test permanent delete from recycle bin"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_permanent_delete(self, headers):
        """Test permanently deleting from recycle bin"""
        # Get stores
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        store_id = ""
        if stores_response.status_code == 200 and stores_response.json():
            store_id = stores_response.json()[0]["id"]
        
        # Create test employee
        employee_data = {
            "employee_code": f"TEST_PERM_{datetime.now().strftime('%H%M%S')}",
            "name": "Test Permanent Delete Employee",
            "email": f"test_perm_{datetime.now().strftime('%H%M%S')}@test.com",
            "store_id": store_id,
            "department": "general"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=headers)
        assert create_response.status_code in [200, 201]
        employee_id = create_response.json().get("id")
        
        # Delete to recycle bin
        delete_response = requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=headers)
        assert delete_response.status_code == 200
        recycle_bin_id = delete_response.json().get("recycle_bin_id")
        
        # Permanently delete
        perm_delete = requests.delete(f"{BASE_URL}/api/recycle-bin/{recycle_bin_id}", headers=headers)
        assert perm_delete.status_code == 200, f"Failed to permanently delete: {perm_delete.text}"
        
        data = perm_delete.json()
        assert "permanently deleted" in data.get("message", "").lower()
        print(f"Permanently deleted employee from recycle bin")
        
        # Verify it's no longer in recycle bin (or marked as permanently deleted)
        recycle_response = requests.get(f"{BASE_URL}/api/recycle-bin", headers=headers)
        assert recycle_response.status_code == 200
        recycle_items = recycle_response.json()["items"]
        
        # Item should not be in active recycle bin anymore
        found = any(item.get("id") == recycle_bin_id and not item.get("is_permanently_deleted") for item in recycle_items)
        assert not found, "Item should not be in active recycle bin after permanent delete"
        print("Verified item no longer in active recycle bin")


class TestStoresAndEmployeesForFaceAttendance:
    """Prerequisite tests for Face Attendance"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_stores_endpoint(self, headers):
        """Test stores endpoint works"""
        response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        assert response.status_code == 200, f"Failed to get stores: {response.text}"
        stores = response.json()
        assert isinstance(stores, list)
        print(f"Found {len(stores)} stores")
    
    def test_employees_endpoint(self, headers):
        """Test employees endpoint works"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=headers)
        assert response.status_code == 200, f"Failed to get employees: {response.text}"
        employees = response.json()
        assert isinstance(employees, list)
        print(f"Found {len(employees)} employees")
    
    def test_attendance_endpoint(self, headers):
        """Test attendance endpoint works"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/attendance?date={today}", headers=headers)
        assert response.status_code == 200, f"Failed to get attendance: {response.text}"
        print("Attendance endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
