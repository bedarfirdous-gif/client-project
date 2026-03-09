"""
Test P0 Enhancements:
1. UI Blink Agent auto-config, enable-auto, webhook endpoints
2. Error AutoFix scan-all, scan-api, scan-login endpoints
3. Performance Agent code-splitting, asset-analysis, full-optimization endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "bedarfirdous@gmail.com"
TEST_PASSWORD = "test123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    # Try superadmin if user login fails
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "superadmin@bijnisbooks.com", "password": "Test@1234"}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


# ==================== UI BLINK AGENT TESTS ====================

class TestUIBlinkAutoConfig:
    """Test UI Blink Agent auto-config endpoint"""
    
    def test_get_auto_config(self, api_client):
        """GET /api/ui-blink/auto-config - Get auto-fix configuration"""
        response = api_client.get(f"{BASE_URL}/api/ui-blink/auto-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "enabled" in data, "Response should contain 'enabled' field"
        assert "auto_apply_safe_fixes" in data, "Response should contain 'auto_apply_safe_fixes' field"
        assert "webhook_enabled" in data or "scan_on_change" in data, "Response should contain webhook/scan config"
        print(f"SUCCESS: auto-config returned: enabled={data.get('enabled')}")


class TestUIBlinkEnableAuto:
    """Test UI Blink Agent enable-auto endpoint"""
    
    def test_enable_auto_mode(self, api_client):
        """POST /api/ui-blink/enable-auto - Enable automatic mode"""
        response = api_client.post(
            f"{BASE_URL}/api/ui-blink/enable-auto",
            json={"enable": True, "apply_safe_only": True}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify configuration was updated - response contains 'auto_mode' nested object or direct fields
        if "auto_mode" in data:
            assert data["auto_mode"].get("enabled") == True, "auto_mode should be enabled"
            print(f"SUCCESS: auto mode enabled: {data['auto_mode'].get('enabled')}")
        else:
            assert "enabled" in data, "Response should contain 'enabled' field"
            print(f"SUCCESS: auto mode enabled: {data.get('enabled')}")
    
    def test_disable_auto_mode(self, api_client):
        """POST /api/ui-blink/enable-auto - Disable automatic mode"""
        response = api_client.post(
            f"{BASE_URL}/api/ui-blink/enable-auto",
            json={"enable": False}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"SUCCESS: auto mode toggled: enabled={data.get('enabled')}")


class TestUIBlinkWebhook:
    """Test UI Blink Agent webhook endpoint"""
    
    def test_webhook_trigger_disabled(self, api_client):
        """POST /api/ui-blink/webhook - Webhook trigger when disabled"""
        # First ensure auto mode is disabled
        api_client.post(
            f"{BASE_URL}/api/ui-blink/enable-auto",
            json={"enable": False}
        )
        
        response = api_client.post(
            f"{BASE_URL}/api/ui-blink/webhook",
            json={
                "files_changed": ["/app/frontend/src/App.js"],
                "trigger_type": "manual"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # When disabled, should return skipped status
        assert "status" in data, "Response should contain 'status' field"
        print(f"SUCCESS: webhook response status: {data.get('status')}")
    
    def test_webhook_trigger_enabled(self, api_client):
        """POST /api/ui-blink/webhook - Webhook trigger when enabled"""
        # Enable auto mode first
        api_client.post(
            f"{BASE_URL}/api/ui-blink/enable-auto",
            json={"enable": True, "apply_safe_only": True}
        )
        
        response = api_client.post(
            f"{BASE_URL}/api/ui-blink/webhook",
            json={
                "files_changed": ["/app/frontend/src/components/RestockAlertsPanel.js"],
                "trigger_type": "push"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status' field"
        assert "timestamp" in data, "Response should contain 'timestamp' field"
        print(f"SUCCESS: webhook processed - status: {data.get('status')}, scan_results: {data.get('scan_results')}")
        
        # Disable auto mode after test
        api_client.post(
            f"{BASE_URL}/api/ui-blink/enable-auto",
            json={"enable": False}
        )


# ==================== ERROR AUTOFIX TESTS ====================

class TestErrorAutoFixScanAll:
    """Test Error AutoFix scan-all endpoint"""
    
    def test_scan_all_errors(self, api_client):
        """POST /api/error-autofix/scan-all - Scan all error types"""
        response = api_client.post(f"{BASE_URL}/api/error-autofix/scan-all")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "timestamp" in data, "Response should contain 'timestamp' field"
        assert "total_issues" in data or "frontend_scan" in data, "Response should contain scan results"
        
        if "frontend_scan" in data:
            print(f"SUCCESS: scan-all completed - frontend: {data['frontend_scan'].get('scanned_files', 0)} files")
            print(f"  API scan: {data.get('api_scan', {}).get('scanned_files', 0)} files")
            print(f"  Login scan: {data.get('login_scan', {}).get('scanned_files', 0)} files")
        else:
            print(f"SUCCESS: scan-all completed - total issues: {data.get('total_issues', 0)}")


class TestErrorAutoFixScanAPI:
    """Test Error AutoFix scan-api endpoint"""
    
    def test_scan_api_errors(self, api_client):
        """POST /api/error-autofix/scan-api - Scan for API errors"""
        response = api_client.post(f"{BASE_URL}/api/error-autofix/scan-api")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "scanned_files" in data, "Response should contain 'scanned_files' field"
        
        print(f"SUCCESS: scan-api completed")
        print(f"  Scanned files: {data.get('scanned_files', 0)}")
        print(f"  API calls found: {data.get('api_calls_found', 0)}")
        print(f"  Issues found: {data.get('issues_found', 0)}")


class TestErrorAutoFixScanLogin:
    """Test Error AutoFix scan-login endpoint"""
    
    def test_scan_login_errors(self, api_client):
        """POST /api/error-autofix/scan-login - Scan for login errors"""
        response = api_client.post(f"{BASE_URL}/api/error-autofix/scan-login")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "scanned_files" in data, "Response should contain 'scanned_files' field"
        
        print(f"SUCCESS: scan-login completed")
        print(f"  Scanned files: {data.get('scanned_files', 0)}")
        print(f"  Login issues found: {data.get('login_issues_found', 0)}")
        print(f"  Recommendations: {len(data.get('recommendations', []))}")


# ==================== PERFORMANCE AGENT TESTS ====================

class TestPerformanceCodeSplitting:
    """Test Performance Agent code-splitting endpoint"""
    
    def test_apply_code_splitting(self, api_client):
        """POST /api/performance/code-splitting - Apply code splitting"""
        response = api_client.post(f"{BASE_URL}/api/performance/code-splitting")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "timestamp" in data, "Response should contain 'timestamp' field"
        
        print(f"SUCCESS: code-splitting completed")
        print(f"  Files modified: {len(data.get('files_modified', []))}")
        print(f"  Components split: {data.get('components_split', 0)}")
        print(f"  Estimated improvement: {data.get('estimated_improvement_ms', 0)}ms")
        if data.get('errors'):
            print(f"  Errors: {data['errors']}")


class TestPerformanceAssetAnalysis:
    """Test Performance Agent asset-analysis endpoint"""
    
    def test_get_asset_analysis(self, api_client):
        """GET /api/performance/asset-analysis - Analyze assets"""
        response = api_client.get(f"{BASE_URL}/api/performance/asset-analysis")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "timestamp" in data, "Response should contain 'timestamp' field"
        assert "total_assets_size_kb" in data, "Response should contain 'total_assets_size_kb' field"
        
        print(f"SUCCESS: asset-analysis completed")
        print(f"  Total assets size: {data.get('total_assets_size_kb', 0):.2f} KB")
        print(f"  Compressible size: {data.get('compressible_size_kb', 0):.2f} KB")
        print(f"  Potential savings: {data.get('potential_savings_kb', 0):.2f} KB")
        print(f"  Images: {len(data.get('assets', {}).get('images', []))}")
        print(f"  Recommendations: {len(data.get('recommendations', []))}")


class TestPerformanceFullOptimization:
    """Test Performance Agent full-optimization endpoint"""
    
    def test_run_full_optimization(self, api_client):
        """POST /api/performance/full-optimization - Run full optimization"""
        response = api_client.post(f"{BASE_URL}/api/performance/full-optimization")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "timestamp" in data, "Response should contain 'timestamp' field"
        assert "phases" in data or "summary" in data, "Response should contain optimization results"
        
        print(f"SUCCESS: full-optimization completed")
        print(f"  Total improvement: {data.get('total_improvement_ms', 0)}ms")
        print(f"  Files modified: {len(data.get('files_modified', []))}")
        
        if "phases" in data:
            phases = data["phases"]
            if "code_splitting" in phases:
                print(f"  Code splitting: {phases['code_splitting'].get('components_split', 0)} components")
            if "safe_optimizations" in phases:
                print(f"  Safe optimizations: {phases['safe_optimizations'].get('optimizations_applied', 0)}")
            if "asset_analysis" in phases:
                print(f"  Asset analysis: {phases['asset_analysis'].get('total_size_kb', 0):.2f} KB total")
        
        if "summary" in data:
            for item in data["summary"]:
                print(f"    - {item}")


# ==================== ERROR AUTOFIX DASHBOARD TEST ====================

class TestErrorAutoFixDashboard:
    """Test Error AutoFix dashboard endpoint"""
    
    def test_get_dashboard(self, api_client):
        """GET /api/error-autofix/dashboard - Get dashboard stats"""
        response = api_client.get(f"{BASE_URL}/api/error-autofix/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "total_errors" in data, "Response should contain 'total_errors' field"
        
        print(f"SUCCESS: error-autofix dashboard loaded")
        print(f"  Total errors: {data.get('total_errors', 0)}")
        print(f"  Fixed errors: {data.get('fixed_errors', 0)}")
        print(f"  Pending errors: {data.get('pending_errors', 0)}")
        print(f"  Fix rate: {data.get('fix_rate', 0):.1f}%")


# ==================== PERFORMANCE DASHBOARD TEST ====================

class TestPerformanceDashboard:
    """Test Performance Agent dashboard endpoint"""
    
    def test_get_dashboard(self, api_client):
        """GET /api/performance/dashboard - Get dashboard stats"""
        response = api_client.get(f"{BASE_URL}/api/performance/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "total_issues" in data, "Response should contain 'total_issues' field"
        
        print(f"SUCCESS: performance dashboard loaded")
        print(f"  Total issues: {data.get('total_issues', 0)}")
        print(f"  Optimized: {data.get('optimized_issues', 0)}")
        print(f"  Pending: {data.get('pending_issues', 0)}")
        print(f"  Current score: {data.get('current_score', 0)}")
        print(f"  Target load time: {data.get('target_load_time_ms', 3000)}ms")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
