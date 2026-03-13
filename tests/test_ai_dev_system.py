"""
AI Development System API Tests
Tests the AI Dev Studio endpoints: templates, generate, modules, sandbox, tests, deploy
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://erp-invoice-fix-1.preview.emergentagent.com')

# Super Admin Credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "admin123"

# Test data
TEST_MODULE_ID = None
TEST_SANDBOX_ID = None


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for superadmin"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="module")
def api_headers(auth_token):
    """Create headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestAIDevTemplates:
    """Test AI Dev templates endpoint"""
    
    def test_get_templates_success(self, api_headers):
        """GET /api/superadmin/ai-dev/templates - Returns templates list"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/templates",
            headers=api_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "templates" in data
        print(f"✓ Templates endpoint returns {len(data['templates'])} templates")
    
    def test_templates_count_is_6(self, api_headers):
        """GET /api/superadmin/ai-dev/templates - Returns exactly 6 templates"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/templates",
            headers=api_headers
        )
        data = response.json()
        assert len(data["templates"]) == 6, f"Expected 6 templates, got {len(data['templates'])}"
        print(f"✓ Exactly 6 templates returned: crud, report, dashboard, settings, workflow, integration")
    
    def test_templates_have_required_fields(self, api_headers):
        """GET /api/superadmin/ai-dev/templates - Each template has required fields"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/templates",
            headers=api_headers
        )
        data = response.json()
        required_fields = ["type", "name", "description", "example_prompt", "required_fields"]
        
        for template in data["templates"]:
            for field in required_fields:
                assert field in template, f"Template missing field: {field}"
        print(f"✓ All templates have required fields: {required_fields}")
    
    def test_templates_types_correct(self, api_headers):
        """GET /api/superadmin/ai-dev/templates - Template types are correct"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/templates",
            headers=api_headers
        )
        data = response.json()
        expected_types = {"crud", "report", "dashboard", "settings", "workflow", "integration"}
        actual_types = {t["type"] for t in data["templates"]}
        
        assert actual_types == expected_types, f"Expected types {expected_types}, got {actual_types}"
        print(f"✓ All expected template types present: {expected_types}")


class TestAIDevModulesList:
    """Test AI Dev modules listing"""
    
    def test_list_modules_success(self, api_headers):
        """GET /api/superadmin/ai-dev/modules - Returns modules list"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/modules",
            headers=api_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "modules" in data
        print(f"✓ Modules list endpoint returns {len(data['modules'])} modules")
    
    def test_existing_module_in_list(self, api_headers):
        """GET /api/superadmin/ai-dev/modules - NotificationSettings module exists"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/modules",
            headers=api_headers
        )
        data = response.json()
        module_names = [m["name"] for m in data["modules"]]
        assert "NotificationSettings" in module_names, "Pre-existing NotificationSettings module not found"
        print(f"✓ NotificationSettings module found in list")
    
    def test_module_has_required_fields(self, api_headers):
        """GET /api/superadmin/ai-dev/modules - Modules have required fields"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/modules",
            headers=api_headers
        )
        data = response.json()
        
        if data["modules"]:
            module = data["modules"][0]
            required_fields = ["id", "name", "description", "module_type", "status", "files", "created_at"]
            for field in required_fields:
                assert field in module, f"Module missing field: {field}"
            print(f"✓ Modules have required fields: {required_fields}")


class TestAIDevModuleDetails:
    """Test AI Dev module details endpoint"""
    
    def test_get_module_by_id(self, api_headers):
        """GET /api/superadmin/ai-dev/modules/{id} - Returns module details"""
        module_id = "ee616750-3fac-4d5d-ad6b-98dc6ac6b14d"
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/modules/{module_id}",
            headers=api_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == module_id
        assert data["name"] == "NotificationSettings"
        print(f"✓ Module details returned for ID: {module_id}")
    
    def test_module_has_files(self, api_headers):
        """GET /api/superadmin/ai-dev/modules/{id} - Module contains generated files"""
        module_id = "ee616750-3fac-4d5d-ad6b-98dc6ac6b14d"
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/modules/{module_id}",
            headers=api_headers
        )
        data = response.json()
        assert "files" in data
        assert len(data["files"]) >= 2, "Expected at least frontend and backend files"
        
        file_types = [f["code_type"] for f in data["files"]]
        assert "frontend" in file_types, "No frontend file found"
        assert "backend" in file_types, "No backend file found"
        print(f"✓ Module has {len(data['files'])} generated files (frontend + backend)")
    
    def test_module_has_api_endpoints(self, api_headers):
        """GET /api/superadmin/ai-dev/modules/{id} - Module has API endpoints defined"""
        module_id = "ee616750-3fac-4d5d-ad6b-98dc6ac6b14d"
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/modules/{module_id}",
            headers=api_headers
        )
        data = response.json()
        assert "api_endpoints" in data
        assert len(data["api_endpoints"]) >= 1
        
        for endpoint in data["api_endpoints"]:
            assert "method" in endpoint
            assert "path" in endpoint
        print(f"✓ Module has {len(data['api_endpoints'])} API endpoints defined")
    
    def test_nonexistent_module_returns_404(self, api_headers):
        """GET /api/superadmin/ai-dev/modules/{id} - Non-existent module returns 404"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/superadmin/ai-dev/modules/{fake_id}",
            headers=api_headers
        )
        assert response.status_code == 404
        print(f"✓ Non-existent module returns 404")


class TestAIDevSandbox:
    """Test AI Dev sandbox creation and testing"""
    
    def test_create_sandbox(self, api_headers):
        """POST /api/superadmin/ai-dev/modules/{id}/sandbox - Creates sandbox"""
        global TEST_SANDBOX_ID
        module_id = "ee616750-3fac-4d5d-ad6b-98dc6ac6b14d"
        response = requests.post(
            f"{BASE_URL}/api/superadmin/ai-dev/modules/{module_id}/sandbox",
            headers=api_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "sandbox" in data
        assert data["sandbox"]["module_id"] == module_id
        assert data["sandbox"]["status"] == "created"
        TEST_SANDBOX_ID = data["sandbox"]["id"]
        print(f"✓ Sandbox created with ID: {TEST_SANDBOX_ID}")
    
    def test_run_sandbox_tests(self, api_headers):
        """POST /api/superadmin/ai-dev/sandbox/{id}/test - Runs tests"""
        global TEST_SANDBOX_ID
        if not TEST_SANDBOX_ID:
            # Create sandbox first
            module_id = "ee616750-3fac-4d5d-ad6b-98dc6ac6b14d"
            response = requests.post(
                f"{BASE_URL}/api/superadmin/ai-dev/modules/{module_id}/sandbox",
                headers=api_headers
            )
            TEST_SANDBOX_ID = response.json()["sandbox"]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/ai-dev/sandbox/{TEST_SANDBOX_ID}/test",
            headers=api_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "tests" in data
        assert "passed" in data
        assert "failed" in data
        print(f"✓ Sandbox tests completed: {data['passed']} passed, {data['failed']} failed")
    
    def test_sandbox_tests_results_structure(self, api_headers):
        """POST /api/superadmin/ai-dev/sandbox/{id}/test - Test results have proper structure"""
        global TEST_SANDBOX_ID
        if not TEST_SANDBOX_ID:
            pytest.skip("No sandbox ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/ai-dev/sandbox/{TEST_SANDBOX_ID}/test",
            headers=api_headers
        )
        data = response.json()
        
        for test in data["tests"]:
            assert "name" in test
            assert "status" in test
            assert test["status"] in ["passed", "failed", "warning"]
        print(f"✓ Test results have proper structure with name and status")


class TestAIDevAuth:
    """Test authentication requirements for AI Dev endpoints"""
    
    def test_templates_requires_auth(self):
        """GET /api/superadmin/ai-dev/templates - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/superadmin/ai-dev/templates")
        assert response.status_code in [401, 403]
        print(f"✓ Templates endpoint requires authentication")
    
    def test_modules_requires_auth(self):
        """GET /api/superadmin/ai-dev/modules - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/superadmin/ai-dev/modules")
        assert response.status_code in [401, 403]
        print(f"✓ Modules endpoint requires authentication")
    
    def test_generate_requires_superadmin(self, api_headers):
        """POST /api/superadmin/ai-dev/generate - Only superadmin can generate"""
        # This test validates that the endpoint exists and requires proper auth
        # A non-superadmin would get 403
        response = requests.post(
            f"{BASE_URL}/api/superadmin/ai-dev/generate",
            headers=api_headers,
            json={
                "prompt": "Test module",
                "module_name": "TEST_SKIP",
                "module_type": "custom"
            }
        )
        # Should be accepted (200) or validation error (422), not auth error (401/403)
        assert response.status_code not in [401, 403], "Superadmin should have access"
        print(f"✓ Generate endpoint accepts superadmin requests")


class TestAIDevModuleGeneration:
    """Test module generation (Note: This uses real LLM API and may take time)"""
    
    @pytest.mark.skip(reason="Module generation uses real LLM API and takes 30-60 seconds")
    def test_generate_simple_module(self, api_headers):
        """POST /api/superadmin/ai-dev/generate - Generates a simple module"""
        global TEST_MODULE_ID
        response = requests.post(
            f"{BASE_URL}/api/superadmin/ai-dev/generate",
            headers=api_headers,
            json={
                "prompt": "Create a simple test module with a hello world endpoint",
                "module_name": "TEST_HelloWorld",
                "module_type": "custom",
                "description": "Test module for automated testing",
                "include_frontend": True,
                "include_backend": True,
                "include_database": False
            },
            timeout=120  # LLM generation can take time
        )
        assert response.status_code == 200
        data = response.json()
        assert "module" in data
        assert data["module"]["status"] in ["generated", "generating"]
        TEST_MODULE_ID = data["module"]["id"]
        print(f"✓ Module generated with ID: {TEST_MODULE_ID}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
