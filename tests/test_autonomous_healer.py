"""
Test Autonomous Self-Healing System
====================================
Tests for autonomous healer API endpoints including:
- Status endpoint
- Auto-fix for various error types (database, memory, network, dependency, frontend)
- Security scanning
- System health check
- File integrity verification
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


@pytest.fixture(scope="module")
def auth_session():
    """Module-scoped auth session to avoid repeated logins"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login to get auth token
    login_response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
    )
    
    assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    
    token_data = login_response.json()
    token = token_data.get("access_token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    
    yield session
    
    session.close()


class TestAutonomousHealerStatus:
    """Test autonomous healer status endpoint"""
    
    def test_status_endpoint(self, auth_session):
        """GET /api/autonomous-healer/status - Get healer status"""
        response = auth_session.get(f"{BASE_URL}/api/autonomous-healer/status")
        
        assert response.status_code == 200, f"Status check failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "is_running" in data, "Response missing 'is_running' field"
        assert "statistics" in data, "Response missing 'statistics' field"
        assert "recent_fixes" in data, "Response missing 'recent_fixes' field"
        
        # Verify statistics structure
        stats = data["statistics"]
        assert "total_fixes" in stats, "Statistics missing 'total_fixes'"
        assert "success_rate" in stats, "Statistics missing 'success_rate'"
        
        print(f"\nHealer status: running={data['is_running']}, total_fixes={stats.get('total_fixes', 0)}, success_rate={stats.get('success_rate', 0)}%")


class TestAutonomousHealerFixes:
    """Test autonomous healer fix endpoints"""
    
    def test_fix_database_error(self, auth_session):
        """POST /api/autonomous-healer/fix - Fix database connection error"""
        response = auth_session.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            json={
                "error_type": "database",
                "error_message": "Test database connection error"
            }
        )
        
        assert response.status_code == 200, f"Database fix failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "fix_id" in data, "Response missing 'fix_id'"
        assert "error_type" in data, "Response missing 'error_type'"
        assert "result" in data, "Response missing 'result'"
        assert "details" in data, "Response missing 'details'"
        assert "execution_time_ms" in data, "Response missing 'execution_time_ms'"
        
        # Verify the fix result is valid
        assert data["result"] in ["success", "partial", "failed", "skipped"], f"Invalid result: {data['result']}"
        assert data["error_type"] == "database_connection", f"Unexpected error_type: {data['error_type']}"
        
        print(f"\nDatabase fix: result={data['result']}, details={data['details'][:100]}")
    
    def test_fix_memory_error(self, auth_session):
        """POST /api/autonomous-healer/fix - Fix memory leak error"""
        response = auth_session.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            json={
                "error_type": "memory",
                "error_message": "High memory usage detected"
            }
        )
        
        assert response.status_code == 200, f"Memory fix failed: {response.text}"
        
        data = response.json()
        
        assert "fix_id" in data
        assert "result" in data
        assert data["result"] in ["success", "partial", "failed", "skipped"]
        assert data["error_type"] == "memory_leak"
        
        print(f"\nMemory fix: result={data['result']}, details={data['details'][:100]}")
    
    def test_fix_network_error(self, auth_session):
        """POST /api/autonomous-healer/fix - Fix network error"""
        response = auth_session.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            json={
                "error_type": "network",
                "error_message": "Network connectivity issue"
            }
        )
        
        assert response.status_code == 200, f"Network fix failed: {response.text}"
        
        data = response.json()
        
        assert "fix_id" in data
        assert "result" in data
        assert data["result"] in ["success", "partial", "failed", "skipped"]
        assert data["error_type"] == "network_error"
        
        print(f"\nNetwork fix: result={data['result']}, details={data['details'][:100]}")
    
    def test_fix_dependency_error(self, auth_session):
        """POST /api/autonomous-healer/fix - Fix dependency error"""
        response = auth_session.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            json={
                "error_type": "dependency",
                "error_message": "General dependency fix request"
            }
        )
        
        assert response.status_code == 200, f"Dependency fix failed: {response.text}"
        
        data = response.json()
        
        assert "fix_id" in data
        assert "result" in data
        assert data["result"] in ["success", "partial", "failed", "skipped"]
        assert data["error_type"] == "dependency_error"
        
        print(f"\nDependency fix: result={data['result']}, details={data['details'][:100]}")
    
    def test_fix_permission_error(self, auth_session):
        """POST /api/autonomous-healer/fix - Fix permission error"""
        response = auth_session.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            json={
                "error_type": "permission",
                "error_message": "Permission denied on file access"
            }
        )
        
        assert response.status_code == 200, f"Permission fix failed: {response.text}"
        
        data = response.json()
        
        assert "fix_id" in data
        assert "result" in data
        assert data["result"] in ["success", "partial", "failed", "skipped"]
        assert data["error_type"] == "permission_error"
        
        print(f"\nPermission fix: result={data['result']}, details={data['details'][:100]}")
    
    def test_fix_unknown_error_type(self, auth_session):
        """POST /api/autonomous-healer/fix - Unknown error type should return 400"""
        response = auth_session.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            json={
                "error_type": "invalid_unknown_type",
                "error_message": "Unknown error"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for unknown error type, got {response.status_code}"
        print("\nUnknown error type correctly rejected with 400")


class TestAutonomousHealerScan:
    """Test security scan endpoint"""
    
    def test_security_scan(self, auth_session):
        """POST /api/autonomous-healer/scan - Run security scan"""
        response = auth_session.post(f"{BASE_URL}/api/autonomous-healer/scan")
        
        assert response.status_code == 200, f"Security scan failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "scan_id" in data, "Response missing 'scan_id'"
        assert "timestamp" in data, "Response missing 'timestamp'"
        assert "files_scanned" in data, "Response missing 'files_scanned'"
        assert "threats_found" in data, "Response missing 'threats_found'"
        assert "clean" in data, "Response missing 'clean'"
        
        # Verify the scan found files
        assert data["files_scanned"] > 0, "No files were scanned"
        
        print(f"\nSecurity scan: files_scanned={data['files_scanned']}, threats_found={len(data['threats_found'])}, clean={data['clean']}")


class TestAutonomousHealerHealth:
    """Test system health endpoint"""
    
    def test_system_health(self, auth_session):
        """GET /api/autonomous-healer/health - Get system health"""
        response = auth_session.get(f"{BASE_URL}/api/autonomous-healer/health")
        
        assert response.status_code == 200, f"Health check failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "timestamp" in data, "Response missing 'timestamp'"
        assert "status" in data, "Response missing 'status'"
        assert "issues" in data, "Response missing 'issues'"
        assert "metrics" in data, "Response missing 'metrics'"
        
        # Verify status is valid
        assert data["status"] in ["healthy", "degraded", "critical"], f"Invalid status: {data['status']}"
        
        # Verify metrics structure
        metrics = data["metrics"]
        assert "cpu_percent" in metrics, "Metrics missing 'cpu_percent'"
        assert "memory_percent" in metrics, "Metrics missing 'memory_percent'"
        assert "disk_percent" in metrics, "Metrics missing 'disk_percent'"
        
        print(f"\nSystem health: status={data['status']}, cpu={metrics['cpu_percent']}%, memory={metrics['memory_percent']}%, disk={metrics['disk_percent']}%")


class TestAutonomousHealerIntegrity:
    """Test file integrity endpoint"""
    
    def test_file_integrity(self, auth_session):
        """POST /api/autonomous-healer/integrity - Verify file integrity"""
        response = auth_session.post(f"{BASE_URL}/api/autonomous-healer/integrity")
        
        assert response.status_code == 200, f"Integrity check failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "timestamp" in data, "Response missing 'timestamp'"
        assert "files_checked" in data, "Response missing 'files_checked'"
        assert "modified_files" in data, "Response missing 'modified_files'"
        assert "missing_files" in data, "Response missing 'missing_files'"
        assert "integrity_ok" in data, "Response missing 'integrity_ok'"
        
        # Verify files were checked
        assert data["files_checked"] > 0, "No files were checked"
        
        print(f"\nFile integrity: files_checked={data['files_checked']}, modified={len(data['modified_files'])}, missing={len(data['missing_files'])}, integrity_ok={data['integrity_ok']}")


class TestAutonomousHealerSuccessRate:
    """Test success rate validation"""
    
    def test_success_rate_after_multiple_fixes(self, auth_session):
        """Verify success rate is high after running multiple fixes"""
        # Run multiple fixes - avoiding thread/async that restart services
        fix_types = ["database", "memory", "network", "permission"]
        results = []
        
        for fix_type in fix_types:
            response = auth_session.post(
                f"{BASE_URL}/api/autonomous-healer/fix",
                json={
                    "error_type": fix_type,
                    "error_message": f"Test {fix_type} fix for success rate validation"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                results.append({
                    "type": fix_type,
                    "result": data.get("result"),
                    "details": data.get("details", "")[:50]
                })
        
        # Get updated statistics
        status_response = auth_session.get(f"{BASE_URL}/api/autonomous-healer/status")
        assert status_response.status_code == 200
        
        status_data = status_response.json()
        stats = status_data["statistics"]
        
        # Calculate success rate from results
        successful = len([r for r in results if r["result"] in ["success", "partial"]])
        total = len(results)
        calculated_rate = (successful / total * 100) if total > 0 else 0
        
        print(f"\n=== SUCCESS RATE VALIDATION ===")
        print(f"Fixes attempted: {total}")
        print(f"Successful fixes: {successful}")
        print(f"Calculated success rate: {calculated_rate:.1f}%")
        print(f"Reported success rate: {stats.get('success_rate', 0)}%")
        print(f"Fix results: {results}")
        
        # Verify success rate is reasonable (allowing for some failures)
        assert calculated_rate >= 50, f"Success rate too low: {calculated_rate}%"


class TestAutonomousHealerAuth:
    """Test authentication requirements for autonomous healer endpoints"""
    
    def test_status_requires_auth(self):
        """Verify status endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/autonomous-healer/status")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}: {response.text}"
        print("\nStatus endpoint correctly requires authentication")
    
    def test_fix_requires_auth(self):
        """Verify fix endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous-healer/fix",
            json={"error_type": "database", "error_message": "Test"}
        )
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}: {response.text}"
        print("\nFix endpoint correctly requires authentication")
    
    def test_scan_requires_auth(self):
        """Verify scan endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/autonomous-healer/scan")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}: {response.text}"
        print("\nScan endpoint correctly requires authentication")
    
    def test_health_requires_auth(self):
        """Verify health endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/autonomous-healer/health")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}: {response.text}"
        print("\nHealth endpoint correctly requires authentication")
    
    def test_integrity_requires_auth(self):
        """Verify integrity endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/autonomous-healer/integrity")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}: {response.text}"
        print("\nIntegrity endpoint correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
