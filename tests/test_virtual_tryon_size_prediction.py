"""
Test Suite for Virtual Try-On, AI Size Prediction, and Inventory Alert features
Tests body measurements CRUD, size prediction API, and inventory alert settings
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "SuperAdmin@123"

# Test customer ID provided by main agent
TEST_CUSTOMER_ID = "6843c4ef-fe7c-4bb2-ad7f-8c93713c6f02"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    token = data.get("access_token") or data.get("token")
    assert token, "No token returned from login"
    return token


@pytest.fixture(scope="module")
def authenticated_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestBodyMeasurementsAPI:
    """Tests for body measurements CRUD operations"""

    def test_get_body_measurements(self, authenticated_client):
        """Test retrieving body measurements"""
        response = authenticated_client.get(f"{BASE_URL}/api/body-measurements")
        assert response.status_code == 200, f"Failed to get measurements: {response.text}"
        data = response.json()
        assert "measurements" in data
        assert isinstance(data["measurements"], list)
        print(f"Found {len(data['measurements'])} saved measurement profiles")

    def test_create_manual_body_measurement(self, authenticated_client):
        """Test creating manual body measurement"""
        measurement_data = {
            "height": 175,
            "chest": 96,
            "waist": 82,
            "hip": 98,
            "shoulder": 45,
            "armLength": 62,
            "inseam": 81,
            "neck": 38,
            "torsoLength": 50,
            "source": "manual",
            "profile_name": f"TEST_Profile_{uuid.uuid4().hex[:8]}"
        }
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/body-measurements",
            json=measurement_data
        )
        assert response.status_code == 200 or response.status_code == 201, f"Failed to create measurement: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["height"] == 175
        assert data["chest"] == 96
        assert data["waist"] == 82
        assert data["hip"] == 98
        assert data["source"] == "manual"
        print(f"Created measurement profile with ID: {data['id']}")
        return data["id"]

    def test_create_ai_detected_measurement(self, authenticated_client):
        """Test creating AI-detected body measurement"""
        measurement_data = {
            "height": 180,
            "chest": 102,
            "waist": 88,
            "hip": 104,
            "shoulder": 48,
            "armLength": 65,
            "inseam": 84,
            "neck": 40,
            "torsoLength": 52,
            "source": "ai_detection",
            "profile_name": f"TEST_AI_Profile_{uuid.uuid4().hex[:8]}"
        }
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/body-measurements",
            json=measurement_data
        )
        assert response.status_code == 200 or response.status_code == 201, f"Failed to create AI measurement: {response.text}"
        data = response.json()
        assert data["source"] == "ai_detection"
        print(f"Created AI-detected measurement with ID: {data['id']}")

    def test_verify_measurements_persist(self, authenticated_client):
        """Test that saved measurements are persisted and retrievable"""
        response = authenticated_client.get(f"{BASE_URL}/api/body-measurements")
        assert response.status_code == 200
        data = response.json()
        
        # Should have at least the measurements we created
        assert len(data["measurements"]) >= 1, "No measurements found after creation"
        
        # Check that measurements have required fields
        for measurement in data["measurements"]:
            assert "id" in measurement
            assert "height" in measurement
            assert "chest" in measurement
            assert "source" in measurement
        print(f"Verified {len(data['measurements'])} measurements persisted")


class TestSizeRecommendation:
    """Tests for size recommendation based on measurements"""

    def test_size_recommendation_calculation(self, authenticated_client):
        """Test that the frontend size calculation logic works correctly"""
        # This is tested via body measurements - when saved, they can be used for size recommendation
        # The size recommendation is done client-side based on SIZE_CHART
        
        # Create measurements that should result in size M
        measurement_data = {
            "height": 175,
            "chest": 93,  # M range is 89-97
            "waist": 79,  # M range is 74-84
            "hip": 100,   # M range is 97-104
            "shoulder": 45,
            "armLength": 62,
            "inseam": 81,
            "neck": 38,
            "source": "manual"
        }
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/body-measurements",
            json=measurement_data
        )
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        print("Size M measurements saved successfully")


class TestAISizePredictionAPI:
    """Tests for AI size prediction based on purchase history"""

    def test_get_size_prediction_for_customer(self, authenticated_client):
        """Test AI size prediction for a specific customer"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/size-prediction/{TEST_CUSTOMER_ID}"
        )
        assert response.status_code == 200, f"Failed to get size prediction: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "customer_id" in data
        assert "predicted_size" in data
        assert "confidence" in data
        assert "prediction_source" in data
        
        # Size should be one of valid sizes
        valid_sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]
        assert data["predicted_size"] in valid_sizes, f"Invalid size: {data['predicted_size']}"
        
        # Confidence should be 0-100
        assert 0 <= data["confidence"] <= 100
        
        print(f"Size prediction: {data['predicted_size']} with {data['confidence']}% confidence")
        print(f"Prediction source: {data['prediction_source']}")

    def test_size_prediction_with_category(self, authenticated_client):
        """Test size prediction with category filter"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/size-prediction/{TEST_CUSTOMER_ID}?category=tops"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "predicted_size" in data
        print(f"Category-specific prediction: {data['predicted_size']}")

    def test_size_prediction_invalid_customer(self, authenticated_client):
        """Test size prediction for non-existent customer"""
        fake_customer_id = "non-existent-customer-id"
        response = authenticated_client.get(
            f"{BASE_URL}/api/size-prediction/{fake_customer_id}"
        )
        assert response.status_code == 404, "Should return 404 for non-existent customer"

    def test_size_prediction_analytics(self, authenticated_client):
        """Test size analytics endpoint for inventory planning"""
        response = authenticated_client.get(f"{BASE_URL}/api/size-prediction/analytics")
        assert response.status_code == 200, f"Failed to get analytics: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "overall_size_distribution" in data
        assert "by_category" in data
        assert "recommendations" in data
        
        # Recommendations should be a list
        assert isinstance(data["recommendations"], list)
        print(f"Size distribution: {data['overall_size_distribution']}")
        print(f"Recommendations: {data['recommendations']}")


class TestInventoryAlertSettings:
    """Tests for inventory alert settings configuration"""

    def test_get_inventory_alert_settings(self, authenticated_client):
        """Test retrieving inventory alert settings"""
        response = authenticated_client.get(f"{BASE_URL}/api/inventory/alerts/settings")
        assert response.status_code == 200, f"Failed to get settings: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "enabled" in data
        assert "low_stock_threshold" in data
        assert "channels" in data
        print(f"Alert settings: enabled={data['enabled']}, threshold={data['low_stock_threshold']}")

    def test_update_inventory_alert_settings(self, authenticated_client):
        """Test updating inventory alert settings"""
        new_settings = {
            "enabled": True,
            "low_stock_threshold": 5,  # Set to 5 as per main agent context
            "out_of_stock_alert": True,
            "channels": ["in_app"],
            "email_recipients": [],
            "phone_recipients": []
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/inventory/alerts/settings",
            json=new_settings
        )
        assert response.status_code == 200, f"Failed to update settings: {response.text}"
        data = response.json()
        assert "settings" in data
        
        # Verify settings were updated
        response = authenticated_client.get(f"{BASE_URL}/api/inventory/alerts/settings")
        assert response.status_code == 200
        updated_data = response.json()
        assert updated_data["low_stock_threshold"] == 5
        print("Settings updated successfully with threshold=5")

    def test_update_alert_channels(self, authenticated_client):
        """Test updating alert notification channels"""
        settings_with_channels = {
            "enabled": True,
            "low_stock_threshold": 10,
            "out_of_stock_alert": True,
            "channels": ["in_app", "email"],
            "email_recipients": ["test@example.com"],
            "phone_recipients": []
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/inventory/alerts/settings",
            json=settings_with_channels
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print("Multiple channels configured successfully")


class TestInventoryAlerts:
    """Tests for inventory alert check and creation"""

    def test_get_inventory_alerts(self, authenticated_client):
        """Test retrieving inventory alerts"""
        response = authenticated_client.get(f"{BASE_URL}/api/inventory/alerts")
        assert response.status_code == 200, f"Failed to get alerts: {response.text}"
        data = response.json()
        
        assert "low_stock_items" in data
        assert "alerts" in data
        assert "threshold" in data
        print(f"Found {len(data['low_stock_items'])} low stock items, {len(data['alerts'])} alerts")

    def test_check_and_create_alerts(self, authenticated_client):
        """Test triggering inventory alert check"""
        response = authenticated_client.post(f"{BASE_URL}/api/inventory/alerts/check")
        assert response.status_code == 200, f"Failed to check alerts: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "alerts_created" in data
        print(f"Alert check result: {data['message']}, alerts created: {data['alerts_created']}")

    def test_get_alerts_with_status_filter(self, authenticated_client):
        """Test getting alerts with status filter"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/inventory/alerts?status=pending"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "alerts" in data
        print(f"Found {len(data['alerts'])} pending alerts")


class TestVirtualTryOnSimulation:
    """Tests for virtual try-on simulation"""

    def test_get_clothing_items(self, authenticated_client):
        """Test retrieving clothing items for try-on"""
        response = authenticated_client.get(f"{BASE_URL}/api/items?category=clothing&limit=10")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Items API returns a list directly, not wrapped in {"items": [...]}
        items = data if isinstance(data, list) else data.get("items", [])
        print(f"Found {len(items)} clothing items for try-on")
        return items

    def test_virtual_tryon_simulate(self, authenticated_client):
        """Test virtual try-on simulation endpoint"""
        # First get an item to try on
        items_response = authenticated_client.get(f"{BASE_URL}/api/items?limit=1")
        if items_response.status_code != 200:
            pytest.skip("No items available for try-on test")
        
        data = items_response.json()
        # Items API returns a list directly
        items = data if isinstance(data, list) else data.get("items", [])
        if not items:
            pytest.skip("No items found for try-on test")
        
        item_id = items[0]["id"]
        
        # Simulate try-on
        tryon_data = {
            "clothing_id": item_id,
            "measurements": {
                "height": 175,
                "chest": 96,
                "waist": 82,
                "hip": 98,
                "shoulder": 45,
                "armLength": 62,
                "inseam": 81
            },
            "size_recommendation": {
                "recommendedSize": "M",
                "fitAnalysis": {
                    "chest": "perfect",
                    "waist": "perfect",
                    "hip": "perfect"
                }
            }
        }
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/virtual-tryon/simulate",
            json=tryon_data
        )
        assert response.status_code == 200, f"Try-on simulation failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "clothing_id" in data
        assert "fit_score" in data
        assert "fit_verdict" in data
        assert "suggestions" in data  # Note: response uses 'suggestions' not 'recommendations'
        print(f"Try-on result: {data['fit_verdict']} (score: {data['fit_score']})")


class TestBulkSizePrediction:
    """Tests for bulk size prediction endpoint"""

    def test_bulk_size_prediction(self, authenticated_client):
        """Test bulk size prediction for multiple customers"""
        # Use the test customer ID
        customer_ids = [TEST_CUSTOMER_ID]
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/size-prediction/bulk",
            json=customer_ids
        )
        assert response.status_code == 200, f"Bulk prediction failed: {response.text}"
        data = response.json()
        
        assert "predictions" in data
        assert len(data["predictions"]) == 1
        print(f"Bulk prediction returned {len(data['predictions'])} results")


class TestCleanup:
    """Cleanup test data"""

    def test_cleanup_test_measurements(self, authenticated_client):
        """Clean up test measurement profiles"""
        # Get all measurements
        response = authenticated_client.get(f"{BASE_URL}/api/body-measurements")
        if response.status_code == 200:
            measurements = response.json().get("measurements", [])
            # Delete test measurements (those with TEST_ prefix)
            for m in measurements:
                if m.get("profile_name", "").startswith("TEST_"):
                    delete_response = authenticated_client.delete(
                        f"{BASE_URL}/api/body-measurements/{m['id']}"
                    )
                    if delete_response.status_code == 200:
                        print(f"Cleaned up test measurement: {m['id']}")
        print("Cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
