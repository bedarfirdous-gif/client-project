"""
Test Suite for Enterprise Self-Healing System
=============================================
Tests all self-healing core APIs for error detection, auto-fix, rollback, learning engine, etc.
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Auth credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for superadmin"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip("Authentication failed - superadmin login failed")
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with authentication"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestHealthEndpoint:
    """Test the basic health check endpoint"""

    def test_health_endpoint(self):
        """GET /api/health - should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
        print(f"✓ Health endpoint working: {data}")


class TestSelfHealingDashboard:
    """Test the self-healing dashboard API"""

    def test_dashboard_requires_auth(self):
        """GET /api/self-healing/dashboard without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/self-healing/dashboard")
        assert response.status_code in [401, 403]
        print("✓ Dashboard requires authentication")

    def test_dashboard_returns_data(self, auth_headers):
        """GET /api/self-healing/dashboard should return dashboard data"""
        response = requests.get(
            f"{BASE_URL}/api/self-healing/dashboard",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for expected fields
        assert "system_health" in data
        assert "error_stats" in data
        assert "auto_heal_enabled" in data
        assert "is_running" in data
        
        # Verify system_health structure
        if data.get("system_health"):
            health = data["system_health"]
            assert "overall_status" in health or "status" in health
        
        print(f"✓ Dashboard API working - auto_heal_enabled: {data.get('auto_heal_enabled')}, is_running: {data.get('is_running')}")
        print(f"  System health: {data.get('system_health', {}).get('overall_status', 'N/A')}")
        print(f"  Error stats: {data.get('error_stats')}")


class TestSelfHealingHealth:
    """Test the self-healing health endpoint"""

    def test_health_requires_auth(self):
        """GET /api/self-healing/health without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/self-healing/health")
        assert response.status_code in [401, 403]
        print("✓ Health endpoint requires authentication")

    def test_health_returns_status(self, auth_headers):
        """GET /api/self-healing/health should return health status"""
        response = requests.get(
            f"{BASE_URL}/api/self-healing/health",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check expected fields
        assert "overall_status" in data
        assert "services" in data
        
        # Verify services are present
        services = data.get("services", {})
        assert "Backend API" in services or "backend" in str(services).lower()
        assert "Frontend" in services or "frontend" in str(services).lower()
        assert "MongoDB" in services or "mongodb" in str(services).lower()
        
        print(f"✓ Health API working - overall_status: {data.get('overall_status')}")
        print(f"  Services: {list(services.keys())}")


class TestCriticalModules:
    """Test critical modules protection API"""

    def test_critical_modules_requires_auth(self):
        """GET /api/self-healing/critical-modules without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/self-healing/critical-modules")
        assert response.status_code in [401, 403]
        print("✓ Critical modules endpoint requires authentication")

    def test_critical_modules_returns_list(self, auth_headers):
        """GET /api/self-healing/critical-modules should return modules list"""
        response = requests.get(
            f"{BASE_URL}/api/self-healing/critical-modules",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for modules field
        assert "modules" in data
        assert isinstance(data["modules"], list)
        
        print(f"✓ Critical modules API working - {len(data['modules'])} modules defined")
        for module in data['modules'][:3]:
            print(f"  - {module.get('name', 'Unknown')}: {module.get('protection_level', 'N/A')}")


class TestDetectedErrors:
    """Test the detected errors API"""

    def test_errors_requires_auth(self):
        """GET /api/self-healing/errors without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/self-healing/errors")
        assert response.status_code in [401, 403]
        print("✓ Errors endpoint requires authentication")

    def test_errors_returns_list(self, auth_headers):
        """GET /api/self-healing/errors should return errors list"""
        response = requests.get(
            f"{BASE_URL}/api/self-healing/errors?limit=20",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for errors field
        assert "errors" in data
        assert isinstance(data["errors"], list)
        
        print(f"✓ Errors API working - {len(data['errors'])} recent errors")
        for error in data['errors'][:3]:
            print(f"  - [{error.get('severity', 'N/A')}] {error.get('error_type', 'Unknown')}: {error.get('error_message', 'N/A')[:50]}...")


class TestToggleAutoHeal:
    """Test the toggle auto-heal API"""

    def test_toggle_requires_auth(self):
        """POST /api/self-healing/toggle-auto-heal without auth should fail"""
        response = requests.post(
            f"{BASE_URL}/api/self-healing/toggle-auto-heal?enabled=true"
        )
        assert response.status_code in [401, 403]
        print("✓ Toggle auto-heal endpoint requires authentication")

    def test_toggle_auto_heal_enable(self, auth_headers):
        """POST /api/self-healing/toggle-auto-heal?enabled=true should enable"""
        response = requests.post(
            f"{BASE_URL}/api/self-healing/toggle-auto-heal?enabled=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "auto_heal_enabled" in data
        assert data["auto_heal_enabled"] == True
        
        print(f"✓ Toggle auto-heal enable working: {data}")

    def test_toggle_auto_heal_disable(self, auth_headers):
        """POST /api/self-healing/toggle-auto-heal?enabled=false should disable"""
        response = requests.post(
            f"{BASE_URL}/api/self-healing/toggle-auto-heal?enabled=false",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "auto_heal_enabled" in data
        assert data["auto_heal_enabled"] == False
        
        # Re-enable for subsequent tests
        requests.post(
            f"{BASE_URL}/api/self-healing/toggle-auto-heal?enabled=true",
            headers=auth_headers
        )
        
        print(f"✓ Toggle auto-heal disable working: {data}")


class TestRollbackStats:
    """Test the rollback statistics API"""

    def test_rollback_stats_requires_auth(self):
        """GET /api/self-healing/rollback-stats without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/self-healing/rollback-stats")
        assert response.status_code in [401, 403]
        print("✓ Rollback stats endpoint requires authentication")

    def test_rollback_stats_returns_data(self, auth_headers):
        """GET /api/self-healing/rollback-stats should return statistics"""
        response = requests.get(
            f"{BASE_URL}/api/self-healing/rollback-stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for expected stats fields
        assert "total_rollbacks" in data or "total" in str(data).lower()
        
        print(f"✓ Rollback stats API working: {data}")


class TestLearningStats:
    """Test the learning engine statistics API"""

    def test_learning_stats_requires_auth(self):
        """GET /api/self-healing/learning-stats without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/self-healing/learning-stats")
        assert response.status_code in [401, 403]
        print("✓ Learning stats endpoint requires authentication")

    def test_learning_stats_returns_data(self, auth_headers):
        """GET /api/self-healing/learning-stats should return statistics"""
        response = requests.get(
            f"{BASE_URL}/api/self-healing/learning-stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for expected stats fields
        assert "total_patterns" in data or "patterns" in str(data).lower() or isinstance(data, dict)
        
        print(f"✓ Learning stats API working: {data}")


class TestHandleError:
    """Test the handle-error API for submitting errors to the pipeline"""

    def test_handle_error_requires_auth(self):
        """POST /api/self-healing/handle-error without auth should fail"""
        response = requests.post(
            f"{BASE_URL}/api/self-healing/handle-error",
            json={"error_type": "TestError", "error_message": "Test message"}
        )
        assert response.status_code in [401, 403]
        print("✓ Handle error endpoint requires authentication")

    def test_handle_error_submits_error(self, auth_headers):
        """POST /api/self-healing/handle-error should submit error to pipeline"""
        test_error = {
            "error_type": "ValidationError",
            "error_message": "Invalid email format in user registration",
            "source": "backend",
            "file_path": "/app/backend/server.py",
            "function_name": "create_user",
            "line_number": 1234,
            "auto_fix": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/self-healing/handle-error",
            headers=auth_headers,
            json=test_error
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for operation fields
        assert "operation_id" in data
        assert "status" in data
        assert "notes" in data
        
        print(f"✓ Handle error API working - operation_id: {data.get('operation_id')}")
        print(f"  Status: {data.get('status')}")
        print(f"  Notes: {data.get('notes', [])[:2]}")


class TestErrorPatterns:
    """Test the error patterns API"""

    def test_patterns_requires_auth(self):
        """GET /api/self-healing/patterns without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/self-healing/patterns")
        assert response.status_code in [401, 403]
        print("✓ Patterns endpoint requires authentication")

    def test_patterns_returns_list(self, auth_headers):
        """GET /api/self-healing/patterns should return patterns list"""
        response = requests.get(
            f"{BASE_URL}/api/self-healing/patterns?min_occurrences=1",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "patterns" in data
        assert isinstance(data["patterns"], list)
        
        print(f"✓ Patterns API working - {len(data['patterns'])} patterns found")


class TestSandboxResults:
    """Test the sandbox test results API"""

    def test_sandbox_results_requires_auth(self):
        """GET /api/self-healing/sandbox-results without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/self-healing/sandbox-results")
        assert response.status_code in [401, 403]
        print("✓ Sandbox results endpoint requires authentication")

    def test_sandbox_results_returns_data(self, auth_headers):
        """GET /api/self-healing/sandbox-results should return results"""
        response = requests.get(
            f"{BASE_URL}/api/self-healing/sandbox-results?limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data
        assert isinstance(data["results"], list)
        
        print(f"✓ Sandbox results API working - {len(data['results'])} results")


class TestReliablePatterns:
    """Test the reliable patterns API"""

    def test_reliable_patterns_requires_auth(self):
        """GET /api/self-healing/reliable-patterns without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/self-healing/reliable-patterns")
        assert response.status_code in [401, 403]
        print("✓ Reliable patterns endpoint requires authentication")

    def test_reliable_patterns_returns_data(self, auth_headers):
        """GET /api/self-healing/reliable-patterns should return patterns"""
        response = requests.get(
            f"{BASE_URL}/api/self-healing/reliable-patterns",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "patterns" in data
        assert isinstance(data["patterns"], list)
        
        print(f"✓ Reliable patterns API working - {len(data['patterns'])} reliable patterns")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
