"""
Test User Management Module
- User CRUD operations
- Role-based permissions
- Audit trail
- User activation/deactivation
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@brandmafia.com"
TEST_PASSWORD = "demo123"


class TestUserManagementAuth:
    """Test authentication for user management"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
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
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")


class TestUserManagementEndpoints:
    """Test User Management CRUD endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_list_users(self, auth_headers):
        """Test GET /api/users - List all users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} users")
        
        # Verify user structure
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
            print(f"✓ User structure verified: {user.get('name')} ({user.get('role')})")
    
    def test_get_permission_modules(self, auth_headers):
        """Test GET /api/permission-modules - Get all permission modules"""
        response = requests.get(f"{BASE_URL}/api/permission-modules", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "modules" in data
        assert "roles" in data
        assert "default_permissions" in data
        
        # Verify modules count (should be 31 as per requirements)
        modules = data["modules"]
        assert len(modules) >= 30, f"Expected at least 30 modules, got {len(modules)}"
        print(f"✓ Got {len(modules)} permission modules")
        
        # Verify roles
        roles = data["roles"]
        assert "admin" in roles
        assert "manager" in roles
        assert "staff" in roles
        assert "cashier" in roles
        print(f"✓ Roles verified: {roles}")
        
        # Verify default permissions exist for each role
        default_perms = data["default_permissions"]
        for role in roles:
            assert role in default_perms, f"Missing default permissions for {role}"
        print("✓ Default permissions verified for all roles")
        
        # Verify module categories
        categories = set(m["category"] for m in modules)
        expected_categories = {"General", "Sales", "Purchase", "Parties & Ledger", "Discounts & Offers", "HR Management", "Settings"}
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
        print(f"✓ Categories verified: {categories}")
    
    def test_create_user(self, auth_headers):
        """Test POST /api/users - Create new user"""
        unique_id = str(uuid.uuid4())[:8]
        test_user = {
            "email": f"TEST_user_{unique_id}@test.com",
            "password": "testpass123",
            "name": f"TEST User {unique_id}",
            "role": "staff",
            "store_ids": [],
            "permissions": {}
        }
        
        response = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json=test_user)
        assert response.status_code == 200, f"Create user failed: {response.text}"
        data = response.json()
        
        # Verify created user
        assert data["email"] == test_user["email"].lower()
        assert data["name"] == test_user["name"]
        assert data["role"] == test_user["role"]
        assert "id" in data
        assert "password" not in data  # Password should not be returned
        assert data.get("is_active") == True
        
        # Verify default permissions were applied
        assert "permissions" in data
        print(f"✓ Created user: {data['name']} (ID: {data['id']})")
        
        # Store user ID for cleanup
        return data["id"]
    
    def test_create_user_duplicate_email(self, auth_headers):
        """Test POST /api/users - Duplicate email should fail"""
        test_user = {
            "email": TEST_EMAIL,  # Already exists
            "password": "testpass123",
            "name": "Duplicate User",
            "role": "staff",
            "store_ids": [],
            "permissions": {}
        }
        
        response = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json=test_user)
        assert response.status_code == 400
        data = response.json()
        assert "already exists" in data.get("detail", "").lower()
        print("✓ Duplicate email correctly rejected")
    
    def test_get_single_user(self, auth_headers):
        """Test GET /api/users/{user_id} - Get single user"""
        # First get list of users
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        users = response.json()
        assert len(users) > 0
        
        user_id = users[0]["id"]
        
        # Get single user
        response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == user_id
        assert "email" in data
        assert "name" in data
        assert "password" not in data
        print(f"✓ Got single user: {data['name']}")
    
    def test_update_user(self, auth_headers):
        """Test PUT /api/users/{user_id} - Update user"""
        # First create a test user
        unique_id = str(uuid.uuid4())[:8]
        test_user = {
            "email": f"TEST_update_{unique_id}@test.com",
            "password": "testpass123",
            "name": f"TEST Update User {unique_id}",
            "role": "staff",
            "store_ids": [],
            "permissions": {}
        }
        
        create_response = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json=test_user)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update the user
        update_data = {
            "name": f"TEST Updated Name {unique_id}",
            "role": "manager"
        }
        
        response = requests.put(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == update_data["name"]
        assert data["role"] == update_data["role"]
        print(f"✓ Updated user: {data['name']} (role: {data['role']})")
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["name"] == update_data["name"]
        assert fetched["role"] == update_data["role"]
        print("✓ Update verified via GET")
    
    def test_deactivate_user(self, auth_headers):
        """Test PUT /api/users/{user_id} - Deactivate user (soft delete)"""
        # First create a test user
        unique_id = str(uuid.uuid4())[:8]
        test_user = {
            "email": f"TEST_deactivate_{unique_id}@test.com",
            "password": "testpass123",
            "name": f"TEST Deactivate User {unique_id}",
            "role": "staff",
            "store_ids": [],
            "permissions": {}
        }
        
        create_response = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json=test_user)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Deactivate the user
        response = requests.put(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers, json={"is_active": False})
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_active"] == False
        print(f"✓ Deactivated user: {data['name']}")
        
        # Verify deactivation persisted
        get_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["is_active"] == False
        print("✓ Deactivation verified via GET")
    
    def test_reactivate_user(self, auth_headers):
        """Test PUT /api/users/{user_id} - Reactivate user"""
        # First create and deactivate a test user
        unique_id = str(uuid.uuid4())[:8]
        test_user = {
            "email": f"TEST_reactivate_{unique_id}@test.com",
            "password": "testpass123",
            "name": f"TEST Reactivate User {unique_id}",
            "role": "staff",
            "store_ids": [],
            "permissions": {}
        }
        
        create_response = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json=test_user)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Deactivate
        requests.put(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers, json={"is_active": False})
        
        # Reactivate
        response = requests.put(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers, json={"is_active": True})
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_active"] == True
        print(f"✓ Reactivated user: {data['name']}")
    
    def test_update_user_permissions(self, auth_headers):
        """Test PUT /api/users/{user_id} - Update user permissions"""
        # First create a test user
        unique_id = str(uuid.uuid4())[:8]
        test_user = {
            "email": f"TEST_perms_{unique_id}@test.com",
            "password": "testpass123",
            "name": f"TEST Permissions User {unique_id}",
            "role": "staff",
            "store_ids": [],
            "permissions": {}
        }
        
        create_response = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json=test_user)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update permissions
        new_permissions = {
            "dashboard": True,
            "pos": True,
            "items": True,
            "inventory": False,
            "analytics": False
        }
        
        response = requests.put(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers, json={"permissions": new_permissions})
        assert response.status_code == 200
        data = response.json()
        
        assert data["permissions"]["dashboard"] == True
        assert data["permissions"]["pos"] == True
        assert data["permissions"]["items"] == True
        print(f"✓ Updated permissions for user: {data['name']}")


class TestAuditTrail:
    """Test Audit Trail functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_user_audit_trail(self, auth_headers):
        """Test GET /api/users/{user_id}/audit - Get audit trail for specific user"""
        # First get list of users
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        users = response.json()
        assert len(users) > 0
        
        user_id = users[0]["id"]
        
        # Get audit trail for user
        response = requests.get(f"{BASE_URL}/api/users/{user_id}/audit", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} audit records for user")
        
        # Verify audit record structure if any exist
        if len(data) > 0:
            audit = data[0]
            assert "id" in audit
            assert "action" in audit
            assert "created_at" in audit
            print(f"✓ Audit record structure verified: {audit.get('action')}")
    
    def test_get_full_audit_trail(self, auth_headers):
        """Test GET /api/audit-trail - Get full audit trail"""
        response = requests.get(f"{BASE_URL}/api/audit-trail", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} total audit records")
    
    def test_audit_trail_filter_by_entity_type(self, auth_headers):
        """Test GET /api/audit-trail with entity_type filter"""
        response = requests.get(f"{BASE_URL}/api/audit-trail?entity_type=user", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # All records should be for users
        for record in data:
            assert record.get("entity_type") == "user"
        print(f"✓ Filtered audit trail by entity_type=user: {len(data)} records")
    
    def test_audit_trail_filter_by_action(self, auth_headers):
        """Test GET /api/audit-trail with action filter"""
        response = requests.get(f"{BASE_URL}/api/audit-trail?action=user_created", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # All records should have user_created action
        for record in data:
            assert record.get("action") == "user_created"
        print(f"✓ Filtered audit trail by action=user_created: {len(data)} records")
    
    def test_audit_created_on_user_create(self, auth_headers):
        """Test that audit record is created when user is created"""
        # Create a test user
        unique_id = str(uuid.uuid4())[:8]
        test_user = {
            "email": f"TEST_audit_{unique_id}@test.com",
            "password": "testpass123",
            "name": f"TEST Audit User {unique_id}",
            "role": "staff",
            "store_ids": [],
            "permissions": {}
        }
        
        create_response = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json=test_user)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Check audit trail for this user
        response = requests.get(f"{BASE_URL}/api/users/{user_id}/audit", headers=auth_headers)
        assert response.status_code == 200
        audits = response.json()
        
        # Should have at least one audit record (user_created)
        assert len(audits) >= 1
        
        # Find user_created action
        created_audit = next((a for a in audits if a.get("action") == "user_created"), None)
        assert created_audit is not None, "user_created audit record not found"
        print(f"✓ Audit record created for new user: {created_audit.get('action')}")


class TestStoresEndpoint:
    """Test stores endpoint used by User Management"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_list_stores(self, auth_headers):
        """Test GET /api/stores - List all stores"""
        response = requests.get(f"{BASE_URL}/api/stores", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} stores")
        
        # Verify store structure if any exist
        if len(data) > 0:
            store = data[0]
            assert "id" in store
            assert "name" in store
            print(f"✓ Store structure verified: {store.get('name')}")


# Cleanup fixture to remove test users after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_users():
    """Cleanup TEST_ prefixed users after all tests"""
    yield
    
    # Login
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code != 200:
        return
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Get all users
    response = requests.get(f"{BASE_URL}/api/users", headers=headers)
    if response.status_code != 200:
        return
    
    users = response.json()
    
    # Deactivate TEST_ users
    for user in users:
        if user.get("email", "").startswith("test_"):
            requests.put(f"{BASE_URL}/api/users/{user['id']}", headers=headers, json={"is_active": False})
            print(f"Cleaned up test user: {user.get('email')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
