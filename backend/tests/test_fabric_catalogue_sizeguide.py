"""
Test Fabric Catalogue and Size Guide Features
Tests for:
- Fabric CRUD operations
- Fabric categories
- Custom stitch requests
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "SuperAdmin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture
def api_client(auth_token):
    """Create API client with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestFabricCategories:
    """Test fabric categories endpoint"""
    
    def test_get_fabric_categories(self, api_client):
        """Test GET /api/fabrics/categories returns list of fabric categories"""
        response = api_client.get(f"{BASE_URL}/api/fabrics/categories")
        
        assert response.status_code == 200, f"Failed to get categories: {response.text}"
        
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) > 0
        
        # Verify category structure
        first_cat = data["categories"][0]
        assert "id" in first_cat
        assert "name" in first_cat
        assert "description" in first_cat
        
        print(f"✓ Found {len(data['categories'])} fabric categories")


class TestFabricCRUD:
    """Test fabric CRUD operations"""
    
    @pytest.fixture
    def test_fabric_data(self):
        """Generate test fabric data"""
        return {
            "name": f"TEST_Fabric_{uuid.uuid4().hex[:8]}",
            "category": "cotton",
            "description": "Test fabric description",
            "color": "Navy Blue",
            "pattern": "solid",
            "price_per_meter": 299.99,
            "available_quantity": 50,
            "suitable_for": ["tops", "bottoms"],
            "care_instructions": "Machine wash cold",
            "composition": "100% Cotton"
        }
    
    def test_list_fabrics(self, api_client):
        """Test GET /api/fabrics returns fabrics list"""
        response = api_client.get(f"{BASE_URL}/api/fabrics")
        
        assert response.status_code == 200, f"Failed to list fabrics: {response.text}"
        
        data = response.json()
        assert "fabrics" in data
        assert "total" in data
        assert isinstance(data["fabrics"], list)
        
        print(f"✓ Found {data['total']} fabrics")
    
    def test_create_fabric(self, api_client, test_fabric_data):
        """Test POST /api/fabrics creates a new fabric"""
        response = api_client.post(
            f"{BASE_URL}/api/fabrics",
            json=test_fabric_data
        )
        
        assert response.status_code == 200, f"Failed to create fabric: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["name"] == test_fabric_data["name"]
        assert data["category"] == test_fabric_data["category"]
        assert data["price_per_meter"] == test_fabric_data["price_per_meter"]
        
        # Cleanup - delete the test fabric
        fabric_id = data["id"]
        api_client.delete(f"{BASE_URL}/api/fabrics/{fabric_id}")
        
        print(f"✓ Created and deleted fabric: {test_fabric_data['name']}")
    
    def test_create_and_get_fabric(self, api_client, test_fabric_data):
        """Test creating a fabric and retrieving it to verify persistence"""
        # Create fabric
        create_response = api_client.post(
            f"{BASE_URL}/api/fabrics",
            json=test_fabric_data
        )
        
        assert create_response.status_code == 200
        fabric_id = create_response.json()["id"]
        
        # Get fabric to verify persistence
        get_response = api_client.get(f"{BASE_URL}/api/fabrics/{fabric_id}")
        
        assert get_response.status_code == 200
        fetched = get_response.json()
        
        assert fetched["id"] == fabric_id
        assert fetched["name"] == test_fabric_data["name"]
        assert fetched["category"] == test_fabric_data["category"]
        assert fetched["color"] == test_fabric_data["color"]
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/fabrics/{fabric_id}")
        print(f"✓ Create-Get verification passed for fabric: {test_fabric_data['name']}")
    
    def test_update_fabric(self, api_client, test_fabric_data):
        """Test PUT /api/fabrics/{id} updates fabric"""
        # Create fabric first
        create_response = api_client.post(
            f"{BASE_URL}/api/fabrics",
            json=test_fabric_data
        )
        
        assert create_response.status_code == 200
        fabric_id = create_response.json()["id"]
        
        # Update fabric
        updated_data = test_fabric_data.copy()
        updated_data["name"] = f"TEST_Updated_{uuid.uuid4().hex[:8]}"
        updated_data["price_per_meter"] = 399.99
        
        update_response = api_client.put(
            f"{BASE_URL}/api/fabrics/{fabric_id}",
            json=updated_data
        )
        
        assert update_response.status_code == 200
        
        # Verify update
        get_response = api_client.get(f"{BASE_URL}/api/fabrics/{fabric_id}")
        assert get_response.status_code == 200
        
        fetched = get_response.json()
        assert fetched["price_per_meter"] == 399.99
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/fabrics/{fabric_id}")
        print(f"✓ Update verification passed")
    
    def test_delete_fabric(self, api_client, test_fabric_data):
        """Test DELETE /api/fabrics/{id} soft deletes fabric"""
        # Create fabric
        create_response = api_client.post(
            f"{BASE_URL}/api/fabrics",
            json=test_fabric_data
        )
        
        assert create_response.status_code == 200
        fabric_id = create_response.json()["id"]
        
        # Delete fabric
        delete_response = api_client.delete(f"{BASE_URL}/api/fabrics/{fabric_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion - should return 404
        get_response = api_client.get(f"{BASE_URL}/api/fabrics/{fabric_id}")
        assert get_response.status_code == 404
        
        print(f"✓ Delete verification passed")
    
    def test_search_fabrics(self, api_client, test_fabric_data):
        """Test fabric search functionality"""
        # Create fabric with unique name
        test_fabric_data["name"] = f"TEST_SearchFabric_{uuid.uuid4().hex[:8]}"
        
        create_response = api_client.post(
            f"{BASE_URL}/api/fabrics",
            json=test_fabric_data
        )
        
        assert create_response.status_code == 200
        fabric_id = create_response.json()["id"]
        
        # Search for fabric
        search_response = api_client.get(
            f"{BASE_URL}/api/fabrics?search=SearchFabric"
        )
        
        assert search_response.status_code == 200
        data = search_response.json()
        
        # Should find at least our created fabric
        found = any(f["id"] == fabric_id for f in data["fabrics"])
        assert found, "Created fabric not found in search results"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/fabrics/{fabric_id}")
        print(f"✓ Search functionality working")
    
    def test_filter_by_category(self, api_client, test_fabric_data):
        """Test filtering fabrics by category"""
        # Create fabric
        create_response = api_client.post(
            f"{BASE_URL}/api/fabrics",
            json=test_fabric_data
        )
        
        assert create_response.status_code == 200
        fabric_id = create_response.json()["id"]
        
        # Filter by category
        filter_response = api_client.get(
            f"{BASE_URL}/api/fabrics?category=cotton"
        )
        
        assert filter_response.status_code == 200
        data = filter_response.json()
        
        # All returned fabrics should be cotton
        for fabric in data["fabrics"]:
            assert fabric["category"] == "cotton"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/fabrics/{fabric_id}")
        print(f"✓ Category filter working")


class TestCustomStitchRequests:
    """Test custom stitch request functionality"""
    
    @pytest.fixture
    def test_fabric_id(self, api_client):
        """Create a test fabric and return its ID"""
        fabric_data = {
            "name": f"TEST_StitchFabric_{uuid.uuid4().hex[:8]}",
            "category": "cotton",
            "description": "Test fabric for stitch request",
            "color": "Red",
            "pattern": "solid",
            "price_per_meter": 200,
            "available_quantity": 100,
            "suitable_for": ["tops"],
            "care_instructions": "Hand wash",
            "composition": "100% Cotton"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/fabrics",
            json=fabric_data
        )
        
        assert response.status_code == 200
        fabric_id = response.json()["id"]
        
        yield fabric_id
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/fabrics/{fabric_id}")
    
    def test_create_stitch_request(self, api_client, test_fabric_id):
        """Test POST /api/fabrics/custom-stitch-request creates a request"""
        request_data = {
            "fabric_id": test_fabric_id,
            "clothing_type": "tops",
            "measurements": {"chest": 96, "waist": 82},
            "design_notes": "Test design notes",
            "quantity": 2,
            "urgency": "normal",
            "customer_name": "Test Customer",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "delivery_address": "123 Test Street"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/fabrics/custom-stitch-request",
            json=request_data
        )
        
        assert response.status_code == 200, f"Failed to create stitch request: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["fabric_id"] == test_fabric_id
        assert data["clothing_type"] == "tops"
        assert data["status"] == "pending"
        assert "estimated_price" in data
        assert "estimated_delivery_days" in data
        
        print(f"✓ Created stitch request with estimated price: ₹{data['estimated_price']}")
    
    def test_list_stitch_requests(self, api_client, test_fabric_id):
        """Test GET /api/fabrics/custom-stitch-requests returns list"""
        # First create a request
        request_data = {
            "fabric_id": test_fabric_id,
            "clothing_type": "bottoms",
            "measurements": {"waist": 82, "hip": 94},
            "design_notes": "List test",
            "quantity": 1,
            "urgency": "express",
            "customer_name": "List Test Customer",
            "customer_phone": "1234567890"
        }
        
        api_client.post(
            f"{BASE_URL}/api/fabrics/custom-stitch-request",
            json=request_data
        )
        
        # Get list
        response = api_client.get(f"{BASE_URL}/api/fabrics/custom-stitch-requests")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "requests" in data
        assert "total" in data
        assert isinstance(data["requests"], list)
        
        print(f"✓ Found {data['total']} stitch requests")
    
    def test_urgency_pricing(self, api_client, test_fabric_id):
        """Test that urgency affects estimated price"""
        base_request = {
            "fabric_id": test_fabric_id,
            "clothing_type": "tops",
            "measurements": {"chest": 96},
            "quantity": 1,
            "customer_name": "Price Test",
            "customer_phone": "1111111111"
        }
        
        # Normal urgency
        normal_request = {**base_request, "urgency": "normal"}
        normal_resp = api_client.post(
            f"{BASE_URL}/api/fabrics/custom-stitch-request",
            json=normal_request
        )
        normal_price = normal_resp.json()["estimated_price"]
        
        # Express urgency
        express_request = {**base_request, "urgency": "express"}
        express_resp = api_client.post(
            f"{BASE_URL}/api/fabrics/custom-stitch-request",
            json=express_request
        )
        express_price = express_resp.json()["estimated_price"]
        
        # Express should be more expensive
        assert express_price > normal_price, "Express should cost more than normal"
        
        print(f"✓ Normal: ₹{normal_price}, Express: ₹{express_price} (1.5x multiplier)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
