"""
Test Suite for QR Code, Late Hours, and Data Isolation Features
================================================================
Tests:
1. QR code data returned in Employee ID Card API
2. Late hours calculation in attendance API based on employee shift timing
3. Data isolation - items API returns only tenant-owned items
4. Data isolation - variants API only allows updates/deletes for tenant-owned variants
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin token for testing"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Superadmin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def test_admin_token(self):
        """Get test admin token for tenant isolation testing"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Test admin login failed: {response.text}"
        return response.json().get("access_token")


class TestEmployeeIDCard(TestAuth):
    """Test Employee ID Card QR code functionality"""
    
    def test_employee_id_card_returns_qr_data(self, admin_token):
        """Verify ID card endpoint returns qr_code_data field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get list of employees
        response = requests.get(f"{BASE_URL}/api/employees", headers=headers)
        assert response.status_code == 200
        employees = response.json()
        
        if len(employees) == 0:
            pytest.skip("No employees available for testing")
        
        # Get ID card for first employee
        employee_id = employees[0].get("id")
        response = requests.get(f"{BASE_URL}/api/employees/{employee_id}/id-card", headers=headers)
        assert response.status_code == 200
        
        card_data = response.json()
        assert "card_data" in card_data, "Response should contain card_data"
        
        # Verify QR code data is present
        qr_code_data = card_data.get("card_data", {}).get("qr_code_data")
        assert qr_code_data is not None, "qr_code_data should be present in card_data"
        assert len(qr_code_data) > 0, "qr_code_data should not be empty"
        print(f"QR code data found: {qr_code_data[:50]}...")


class TestLateHoursCalculation(TestAuth):
    """Test Late Hours calculation in attendance API"""
    
    @pytest.fixture
    def store_id(self, admin_token):
        """Get a store ID for testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/stores", headers=headers)
        assert response.status_code == 200
        stores = response.json()
        if len(stores) == 0:
            pytest.skip("No stores available for testing")
        return stores[0].get("id")
    
    @pytest.fixture
    def employee_with_shift(self, admin_token, store_id):
        """Get or create an employee with shift timing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/employees", headers=headers)
        assert response.status_code == 200
        employees = response.json()
        
        # Find employee with shift_start_time or use first one
        for emp in employees:
            if emp.get("shift_start_time"):
                return emp
        
        if len(employees) > 0:
            return employees[0]
        
        pytest.skip("No employees available for testing")
    
    def test_attendance_late_hours_calculation(self, admin_token, store_id, employee_with_shift):
        """Test that attendance API calculates late_hours when check-in is after shift start"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        employee_id = employee_with_shift.get("id")
        shift_start = employee_with_shift.get("shift_start_time", "09:00")
        
        # Calculate a late check-in time (2 hours after shift start)
        shift_parts = shift_start.split(":")
        shift_hour = int(shift_parts[0])
        late_hour = shift_hour + 2  # 2 hours late
        late_check_in = f"{late_hour:02d}:00"
        
        # Use a test date that won't conflict
        test_date = "2026-01-15"
        
        # Create attendance with late check-in
        attendance_payload = {
            "employee_id": employee_id,
            "store_id": store_id,
            "date": test_date,
            "status": "present",
            "in_time": late_check_in,
            "out_time": "18:00"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance", 
                                headers=headers, json=attendance_payload)
        assert response.status_code == 200, f"Failed to create attendance: {response.text}"
        
        result = response.json()
        
        # Verify late_hours is calculated
        late_hours = result.get("late_hours", 0)
        assert late_hours > 0, f"late_hours should be > 0 for late check-in, got: {late_hours}"
        assert late_hours >= 1.9, f"Expected approximately 2 hours late, got: {late_hours}"
        
        print(f"Late hours calculated: {late_hours}h (expected ~2.0h)")
        print(f"Shift start: {shift_start}, Check-in: {late_check_in}")
    
    def test_attendance_no_late_hours_on_time(self, admin_token, store_id, employee_with_shift):
        """Test that attendance API returns 0 late_hours when check-in is on time"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        employee_id = employee_with_shift.get("id")
        shift_start = employee_with_shift.get("shift_start_time", "09:00")
        
        test_date = "2026-01-16"
        
        # Create attendance with on-time check-in
        attendance_payload = {
            "employee_id": employee_id,
            "store_id": store_id,
            "date": test_date,
            "status": "present",
            "in_time": shift_start,  # Exactly on time
            "out_time": "18:00"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance", 
                                headers=headers, json=attendance_payload)
        assert response.status_code == 200, f"Failed to create attendance: {response.text}"
        
        result = response.json()
        late_hours = result.get("late_hours", 0)
        assert late_hours == 0, f"late_hours should be 0 for on-time check-in, got: {late_hours}"
        print(f"On-time check-in: late_hours = {late_hours} (expected 0)")
    
    def test_attendance_returns_shift_timing(self, admin_token, store_id, employee_with_shift):
        """Test that attendance API returns shift_start_time and shift_end_time"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        employee_id = employee_with_shift.get("id")
        test_date = "2026-01-17"
        
        attendance_payload = {
            "employee_id": employee_id,
            "store_id": store_id,
            "date": test_date,
            "status": "present",
            "in_time": "09:00",
            "out_time": "18:00"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance", 
                                headers=headers, json=attendance_payload)
        assert response.status_code == 200
        
        result = response.json()
        
        # Verify shift timing is returned
        assert "shift_start_time" in result, "shift_start_time should be in response"
        assert "shift_end_time" in result, "shift_end_time should be in response"
        print(f"Shift timing returned: {result.get('shift_start_time')} - {result.get('shift_end_time')}")
    
    def test_get_attendance_includes_late_hours(self, admin_token, store_id, employee_with_shift):
        """Test that GET attendance includes late_hours field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        employee_id = employee_with_shift.get("id")
        test_date = "2026-01-15"  # Use the date from the late check-in test
        
        response = requests.get(
            f"{BASE_URL}/api/attendance?employee_id={employee_id}&date={test_date}",
            headers=headers
        )
        assert response.status_code == 200
        
        attendance_list = response.json()
        if len(attendance_list) > 0:
            att = attendance_list[0]
            assert "late_hours" in att, "late_hours should be in attendance record"
            print(f"Attendance record has late_hours: {att.get('late_hours')}")


class TestDataIsolation(TestAuth):
    """Test multi-tenant data isolation for items and variants APIs"""
    
    def test_get_item_requires_tenant_match(self, admin_token, test_admin_token):
        """Test that GET /items/{id} only returns items for the logged-in tenant"""
        superadmin_headers = {"Authorization": f"Bearer {admin_token}"}
        test_admin_headers = {"Authorization": f"Bearer {test_admin_token}"}
        
        # Create an item as superadmin
        unique_name = f"TEST_Item_{uuid.uuid4().hex[:8]}"
        item_payload = {
            "name": unique_name,
            "description": "Test item for isolation testing",
            "mrp": 100,
            "selling_price": 90,
            "cost_price": 50
        }
        
        response = requests.post(f"{BASE_URL}/api/items", 
                                headers=superadmin_headers, json=item_payload)
        assert response.status_code == 200, f"Failed to create item: {response.text}"
        created_item = response.json()
        item_id = created_item.get("id")
        
        # Verify superadmin can access the item
        response = requests.get(f"{BASE_URL}/api/items/{item_id}", headers=superadmin_headers)
        assert response.status_code == 200, "Superadmin should be able to access own item"
        
        # Test admin (different tenant) should NOT see this item
        response = requests.get(f"{BASE_URL}/api/items/{item_id}", headers=test_admin_headers)
        assert response.status_code == 404, f"Different tenant should get 404, got: {response.status_code}"
        
        print(f"Data isolation verified: Item {item_id} only accessible by owning tenant")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=superadmin_headers)
    
    def test_items_list_filtered_by_tenant(self, admin_token, test_admin_token):
        """Test that GET /items only returns items for the logged-in tenant"""
        superadmin_headers = {"Authorization": f"Bearer {admin_token}"}
        test_admin_headers = {"Authorization": f"Bearer {test_admin_token}"}
        
        # Create a uniquely named item as superadmin
        unique_name = f"ISOLATION_TEST_{uuid.uuid4().hex[:8]}"
        item_payload = {
            "name": unique_name,
            "description": "Isolation test item",
            "mrp": 100,
            "selling_price": 90
        }
        
        response = requests.post(f"{BASE_URL}/api/items", 
                                headers=superadmin_headers, json=item_payload)
        assert response.status_code == 200
        created_item = response.json()
        item_id = created_item.get("id")
        
        # Get items list for test_admin
        response = requests.get(f"{BASE_URL}/api/items", headers=test_admin_headers)
        assert response.status_code == 200
        test_admin_items = response.json()
        
        # Verify the superadmin's item is NOT in test_admin's list
        item_ids = [item.get("id") for item in test_admin_items]
        assert item_id not in item_ids, "Item from different tenant should not appear in list"
        
        # Also verify by name
        item_names = [item.get("name") for item in test_admin_items]
        assert unique_name not in item_names, "Item name from different tenant should not appear"
        
        print(f"Items list isolation verified: {unique_name} not visible to different tenant")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=superadmin_headers)


class TestVariantIsolation(TestAuth):
    """Test variant API data isolation"""
    
    @pytest.fixture
    def test_item_with_variant(self, admin_token):
        """Create a test item with variant for isolation testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create item
        item_payload = {
            "name": f"TEST_VariantItem_{uuid.uuid4().hex[:6]}",
            "description": "Test item for variant isolation",
            "mrp": 100,
            "selling_price": 90
        }
        
        response = requests.post(f"{BASE_URL}/api/items", headers=headers, json=item_payload)
        assert response.status_code == 200
        item = response.json()
        item_id = item.get("id")
        
        # Create variant
        variant_payload = {
            "item_id": item_id,
            "size": "M",
            "color": "Blue",
            "barcode": f"TEST{uuid.uuid4().hex[:8]}"
        }
        
        response = requests.post(f"{BASE_URL}/api/variants", headers=headers, json=variant_payload)
        assert response.status_code == 200
        variant = response.json()
        
        yield {"item": item, "variant": variant}
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/variants/{variant.get('id')}", headers=headers)
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=headers)
    
    def test_update_variant_requires_tenant_match(self, admin_token, test_admin_token, test_item_with_variant):
        """Test that PUT /variants/{id} only works for tenant-owned variants"""
        superadmin_headers = {"Authorization": f"Bearer {admin_token}"}
        test_admin_headers = {"Authorization": f"Bearer {test_admin_token}"}
        
        variant = test_item_with_variant["variant"]
        variant_id = variant.get("id")
        item_id = test_item_with_variant["item"].get("id")
        
        # Superadmin should be able to update own variant
        update_payload = {
            "item_id": item_id,
            "size": "L",
            "color": "Red"
        }
        
        response = requests.put(f"{BASE_URL}/api/variants/{variant_id}", 
                               headers=superadmin_headers, json=update_payload)
        assert response.status_code == 200, "Owner should be able to update variant"
        
        # Test admin (different tenant) should NOT be able to update
        response = requests.put(f"{BASE_URL}/api/variants/{variant_id}", 
                               headers=test_admin_headers, json=update_payload)
        assert response.status_code == 404, f"Different tenant update should get 404, got: {response.status_code}"
        
        print(f"Variant update isolation verified: Variant {variant_id}")
    
    def test_delete_variant_requires_tenant_match(self, admin_token, test_admin_token):
        """Test that DELETE /variants/{id} only works for tenant-owned variants"""
        superadmin_headers = {"Authorization": f"Bearer {admin_token}"}
        test_admin_headers = {"Authorization": f"Bearer {test_admin_token}"}
        
        # Create a temporary item and variant for deletion test
        item_payload = {
            "name": f"TEST_DeleteVariant_{uuid.uuid4().hex[:6]}",
            "mrp": 100,
            "selling_price": 90
        }
        
        response = requests.post(f"{BASE_URL}/api/items", headers=superadmin_headers, json=item_payload)
        assert response.status_code == 200
        item_id = response.json().get("id")
        
        variant_payload = {
            "item_id": item_id,
            "size": "S",
            "color": "Green",
            "barcode": f"DEL{uuid.uuid4().hex[:8]}"
        }
        
        response = requests.post(f"{BASE_URL}/api/variants", headers=superadmin_headers, json=variant_payload)
        assert response.status_code == 200
        variant_id = response.json().get("id")
        
        # Test admin (different tenant) should NOT be able to delete
        response = requests.delete(f"{BASE_URL}/api/variants/{variant_id}", headers=test_admin_headers)
        assert response.status_code == 404, f"Different tenant delete should get 404, got: {response.status_code}"
        
        # Verify variant still exists (superadmin can get item with variants)
        response = requests.get(f"{BASE_URL}/api/items/{item_id}", headers=superadmin_headers)
        assert response.status_code == 200
        item_data = response.json()
        variant_ids = [v.get("id") for v in item_data.get("variants", [])]
        assert variant_id in variant_ids, "Variant should still exist after failed cross-tenant delete"
        
        print(f"Variant delete isolation verified: Variant {variant_id}")
        
        # Cleanup (as superadmin)
        requests.delete(f"{BASE_URL}/api/variants/{variant_id}", headers=superadmin_headers)
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=superadmin_headers)


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_attendance(self):
        """Clean up test attendance records"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Cannot login for cleanup")
        
        token = response.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get attendance for test dates and delete them
        for date in ["2026-01-15", "2026-01-16", "2026-01-17"]:
            response = requests.get(f"{BASE_URL}/api/attendance?date={date}", headers=headers)
            if response.status_code == 200:
                attendance_records = response.json()
                for att in attendance_records:
                    att_id = att.get("id")
                    if att_id:
                        requests.delete(f"{BASE_URL}/api/attendance/{att_id}", headers=headers)
        
        print("Test attendance records cleaned up")
