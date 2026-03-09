"""
Test Live Error Monitoring Feature - Real-time Error Feed & Resolution
====================================================================
Tests for:
1. GET /api/orchestrator/live-errors - Returns error list with stats
2. POST /api/orchestrator/report-error - Creates new error and routes to agents
3. PUT /api/orchestrator/live-errors/{id}/resolve - Marks error as fixed
4. GET /api/orchestrator/error-timeline - Returns timeline data
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLiveErrorMonitoringAPIs:
    """Tests for Live Error Monitoring feature APIs"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for superadmin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Auth headers for API calls"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    # ===========================================
    # GET /api/orchestrator/live-errors
    # ===========================================
    
    def test_get_live_errors_basic(self, auth_headers):
        """Test basic live errors endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/live-errors",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "errors" in data, "Response should have 'errors' field"
        assert "stats" in data, "Response should have 'stats' field"
        assert "period_minutes" in data, "Response should have 'period_minutes' field"
        
        # Verify stats structure
        stats = data["stats"]
        assert "total" in stats, "Stats should have 'total'"
        assert "fixed" in stats, "Stats should have 'fixed'"
        assert "failed" in stats, "Stats should have 'failed'"
        assert "pending" in stats, "Stats should have 'pending'"
        assert "critical" in stats, "Stats should have 'critical'"
        assert "high" in stats, "Stats should have 'high'"
        assert "fix_rate" in stats, "Stats should have 'fix_rate'"
        
        print(f"Live errors response: errors={len(data['errors'])}, stats={stats}")
    
    def test_get_live_errors_with_filters(self, auth_headers):
        """Test live errors with query filters"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/live-errors",
            headers=auth_headers,
            params={"limit": 10, "since_minutes": 30}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify limit is respected
        assert len(data["errors"]) <= 10, "Should respect limit parameter"
        print(f"Filtered live errors: {len(data['errors'])} errors")
    
    def test_get_live_errors_filter_by_severity(self, auth_headers):
        """Test live errors filtered by severity"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/live-errors",
            headers=auth_headers,
            params={"severity": "critical"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # If we have critical errors, verify they're all critical
        for error in data["errors"]:
            assert error["severity"] == "critical", "All errors should be critical"
        print(f"Critical errors: {len(data['errors'])}")
    
    def test_get_live_errors_filter_by_status(self, auth_headers):
        """Test live errors filtered by status"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/live-errors",
            headers=auth_headers,
            params={"status": "failed"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # If we have failed errors, verify they're all failed
        for error in data["errors"]:
            assert error["status"] == "failed", "All errors should be failed status"
        print(f"Failed errors: {len(data['errors'])}")
    
    def test_get_live_errors_unauthenticated(self):
        """Test live errors endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/live-errors")
        assert response.status_code in [401, 403], "Should require authentication"
    
    # ===========================================
    # POST /api/orchestrator/report-error
    # ===========================================
    
    def test_report_error_basic(self, auth_headers):
        """Test reporting a new error"""
        unique_id = str(uuid.uuid4())[:8]
        error_data = {
            "error_type": f"TestError_{unique_id}",
            "error_message": "This is a test error message for automated testing",
            "source": "user_reported",
            "auto_route": False  # Don't auto-route to avoid agent interference
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json=error_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "error_id" in data, "Response should have 'error_id'"
        assert "severity" in data, "Response should have 'severity'"
        assert "category" in data, "Response should have 'category'"
        assert "status" in data, "Response should have 'status'"
        
        print(f"Reported error: id={data['error_id']}, severity={data['severity']}, category={data['category']}")
        return data["error_id"]
    
    def test_report_error_with_file_path(self, auth_headers):
        """Test reporting error with file path"""
        unique_id = str(uuid.uuid4())[:8]
        error_data = {
            "error_type": f"TypeError_{unique_id}",
            "error_message": "Cannot read property 'map' of undefined",
            "file_path": "/src/components/ProductList.js",
            "line_number": 42,
            "source": "frontend",
            "auto_route": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json=error_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["category"] == "javascript", f"Should categorize as javascript, got {data['category']}"
        print(f"JavaScript error reported: {data['error_id']}, category={data['category']}")
    
    def test_report_error_with_stack_trace(self, auth_headers):
        """Test reporting error with stack trace"""
        unique_id = str(uuid.uuid4())[:8]
        error_data = {
            "error_type": f"RuntimeError_{unique_id}",
            "error_message": "Database connection timeout",
            "stack_trace": "Traceback (most recent call last):\n  File 'server.py', line 100\n    await db.connect()\nTimeoutError: Connection timed out",
            "source": "backend",
            "auto_route": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json=error_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["error_id"], "Should return error_id"
        print(f"Error with stack trace reported: {data['error_id']}")
    
    def test_report_critical_error(self, auth_headers):
        """Test reporting a critical error (should auto-detect severity)"""
        unique_id = str(uuid.uuid4())[:8]
        error_data = {
            "error_type": f"DatabaseCrash_{unique_id}",
            "error_message": "Critical database connection failure - server crash detected",
            "source": "system",
            "auto_route": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json=error_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should auto-detect as critical
        assert data["severity"] == "critical", f"Should detect as critical, got {data['severity']}"
        print(f"Critical error reported: {data['error_id']}, severity={data['severity']}")
        return data["error_id"]
    
    def test_report_error_with_auto_route(self, auth_headers):
        """Test reporting error with auto-routing enabled"""
        unique_id = str(uuid.uuid4())[:8]
        error_data = {
            "error_type": f"SyntaxError_{unique_id}",
            "error_message": "Unexpected token 'const'",
            "file_path": "/src/pages/Dashboard.js",
            "source": "frontend",
            "auto_route": True  # Enable auto-routing
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json=error_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["auto_routing"] == True, "Should have auto_routing enabled"
        print(f"Auto-routed error: {data['error_id']}, auto_routing={data['auto_routing']}")
    
    def test_report_error_unauthenticated(self):
        """Test report error requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            json={"error_type": "Test", "error_message": "Test"}
        )
        assert response.status_code in [401, 403], "Should require authentication"
    
    # ===========================================
    # PUT /api/orchestrator/live-errors/{id}/resolve
    # ===========================================
    
    def test_resolve_error(self, auth_headers):
        """Test resolving an error manually"""
        # First, create an error to resolve
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"TestResolve_{unique_id}",
                "error_message": "Test error to be resolved",
                "source": "user_reported",
                "auto_route": False
            }
        )
        assert create_response.status_code == 200
        error_id = create_response.json()["error_id"]
        
        # Now resolve it
        resolve_response = requests.put(
            f"{BASE_URL}/api/orchestrator/live-errors/{error_id}/resolve",
            headers=auth_headers,
            json={"resolution": "Fixed by manual investigation and code update"}
        )
        assert resolve_response.status_code == 200, f"Failed to resolve: {resolve_response.text}"
        data = resolve_response.json()
        
        assert data.get("success") == True, "Should return success=True"
        print(f"Error resolved: {error_id}")
        
        # Verify error is now fixed
        get_response = requests.get(
            f"{BASE_URL}/api/orchestrator/live-errors/{error_id}",
            headers=auth_headers
        )
        if get_response.status_code == 200:
            error = get_response.json()
            assert error.get("status") == "fixed", f"Error status should be 'fixed', got {error.get('status')}"
            assert error.get("resolved_at"), "Should have resolved_at timestamp"
            print(f"Verified error status: {error.get('status')}")
    
    def test_resolve_error_with_custom_resolution(self, auth_headers):
        """Test resolving error with custom resolution text"""
        # Create error
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"CustomResolve_{unique_id}",
                "error_message": "Test error for custom resolution",
                "auto_route": False
            }
        )
        assert create_response.status_code == 200
        error_id = create_response.json()["error_id"]
        
        # Resolve with custom resolution
        resolution_text = "Root cause was a race condition in the async handler. Fixed by adding proper await."
        resolve_response = requests.put(
            f"{BASE_URL}/api/orchestrator/live-errors/{error_id}/resolve",
            headers=auth_headers,
            json={"resolution": resolution_text}
        )
        assert resolve_response.status_code == 200
        
        # Verify resolution text is saved
        get_response = requests.get(
            f"{BASE_URL}/api/orchestrator/live-errors/{error_id}",
            headers=auth_headers
        )
        if get_response.status_code == 200:
            error = get_response.json()
            assert resolution_text in error.get("fix_result", ""), "Resolution text should be saved"
            print(f"Custom resolution saved: {error.get('fix_result')}")
    
    def test_resolve_nonexistent_error(self, auth_headers):
        """Test resolving a non-existent error"""
        fake_id = str(uuid.uuid4())
        response = requests.put(
            f"{BASE_URL}/api/orchestrator/live-errors/{fake_id}/resolve",
            headers=auth_headers,
            json={"resolution": "Test"}
        )
        # Should still return success=True as the method doesn't validate existence
        # or return 404 - behavior depends on implementation
        print(f"Resolve non-existent: status={response.status_code}")
    
    # ===========================================
    # GET /api/orchestrator/error-timeline
    # ===========================================
    
    def test_get_error_timeline_basic(self, auth_headers):
        """Test error timeline endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/error-timeline",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "timeline" in data, "Response should have 'timeline' field"
        assert "hours" in data, "Response should have 'hours' field"
        
        print(f"Error timeline: hours={data['hours']}, data_points={len(data['timeline'])}")
    
    def test_get_error_timeline_custom_hours(self, auth_headers):
        """Test error timeline with custom hours parameter"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/error-timeline",
            headers=auth_headers,
            params={"hours": 12}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["hours"] == 12, "Should respect hours parameter"
        print(f"12-hour timeline: data_points={len(data['timeline'])}")
    
    def test_get_error_timeline_unauthenticated(self):
        """Test error timeline requires authentication"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/error-timeline")
        assert response.status_code in [401, 403], "Should require authentication"
    
    # ===========================================
    # GET /api/orchestrator/live-errors/{error_id}
    # ===========================================
    
    def test_get_error_details(self, auth_headers):
        """Test getting specific error details"""
        # Create an error
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"DetailTest_{unique_id}",
                "error_message": "Test error for detail retrieval",
                "file_path": "/src/test/Test.js",
                "line_number": 100,
                "auto_route": False
            }
        )
        assert create_response.status_code == 200
        error_id = create_response.json()["error_id"]
        
        # Get error details
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/live-errors/{error_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        error = response.json()
        
        # Verify error structure
        assert error.get("error_id") == error_id, "Should return correct error_id"
        assert f"DetailTest_{unique_id}" in error.get("error_type", ""), "Should have correct error_type"
        assert error.get("file_path") == "/src/test/Test.js", "Should have file_path"
        assert error.get("line_number") == 100, "Should have line_number"
        
        print(f"Error details retrieved: {error.get('error_type')}, severity={error.get('severity')}")
    
    def test_get_error_details_not_found(self, auth_headers):
        """Test getting non-existent error returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/live-errors/{fake_id}",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Should return 404, got {response.status_code}"
    
    # ===========================================
    # PUT /api/orchestrator/live-errors/{id}/acknowledge
    # ===========================================
    
    def test_acknowledge_error(self, auth_headers):
        """Test acknowledging an error"""
        # Create an error
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"AckTest_{unique_id}",
                "error_message": "Test error for acknowledgement",
                "auto_route": False
            }
        )
        assert create_response.status_code == 200
        error_id = create_response.json()["error_id"]
        
        # Acknowledge error
        response = requests.put(
            f"{BASE_URL}/api/orchestrator/live-errors/{error_id}/acknowledge",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Should return success=True"
        print(f"Error acknowledged: {error_id}")
    
    # ===========================================
    # Integration Tests
    # ===========================================
    
    def test_full_error_lifecycle(self, auth_headers):
        """Test complete error lifecycle: report -> acknowledge -> resolve"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Step 1: Report error
        report_response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"LifecycleTest_{unique_id}",
                "error_message": "Test error for full lifecycle test",
                "file_path": "/src/lifecycle/Test.py",
                "source": "test_suite",
                "auto_route": False
            }
        )
        assert report_response.status_code == 200
        error_id = report_response.json()["error_id"]
        print(f"Step 1 - Error reported: {error_id}")
        
        # Step 2: Acknowledge error
        ack_response = requests.put(
            f"{BASE_URL}/api/orchestrator/live-errors/{error_id}/acknowledge",
            headers=auth_headers
        )
        assert ack_response.status_code == 200
        print(f"Step 2 - Error acknowledged")
        
        # Step 3: Verify error appears in live errors
        list_response = requests.get(
            f"{BASE_URL}/api/orchestrator/live-errors",
            headers=auth_headers,
            params={"limit": 100, "since_minutes": 5}
        )
        assert list_response.status_code == 200
        errors = list_response.json()["errors"]
        error_ids = [e["error_id"] for e in errors]
        assert error_id in error_ids, "Error should appear in live errors list"
        print(f"Step 3 - Error found in live errors list")
        
        # Step 4: Resolve error
        resolve_response = requests.put(
            f"{BASE_URL}/api/orchestrator/live-errors/{error_id}/resolve",
            headers=auth_headers,
            json={"resolution": "Lifecycle test completed - error resolved"}
        )
        assert resolve_response.status_code == 200
        print(f"Step 4 - Error resolved")
        
        # Step 5: Verify final state
        final_response = requests.get(
            f"{BASE_URL}/api/orchestrator/live-errors/{error_id}",
            headers=auth_headers
        )
        if final_response.status_code == 200:
            final_error = final_response.json()
            assert final_error.get("status") == "fixed", "Final status should be 'fixed'"
            assert final_error.get("resolved_at"), "Should have resolved_at timestamp"
            print(f"Step 5 - Final state verified: status={final_error.get('status')}")
        
        print("Full error lifecycle test PASSED!")


class TestLiveErrorSeverityDetection:
    """Tests for error severity auto-detection"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_critical_severity_detection(self, auth_headers):
        """Test critical severity is detected from keywords"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"ServerCrash_{unique_id}",
                "error_message": "Fatal: Server crash - memory leak detected",
                "auto_route": False
            }
        )
        assert response.status_code == 200
        assert response.json()["severity"] == "critical"
        print("Critical severity detection: PASSED")
    
    def test_high_severity_detection(self, auth_headers):
        """Test high severity is detected from keywords"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"HTTP500_{unique_id}",
                "error_message": "500 Internal Server Error on /api/users",
                "auto_route": False
            }
        )
        assert response.status_code == 200
        assert response.json()["severity"] == "high"
        print("High severity detection: PASSED")
    
    def test_medium_severity_detection(self, auth_headers):
        """Test medium severity is detected from keywords"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"TypeError_{unique_id}",
                "error_message": "TypeError: undefined is not a function",
                "auto_route": False
            }
        )
        assert response.status_code == 200
        assert response.json()["severity"] == "medium"
        print("Medium severity detection: PASSED")
    
    def test_low_severity_default(self, auth_headers):
        """Test low severity is default for unknown errors"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"MinorWarning_{unique_id}",
                "error_message": "Warning: Deprecated function usage",
                "auto_route": False
            }
        )
        assert response.status_code == 200
        assert response.json()["severity"] == "low"
        print("Low severity default: PASSED")


class TestLiveErrorCategoryRouting:
    """Tests for error category detection and routing"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_javascript_category(self, auth_headers):
        """Test JavaScript file errors are categorized correctly"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"Error_{unique_id}",
                "error_message": "Cannot read property 'length' of undefined",
                "file_path": "/src/pages/Home.js",
                "auto_route": False
            }
        )
        assert response.status_code == 200
        assert response.json()["category"] == "javascript"
        print("JavaScript category: PASSED")
    
    def test_react_category(self, auth_headers):
        """Test React errors are categorized correctly"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"ReactHookError_{unique_id}",
                "error_message": "Invalid hook call. Hooks can only be called inside of the body of a function component",
                "file_path": "/src/components/Button.jsx",
                "auto_route": False
            }
        )
        assert response.status_code == 200
        assert response.json()["category"] == "react"
        print("React category: PASSED")
    
    def test_python_category(self, auth_headers):
        """Test Python file errors are categorized correctly"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"IndentationError_{unique_id}",
                "error_message": "unexpected indentation",
                "file_path": "/app/backend/server.py",
                "auto_route": False
            }
        )
        assert response.status_code == 200
        assert response.json()["category"] == "syntax"
        print("Python/Syntax category: PASSED")
    
    def test_database_category(self, auth_headers):
        """Test database errors are categorized correctly"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=auth_headers,
            json={
                "error_type": f"MongoError_{unique_id}",
                "error_message": "MongoDB connection failed: connection refused",
                "auto_route": False
            }
        )
        assert response.status_code == 200
        assert response.json()["category"] == "database"
        print("Database category: PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
