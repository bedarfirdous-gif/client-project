"""
Enhanced AutoHeal Root Cause Detection Tests
=============================================
Tests the exact root cause classification across 8 categories:
- frontend, backend, database, network, memory, thread, async, dependency

Also tests continuous monitoring API endpoints.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://erp-invoice-fix-1.preview.emergentagent.com"

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for superadmin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get authorization headers"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestMonitoringEndpoints:
    """Tests for continuous monitoring API endpoints"""
    
    def test_monitoring_health_endpoint(self, auth_headers):
        """GET /api/monitoring/health - Check system health summary"""
        response = requests.get(f"{BASE_URL}/api/monitoring/health", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify health response structure
        assert "status" in data
        assert data["status"] in ["healthy", "degraded", "no_data"]
        print(f"✓ Monitoring health status: {data['status']}")
        
    def test_monitoring_snapshots_endpoint(self, auth_headers):
        """GET /api/monitoring/snapshots - Get monitoring snapshots"""
        response = requests.get(f"{BASE_URL}/api/monitoring/snapshots?limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "snapshots" in data
        assert "count" in data
        assert isinstance(data["snapshots"], list)
        print(f"✓ Monitoring snapshots count: {data['count']}")
        
    def test_monitoring_start_endpoint(self, auth_headers):
        """POST /api/monitoring/start - Start continuous monitoring"""
        response = requests.post(f"{BASE_URL}/api/monitoring/start", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response
        assert "message" in data
        assert "status" in data
        assert data["status"] in ["active"]
        print(f"✓ Monitoring start: {data['message']}")
        
    def test_monitoring_stop_endpoint(self, auth_headers):
        """POST /api/monitoring/stop - Stop continuous monitoring"""
        response = requests.post(f"{BASE_URL}/api/monitoring/stop", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response
        assert "message" in data
        assert "status" in data
        print(f"✓ Monitoring stop: {data['message']}")


class TestRootCauseCategories:
    """Tests for root cause category endpoint"""
    
    def test_root_cause_categories_endpoint(self, auth_headers):
        """GET /api/autoheal/root-cause-categories - Get category breakdown"""
        response = requests.get(f"{BASE_URL}/api/autoheal/root-cause-categories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "categories" in data
        assert "total" in data
        assert "category_descriptions" in data
        
        # Verify all 8 categories + unknown are described
        descriptions = data["category_descriptions"]
        expected_categories = ["frontend", "backend", "database", "network", "memory", "thread", "async", "dependency", "unknown"]
        for cat in expected_categories:
            assert cat in descriptions, f"Missing category description: {cat}"
        
        print(f"✓ Root cause categories: {len(descriptions)} categories, {data['total']} total reports")


class TestDatabaseErrorDetection:
    """Tests for database error classification"""
    
    def test_database_connection_error(self, auth_headers):
        """POST /api/autoheal/diagnose - Database connection error should be 'database' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Cannot connect to database: mongodb connection pool exhausted",
            "module": "test",
            "function": "test_db_connection"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify root cause category is database
        assert "root_cause_category" in data, "Missing root_cause_category in response"
        assert data["root_cause_category"] == "database", f"Expected 'database', got '{data['root_cause_category']}'"
        assert "component" in data
        assert "subsystem" in data
        print(f"✓ Database connection error detected as: {data['root_cause_category']} (component: {data.get('component', 'N/A')})")
        
    def test_database_query_error(self, auth_headers):
        """POST /api/autoheal/diagnose - Database query error should be 'database' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Database query failed: aggregate pipeline error on collection users",
            "module": "test",
            "function": "test_query"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "database", f"Expected 'database', got '{data['root_cause_category']}'"
        print(f"✓ Database query error detected as: {data['root_cause_category']}")


class TestMemoryErrorDetection:
    """Tests for memory error classification"""
    
    def test_memory_overflow_error(self, auth_headers):
        """POST /api/autoheal/diagnose - Memory overflow should be 'memory' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Out of memory: JavaScript heap allocation failed",
            "module": "test",
            "function": "test_memory"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "memory", f"Expected 'memory', got '{data['root_cause_category']}'"
        print(f"✓ Memory overflow error detected as: {data['root_cause_category']}")
        
    def test_memory_leak_error(self, auth_headers):
        """POST /api/autoheal/diagnose - Memory leak should be 'memory' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Memory leak detected: growing memory usage not released after gc",
            "module": "test",
            "function": "test_leak"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "memory", f"Expected 'memory', got '{data['root_cause_category']}'"
        print(f"✓ Memory leak error detected as: {data['root_cause_category']}")


class TestAsyncErrorDetection:
    """Tests for async/promise error classification"""
    
    def test_unhandled_promise_rejection(self, auth_headers):
        """POST /api/autoheal/diagnose - Unhandled promise rejection should be 'async' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Unhandled promise rejection: await operation failed in async function",
            "module": "test",
            "function": "test_async"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "async", f"Expected 'async', got '{data['root_cause_category']}'"
        print(f"✓ Unhandled promise error detected as: {data['root_cause_category']}")
        
    def test_async_timeout_error(self, auth_headers):
        """POST /api/autoheal/diagnose - Async timeout should be 'async' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Async timeout: asyncio timeout waiting for task to complete",
            "module": "test",
            "function": "test_async_timeout"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "async", f"Expected 'async', got '{data['root_cause_category']}'"
        print(f"✓ Async timeout error detected as: {data['root_cause_category']}")


class TestNetworkErrorDetection:
    """Tests for network/SSL error classification"""
    
    def test_ssl_certificate_error(self, auth_headers):
        """POST /api/autoheal/diagnose - SSL certificate error should be 'network' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "SSL certificate verify failed: handshake error",
            "module": "test",
            "function": "test_ssl"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "network", f"Expected 'network', got '{data['root_cause_category']}'"
        print(f"✓ SSL error detected as: {data['root_cause_category']}")
        
    def test_dns_resolution_error(self, auth_headers):
        """POST /api/autoheal/diagnose - DNS error should be 'network' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "DNS name resolution failed: getaddrinfo unknown host",
            "module": "test",
            "function": "test_dns"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "network", f"Expected 'network', got '{data['root_cause_category']}'"
        print(f"✓ DNS error detected as: {data['root_cause_category']}")


class TestThreadErrorDetection:
    """Tests for thread/deadlock error classification"""
    
    def test_deadlock_error(self, auth_headers):
        """POST /api/autoheal/diagnose - Deadlock error should be 'thread' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Thread deadlock detected: lock wait timeout on mutex",
            "module": "test",
            "function": "test_deadlock"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "thread", f"Expected 'thread', got '{data['root_cause_category']}'"
        print(f"✓ Deadlock error detected as: {data['root_cause_category']}")
        
    def test_race_condition_error(self, auth_headers):
        """POST /api/autoheal/diagnose - Race condition should be 'thread' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Race condition detected: concurrent modification exception",
            "module": "test",
            "function": "test_race"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "thread", f"Expected 'thread', got '{data['root_cause_category']}'"
        print(f"✓ Race condition error detected as: {data['root_cause_category']}")


class TestDependencyErrorDetection:
    """Tests for dependency/import error classification"""
    
    def test_missing_module_error(self, auth_headers):
        """POST /api/autoheal/diagnose - Missing module should be 'dependency' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "No module named 'some_package': pip install required",
            "module": "test",
            "function": "test_import"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "dependency", f"Expected 'dependency', got '{data['root_cause_category']}'"
        print(f"✓ Missing module error detected as: {data['root_cause_category']}")
        
    def test_version_mismatch_error(self, auth_headers):
        """POST /api/autoheal/diagnose - Version mismatch should be 'dependency' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Version incompatible: package requires newer version, breaking change",
            "module": "test",
            "function": "test_version"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "dependency", f"Expected 'dependency', got '{data['root_cause_category']}'"
        print(f"✓ Version mismatch error detected as: {data['root_cause_category']}")


class TestFrontendErrorDetection:
    """Tests for frontend/React error classification"""
    
    def test_react_render_error(self, auth_headers):
        """POST /api/autoheal/diagnose - React render error should be 'frontend' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "React component render error: cannot read property of undefined in jsx",
            "module": "frontend",
            "function": "ComponentRender"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "frontend", f"Expected 'frontend', got '{data['root_cause_category']}'"
        print(f"✓ React render error detected as: {data['root_cause_category']}")
        
    def test_state_management_error(self, auth_headers):
        """POST /api/autoheal/diagnose - State management error should be 'frontend' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Redux state error: cannot dispatch action, useReducer failed",
            "module": "frontend",
            "function": "StateUpdate"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "frontend", f"Expected 'frontend', got '{data['root_cause_category']}'"
        print(f"✓ State management error detected as: {data['root_cause_category']}")


class TestBackendErrorDetection:
    """Tests for backend logic error classification"""
    
    def test_api_handler_error(self, auth_headers):
        """POST /api/autoheal/diagnose - API handler error should be 'backend' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "API endpoint failed: http error 500 internal server",
            "module": "backend",
            "function": "api_handler"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "backend", f"Expected 'backend', got '{data['root_cause_category']}'"
        print(f"✓ API handler error detected as: {data['root_cause_category']}")
        
    def test_authentication_error(self, auth_headers):
        """POST /api/autoheal/diagnose - Auth error should be 'backend' category"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Authentication failed: JWT token invalid, unauthorized 401",
            "module": "backend",
            "function": "auth_middleware"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "root_cause_category" in data
        assert data["root_cause_category"] == "backend", f"Expected 'backend', got '{data['root_cause_category']}'"
        print(f"✓ Authentication error detected as: {data['root_cause_category']}")


class TestDiagnoseResponseStructure:
    """Tests for diagnose endpoint response structure"""
    
    def test_diagnose_response_has_required_fields(self, auth_headers):
        """POST /api/autoheal/diagnose - Verify response has root_cause_category, component, subsystem"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Test error for response validation",
            "module": "test",
            "function": "test_response"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields
        required_fields = ["root_cause_category", "component", "subsystem", "error_type", 
                          "severity", "root_cause", "root_cause_confidence", "resolved", 
                          "escalated", "recommendations", "resolution_time_ms"]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"✓ Diagnose response has all required fields: root_cause_category={data['root_cause_category']}, component={data['component']}, subsystem={data['subsystem']}")
        
    def test_diagnose_response_fix_applied(self, auth_headers):
        """POST /api/autoheal/diagnose - Verify fix_applied structure"""
        response = requests.post(f"{BASE_URL}/api/autoheal/diagnose", headers=auth_headers, json={
            "error_message": "Database connection reset",
            "module": "test",
            "function": "test_fix"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify fix_applied structure if present
        if data.get("fix_applied"):
            fix = data["fix_applied"]
            fix_fields = ["fix_type", "description", "status", "confidence"]
            for field in fix_fields:
                assert field in fix, f"Missing fix_applied field: {field}"
        
        print(f"✓ Diagnose response fix_applied structure is valid")


class TestAutoHealReportsAndStats:
    """Tests for AutoHeal reports and stats endpoints"""
    
    def test_autoheal_reports_endpoint(self, auth_headers):
        """GET /api/autoheal/reports - Get healing reports"""
        response = requests.get(f"{BASE_URL}/api/autoheal/reports?limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ AutoHeal reports count: {len(data)}")
        
    def test_autoheal_stats_endpoint(self, auth_headers):
        """GET /api/autoheal/stats - Get healing statistics"""
        response = requests.get(f"{BASE_URL}/api/autoheal/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "today" in data
        assert "week" in data
        print(f"✓ AutoHeal stats: Today={data['today']}, Week={data['week']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
