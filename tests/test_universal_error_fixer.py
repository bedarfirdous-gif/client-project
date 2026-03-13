"""
Test Universal Error Fixer AI Agent API Endpoints

Tests the following features:
- /api/universal-fixer/dashboard - Dashboard data retrieval
- /api/universal-fixer/scan - Full error scanning
- /api/universal-fixer/start-monitoring - Start monitoring
- /api/universal-fixer/stop-monitoring - Stop monitoring
- /api/universal-fixer/clear - Clear errors
- /api/universal-fixer/stats - Get statistics
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Return headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestUniversalErrorFixerDashboard:
    """Test Universal Error Fixer Dashboard endpoint"""
    
    def test_dashboard_returns_correct_structure(self, headers):
        """Dashboard endpoint returns expected data structure"""
        response = requests.get(f"{BASE_URL}/api/universal-fixer/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "agent_name" in data, "Missing agent_name field"
        assert "model" in data, "Missing model field"
        assert "status" in data, "Missing status field"
        assert "is_monitoring" in data, "Missing is_monitoring field"
        assert "stats" in data, "Missing stats field"
        
        # Verify agent info
        assert data["agent_name"] == "Universal Error Fixer"
        assert data["model"] == "Gemini 3 Flash"
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_errors" in stats
        assert "by_category" in stats
        assert "by_source" in stats
        assert "fixes_applied" in stats
        assert "fixes_verified" in stats
        assert "auto_fix_rate" in stats
        
        print(f"Dashboard returned: agent={data['agent_name']}, model={data['model']}, status={data['status']}")
    
    def test_dashboard_error_categories_present(self, headers):
        """Dashboard includes all error categories (404, 502, runtime, type_error, systematic)"""
        response = requests.get(f"{BASE_URL}/api/universal-fixer/dashboard", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        by_category = data["stats"]["by_category"]
        
        # Verify all error categories are tracked
        expected_categories = ["http_404", "http_502", "http_500", "runtime", "type_error", "systematic"]
        for category in expected_categories:
            assert category in by_category, f"Missing category: {category}"
        
        print(f"Categories tracked: {list(by_category.keys())}")
    
    def test_dashboard_error_sources_present(self, headers):
        """Dashboard includes all error sources (frontend, backend, api, database)"""
        response = requests.get(f"{BASE_URL}/api/universal-fixer/dashboard", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        by_source = data["stats"]["by_source"]
        
        expected_sources = ["frontend", "backend", "api", "database"]
        for source in expected_sources:
            assert source in by_source, f"Missing source: {source}"
        
        print(f"Sources tracked: {list(by_source.keys())}")


class TestUniversalErrorFixerScan:
    """Test Universal Error Fixer Scan endpoint"""
    
    def test_scan_runs_successfully(self, headers):
        """Scan endpoint runs and returns result structure"""
        response = requests.post(f"{BASE_URL}/api/universal-fixer/scan", headers=headers)
        
        assert response.status_code == 200, f"Scan failed: {response.text}"
        data = response.json()
        
        # Verify scan result structure
        assert "success" in data, "Missing success field"
        assert data["success"] == True, "Scan did not succeed"
        assert "scan_time" in data, "Missing scan_time field"
        assert "errors" in data, "Missing errors field"
        assert "fixes" in data, "Missing fixes field"
        assert "stats" in data, "Missing stats field"
        
        # Verify errors breakdown
        errors = data["errors"]
        assert "total" in errors
        assert "http" in errors
        assert "runtime" in errors
        
        print(f"Scan result: total_errors={errors['total']}, http={errors['http']}, runtime={errors['runtime']}")
    
    def test_scan_returns_fix_details(self, headers):
        """Scan endpoint returns fix details when errors found"""
        response = requests.post(f"{BASE_URL}/api/universal-fixer/scan", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify fixes structure
        fixes = data["fixes"]
        assert "generated" in fixes
        assert "auto_applied" in fixes
        
        # If there are fix details, verify structure
        if "fix_details" in data and len(data["fix_details"]) > 0:
            fix = data["fix_details"][0]
            assert "id" in fix
            assert "error_id" in fix
            assert "confidence" in fix
            
            print(f"Fix details found: {len(data['fix_details'])} fixes")
        else:
            print("No fix details in scan result (clean system)")


class TestUniversalErrorFixerMonitoring:
    """Test Universal Error Fixer Monitoring endpoints"""
    
    def test_start_monitoring_succeeds(self, headers):
        """Start monitoring endpoint works correctly"""
        response = requests.post(f"{BASE_URL}/api/universal-fixer/start-monitoring?interval=30", headers=headers)
        
        assert response.status_code == 200, f"Start monitoring failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "is_monitoring" in data
        # It should either start or report already active
        assert data["is_monitoring"] == True
        
        print(f"Start monitoring result: {data['message']}")
    
    def test_stop_monitoring_succeeds(self, headers):
        """Stop monitoring endpoint works correctly"""
        response = requests.post(f"{BASE_URL}/api/universal-fixer/stop-monitoring", headers=headers)
        
        assert response.status_code == 200, f"Stop monitoring failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert data["message"] == "Universal monitoring stopped"
        assert data["is_monitoring"] == False
        
        print(f"Stop monitoring result: {data['message']}")
    
    def test_toggle_monitoring_updates_status(self, headers):
        """Toggling monitoring updates the status correctly"""
        # Stop first to ensure clean state
        requests.post(f"{BASE_URL}/api/universal-fixer/stop-monitoring", headers=headers)
        
        # Check dashboard - should be idle
        response = requests.get(f"{BASE_URL}/api/universal-fixer/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_monitoring"] == False, "Should be idle after stop"
        assert data["status"] == "idle"
        
        # Start monitoring
        response = requests.post(f"{BASE_URL}/api/universal-fixer/start-monitoring?interval=30", headers=headers)
        assert response.status_code == 200
        
        # Check dashboard - should be monitoring
        response = requests.get(f"{BASE_URL}/api/universal-fixer/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_monitoring"] == True, "Should be monitoring after start"
        assert data["status"] == "monitoring"
        
        # Stop for cleanup
        requests.post(f"{BASE_URL}/api/universal-fixer/stop-monitoring", headers=headers)
        
        print("Monitoring toggle test passed")


class TestUniversalErrorFixerClear:
    """Test Universal Error Fixer Clear endpoint"""
    
    def test_clear_errors_succeeds(self, headers):
        """Clear errors endpoint works correctly"""
        response = requests.post(f"{BASE_URL}/api/universal-fixer/clear", headers=headers)
        
        assert response.status_code == 200, f"Clear failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert data["message"] == "All errors cleared"
        
        print("Clear errors succeeded")
    
    def test_clear_resets_stats(self, headers):
        """Clearing errors resets the statistics"""
        # Clear errors
        response = requests.post(f"{BASE_URL}/api/universal-fixer/clear", headers=headers)
        assert response.status_code == 200
        
        # Check dashboard
        response = requests.get(f"{BASE_URL}/api/universal-fixer/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Stats should be reset
        stats = data["stats"]
        assert stats["total_errors"] == 0, "Total errors should be 0 after clear"
        
        # Error categories should be 0
        for category, count in stats["by_category"].items():
            assert count == 0, f"Category {category} should be 0 after clear"
        
        print("Stats reset after clear")


class TestUniversalErrorFixerStats:
    """Test Universal Error Fixer Stats endpoint"""
    
    def test_stats_endpoint_returns_data(self, headers):
        """Stats endpoint returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/universal-fixer/stats", headers=headers)
        
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "total_errors" in data
        assert "by_category" in data
        assert "by_source" in data
        assert "fixes_applied" in data
        assert "fixes_verified" in data
        assert "fixes_rolled_back" in data
        assert "auto_fix_rate" in data
        
        print(f"Stats: total_errors={data['total_errors']}, fixes_applied={data['fixes_applied']}")


class TestUniversalErrorFixerAuth:
    """Test Universal Error Fixer requires authentication"""
    
    def test_dashboard_requires_auth(self):
        """Dashboard endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/universal-fixer/dashboard")
        assert response.status_code in [401, 403], "Should require auth"
    
    def test_scan_requires_auth(self):
        """Scan endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/universal-fixer/scan")
        assert response.status_code in [401, 403], "Should require auth"
    
    def test_monitoring_requires_auth(self):
        """Monitoring endpoints require authentication"""
        response = requests.post(f"{BASE_URL}/api/universal-fixer/start-monitoring")
        assert response.status_code in [401, 403], "Should require auth"
        
        response = requests.post(f"{BASE_URL}/api/universal-fixer/stop-monitoring")
        assert response.status_code in [401, 403], "Should require auth"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
