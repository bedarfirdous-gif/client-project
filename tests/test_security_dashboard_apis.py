"""
Test Security Dashboard Backend APIs (Autonomous Healer)
Tests: /api/autonomous-healer/* endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://erp-invoice-fix-1.preview.emergentagent.com')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for superadmin"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestSecurityDashboardAPIs:
    """Test all Security Dashboard / Autonomous Healer APIs"""
    
    # Test 1: GET /api/autonomous-healer/status
    def test_healer_status(self, auth_headers):
        """Test fetching healer status"""
        response = requests.get(
            f"{BASE_URL}/api/autonomous-healer/status",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Status failed: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "is_running" in data, "Missing is_running field"
        assert "statistics" in data, "Missing statistics field"
        assert "recent_fixes" in data, "Missing recent_fixes field"
        
        # Validate statistics structure - must have at least total_fixes and success_rate
        stats = data["statistics"]
        assert "total_fixes" in stats, "Missing total_fixes in statistics"
        assert "success_rate" in stats, "Missing success_rate in statistics"
        # Note: successful, partial, failed are only present when there are fixes
        
        print(f"✓ Healer status: is_running={data['is_running']}, total_fixes={stats['total_fixes']}, success_rate={stats['success_rate']}%")
    
    # Test 2: GET /api/autonomous-healer/health
    def test_system_health(self, auth_headers):
        """Test system health check"""
        response = requests.get(
            f"{BASE_URL}/api/autonomous-healer/health",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Health check failed: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "status" in data, "Missing status field"
        assert "metrics" in data, "Missing metrics field"
        
        # Validate metrics
        metrics = data["metrics"]
        assert "cpu_percent" in metrics, "Missing cpu_percent"
        assert "memory_percent" in metrics, "Missing memory_percent"
        assert "disk_percent" in metrics, "Missing disk_percent"
        
        # Validate status is one of expected values
        assert data["status"] in ["healthy", "degraded", "critical"], f"Invalid status: {data['status']}"
        
        print(f"✓ System health: status={data['status']}, CPU={metrics['cpu_percent']}%, Memory={metrics['memory_percent']}%, Disk={metrics['disk_percent']}%")
    
    # Test 3: POST /api/autonomous-healer/scan
    def test_security_scan(self, auth_headers):
        """Test antivirus/security scan"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous-healer/scan",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Scan failed: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "clean" in data, "Missing clean field"
        assert "files_scanned" in data, "Missing files_scanned"
        assert "threats_found" in data, "Missing threats_found"
        assert "suspicious_files" in data, "Missing suspicious_files"
        assert "timestamp" in data, "Missing timestamp"
        
        # Validate data types
        assert isinstance(data["clean"], bool), "clean should be boolean"
        assert isinstance(data["files_scanned"], int), "files_scanned should be int"
        assert isinstance(data["threats_found"], list), "threats_found should be list"
        assert isinstance(data["suspicious_files"], list), "suspicious_files should be list"
        
        print(f"✓ Security scan: clean={data['clean']}, files_scanned={data['files_scanned']}, threats={len(data['threats_found'])}, suspicious={len(data['suspicious_files'])}")
    
    # Test 4: POST /api/autonomous-healer/integrity
    def test_file_integrity(self, auth_headers):
        """Test file integrity verification"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous-healer/integrity",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Integrity check failed: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "integrity_ok" in data, "Missing integrity_ok field"
        assert "files_checked" in data, "Missing files_checked"
        assert "modified_files" in data, "Missing modified_files"
        assert "missing_files" in data, "Missing missing_files"
        
        # Validate data types
        assert isinstance(data["integrity_ok"], bool), "integrity_ok should be boolean"
        assert isinstance(data["files_checked"], int), "files_checked should be int"
        
        print(f"✓ Integrity check: ok={data['integrity_ok']}, files_checked={data['files_checked']}, modified={len(data['modified_files'])}, missing={len(data['missing_files'])}")
    
    # Test 5: POST /api/autonomous-healer/fix (database)
    def test_fix_database(self, auth_headers):
        """Test manual fix trigger for database"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            headers=auth_headers,
            json={"error_type": "database", "error_message": "Test database fix"}
        )
        assert response.status_code == 200, f"Database fix failed: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "fix_id" in data, "Missing fix_id"
        assert "error_type" in data, "Missing error_type"
        assert "result" in data, "Missing result"
        assert "details" in data, "Missing details"
        assert "execution_time_ms" in data, "Missing execution_time_ms"
        
        # Validate result is one of expected values
        assert data["result"] in ["success", "partial", "failed", "skipped"], f"Invalid result: {data['result']}"
        
        print(f"✓ Database fix: result={data['result']}, details={data['details'][:50]}...")
    
    # Test 6: POST /api/autonomous-healer/fix (memory)
    def test_fix_memory(self, auth_headers):
        """Test manual fix trigger for memory"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            headers=auth_headers,
            json={"error_type": "memory", "error_message": "Test memory fix"}
        )
        assert response.status_code == 200, f"Memory fix failed: {response.text}"
        
        data = response.json()
        assert "result" in data
        print(f"✓ Memory fix: result={data['result']}, details={data['details'][:50]}...")
    
    # Test 7: POST /api/autonomous-healer/fix (network)
    def test_fix_network(self, auth_headers):
        """Test manual fix trigger for network"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            headers=auth_headers,
            json={"error_type": "network", "error_message": "Test network fix"}
        )
        assert response.status_code == 200, f"Network fix failed: {response.text}"
        
        data = response.json()
        assert "result" in data
        print(f"✓ Network fix: result={data['result']}, details={data['details'][:50]}...")
    
    # Test 8: POST /api/autonomous-healer/fix (permission)
    def test_fix_permission(self, auth_headers):
        """Test manual fix trigger for permission"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            headers=auth_headers,
            json={"error_type": "permission", "error_message": "Test permission fix"}
        )
        assert response.status_code == 200, f"Permission fix failed: {response.text}"
        
        data = response.json()
        assert "result" in data
        print(f"✓ Permission fix: result={data['result']}, details={data['details'][:50]}...")
    
    # Test 9: POST /api/autonomous-healer/fix (unknown type - should return 400)
    def test_fix_unknown_type(self, auth_headers):
        """Test fix with unknown error type should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            headers=auth_headers,
            json={"error_type": "unknown_type_xyz", "error_message": "Test"}
        )
        assert response.status_code == 400, f"Expected 400 for unknown type, got: {response.status_code}"
        print("✓ Unknown fix type correctly returns 400")
    
    # Test 10: POST /api/autonomous-healer/start
    def test_start_healer(self, auth_headers):
        """Test starting the autonomous healer"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous-healer/start",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Start healer failed: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert data["status"] == "running"
        print(f"✓ Start healer: {data['message']}")
    
    # Test 11: POST /api/autonomous-healer/stop
    def test_stop_healer(self, auth_headers):
        """Test stopping the autonomous healer"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous-healer/stop",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Stop healer failed: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert data["status"] == "stopped"
        print(f"✓ Stop healer: {data['message']}")
    
    # Test 12: Verify status after stop
    def test_status_after_stop(self, auth_headers):
        """Verify healer is_running is false after stop"""
        response = requests.get(
            f"{BASE_URL}/api/autonomous-healer/status",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_running"] == False, "Healer should not be running after stop"
        print("✓ Status after stop: is_running=False")
    
    # Test 13: Test without authentication (should fail)
    def test_unauthorized_access(self):
        """Test endpoints require authentication"""
        endpoints = [
            ("GET", "/api/autonomous-healer/status"),
            ("GET", "/api/autonomous-healer/health"),
            ("POST", "/api/autonomous-healer/scan"),
            ("POST", "/api/autonomous-healer/integrity"),
            ("POST", "/api/autonomous-healer/start"),
            ("POST", "/api/autonomous-healer/stop"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}")
            else:
                response = requests.post(f"{BASE_URL}{endpoint}")
            
            assert response.status_code in [401, 403], f"{endpoint} should require auth, got {response.status_code}"
        
        print("✓ All endpoints correctly require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
