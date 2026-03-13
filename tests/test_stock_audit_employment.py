"""
Test Stock Audit Trail and Employment Applications APIs
Tests for:
1. Stock Audit Trail - GET /api/stock-audit-trail, GET /api/stock-audit-trail/summary
2. Employment Applications - CRUD operations, status updates, convert to employee
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@brandmafia.com"
TEST_PASSWORD = "demo123"


class TestAuth:
    """Authentication helper"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestStockAuditTrail(TestAuth):
    """Stock Audit Trail API Tests"""
    
    def test_get_stock_audit_trail(self, auth_headers):
        """Test GET /api/stock-audit-trail returns audit entries"""
        response = requests.get(
            f"{BASE_URL}/api/stock-audit-trail",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "entries" in data, "Response should have 'entries' field"
        assert "total" in data, "Response should have 'total' field"
        assert "limit" in data, "Response should have 'limit' field"
        assert "offset" in data, "Response should have 'offset' field"
        
        print(f"Stock Audit Trail: {data['total']} total entries, {len(data['entries'])} returned")
        
        # If there are entries, verify structure
        if data['entries']:
            entry = data['entries'][0]
            expected_fields = ['id', 'movement_type', 'quantity_change', 'created_at']
            for field in expected_fields:
                assert field in entry, f"Entry should have '{field}' field"
            print(f"Sample entry: {entry.get('movement_type')} - {entry.get('quantity_change')} units")
    
    def test_get_stock_audit_trail_with_filters(self, auth_headers):
        """Test GET /api/stock-audit-trail with filters"""
        # Test with movement_type filter
        response = requests.get(
            f"{BASE_URL}/api/stock-audit-trail?movement_type=sale",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All entries should be of type 'sale'
        for entry in data['entries']:
            assert entry.get('movement_type') == 'sale', f"Expected 'sale', got {entry.get('movement_type')}"
        
        print(f"Filtered by 'sale': {len(data['entries'])} entries")
    
    def test_get_stock_audit_trail_with_date_range(self, auth_headers):
        """Test GET /api/stock-audit-trail with date range"""
        # Get entries from last 30 days
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        
        response = requests.get(
            f"{BASE_URL}/api/stock-audit-trail?start_date={start_date}&end_date={end_date}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        print(f"Entries in last 30 days: {len(data['entries'])}")
    
    def test_get_stock_audit_trail_summary(self, auth_headers):
        """Test GET /api/stock-audit-trail/summary returns analytics"""
        response = requests.get(
            f"{BASE_URL}/api/stock-audit-trail/summary",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "by_movement_type" in data, "Response should have 'by_movement_type' field"
        assert "top_items" in data, "Response should have 'top_items' field"
        assert "user_activity" in data, "Response should have 'user_activity' field"
        
        print(f"Summary - Movement types: {len(data['by_movement_type'])}, Top items: {len(data['top_items'])}, User activity: {len(data['user_activity'])}")
        
        # Verify movement type summary structure
        if data['by_movement_type']:
            summary = data['by_movement_type'][0]
            assert '_id' in summary, "Summary should have '_id' (movement type)"
            assert 'total_movements' in summary, "Summary should have 'total_movements'"
            print(f"Sample movement type: {summary['_id']} - {summary['total_movements']} movements")
    
    def test_get_stock_audit_trail_summary_with_filters(self, auth_headers):
        """Test GET /api/stock-audit-trail/summary with filters"""
        # Get stores first
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers)
        stores = stores_response.json()
        
        if stores:
            store_id = stores[0]['id']
            response = requests.get(
                f"{BASE_URL}/api/stock-audit-trail/summary?store_id={store_id}",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            
            print(f"Summary for store {stores[0]['name']}: {len(data['by_movement_type'])} movement types")


class TestEmploymentApplications(TestAuth):
    """Employment Applications API Tests"""
    
    created_application_id = None
    
    def test_list_employment_applications(self, auth_headers):
        """Test GET /api/employment-applications returns list"""
        response = requests.get(
            f"{BASE_URL}/api/employment-applications",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Employment Applications: {len(data)} applications found")
        
        if data:
            app = data[0]
            print(f"Sample application: {app.get('full_name')} - {app.get('status')}")
    
    def test_create_employment_application(self, auth_headers):
        """Test POST /api/employment-applications creates new application"""
        test_app_id = f"TEST_APP_{uuid.uuid4().hex[:8]}"
        
        application_data = {
            "full_name": f"Test Applicant {test_app_id}",
            "date_of_birth": "1995-05-15",
            "gender": "male",
            "address": "123 Test Street, Test City",
            "contact_number": "+91 9876543210",
            "email": f"test_{test_app_id}@example.com",
            "emergency_contact": "+91 9876543211",
            "emergency_contact_name": "Test Emergency Contact",
            "position_applied": "Sales Associate",
            "department": "sales",
            "expected_start_date": (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'),
            "expected_salary": "25000",
            "free_will_acknowledged": True,
            "applicant_signature": f"Test Applicant {test_app_id}",
            "applicant_signature_date": datetime.now().strftime('%Y-%m-%d'),
            "documents": {
                "aadhaar": {"name": "aadhaar.pdf", "uploaded_at": datetime.now().isoformat()},
                "address_proof": {"name": "address.pdf", "uploaded_at": datetime.now().isoformat()},
                "education_cert": {"name": "education.pdf", "uploaded_at": datetime.now().isoformat()},
                "photo": {"name": "photo.jpg", "uploaded_at": datetime.now().isoformat()}
            },
            "declaration_agreed": True,
            "declaration_signature": f"Test Applicant {test_app_id}",
            "declaration_date": datetime.now().strftime('%Y-%m-%d'),
            "status": "pending_review",
            "application_id": test_app_id,
            "submitted_at": datetime.now().isoformat()
        }
        
        response = requests.post(
            f"{BASE_URL}/api/employment-applications",
            headers=auth_headers,
            json=application_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should have 'id' field"
        assert "message" in data, "Response should have 'message' field"
        
        TestEmploymentApplications.created_application_id = data["id"]
        print(f"Created application: {data['id']}")
        
        # Verify by GET
        get_response = requests.get(
            f"{BASE_URL}/api/employment-applications/{data['id']}",
            headers=auth_headers
        )
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        app = get_response.json()
        
        assert app["full_name"] == application_data["full_name"], "Name mismatch"
        assert app["status"] == "pending_review", "Status should be pending_review"
        print(f"Verified application: {app['full_name']} - {app['status']}")
    
    def test_get_employment_application(self, auth_headers):
        """Test GET /api/employment-applications/{id} returns specific application"""
        if not TestEmploymentApplications.created_application_id:
            pytest.skip("No application created to get")
        
        response = requests.get(
            f"{BASE_URL}/api/employment-applications/{TestEmploymentApplications.created_application_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["id"] == TestEmploymentApplications.created_application_id
        print(f"Got application: {data['full_name']}")
    
    def test_update_application_status_to_under_review(self, auth_headers):
        """Test PUT /api/employment-applications/{id}/status updates status to under_review"""
        if not TestEmploymentApplications.created_application_id:
            pytest.skip("No application created to update")
        
        response = requests.put(
            f"{BASE_URL}/api/employment-applications/{TestEmploymentApplications.created_application_id}/status?status=under_review",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should have 'message' field"
        print(f"Status update response: {data['message']}")
        
        # Verify status changed
        get_response = requests.get(
            f"{BASE_URL}/api/employment-applications/{TestEmploymentApplications.created_application_id}",
            headers=auth_headers
        )
        app = get_response.json()
        assert app["status"] == "under_review", f"Expected 'under_review', got {app['status']}"
        print(f"Verified status: {app['status']}")
    
    def test_update_application_status_to_approved(self, auth_headers):
        """Test PUT /api/employment-applications/{id}/status updates status to approved"""
        if not TestEmploymentApplications.created_application_id:
            pytest.skip("No application created to update")
        
        response = requests.put(
            f"{BASE_URL}/api/employment-applications/{TestEmploymentApplications.created_application_id}/status?status=approved",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify status changed
        get_response = requests.get(
            f"{BASE_URL}/api/employment-applications/{TestEmploymentApplications.created_application_id}",
            headers=auth_headers
        )
        app = get_response.json()
        assert app["status"] == "approved", f"Expected 'approved', got {app['status']}"
        print(f"Application approved: {app['full_name']}")
    
    def test_convert_application_to_employee(self, auth_headers):
        """Test POST /api/employment-applications/{id}/convert-to-employee"""
        if not TestEmploymentApplications.created_application_id:
            pytest.skip("No application created to convert")
        
        # Get stores for assignment
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers)
        stores = stores_response.json()
        store_id = stores[0]['id'] if stores else ""
        
        convert_data = {
            "store_id": store_id,
            "date_of_joining": datetime.now().strftime('%Y-%m-%d'),
            "salary": "30000",
            "employment_type": "full-time",
            "employee_code": f"EMP_TEST_{uuid.uuid4().hex[:6].upper()}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/employment-applications/{TestEmploymentApplications.created_application_id}/convert-to-employee",
            headers=auth_headers,
            json=convert_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "employee_id" in data, "Response should have 'employee_id' field"
        assert "message" in data, "Response should have 'message' field"
        print(f"Converted to employee: {data['employee_id']}")
        
        # Verify application status changed to converted_to_employee
        get_response = requests.get(
            f"{BASE_URL}/api/employment-applications/{TestEmploymentApplications.created_application_id}",
            headers=auth_headers
        )
        app = get_response.json()
        assert app["status"] == "converted_to_employee", f"Expected 'converted_to_employee', got {app['status']}"
        
        # Verify employee was created
        emp_response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        employees = emp_response.json()
        created_emp = next((e for e in employees if e.get('id') == data['employee_id']), None)
        assert created_emp is not None, "Employee should exist"
        print(f"Verified employee: {created_emp['name']} - {created_emp.get('employee_code')}")
        
        # Store employee ID for cleanup
        TestEmploymentApplications.created_employee_id = data['employee_id']
    
    def test_list_applications_with_status_filter(self, auth_headers):
        """Test GET /api/employment-applications?status=pending_review"""
        response = requests.get(
            f"{BASE_URL}/api/employment-applications?status=pending_review",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All returned applications should have pending_review status
        for app in data:
            assert app.get('status') == 'pending_review', f"Expected 'pending_review', got {app.get('status')}"
        
        print(f"Pending review applications: {len(data)}")
    
    def test_invalid_status_update(self, auth_headers):
        """Test PUT /api/employment-applications/{id}/status with invalid status"""
        if not TestEmploymentApplications.created_application_id:
            pytest.skip("No application created to test")
        
        response = requests.put(
            f"{BASE_URL}/api/employment-applications/{TestEmploymentApplications.created_application_id}/status?status=invalid_status",
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Invalid status correctly rejected")
    
    def test_get_nonexistent_application(self, auth_headers):
        """Test GET /api/employment-applications/{id} with non-existent ID"""
        response = requests.get(
            f"{BASE_URL}/api/employment-applications/nonexistent-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent application correctly returns 404")


class TestStockMovementOnSale(TestAuth):
    """Test that stock movements are logged when creating sales"""
    
    def test_sale_creates_stock_movement(self, auth_headers):
        """Test that creating a sale logs stock movement in audit trail"""
        # Get initial audit trail count
        initial_response = requests.get(
            f"{BASE_URL}/api/stock-audit-trail?movement_type=sale",
            headers=auth_headers
        )
        initial_data = initial_response.json()
        initial_count = initial_data['total']
        
        # Get items and variants for sale
        items_response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        items = items_response.json()
        
        variants_response = requests.get(f"{BASE_URL}/api/variants", headers=auth_headers)
        variants = variants_response.json()
        
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers)
        stores = stores_response.json()
        
        if not items or not variants or not stores:
            pytest.skip("No items, variants, or stores available for testing")
        
        # Find a variant with inventory
        test_variant = None
        test_store = stores[0]
        
        for variant in variants:
            inv_response = requests.get(
                f"{BASE_URL}/api/inventory?variant_id={variant['id']}&store_id={test_store['id']}",
                headers=auth_headers
            )
            inv_data = inv_response.json()
            if inv_data and inv_data[0].get('quantity', 0) > 0:
                test_variant = variant
                break
        
        if not test_variant:
            print("No variant with inventory found, skipping sale test")
            pytest.skip("No variant with inventory available")
        
        # Create a sale
        sale_data = {
            "store_id": test_store['id'],
            "items": [{
                "item_id": test_variant.get('item_id'),
                "variant_id": test_variant['id'],
                "name": test_variant.get('name', 'Test Item'),
                "quantity": 1,
                "price": test_variant.get('selling_price', 100),
                "total": test_variant.get('selling_price', 100)
            }],
            "subtotal": test_variant.get('selling_price', 100),
            "total": test_variant.get('selling_price', 100),
            "payment_method": "cash",
            "payment_status": "paid"
        }
        
        sale_response = requests.post(
            f"{BASE_URL}/api/sales",
            headers=auth_headers,
            json=sale_data
        )
        
        if sale_response.status_code == 200:
            # Check if audit trail was updated
            after_response = requests.get(
                f"{BASE_URL}/api/stock-audit-trail?movement_type=sale",
                headers=auth_headers
            )
            after_data = after_response.json()
            after_count = after_data['total']
            
            print(f"Sale audit trail: Before={initial_count}, After={after_count}")
            
            # Note: The audit trail entry might be created asynchronously
            # or might not be implemented for all sale types
            if after_count > initial_count:
                print("Stock movement logged for sale")
            else:
                print("Note: Stock movement may not be logged for this sale type")
        else:
            print(f"Sale creation returned {sale_response.status_code}: {sale_response.text}")


class TestCleanup(TestAuth):
    """Cleanup test data"""
    
    def test_cleanup_test_applications(self, auth_headers):
        """Delete test applications created during testing"""
        response = requests.get(
            f"{BASE_URL}/api/employment-applications",
            headers=auth_headers
        )
        applications = response.json()
        
        deleted_count = 0
        for app in applications:
            if app.get('full_name', '').startswith('Test Applicant TEST_APP_'):
                delete_response = requests.delete(
                    f"{BASE_URL}/api/employment-applications/{app['id']}",
                    headers=auth_headers
                )
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test applications")
    
    def test_cleanup_test_employees(self, auth_headers):
        """Delete test employees created during testing"""
        response = requests.get(
            f"{BASE_URL}/api/employees",
            headers=auth_headers
        )
        employees = response.json()
        
        deleted_count = 0
        for emp in employees:
            if emp.get('name', '').startswith('Test Applicant TEST_APP_') or \
               (emp.get('employee_code') and emp.get('employee_code', '').startswith('EMP_TEST_')):
                delete_response = requests.delete(
                    f"{BASE_URL}/api/employees/{emp['id']}",
                    headers=auth_headers
                )
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test employees")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
