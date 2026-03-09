"""
Test System Repair & Cache Cleanup Feature
Tests for:
- /api/system/health endpoint
- /api/system/cleanup endpoint
- /api/system/log-error endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSystemRepairFeature:
    """Test System Repair and Cache Cleanup APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with test credentials
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.authenticated = True
        else:
            self.authenticated = False
            pytest.skip("Authentication failed - skipping tests")
    
    def test_system_health_endpoint(self):
        """Test GET /api/system/health returns health status"""
        response = self.session.get(f"{BASE_URL}/api/system/health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "status" in data, "Response should contain 'status' field"
        assert data["status"] in ["healthy", "warning", "critical", "error"], f"Invalid status: {data['status']}"
        
        # Verify database status
        assert "database" in data, "Response should contain 'database' field"
        
        # Verify counts
        assert "counts" in data, "Response should contain 'counts' field"
        assert "users" in data["counts"], "Counts should include 'users'"
        assert "items" in data["counts"], "Counts should include 'items'"
        assert "sales" in data["counts"], "Counts should include 'sales'"
        
        # Verify timestamp
        assert "timestamp" in data, "Response should contain 'timestamp' field"
        
        print(f"System health status: {data['status']}")
        print(f"Database status: {data['database']}")
        print(f"Counts: {data['counts']}")
    
    def test_system_cleanup_endpoint(self):
        """Test POST /api/system/cleanup clears old data"""
        response = self.session.post(f"{BASE_URL}/api/system/cleanup")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "timestamp" in data, "Response should contain 'timestamp' field"
        assert "user_id" in data, "Response should contain 'user_id' field"
        assert "user_name" in data, "Response should contain 'user_name' field"
        assert "actions" in data, "Response should contain 'actions' field"
        assert "success" in data, "Response should contain 'success' field"
        
        # Verify success
        assert data["success"] is True, f"Cleanup should succeed, got: {data}"
        
        # Verify actions were performed
        assert isinstance(data["actions"], list), "Actions should be a list"
        assert len(data["actions"]) > 0, "Should have at least one cleanup action"
        
        # Check action types
        action_types = [a.get("action") for a in data["actions"]]
        expected_actions = ["clear_old_notifications", "clear_old_audit_logs", "clear_expired_sessions", "reset_stuck_orders"]
        
        for expected in expected_actions:
            assert expected in action_types, f"Missing expected action: {expected}"
        
        print(f"Cleanup completed successfully")
        print(f"Actions performed: {action_types}")
        for action in data["actions"]:
            print(f"  - {action.get('action')}: {action.get('deleted', action.get('modified', 0))} items")
    
    def test_system_log_error_endpoint(self):
        """Test POST /api/system/log-error logs client errors"""
        response = self.session.post(
            f"{BASE_URL}/api/system/log-error",
            params={
                "error": "Test error from pytest",
                "context": "test_system_repair",
                "url": "http://localhost/test"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response
        assert "logged" in data, "Response should contain 'logged' field"
        assert data["logged"] is True, "Error should be logged successfully"
        
        print("Client error logged successfully")
    
    def test_system_health_without_auth(self):
        """Test that system health requires authentication"""
        # Create new session without auth
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        response = unauth_session.get(f"{BASE_URL}/api/system/health")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("System health correctly requires authentication")
    
    def test_system_cleanup_without_auth(self):
        """Test that system cleanup requires authentication"""
        # Create new session without auth
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        response = unauth_session.post(f"{BASE_URL}/api/system/cleanup")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("System cleanup correctly requires authentication")
    
    def test_system_health_returns_counts(self):
        """Test that system health returns accurate counts"""
        response = self.session.get(f"{BASE_URL}/api/system/health")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify counts are non-negative integers
        counts = data.get("counts", {})
        
        assert isinstance(counts.get("users"), int), "Users count should be an integer"
        assert isinstance(counts.get("items"), int), "Items count should be an integer"
        assert isinstance(counts.get("sales"), int), "Sales count should be an integer"
        
        assert counts.get("users", 0) >= 0, "Users count should be non-negative"
        assert counts.get("items", 0) >= 0, "Items count should be non-negative"
        assert counts.get("sales", 0) >= 0, "Sales count should be non-negative"
        
        print(f"Verified counts - Users: {counts['users']}, Items: {counts['items']}, Sales: {counts['sales']}")
    
    def test_system_cleanup_returns_action_details(self):
        """Test that cleanup returns detailed action results"""
        response = self.session.post(f"{BASE_URL}/api/system/cleanup")
        
        assert response.status_code == 200
        data = response.json()
        
        # Each action should have 'action' and either 'deleted' or 'modified'
        for action in data.get("actions", []):
            assert "action" in action, "Each action should have 'action' field"
            assert "deleted" in action or "modified" in action, f"Action {action.get('action')} should have 'deleted' or 'modified' count"
        
        print("All cleanup actions have proper detail fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
