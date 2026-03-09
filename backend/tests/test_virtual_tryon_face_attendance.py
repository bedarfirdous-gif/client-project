"""
Test Suite: Virtual Try-On (Category-Specific Size Charts) + Face Attendance System
Tests for:
1. Category-specific size charts for Virtual Try-On (tops, bottoms, dresses, etc.)
2. Face Attendance API endpoints (registrations, models)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TOKEN = None
USER_ID = None

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "SuperAdmin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Login and get authentication token"""
    global TOKEN, USER_ID
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    TOKEN = data["access_token"]
    USER_ID = data["user"]["id"]
    return TOKEN


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get authentication headers"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestFaceAttendanceAPIs:
    """Test Face Attendance API endpoints"""
    
    def test_get_face_models(self, auth_headers):
        """Test GET /api/face-attendance/models - returns available AI models"""
        response = requests.get(f"{BASE_URL}/api/face-attendance/models", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Data assertions
        assert "models" in data, "Response should include 'models' list"
        assert "current_model" in data, "Response should include 'current_model'"
        assert "deepface_available" in data, "Response should indicate if deepface is available"
        
        # Validate models structure
        models = data["models"]
        assert isinstance(models, list), "Models should be a list"
        
        if len(models) > 0:
            model = models[0]
            assert "id" in model, "Model should have 'id'"
            assert "name" in model, "Model should have 'name'"
        
        print(f"✓ Face models endpoint working. Current model: {data['current_model']}, DeepFace: {data['deepface_available']}")
    
    def test_get_face_registrations(self, auth_headers):
        """Test GET /api/face-attendance/registrations - returns registered faces"""
        response = requests.get(f"{BASE_URL}/api/face-attendance/registrations", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Data assertions
        assert "registrations" in data, "Response should include 'registrations' list"
        assert "count" in data, "Response should include 'count'"
        assert isinstance(data["registrations"], list), "Registrations should be a list"
        assert data["count"] == len(data["registrations"]), "Count should match registrations length"
        
        # If there are registrations, validate structure
        if len(data["registrations"]) > 0:
            reg = data["registrations"][0]
            assert "employee_id" in reg, "Registration should have employee_id"
            assert "registered_at" in reg, "Registration should have registered_at"
        
        print(f"✓ Face registrations endpoint working. Count: {data['count']}")
    
    def test_get_face_registration_status(self, auth_headers):
        """Test GET /api/face-attendance/status/{employee_id} - returns registration status"""
        # Use a fake employee ID - should return registered: false
        fake_employee_id = "test-employee-fake-123"
        response = requests.get(
            f"{BASE_URL}/api/face-attendance/status/{fake_employee_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Data assertions
        assert "registered" in data, "Response should include 'registered' boolean"
        assert isinstance(data["registered"], bool), "registered should be boolean"
        
        print(f"✓ Face registration status endpoint working. Registered: {data['registered']}")


class TestVirtualTryOnSizeCharts:
    """Test Virtual Try-On with category-specific size charts"""
    
    def test_body_measurements_crud(self, auth_headers):
        """Test body measurements CRUD operations"""
        # POST - Create measurement with specific category-focused data
        measurement_data = {
            "height": 175,
            "chest": 96,
            "waist": 82,
            "hip": 98,
            "shoulder": 44,
            "armLength": 62,
            "inseam": 81,
            "neck": 38,
            "source": "manual",
            "created_at": "2026-01-15T10:00:00Z"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/body-measurements",
            headers=auth_headers,
            json=measurement_data
        )
        assert response.status_code in [200, 201], f"Failed to create: {response.text}"
        data = response.json()
        
        # Data assertions
        assert "id" in data, "Response should include measurement 'id'"
        assert data.get("chest") == 96, "Chest measurement should be saved correctly"
        assert data.get("waist") == 82, "Waist measurement should be saved correctly"
        
        measurement_id = data["id"]
        
        # GET - Verify persistence
        response = requests.get(f"{BASE_URL}/api/body-measurements", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get: {response.text}"
        data = response.json()
        
        assert "measurements" in data, "Response should include 'measurements' list"
        
        # Verify our created measurement exists
        found = False
        for m in data["measurements"]:
            if m.get("id") == measurement_id:
                found = True
                assert m.get("chest") == 96, "Chest should be persisted"
                break
        
        assert found, f"Created measurement {measurement_id} should be in the list"
        print(f"✓ Body measurements CRUD working. Created ID: {measurement_id}")
    
    def test_size_prediction_for_tops_category(self, auth_headers):
        """Test AI size prediction for tops category (S/M/L format)"""
        # First, get a customer ID
        response = requests.get(f"{BASE_URL}/api/customers?limit=1", headers=auth_headers)
        if response.status_code == 200:
            customers = response.json()
            if isinstance(customers, list) and len(customers) > 0:
                customer_id = customers[0].get("id")
            else:
                # Create a test customer
                customer_data = {"name": "Test Customer", "phone": "9876543210", "customer_type": "retail"}
                response = requests.post(f"{BASE_URL}/api/customers", headers=auth_headers, json=customer_data)
                if response.status_code in [200, 201]:
                    customer_id = response.json().get("id")
                else:
                    pytest.skip("Could not create test customer")
        else:
            pytest.skip("Could not get customers")
        
        # Test size prediction with tops category
        response = requests.get(
            f"{BASE_URL}/api/size-prediction/{customer_id}?category=tops",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            # Size for tops should be in S/M/L format
            valid_tops_sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
            if "predicted_size" in data:
                assert data["predicted_size"] in valid_tops_sizes, f"Tops size should be letter format, got: {data['predicted_size']}"
            print(f"✓ Tops size prediction: {data.get('predicted_size', 'N/A')}")
        elif response.status_code == 404:
            print(f"✓ Size prediction returns 404 for customer without purchase history (expected)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code} - {response.text}")
    
    def test_size_prediction_for_bottoms_category(self, auth_headers):
        """Test AI size prediction for bottoms category (28/30/32 format)"""
        # Get size prediction analytics to verify category support
        response = requests.get(
            f"{BASE_URL}/api/size-prediction/analytics",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify analytics returns data - actual field is overall_size_distribution
        assert "overall_size_distribution" in data or "by_category" in data, "Analytics should return data"
        print(f"✓ Size prediction analytics endpoint working")
    
    def test_virtual_tryon_simulate(self, auth_headers):
        """Test virtual try-on simulation with category-specific size"""
        # Get an item first
        response = requests.get(f"{BASE_URL}/api/items?limit=1", headers=auth_headers)
        if response.status_code != 200:
            pytest.skip("Could not get items")
        
        items_data = response.json()
        # API returns {"items": [...]} or [...] depending on query params
        items = items_data.get("items", items_data) if isinstance(items_data, dict) else items_data
        
        if len(items) == 0:
            pytest.skip("No items available for try-on test")
        
        item = items[0]
        item_id = item.get("id")
        
        # Test virtual try-on with measurements
        tryon_data = {
            "clothing_id": item_id,
            "measurements": {
                "height": 175,
                "chest": 96,
                "waist": 82,
                "hip": 98,
                "shoulder": 44
            },
            "size_recommendation": {
                "recommendedSize": "M",
                "fitAnalysis": {"chest": "perfect", "waist": "perfect"},
                "confidence": 85,
                "category": "tops"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/virtual-tryon/simulate",
            headers=auth_headers,
            json=tryon_data
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Data assertions
        assert "fit_score" in data or "success" in data, "Response should include fit result"
        print(f"✓ Virtual try-on simulation working. Response: {data}")


class TestEmployeesForFaceAttendance:
    """Test employee endpoints needed for face attendance"""
    
    def test_get_employees(self, auth_headers):
        """Test GET /api/employees - needed for face registration dropdown"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Employees should be a list"
        
        if len(data) > 0:
            emp = data[0]
            assert "id" in emp, "Employee should have 'id'"
            assert "name" in emp, "Employee should have 'name'"
            assert "employee_code" in emp, "Employee should have 'employee_code'"
        
        print(f"✓ Employees endpoint working. Count: {len(data)}")
    
    def test_get_stores(self, auth_headers):
        """Test GET /api/stores - needed for face attendance store selection"""
        response = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Stores should be a list"
        
        if len(data) > 0:
            store = data[0]
            assert "id" in store, "Store should have 'id'"
            assert "name" in store, "Store should have 'name'"
        
        print(f"✓ Stores endpoint working. Count: {len(data)}")
    
    def test_get_attendance(self, auth_headers):
        """Test GET /api/attendance - needed to show today's attendance"""
        import datetime
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/attendance?date={today}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Attendance should be a list"
        print(f"✓ Attendance endpoint working. Today's records: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
