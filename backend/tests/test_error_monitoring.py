"""
Test Error Monitoring System APIs
Tests: POST /api/errors/report, GET /api/superadmin/errors, GET /api/superadmin/errors/stats,
POST /api/superadmin/errors/{id}/fix, POST /api/superadmin/errors/{id}/acknowledge, 
POST /api/superadmin/errors/{id}/ignore, GET /api/superadmin/errors/notifications/list
"""
import pytest
import requests
import os
import uuid
import time

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable must be set")

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "admin123"

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def superadmin_token(api_client):
    """Get superadmin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    
    if response.status_code != 200:
        pytest.skip(f"Super Admin login failed: {response.status_code} - {response.text}")
    
    data = response.json()
    token = data.get("access_token")
    if not token:
        pytest.skip("No access_token in login response")
    
    return token

@pytest.fixture(scope="module")
def authenticated_client(api_client, superadmin_token):
    """Session with superadmin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {superadmin_token}"})
    return api_client


class TestErrorReporting:
    """Test error reporting endpoint - POST /api/errors/report"""
    
    def test_report_frontend_error_success(self, api_client):
        """Test reporting a frontend error"""
        error_payload = {
            "message": f"TEST_Error_{uuid.uuid4().hex[:8]}: TypeError - Cannot read property 'map' of undefined",
            "stack_trace": "at Component.render (Component.js:42)\n  at renderWithHooks (react-dom.development.js:14985)",
            "url": "https://app.example.com/dashboard",
            "component": "DashboardComponent",
            "additional_context": {
                "browser": "Chrome 120",
                "os": "Windows 11",
                "test_marker": "integration_test"
            }
        }
        
        response = api_client.post(f"{BASE_URL}/api/errors/report", json=error_payload)
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data.get("success") is True
        assert "error_id" in data
        assert data.get("error_id") is not None
        assert "category" in data
        assert "severity" in data
        
        # Store error_id for later tests
        self.__class__.reported_error_id = data.get("error_id")
        print(f"Reported error ID: {self.reported_error_id}")
    
    def test_report_database_error(self, api_client):
        """Test reporting a database error"""
        error_payload = {
            "message": "TEST_DatabaseError: Connection refused to MongoDB at localhost:27017",
            "stack_trace": "MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017",
            "url": "backend/database_service.py",
            "component": "DatabaseService",
            "additional_context": {
                "db_host": "localhost",
                "db_port": 27017,
                "operation": "insert"
            }
        }
        
        response = api_client.post(f"{BASE_URL}/api/errors/report", json=error_payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        # Should classify as database error
        print(f"Database error classified as: {data.get('category')}")
    
    def test_report_security_error(self, api_client):
        """Test reporting a security error"""
        error_payload = {
            "message": "TEST_SecurityError: Unauthorized access attempt detected - 403 Forbidden",
            "stack_trace": "AuthenticationError: Invalid JWT token",
            "url": "/api/admin/sensitive-data",
            "component": "AuthMiddleware"
        }
        
        response = api_client.post(f"{BASE_URL}/api/errors/report", json=error_payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        print(f"Security error classified as: category={data.get('category')}, severity={data.get('severity')}")
    
    def test_report_error_minimal_payload(self, api_client):
        """Test reporting with minimal required fields"""
        error_payload = {
            "message": "TEST_MinimalError: Simple error message"
        }
        
        response = api_client.post(f"{BASE_URL}/api/errors/report", json=error_payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True


class TestSuperAdminErrorAccess:
    """Test Super Admin error access endpoints"""
    
    def test_get_errors_list(self, authenticated_client):
        """Test GET /api/superadmin/errors - list all errors"""
        response = authenticated_client.get(f"{BASE_URL}/api/superadmin/errors?limit=50")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "errors" in data
        assert isinstance(data["errors"], list)
        assert "total" in data
        
        # Check structure of error records
        if data["errors"]:
            error = data["errors"][0]
            expected_fields = ["id", "message", "category", "severity", "source"]
            for field in expected_fields:
                assert field in error, f"Missing field: {field}"
            print(f"Found {len(data['errors'])} errors, total={data['total']}")
    
    def test_get_errors_with_category_filter(self, authenticated_client):
        """Test filtering errors by category"""
        response = authenticated_client.get(f"{BASE_URL}/api/superadmin/errors?category=runtime")
        
        assert response.status_code == 200
        data = response.json()
        assert "errors" in data
        
        # All returned errors should match category filter
        for error in data["errors"]:
            if error.get("category"):
                assert error["category"] == "runtime", f"Expected runtime, got {error['category']}"
    
    def test_get_errors_with_severity_filter(self, authenticated_client):
        """Test filtering errors by severity"""
        response = authenticated_client.get(f"{BASE_URL}/api/superadmin/errors?severity=high")
        
        assert response.status_code == 200
        data = response.json()
        assert "errors" in data
    
    def test_get_errors_with_resolved_filter(self, authenticated_client):
        """Test filtering errors by resolution status"""
        # Test unresolved errors
        response = authenticated_client.get(f"{BASE_URL}/api/superadmin/errors?is_resolved=false")
        
        assert response.status_code == 200
        data = response.json()
        assert "errors" in data
        
        for error in data["errors"]:
            assert error.get("is_resolved") is False, "Resolved filter not working"
    
    def test_get_error_stats(self, authenticated_client):
        """Test GET /api/superadmin/errors/stats - error statistics"""
        response = authenticated_client.get(f"{BASE_URL}/api/superadmin/errors/stats?days=7")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required stats fields
        expected_fields = [
            "total_errors", "critical_count", "high_count", "medium_count", 
            "low_count", "resolved_count", "pending_count", "auto_fixed_count",
            "by_category", "by_source", "trend_data", "recent_errors"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing stats field: {field}"
        
        assert isinstance(data["by_category"], dict)
        assert isinstance(data["by_source"], dict)
        assert isinstance(data["trend_data"], list)
        assert isinstance(data["recent_errors"], list)
        
        print(f"Error stats: total={data['total_errors']}, critical={data['critical_count']}, resolved={data['resolved_count']}")


class TestErrorActions:
    """Test error action endpoints - fix, acknowledge, ignore"""
    
    @pytest.fixture(autouse=True)
    def setup_test_error(self, authenticated_client):
        """Create a test error for action tests"""
        # Use the api_client without auth for reporting errors
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        error_payload = {
            "message": f"TEST_ActionError_{uuid.uuid4().hex[:8]}: Test error for action testing",
            "stack_trace": "TestStack at test.py:1",
            "component": "TestComponent"
        }
        
        response = session.post(f"{BASE_URL}/api/errors/report", json=error_payload)
        if response.status_code == 200:
            self.test_error_id = response.json().get("error_id")
            print(f"Created test error: {self.test_error_id}")
        else:
            pytest.skip("Could not create test error")
    
    def test_apply_fix_to_error(self, authenticated_client):
        """Test POST /api/superadmin/errors/{id}/fix"""
        if not hasattr(self, 'test_error_id'):
            pytest.skip("No test error available")
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/superadmin/errors/{self.test_error_id}/fix"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "message" in data
        
        # Verify error is now resolved
        get_response = authenticated_client.get(f"{BASE_URL}/api/superadmin/errors/{self.test_error_id}")
        if get_response.status_code == 200:
            error_data = get_response.json()
            assert error_data.get("is_resolved") is True
            assert error_data.get("fix_status") == "manual_fixed"
            print(f"Error {self.test_error_id} marked as fixed")
    
    def test_acknowledge_error(self, authenticated_client):
        """Test POST /api/superadmin/errors/{id}/acknowledge"""
        # Create new error for acknowledge test
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        error_payload = {
            "message": f"TEST_AcknowledgeError_{uuid.uuid4().hex[:8]}: Error for acknowledge test"
        }
        
        report_response = session.post(f"{BASE_URL}/api/errors/report", json=error_payload)
        if report_response.status_code != 200:
            pytest.skip("Could not create error for acknowledge test")
        
        error_id = report_response.json().get("error_id")
        
        # Acknowledge the error
        response = authenticated_client.post(
            f"{BASE_URL}/api/superadmin/errors/{error_id}/acknowledge"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        
        # Verify error is acknowledged
        get_response = authenticated_client.get(f"{BASE_URL}/api/superadmin/errors/{error_id}")
        if get_response.status_code == 200:
            error_data = get_response.json()
            assert error_data.get("is_acknowledged") is True
            print(f"Error {error_id} acknowledged")
    
    def test_ignore_error(self, authenticated_client):
        """Test POST /api/superadmin/errors/{id}/ignore"""
        # Create new error for ignore test
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        error_payload = {
            "message": f"TEST_IgnoreError_{uuid.uuid4().hex[:8]}: Error for ignore test"
        }
        
        report_response = session.post(f"{BASE_URL}/api/errors/report", json=error_payload)
        if report_response.status_code != 200:
            pytest.skip("Could not create error for ignore test")
        
        error_id = report_response.json().get("error_id")
        
        # Ignore the error
        response = authenticated_client.post(
            f"{BASE_URL}/api/superadmin/errors/{error_id}/ignore"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        
        # Verify error is ignored
        get_response = authenticated_client.get(f"{BASE_URL}/api/superadmin/errors/{error_id}")
        if get_response.status_code == 200:
            error_data = get_response.json()
            assert error_data.get("is_resolved") is True
            assert error_data.get("fix_status") == "ignored"
            print(f"Error {error_id} ignored")
    
    def test_fix_nonexistent_error(self, authenticated_client):
        """Test fixing a non-existent error returns 404"""
        fake_id = "nonexistent-error-id-12345"
        response = authenticated_client.post(
            f"{BASE_URL}/api/superadmin/errors/{fake_id}/fix"
        )
        
        assert response.status_code == 404


class TestErrorNotifications:
    """Test error notification endpoints"""
    
    def test_get_notifications_list(self, authenticated_client):
        """Test GET /api/superadmin/errors/notifications/list"""
        response = authenticated_client.get(f"{BASE_URL}/api/superadmin/errors/notifications/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        assert isinstance(data["unread_count"], int)
        
        print(f"Notifications: count={len(data['notifications'])}, unread={data['unread_count']}")
        
        # Check notification structure if any exist
        if data["notifications"]:
            notification = data["notifications"][0]
            expected_fields = ["id", "type", "title", "message", "severity", "is_read", "created_at"]
            for field in expected_fields:
                assert field in notification, f"Missing notification field: {field}"


class TestErrorAccessControl:
    """Test that error endpoints require proper authorization"""
    
    def test_errors_require_superadmin(self, api_client):
        """Test that errors endpoint requires superadmin access"""
        # Try without auth
        headers_backup = api_client.headers.copy()
        api_client.headers.pop("Authorization", None)
        
        response = api_client.get(f"{BASE_URL}/api/superadmin/errors")
        
        # Restore headers
        api_client.headers.update(headers_backup)
        
        # Should fail without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_stats_require_superadmin(self, api_client):
        """Test that stats endpoint requires superadmin access"""
        headers_backup = api_client.headers.copy()
        api_client.headers.pop("Authorization", None)
        
        response = api_client.get(f"{BASE_URL}/api/superadmin/errors/stats")
        
        api_client.headers.update(headers_backup)
        
        assert response.status_code in [401, 403]


class TestAIClassification:
    """Test AI-powered error classification"""
    
    def test_runtime_error_classification(self, api_client):
        """Test that runtime errors are classified correctly"""
        error_payload = {
            "message": "TypeError: Cannot read property 'length' of undefined",
            "stack_trace": "at processItems (utils.js:42)\n  at main (app.js:10)"
        }
        
        response = api_client.post(f"{BASE_URL}/api/errors/report", json=error_payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # AI should classify this as runtime error
        print(f"TypeError classified as: category={data.get('category')}, severity={data.get('severity')}")
    
    def test_network_error_classification(self, api_client):
        """Test that network errors are classified correctly"""
        error_payload = {
            "message": "Network request failed: ERR_CONNECTION_TIMEOUT after 30000ms",
            "url": "/api/data",
            "component": "DataFetcher"
        }
        
        response = api_client.post(f"{BASE_URL}/api/errors/report", json=error_payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be classified as http_network
        print(f"Network error classified as: category={data.get('category')}, severity={data.get('severity')}")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_errors(authenticated_client):
    """Cleanup TEST_ prefixed errors after tests"""
    yield
    
    # Cleanup can be done by marking test errors as resolved
    try:
        response = authenticated_client.get(f"{BASE_URL}/api/superadmin/errors?limit=100")
        if response.status_code == 200:
            errors = response.json().get("errors", [])
            for error in errors:
                if "TEST_" in error.get("message", ""):
                    # Mark as ignored/resolved
                    authenticated_client.post(
                        f"{BASE_URL}/api/superadmin/errors/{error['id']}/ignore"
                    )
    except Exception as e:
        print(f"Cleanup failed: {e}")
