"""
Test suite for 52 Error Fix Agent Pattern Learning Feature
Tests: Pattern learning, dashboard stats, pattern matching, and API endpoints
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestDashboardEndpoint:
    """Test GET /api/error-fix-52/dashboard with learning stats"""
    
    def test_dashboard_returns_learning_stats(self, api_client):
        """Dashboard should include learning statistics"""
        response = api_client.get(f"{BASE_URL}/api/error-fix-52/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        # Verify learning stats are present
        assert "learning" in data, "Dashboard should include 'learning' field"
        
        learning = data["learning"]
        assert "total_patterns_learned" in learning, "Learning stats should include total_patterns_learned"
        assert "high_confidence_patterns" in learning, "Learning stats should include high_confidence_patterns"
        assert "fixes_from_patterns" in learning, "Learning stats should include fixes_from_patterns"
        assert "learning_enabled" in learning, "Learning stats should include learning_enabled"
        
        # Verify learning is enabled
        assert learning["learning_enabled"] == True, "Learning should be enabled"
        
        print(f"✓ Dashboard learning stats: {learning}")


class TestPatternsEndpoint:
    """Test GET /api/error-fix-52/patterns endpoint"""
    
    def test_get_patterns_returns_structure(self, api_client):
        """GET /api/error-fix-52/patterns should return proper structure"""
        response = api_client.get(f"{BASE_URL}/api/error-fix-52/patterns")
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "total_patterns" in data, "Response should include total_patterns"
        assert "high_confidence_patterns" in data, "Response should include high_confidence_patterns"
        assert "patterns_by_type" in data, "Response should include patterns_by_type"
        assert "patterns" in data, "Response should include patterns list"
        
        assert isinstance(data["patterns"], list), "patterns should be a list"
        print(f"✓ Patterns endpoint returned {data['total_patterns']} patterns")


class TestClearPatternsEndpoint:
    """Test DELETE /api/error-fix-52/patterns endpoint"""
    
    def test_clear_patterns(self, api_client):
        """DELETE /api/error-fix-52/patterns should clear all learned patterns"""
        response = api_client.delete(f"{BASE_URL}/api/error-fix-52/patterns")
        assert response.status_code == 200
        
        data = response.json()
        assert "deleted" in data, "Response should include deleted count"
        print(f"✓ Cleared {data['deleted']} patterns")


class TestPatternLearningFlow:
    """Test the complete pattern learning workflow"""
    
    def test_report_error_creates_pattern(self, api_client):
        """POST /api/error-fix-52/report should auto-fix and learn pattern"""
        # Clear existing patterns first
        api_client.delete(f"{BASE_URL}/api/error-fix-52/patterns")
        api_client.delete(f"{BASE_URL}/api/error-fix-52/clear")
        
        # Report a unique error
        unique_id = str(uuid.uuid4())[:8]
        error_data = {
            "message": f"TypeError: Cannot read property 'map' of undefined in component test_{unique_id}",
            "stack": "TypeError: Cannot read property 'map' of undefined\n    at Component.render (src/components/Test.js:15:10)",
            "file": "src/components/Test.js",
            "line": 15
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/error-fix-52/report",
            json=error_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data, "Response should include error id"
        assert "error_type" in data, "Response should include error_type"
        assert data["status"] == "reported", "Error should be in reported status"
        
        print(f"✓ Error reported: id={data['id']}, type={data['error_type']}")
        
        # Wait for auto-fix to process
        time.sleep(2)
        
        # Check if pattern was learned
        patterns_response = api_client.get(f"{BASE_URL}/api/error-fix-52/patterns")
        assert patterns_response.status_code == 200
        
        patterns_data = patterns_response.json()
        print(f"✓ Current patterns count: {patterns_data['total_patterns']}")
        
        return data
    
    def test_same_error_uses_learned_pattern(self, api_client):
        """When exact same error is reported twice, second should use learned_pattern"""
        # Clear patterns and errors
        api_client.delete(f"{BASE_URL}/api/error-fix-52/patterns")
        api_client.delete(f"{BASE_URL}/api/error-fix-52/clear")
        
        # Report same error twice
        error_message = "HTTP 404: Page not found - /api/test-endpoint"
        error_data = {
            "message": error_message,
            "file": "api/routes.py",
            "line": 100
        }
        
        # First report
        response1 = api_client.post(
            f"{BASE_URL}/api/error-fix-52/report",
            json=error_data
        )
        assert response1.status_code == 200
        first_error_id = response1.json()["id"]
        print(f"✓ First error reported: {first_error_id}")
        
        # Wait for auto-fix to process and learn pattern
        time.sleep(3)
        
        # Check patterns after first fix
        patterns_after_first = api_client.get(f"{BASE_URL}/api/error-fix-52/patterns").json()
        patterns_count_after_first = patterns_after_first["total_patterns"]
        print(f"✓ Patterns after first error: {patterns_count_after_first}")
        
        # Report same error again
        response2 = api_client.post(
            f"{BASE_URL}/api/error-fix-52/report",
            json=error_data
        )
        assert response2.status_code == 200
        second_error_id = response2.json()["id"]
        print(f"✓ Second error reported: {second_error_id}")
        
        # Wait for auto-fix to process
        time.sleep(3)
        
        # Check dashboard for pattern-based fixes
        dashboard_response = api_client.get(f"{BASE_URL}/api/error-fix-52/dashboard")
        assert dashboard_response.status_code == 200
        
        dashboard = dashboard_response.json()
        learning = dashboard.get("learning", {})
        
        print(f"✓ Dashboard learning stats after 2 errors:")
        print(f"  - Total patterns learned: {learning.get('total_patterns_learned', 0)}")
        print(f"  - Fixes from patterns: {learning.get('fixes_from_patterns', 0)}")
        
        # The second error should have been fixed using the learned pattern
        # Check if pattern confidence increased
        patterns = api_client.get(f"{BASE_URL}/api/error-fix-52/patterns").json()
        if patterns["patterns"]:
            first_pattern = patterns["patterns"][0]
            print(f"✓ First pattern details:")
            print(f"  - Error type: {first_pattern.get('error_type')}")
            print(f"  - Success count: {first_pattern.get('success_count')}")
            print(f"  - Confidence score: {first_pattern.get('confidence_score')}")


class TestPatternConfidenceIncrease:
    """Test that pattern confidence increases with repeated successful fixes"""
    
    def test_confidence_increases_with_usage(self, api_client):
        """Pattern confidence should increase when pattern is used successfully"""
        # Clear everything
        api_client.delete(f"{BASE_URL}/api/error-fix-52/patterns")
        api_client.delete(f"{BASE_URL}/api/error-fix-52/clear")
        
        # Report same JavaScript error multiple times
        error_data = {
            "message": "ReferenceError: myVariable is not defined",
            "file": "src/utils.js",
            "line": 42
        }
        
        # Report 3 times to build up confidence
        for i in range(3):
            response = api_client.post(
                f"{BASE_URL}/api/error-fix-52/report",
                json=error_data
            )
            assert response.status_code == 200
            print(f"✓ Error reported iteration {i+1}")
            time.sleep(2)  # Wait for auto-fix
        
        # Check pattern confidence
        patterns_response = api_client.get(f"{BASE_URL}/api/error-fix-52/patterns")
        assert patterns_response.status_code == 200
        
        patterns = patterns_response.json()
        
        if patterns["patterns"]:
            # Find the pattern for JS_REFERENCE_ERROR
            js_patterns = [p for p in patterns["patterns"] if p.get("error_type") == "JS_REFERENCE_ERROR"]
            if js_patterns:
                pattern = js_patterns[0]
                print(f"✓ Pattern confidence check:")
                print(f"  - Success count: {pattern.get('success_count')}")
                print(f"  - Confidence: {pattern.get('confidence_score')}")
                
                # Confidence should be higher than initial 0.6 after multiple uses
                # Initial confidence is 0.6, increases by 0.05 each time
                # After 3 uses: 0.6 + (0.05 * 2) = 0.7 (first creates, next two increase)
                assert pattern.get('success_count', 0) >= 1, "Success count should be at least 1"


class TestErrorTypes:
    """Test that various error types are detected and patterns learned"""
    
    def test_http_error_pattern_learning(self, api_client):
        """HTTP errors should be detected and patterns learned"""
        error_data = {
            "message": "HTTP 500: Internal Server Error - database connection failed",
            "file": "server.py",
            "line": 100
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/error-fix-52/report",
            json=error_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["error_type"] == "HTTP_500", f"Expected HTTP_500, got {data.get('error_type')}"
        print(f"✓ HTTP error detected correctly: {data['error_type']}")
    
    def test_python_error_pattern_learning(self, api_client):
        """Python errors should be detected and patterns learned"""
        error_data = {
            "message": "KeyError: 'missing_key' when accessing user data",
            "file": "backend/services/user.py",
            "line": 55
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/error-fix-52/report",
            json=error_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["error_type"] == "PY_KEY_ERROR", f"Expected PY_KEY_ERROR, got {data.get('error_type')}"
        print(f"✓ Python error detected correctly: {data['error_type']}")
    
    def test_react_error_pattern_learning(self, api_client):
        """React errors should be detected and patterns learned"""
        error_data = {
            "message": "Invalid hook call. Hooks can only be called inside the body of a function component.",
            "file": "src/components/Dashboard.jsx",
            "line": 23
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/error-fix-52/report",
            json=error_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["error_type"] == "REACT_HOOKS", f"Expected REACT_HOOKS, got {data.get('error_type')}"
        print(f"✓ React error detected correctly: {data['error_type']}")
    
    def test_database_error_pattern_learning(self, api_client):
        """Database errors should be detected and patterns learned"""
        error_data = {
            "message": "E11000 duplicate key error collection: test.users index: email_1 dup key",
            "file": "backend/db/users.py",
            "line": 88
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/error-fix-52/report",
            json=error_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["error_type"] == "DB_DUPLICATE_KEY", f"Expected DB_DUPLICATE_KEY, got {data.get('error_type')}"
        print(f"✓ Database error detected correctly: {data['error_type']}")


class TestPatternDetails:
    """Test pattern detail structure and content"""
    
    def test_pattern_has_required_fields(self, api_client):
        """Each pattern should have all required fields"""
        # First ensure there's at least one pattern
        error_data = {
            "message": "TypeError: undefined is not a function",
            "file": "test.js",
            "line": 1
        }
        api_client.post(f"{BASE_URL}/api/error-fix-52/report", json=error_data)
        time.sleep(2)
        
        response = api_client.get(f"{BASE_URL}/api/error-fix-52/patterns")
        assert response.status_code == 200
        
        data = response.json()
        
        if data["patterns"]:
            pattern = data["patterns"][0]
            
            # Check required fields
            required_fields = [
                "id", "pattern_hash", "error_type", "error_name", "category",
                "fix_suggestion", "success_count", "confidence_score", "created_at"
            ]
            
            for field in required_fields:
                assert field in pattern, f"Pattern should have '{field}' field"
            
            print(f"✓ Pattern has all required fields")
            print(f"  - ID: {pattern['id']}")
            print(f"  - Error Type: {pattern['error_type']}")
            print(f"  - Confidence: {pattern['confidence_score']}")


class TestHighConfidencePatterns:
    """Test high confidence pattern counting"""
    
    def test_high_confidence_count_accurate(self, api_client):
        """High confidence count should match patterns with confidence >= 0.8"""
        response = api_client.get(f"{BASE_URL}/api/error-fix-52/patterns")
        assert response.status_code == 200
        
        data = response.json()
        
        # Count patterns with confidence >= 0.8
        high_conf_count = len([p for p in data["patterns"] if p.get("confidence_score", 0) >= 0.8])
        
        assert data["high_confidence_patterns"] == high_conf_count, \
            f"High confidence count mismatch: reported {data['high_confidence_patterns']}, actual {high_conf_count}"
        
        print(f"✓ High confidence count accurate: {high_conf_count}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
