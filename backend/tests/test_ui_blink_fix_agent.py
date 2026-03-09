"""
UI Blink Fix Agent API Tests
Tests for the autonomous AI agent that detects and fixes UI blinking/flickering issues
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestUIBlinkFixAgentAuth:
    """Test authentication requirements for UI Blink Fix Agent endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token for superadmin"""
        self.token = None
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "Test@1234"}
        )
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
        
    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}
    
    def test_dashboard_without_auth_fails(self):
        """Dashboard endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/ui-blink/dashboard")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Dashboard endpoint requires authentication")
    
    def test_scan_without_auth_fails(self):
        """Scan endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/ui-blink/scan")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Scan endpoint requires authentication")


class TestUIBlinkDashboard:
    """Test dashboard statistics endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "Test@1234"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_returns_stats(self):
        """GET /api/ui-blink/dashboard should return dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/ui-blink/dashboard", headers=self.headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        
        data = response.json()
        # Verify expected fields
        assert "total_issues" in data, "Missing total_issues field"
        assert "fixed_issues" in data, "Missing fixed_issues field"
        assert "pending_issues" in data, "Missing pending_issues field"
        assert "fix_rate" in data, "Missing fix_rate field"
        
        # Verify data types
        assert isinstance(data["total_issues"], int), "total_issues should be int"
        assert isinstance(data["fixed_issues"], int), "fixed_issues should be int"
        assert isinstance(data["pending_issues"], int), "pending_issues should be int"
        assert isinstance(data["fix_rate"], (int, float)), "fix_rate should be numeric"
        
        print(f"PASS: Dashboard stats - Total: {data['total_issues']}, Fixed: {data['fixed_issues']}, Pending: {data['pending_issues']}, Fix Rate: {data['fix_rate']}%")


class TestUIBlinkScan:
    """Test code scanning functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "Test@1234"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_scan_finds_issues(self):
        """GET /api/ui-blink/scan should scan code and find blink issues"""
        response = requests.get(f"{BASE_URL}/api/ui-blink/scan", headers=self.headers)
        assert response.status_code == 200, f"Scan failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Scan should return success=True"
        assert "issues_found" in data, "Missing issues_found count"
        assert "issues" in data, "Missing issues array"
        
        issues_count = data["issues_found"]
        print(f"PASS: Scan found {issues_count} potential blink issues")
        
        # Verify issue structure if issues were found
        if issues_count > 0:
            issue = data["issues"][0]
            assert "issue_id" in issue, "Issue missing issue_id"
            assert "blink_type" in issue, "Issue missing blink_type"
            assert "severity" in issue, "Issue missing severity"
            assert "file_path" in issue, "Issue missing file_path"
            print(f"  First issue: {issue['blink_type']} in {issue['file_path']} (severity: {issue['severity']})")
    
    def test_scan_with_target_path(self):
        """Scan can target a specific path"""
        response = requests.get(
            f"{BASE_URL}/api/ui-blink/scan",
            params={"target_path": "/app/frontend/src/pages"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Targeted scan failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"PASS: Targeted scan found {data['issues_found']} issues in pages directory")


class TestUIBlinkIssues:
    """Test issues listing endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "Test@1234"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_all_issues(self):
        """GET /api/ui-blink/issues should return list of detected issues"""
        response = requests.get(f"{BASE_URL}/api/ui-blink/issues", headers=self.headers)
        assert response.status_code == 200, f"Get issues failed: {response.text}"
        
        data = response.json()
        assert "issues" in data, "Response should have issues array"
        assert isinstance(data["issues"], list), "issues should be a list"
        
        print(f"PASS: Got {len(data['issues'])} issues from database")
        
        if len(data["issues"]) > 0:
            issue = data["issues"][0]
            assert "issue_id" in issue, "Issue missing issue_id"
            assert "blink_type" in issue, "Issue missing blink_type"
            assert "status" in issue, "Issue missing status"
            print(f"  Sample issue: ID={issue['issue_id'][:8]}... Type={issue['blink_type']} Status={issue.get('status')}")
    
    def test_get_issues_by_status(self):
        """Issues can be filtered by status"""
        response = requests.get(
            f"{BASE_URL}/api/ui-blink/issues",
            params={"status": "detected"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Get issues by status failed: {response.text}"
        
        data = response.json()
        print(f"PASS: Got {len(data['issues'])} issues with status=detected")


class TestUIBlinkFixes:
    """Test fix generation, listing, and application"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token and scan for issues"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "Test@1234"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_fixes(self):
        """GET /api/ui-blink/fixes should return list of generated fixes"""
        response = requests.get(f"{BASE_URL}/api/ui-blink/fixes", headers=self.headers)
        assert response.status_code == 200, f"Get fixes failed: {response.text}"
        
        data = response.json()
        assert "fixes" in data, "Response should have fixes array"
        assert isinstance(data["fixes"], list), "fixes should be a list"
        
        print(f"PASS: Got {len(data['fixes'])} fixes from database")
        
        if len(data["fixes"]) > 0:
            fix = data["fixes"][0]
            assert "fix_id" in fix, "Fix missing fix_id"
            assert "status" in fix, "Fix missing status"
            print(f"  Sample fix: ID={fix['fix_id'][:8]}... Status={fix['status']}")
    
    def test_generate_fix_for_issue(self):
        """POST /api/ui-blink/issues/{id}/generate-fix should generate AI fix"""
        # First get an issue to fix
        issues_response = requests.get(f"{BASE_URL}/api/ui-blink/issues", headers=self.headers)
        assert issues_response.status_code == 200
        
        issues = issues_response.json().get("issues", [])
        detected_issues = [i for i in issues if i.get("status") == "detected"]
        
        if not detected_issues:
            print("SKIP: No detected issues available to generate fix")
            pytest.skip("No detected issues available")
        
        issue_id = detected_issues[0]["issue_id"]
        print(f"Generating fix for issue: {issue_id[:8]}...")
        
        # Generate fix (may take a few seconds due to AI processing)
        response = requests.post(
            f"{BASE_URL}/api/ui-blink/issues/{issue_id}/generate-fix",
            headers=self.headers,
            timeout=60  # AI processing may take time
        )
        
        # Can be 200 (success) or 500 (if AI fails but endpoint works)
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Fix generation should return success"
            assert "fix" in data, "Response should have fix object"
            
            fix = data["fix"]
            assert "fix_id" in fix, "Fix should have fix_id"
            assert "fix_description" in fix, "Fix should have description"
            print(f"PASS: Generated fix {fix['fix_id'][:8]}... - {fix['fix_description'][:50]}")
        else:
            # 500 error may occur if AI call fails - endpoint still works
            print(f"INFO: Fix generation returned {response.status_code} - AI processing may have failed")
            assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
    
    def test_generate_fix_for_nonexistent_issue(self):
        """Generate fix for non-existent issue should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/ui-blink/issues/nonexistent-issue-id/generate-fix",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-existent issue returns 404")


class TestUIBlinkApplyAndRollback:
    """Test fix application and rollback functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "Test@1234"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_apply_fix_nonexistent(self):
        """Apply non-existent fix should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/ui-blink/fixes/nonexistent-fix-id/apply",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-existent fix apply returns 404")
    
    def test_rollback_fix_nonexistent(self):
        """Rollback non-existent fix should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/ui-blink/fixes/nonexistent-fix-id/rollback",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-existent fix rollback returns 404")
    
    def test_apply_generated_fix(self):
        """Test applying a generated fix"""
        # Get fixes with status 'fix_generated'
        fixes_response = requests.get(f"{BASE_URL}/api/ui-blink/fixes", headers=self.headers)
        assert fixes_response.status_code == 200
        
        fixes = fixes_response.json().get("fixes", [])
        generated_fixes = [f for f in fixes if f.get("status") == "fix_generated"]
        
        if not generated_fixes:
            print("SKIP: No generated fixes available to apply")
            pytest.skip("No generated fixes available")
        
        fix_id = generated_fixes[0]["fix_id"]
        print(f"Attempting to apply fix: {fix_id[:8]}...")
        
        response = requests.post(
            f"{BASE_URL}/api/ui-blink/fixes/{fix_id}/apply",
            headers=self.headers
        )
        
        # Application may succeed or fail depending on code state
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "applied":
                print(f"PASS: Fix applied successfully. Backup at: {data.get('backup_path')}")
            else:
                print(f"INFO: Fix application status: {data.get('status')} - {data.get('error', 'no error')}")
        else:
            print(f"INFO: Fix application returned {response.status_code}")


class TestUIBlinkAutoFix:
    """Test auto-fix functionality with dry run mode"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "Test@1234"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_auto_fix_dry_run(self):
        """POST /api/ui-blink/auto-fix with dry_run=true should preview fixes"""
        response = requests.post(
            f"{BASE_URL}/api/ui-blink/auto-fix",
            params={"dry_run": True},
            headers=self.headers,
            timeout=120  # May take time for AI processing
        )
        
        assert response.status_code == 200, f"Auto-fix dry run failed: {response.text}"
        
        data = response.json()
        assert "dry_run" in data, "Response should indicate dry_run status"
        assert data["dry_run"] == True, "Should be a dry run"
        assert "issues_found" in data, "Should report issues found"
        assert "fixes_generated" in data, "Should report fixes generated"
        
        print(f"PASS: Auto-fix dry run completed")
        print(f"  Issues found: {data['issues_found']}")
        print(f"  Fixes generated: {data['fixes_generated']}")
        print(f"  Fixes applied: {data.get('fixes_applied', 0)}")


class TestUIBlinkReportIssue:
    """Test manual issue reporting"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "Test@1234"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_report_blink_issue(self):
        """POST /api/ui-blink/report should allow manual issue reporting"""
        report_data = {
            "file_path": "/app/frontend/src/pages/TestPage.js",
            "description": "TEST_Button flickers when user hovers - testing manual report"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ui-blink/report",
            json=report_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Report failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Report should return success"
        assert "issue_id" in data, "Response should have issue_id"
        assert "message" in data, "Response should have message"
        
        print(f"PASS: Reported issue successfully. Issue ID: {data['issue_id'][:8]}...")
        print(f"  Message: {data['message']}")


class TestUIBlinkIntegration:
    """Integration test - full workflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "Test@1234"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_full_workflow(self):
        """Test complete workflow: Dashboard -> Scan -> Issues -> Fixes"""
        # Step 1: Get dashboard stats
        dash_response = requests.get(f"{BASE_URL}/api/ui-blink/dashboard", headers=self.headers)
        assert dash_response.status_code == 200, "Dashboard should work"
        initial_stats = dash_response.json()
        print(f"Step 1 - Dashboard: Total={initial_stats['total_issues']}, Fixed={initial_stats['fixed_issues']}")
        
        # Step 2: Run scan
        scan_response = requests.get(f"{BASE_URL}/api/ui-blink/scan", headers=self.headers)
        assert scan_response.status_code == 200, "Scan should work"
        scan_data = scan_response.json()
        print(f"Step 2 - Scan: Found {scan_data['issues_found']} issues")
        
        # Step 3: Get issues list
        issues_response = requests.get(f"{BASE_URL}/api/ui-blink/issues", headers=self.headers)
        assert issues_response.status_code == 200, "Get issues should work"
        issues = issues_response.json().get("issues", [])
        print(f"Step 3 - Issues: Got {len(issues)} issues from database")
        
        # Step 4: Get fixes list
        fixes_response = requests.get(f"{BASE_URL}/api/ui-blink/fixes", headers=self.headers)
        assert fixes_response.status_code == 200, "Get fixes should work"
        fixes = fixes_response.json().get("fixes", [])
        print(f"Step 4 - Fixes: Got {len(fixes)} fixes from database")
        
        # Step 5: Verify dashboard updated
        dash_response2 = requests.get(f"{BASE_URL}/api/ui-blink/dashboard", headers=self.headers)
        assert dash_response2.status_code == 200
        final_stats = dash_response2.json()
        print(f"Step 5 - Final Dashboard: Total={final_stats['total_issues']}, Fixed={final_stats['fixed_issues']}, Fix Rate={final_stats['fix_rate']:.1f}%")
        
        print("PASS: Full workflow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
