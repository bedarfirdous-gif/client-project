"""
Employment Agreements API Tests
Tests for CRUD operations, auto-populate, templates, and agreement management
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@brandmafia.com"
TEST_PASSWORD = "demo123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API requests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with authentication token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestAgreementTemplates:
    """Tests for agreement templates endpoint"""
    
    def test_get_templates(self, auth_headers):
        """Test fetching agreement templates"""
        response = requests.get(
            f"{BASE_URL}/api/agreement-templates",
            headers=auth_headers
        )
        assert response.status_code == 200
        templates = response.json()
        
        # Verify templates structure
        assert isinstance(templates, dict)
        assert len(templates) >= 1, "Should have at least one template"
        
        # Check for standard template
        if "standard" in templates:
            standard = templates["standard"]
            assert "name" in standard
            assert "description" in standard
            assert "default_terms" in standard
            print(f"SUCCESS: Found {len(templates)} templates")
    
    def test_template_has_default_terms(self, auth_headers):
        """Test that templates have default terms"""
        response = requests.get(
            f"{BASE_URL}/api/agreement-templates",
            headers=auth_headers
        )
        assert response.status_code == 200
        templates = response.json()
        
        for key, template in templates.items():
            assert "default_terms" in template, f"Template {key} missing default_terms"
            terms = template["default_terms"]
            # Check for expected default term fields
            assert "notice_period_days" in terms or "working_hours" in terms
            print(f"SUCCESS: Template '{key}' has valid default terms")


class TestEmploymentAgreementsCRUD:
    """Tests for Employment Agreements CRUD operations"""
    
    def test_list_agreements(self, auth_headers):
        """Test listing all employment agreements"""
        response = requests.get(
            f"{BASE_URL}/api/employment-agreements",
            headers=auth_headers
        )
        assert response.status_code == 200
        agreements = response.json()
        
        assert isinstance(agreements, list)
        print(f"SUCCESS: Found {len(agreements)} agreements")
        
        # If there are agreements, verify structure
        if agreements:
            agreement = agreements[0]
            assert "id" in agreement
            assert "employee_name" in agreement
            assert "status" in agreement
    
    def test_list_agreements_filter_by_status(self, auth_headers):
        """Test filtering agreements by status"""
        response = requests.get(
            f"{BASE_URL}/api/employment-agreements?status=draft",
            headers=auth_headers
        )
        assert response.status_code == 200
        agreements = response.json()
        
        # All returned agreements should have draft status
        for agreement in agreements:
            assert agreement.get("status") == "draft"
        print(f"SUCCESS: Filtered {len(agreements)} draft agreements")
    
    def test_create_agreement(self, auth_headers):
        """Test creating a new employment agreement"""
        # First get an employee to use
        emp_response = requests.get(
            f"{BASE_URL}/api/employees",
            headers=auth_headers
        )
        assert emp_response.status_code == 200
        employees = emp_response.json()
        
        if not employees:
            pytest.skip("No employees available for testing")
        
        employee = employees[0]
        
        agreement_data = {
            "document_type": "employment_agreement",
            "template": "standard",
            "employee_id": employee["id"],
            "company_name": "TEST_Company",
            "company_address": "TEST Address",
            "signatory_name": "TEST Signatory",
            "signatory_designation": "Director",
            "employee_name": f"TEST_{employee.get('name', 'Employee')}",
            "employee_address": "Test Address",
            "job_title": "Test Position",
            "department": "Test Department",
            "employment_type": "full_time",
            "start_date": "2026-02-01",
            "working_hours": "9:00 AM - 6:00 PM",
            "compensation_model": "fixed_daily",
            "total_monthly_salary": 50000,
            "fixed_salary": 40000,
            "daily_allowance_total": 10000,
            "daily_allowance_per_day": 385,
            "working_days_month": 26,
            "casual_leave_days": 12,
            "notice_period_days": 30,
            "non_compete_months": 6,
            "governing_law": "India",
            "min_service_months": 12,
            "min_penalty_amount": 25000,
            "employee_penalty_amount": 50000,
            "employer_penalty_amount": 100000,
            "additional_terms": "Test additional terms",
            "confidentiality_clause": True,
            "status": "draft"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/employment-agreements",
            headers=auth_headers,
            json=agreement_data
        )
        assert response.status_code == 200
        result = response.json()
        
        assert "id" in result
        assert "message" in result
        print(f"SUCCESS: Created agreement with ID: {result['id']}")
        
        # Store ID for cleanup
        return result["id"]
    
    def test_get_agreement_by_id(self, auth_headers):
        """Test getting a specific agreement by ID"""
        # First list agreements to get an ID
        list_response = requests.get(
            f"{BASE_URL}/api/employment-agreements",
            headers=auth_headers
        )
        assert list_response.status_code == 200
        agreements = list_response.json()
        
        if not agreements:
            pytest.skip("No agreements available for testing")
        
        agreement_id = agreements[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/employment-agreements/{agreement_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        agreement = response.json()
        
        assert agreement["id"] == agreement_id
        assert "employee_name" in agreement
        assert "status" in agreement
        print(f"SUCCESS: Retrieved agreement for {agreement.get('employee_name')}")
    
    def test_get_nonexistent_agreement(self, auth_headers):
        """Test getting a non-existent agreement returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/employment-agreements/nonexistent-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("SUCCESS: Non-existent agreement returns 404")
    
    def test_update_agreement(self, auth_headers):
        """Test updating an employment agreement"""
        # First list agreements to get a draft agreement
        list_response = requests.get(
            f"{BASE_URL}/api/employment-agreements?status=draft",
            headers=auth_headers
        )
        assert list_response.status_code == 200
        agreements = list_response.json()
        
        if not agreements:
            pytest.skip("No draft agreements available for testing")
        
        agreement = agreements[0]
        agreement_id = agreement["id"]
        
        # Update the agreement
        update_data = {
            "notice_period_days": 45,
            "additional_terms": "Updated terms for testing"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/employment-agreements/{agreement_id}",
            headers=auth_headers,
            json=update_data
        )
        assert response.status_code == 200
        
        # Verify update
        get_response = requests.get(
            f"{BASE_URL}/api/employment-agreements/{agreement_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        updated = get_response.json()
        
        assert updated.get("notice_period_days") == 45
        print("SUCCESS: Agreement updated successfully")


class TestAutoPopulate:
    """Tests for auto-populate functionality"""
    
    def test_auto_populate_with_employee(self, auth_headers):
        """Test auto-populate returns employee data"""
        # First get an employee
        emp_response = requests.get(
            f"{BASE_URL}/api/employees",
            headers=auth_headers
        )
        assert emp_response.status_code == 200
        employees = emp_response.json()
        
        if not employees:
            pytest.skip("No employees available for testing")
        
        employee = employees[0]
        
        response = requests.get(
            f"{BASE_URL}/api/employment-agreements/auto-populate?employee_id={employee['id']}",
            headers=auth_headers
        )
        assert response.status_code == 200
        auto_data = response.json()
        
        # Verify auto-populated fields
        assert "employee_id" in auto_data
        assert "employee_name" in auto_data
        assert auto_data["employee_id"] == employee["id"]
        print(f"SUCCESS: Auto-populated data for {auto_data.get('employee_name')}")
    
    def test_auto_populate_without_employee_id(self, auth_headers):
        """Test auto-populate without employee_id returns error"""
        response = requests.get(
            f"{BASE_URL}/api/employment-agreements/auto-populate",
            headers=auth_headers
        )
        assert response.status_code == 400
        print("SUCCESS: Auto-populate without employee_id returns 400")
    
    def test_auto_populate_with_invalid_employee(self, auth_headers):
        """Test auto-populate with invalid employee returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/employment-agreements/auto-populate?employee_id=invalid-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("SUCCESS: Auto-populate with invalid employee returns 404")


class TestAgreementSigning:
    """Tests for agreement signing functionality"""
    
    def test_sign_agreement_employee(self, auth_headers):
        """Test signing agreement as employee"""
        # Get a draft agreement
        list_response = requests.get(
            f"{BASE_URL}/api/employment-agreements?status=draft",
            headers=auth_headers
        )
        assert list_response.status_code == 200
        agreements = list_response.json()
        
        if not agreements:
            pytest.skip("No draft agreements available for testing")
        
        agreement_id = agreements[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/employment-agreements/{agreement_id}/sign",
            headers=auth_headers,
            json={"signer_type": "employee"}
        )
        assert response.status_code == 200
        result = response.json()
        
        assert "message" in result
        print("SUCCESS: Agreement signed by employee")
    
    def test_sign_agreement_employer(self, auth_headers):
        """Test signing agreement as employer"""
        # Get a pending_signature agreement
        list_response = requests.get(
            f"{BASE_URL}/api/employment-agreements?status=pending_signature",
            headers=auth_headers
        )
        assert list_response.status_code == 200
        agreements = list_response.json()
        
        if not agreements:
            # Try draft agreements
            list_response = requests.get(
                f"{BASE_URL}/api/employment-agreements?status=draft",
                headers=auth_headers
            )
            agreements = list_response.json()
        
        if not agreements:
            pytest.skip("No agreements available for signing test")
        
        agreement_id = agreements[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/employment-agreements/{agreement_id}/sign",
            headers=auth_headers,
            json={"signer_type": "employer"}
        )
        assert response.status_code == 200
        result = response.json()
        
        assert "message" in result
        print("SUCCESS: Agreement signed by employer")


class TestAgreementDeletion:
    """Tests for agreement deletion"""
    
    def test_delete_test_agreements(self, auth_headers):
        """Clean up test agreements"""
        # List all agreements
        list_response = requests.get(
            f"{BASE_URL}/api/employment-agreements",
            headers=auth_headers
        )
        assert list_response.status_code == 200
        agreements = list_response.json()
        
        deleted_count = 0
        for agreement in agreements:
            # Only delete TEST_ prefixed agreements
            if agreement.get("employee_name", "").startswith("TEST_") or \
               agreement.get("company_name", "").startswith("TEST_"):
                response = requests.delete(
                    f"{BASE_URL}/api/employment-agreements/{agreement['id']}",
                    headers=auth_headers
                )
                if response.status_code == 200:
                    deleted_count += 1
        
        print(f"SUCCESS: Cleaned up {deleted_count} test agreements")
    
    def test_delete_nonexistent_agreement(self, auth_headers):
        """Test deleting non-existent agreement returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/employment-agreements/nonexistent-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("SUCCESS: Delete non-existent agreement returns 404")


class TestAgreementValidation:
    """Tests for agreement validation"""
    
    def test_cannot_edit_signed_agreement(self, auth_headers):
        """Test that signed agreements cannot be edited"""
        # Get a signed agreement if exists
        list_response = requests.get(
            f"{BASE_URL}/api/employment-agreements?status=signed",
            headers=auth_headers
        )
        assert list_response.status_code == 200
        agreements = list_response.json()
        
        if not agreements:
            pytest.skip("No signed agreements available for testing")
        
        agreement_id = agreements[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/employment-agreements/{agreement_id}",
            headers=auth_headers,
            json={"notice_period_days": 60}
        )
        assert response.status_code == 400
        print("SUCCESS: Cannot edit signed agreement (returns 400)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
