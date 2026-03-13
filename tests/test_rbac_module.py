"""
RBAC Permission Module - Comprehensive Backend API Tests
Tests all 25+ RBAC APIs including:
- Permission Templates (GET, POST, DELETE)
- Role Cloning (POST)
- Session Management (GET, DELETE, POST)
- Login History (GET, GET summary)
- IP Whitelisting (GET, PUT)
- Time-Based Access (GET, POST, DELETE)
- API Keys Management (GET, POST, DELETE)
- Activity Log (GET, GET export)
- Bulk Permission Updates (POST)
- Permission Check (GET)
- RBAC Stats (GET)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"
STAFF_EMAIL = "staff@bijnisbooks.com"
STAFF_PASSWORD = "staff@123"
VIEWER_EMAIL = "viewer@bijnisbooks.com"
VIEWER_PASSWORD = "viewer@123"


class TestRBACModule:
    """Test suite for RBAC Permission Module APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.superadmin_token = None
        self.staff_token = None
        self.created_resources = {
            "templates": [],
            "roles": [],
            "schedules": [],
            "api_keys": []
        }
    
    def get_superadmin_token(self):
        """Get superadmin authentication token"""
        if self.superadmin_token:
            return self.superadmin_token
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.superadmin_token = response.json().get("access_token")
            return self.superadmin_token
        pytest.skip(f"Superadmin login failed: {response.status_code} - {response.text}")
    
    def get_staff_token(self):
        """Get staff authentication token"""
        if self.staff_token:
            return self.staff_token
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        if response.status_code == 200:
            self.staff_token = response.json().get("access_token")
            return self.staff_token
        return None  # Staff may not exist
    
    def auth_headers(self, token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}"}
    
    # ==================== PERMISSION TEMPLATES ====================
    
    def test_01_get_permission_templates(self):
        """GET /api/rbac/permission-templates - Get pre-defined and custom templates"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/permission-templates",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "templates" in data, "Response should contain 'templates' key"
        templates = data["templates"]
        assert isinstance(templates, list), "Templates should be a list"
        
        # Verify system templates exist
        template_ids = [t.get("id") for t in templates]
        assert "tpl_admin" in template_ids, "Should have Full Admin template"
        assert "tpl_manager" in template_ids, "Should have Store Manager template"
        assert "tpl_cashier" in template_ids, "Should have Cashier template"
        assert "tpl_accountant" in template_ids, "Should have Accountant template"
        assert "tpl_viewer" in template_ids, "Should have Read-Only Viewer template"
        
        # Verify template structure
        for template in templates:
            assert "id" in template, "Template should have id"
            assert "name" in template, "Template should have name"
            assert "permissions" in template, "Template should have permissions"
            assert "is_system" in template, "Template should have is_system flag"
        
        print(f"✓ Found {len(templates)} permission templates")
    
    def test_02_create_custom_permission_template(self):
        """POST /api/rbac/permission-templates - Create custom template"""
        token = self.get_superadmin_token()
        
        template_data = {
            "name": f"TEST_Warehouse Staff {uuid.uuid4().hex[:6]}",
            "description": "Inventory and stock management only",
            "permissions": {
                "dashboard": ["view"],
                "inventory": ["view", "create", "edit"],
                "stock_transfers": ["view", "create"],
                "items": ["view"]
            }
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/rbac/permission-templates",
            headers=self.auth_headers(token),
            json=template_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response
        assert "id" in data, "Response should contain template id"
        assert data["name"] == template_data["name"], "Name should match"
        assert data["is_system"] == False, "Custom template should not be system"
        assert "permissions" in data, "Should have permissions"
        
        # Store for cleanup
        self.created_resources["templates"].append(data["id"])
        print(f"✓ Created custom template: {data['id']}")
        
        return data["id"]
    
    def test_03_delete_custom_permission_template(self):
        """DELETE /api/rbac/permission-templates/{id} - Delete custom template"""
        token = self.get_superadmin_token()
        
        # First create a template to delete
        template_data = {
            "name": f"TEST_ToDelete {uuid.uuid4().hex[:6]}",
            "description": "Template to be deleted",
            "permissions": {"dashboard": ["view"]}
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/rbac/permission-templates",
            headers=self.auth_headers(token),
            json=template_data
        )
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Delete the template
        response = self.session.delete(
            f"{BASE_URL}/api/rbac/permission-templates/{template_id}",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Should have success message"
        print(f"✓ Deleted custom template: {template_id}")
    
    def test_04_cannot_delete_system_template(self):
        """DELETE /api/rbac/permission-templates/{id} - Cannot delete system templates"""
        token = self.get_superadmin_token()
        
        response = self.session.delete(
            f"{BASE_URL}/api/rbac/permission-templates/tpl_admin",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "Cannot delete system templates" in data.get("detail", ""), "Should reject system template deletion"
        print("✓ System template deletion correctly rejected")
    
    # ==================== ROLE CLONING ====================
    
    def test_05_clone_role(self):
        """POST /api/rbac/roles/{id}/clone - Clone existing role"""
        token = self.get_superadmin_token()
        
        # First create a role to clone
        role_data = {
            "name": f"TEST_Original Role {uuid.uuid4().hex[:6]}",
            "description": "Original role for cloning",
            "permissions": {
                "dashboard": True,
                "sales": True,
                "inventory": True
            }
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/roles",
            headers=self.auth_headers(token),
            json=role_data
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create role for cloning: {create_response.text}")
        
        original_role_id = create_response.json()["id"]
        self.created_resources["roles"].append(original_role_id)
        
        # Clone the role
        clone_data = {"new_name": f"TEST_Cloned Role {uuid.uuid4().hex[:6]}"}
        
        response = self.session.post(
            f"{BASE_URL}/api/rbac/roles/{original_role_id}/clone",
            headers=self.auth_headers(token),
            json=clone_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify cloned role
        assert "id" in data, "Cloned role should have id"
        assert data["name"] == clone_data["new_name"], "Name should match"
        assert data["cloned_from"] == original_role_id, "Should reference original role"
        assert "permissions" in data, "Should have permissions"
        
        self.created_resources["roles"].append(data["id"])
        print(f"✓ Cloned role: {data['id']} from {original_role_id}")
    
    def test_06_clone_nonexistent_role(self):
        """POST /api/rbac/roles/{id}/clone - Clone non-existent role returns 404"""
        token = self.get_superadmin_token()
        
        response = self.session.post(
            f"{BASE_URL}/api/rbac/roles/nonexistent_role_id/clone",
            headers=self.auth_headers(token),
            json={"new_name": "Should Fail"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Non-existent role clone correctly returns 404")
    
    # ==================== SESSION MANAGEMENT ====================
    
    def test_07_get_all_sessions(self):
        """GET /api/rbac/sessions - Get all active user sessions"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/sessions",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "sessions" in data, "Response should contain 'sessions'"
        assert "total" in data, "Response should contain 'total'"
        assert isinstance(data["sessions"], list), "Sessions should be a list"
        
        # At least our current session should exist
        print(f"✓ Found {data['total']} active sessions")
    
    def test_08_get_user_sessions(self):
        """GET /api/rbac/sessions/user/{user_id} - Get user's sessions"""
        token = self.get_superadmin_token()
        
        # Get current user info
        me_response = self.session.get(
            f"{BASE_URL}/api/auth/me",
            headers=self.auth_headers(token)
        )
        assert me_response.status_code == 200
        user_id = me_response.json()["id"]
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/sessions/user/{user_id}",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "sessions" in data, "Response should contain 'sessions'"
        print(f"✓ Found {len(data['sessions'])} sessions for user {user_id}")
    
    def test_09_revoke_session(self):
        """DELETE /api/rbac/sessions/{session_id} - Revoke session"""
        token = self.get_superadmin_token()
        
        # Get sessions first
        sessions_response = self.session.get(
            f"{BASE_URL}/api/rbac/sessions",
            headers=self.auth_headers(token)
        )
        
        if sessions_response.status_code != 200 or not sessions_response.json().get("sessions"):
            pytest.skip("No sessions available to revoke")
        
        # We'll test with a fake session ID to avoid revoking our own session
        response = self.session.delete(
            f"{BASE_URL}/api/rbac/sessions/fake_session_id_for_test",
            headers=self.auth_headers(token)
        )
        
        # Should return 200 even if session doesn't exist (idempotent)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Session revoke endpoint working")
    
    def test_10_revoke_all_user_sessions(self):
        """POST /api/rbac/sessions/revoke-all/{user_id} - Force logout all devices"""
        token = self.get_superadmin_token()
        
        # Use a fake user ID to avoid logging ourselves out
        response = self.session.post(
            f"{BASE_URL}/api/rbac/sessions/revoke-all/fake_user_id_for_test",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Should have success message"
        print("✓ Revoke all sessions endpoint working")
    
    # ==================== LOGIN HISTORY ====================
    
    def test_11_get_login_history(self):
        """GET /api/rbac/login-history - Get login audit trail"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/login-history",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "history" in data, "Response should contain 'history'"
        assert "total" in data, "Response should contain 'total'"
        print(f"✓ Found {data['total']} login history records")
    
    def test_12_get_login_history_with_filters(self):
        """GET /api/rbac/login-history - Get login history with filters"""
        token = self.get_superadmin_token()
        
        # Test with status filter
        response = self.session.get(
            f"{BASE_URL}/api/rbac/login-history?status=success&limit=10",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Login history with filters working")
    
    def test_13_get_login_history_summary(self):
        """GET /api/rbac/login-history/summary - Get login statistics"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/login-history/summary?days=30",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "period_days" in data, "Should have period_days"
        assert "total_attempts" in data, "Should have total_attempts"
        assert "successful" in data, "Should have successful count"
        assert "failed" in data, "Should have failed count"
        assert "success_rate" in data, "Should have success_rate"
        assert "unique_users" in data, "Should have unique_users"
        
        print(f"✓ Login summary: {data['total_attempts']} attempts, {data['success_rate']}% success rate")
    
    # ==================== IP WHITELISTING ====================
    
    def test_14_get_ip_whitelist(self):
        """GET /api/rbac/ip-whitelist - Get IP whitelist config"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/ip-whitelist",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "ip_whitelist_enabled" in data, "Should have ip_whitelist_enabled"
        assert "whitelisted_ips" in data, "Should have whitelisted_ips"
        assert "whitelisted_ranges" in data, "Should have whitelisted_ranges"
        
        print(f"✓ IP whitelist enabled: {data['ip_whitelist_enabled']}")
    
    def test_15_update_ip_whitelist(self):
        """PUT /api/rbac/ip-whitelist - Update IP whitelist"""
        token = self.get_superadmin_token()
        
        whitelist_data = {
            "ip_whitelist_enabled": False,  # Keep disabled for testing
            "whitelisted_ips": ["192.168.1.100", "10.0.0.50"],
            "whitelisted_ranges": ["192.168.1.0/24"]
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/rbac/ip-whitelist",
            headers=self.auth_headers(token),
            json=whitelist_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Should have success message"
        
        # Verify update
        get_response = self.session.get(
            f"{BASE_URL}/api/rbac/ip-whitelist",
            headers=self.auth_headers(token)
        )
        assert get_response.status_code == 200
        updated_data = get_response.json()
        assert updated_data["whitelisted_ips"] == whitelist_data["whitelisted_ips"]
        
        print("✓ IP whitelist updated successfully")
    
    # ==================== TIME-BASED ACCESS ====================
    
    def test_16_get_access_schedules(self):
        """GET /api/rbac/access-schedule - Get time-based access schedules"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/access-schedule",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "schedules" in data, "Response should contain 'schedules'"
        print(f"✓ Found {len(data['schedules'])} access schedules")
    
    def test_17_create_access_schedule(self):
        """POST /api/rbac/access-schedule - Create access schedule"""
        token = self.get_superadmin_token()
        
        schedule_data = {
            "name": f"TEST_Business Hours {uuid.uuid4().hex[:6]}",
            "role_id": None,
            "user_id": None,
            "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
            "start_time": "09:00",
            "end_time": "18:00",
            "timezone": "Asia/Kolkata",
            "is_active": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/rbac/access-schedule",
            headers=self.auth_headers(token),
            json=schedule_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response
        assert "id" in data, "Should have schedule id"
        assert data["name"] == schedule_data["name"], "Name should match"
        assert data["start_time"] == schedule_data["start_time"], "Start time should match"
        assert data["end_time"] == schedule_data["end_time"], "End time should match"
        
        self.created_resources["schedules"].append(data["id"])
        print(f"✓ Created access schedule: {data['id']}")
        
        return data["id"]
    
    def test_18_delete_access_schedule(self):
        """DELETE /api/rbac/access-schedule/{id} - Delete schedule"""
        token = self.get_superadmin_token()
        
        # First create a schedule to delete
        schedule_data = {
            "name": f"TEST_ToDelete {uuid.uuid4().hex[:6]}",
            "days": ["monday"],
            "start_time": "09:00",
            "end_time": "17:00"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/rbac/access-schedule",
            headers=self.auth_headers(token),
            json=schedule_data
        )
        assert create_response.status_code == 200
        schedule_id = create_response.json()["id"]
        
        # Delete the schedule
        response = self.session.delete(
            f"{BASE_URL}/api/rbac/access-schedule/{schedule_id}",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Deleted access schedule: {schedule_id}")
    
    # ==================== API KEYS MANAGEMENT ====================
    
    def test_19_get_api_keys(self):
        """GET /api/rbac/api-keys - List API keys"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/api-keys",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "api_keys" in data, "Response should contain 'api_keys'"
        print(f"✓ Found {len(data['api_keys'])} API keys")
    
    def test_20_create_api_key(self):
        """POST /api/rbac/api-keys - Create new API key"""
        token = self.get_superadmin_token()
        
        key_data = {
            "name": f"TEST_Integration Key {uuid.uuid4().hex[:6]}",
            "permissions": ["read:items", "read:inventory"],
            "expires_at": "2027-12-31",
            "rate_limit": 1000
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/rbac/api-keys",
            headers=self.auth_headers(token),
            json=key_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response
        assert "id" in data, "Should have key id"
        assert "key" in data, "Should have the actual key (shown only once)"
        assert data["key"].startswith("bk_live_"), "Key should have correct prefix"
        assert "message" in data, "Should have warning message about saving key"
        
        self.created_resources["api_keys"].append(data["id"])
        print(f"✓ Created API key: {data['id']} (key prefix: {data['key'][:12]}...)")
        
        return data["id"]
    
    def test_21_revoke_api_key(self):
        """DELETE /api/rbac/api-keys/{key_id} - Revoke API key"""
        token = self.get_superadmin_token()
        
        # First create a key to revoke
        key_data = {
            "name": f"TEST_ToRevoke {uuid.uuid4().hex[:6]}",
            "permissions": ["read:items"]
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/rbac/api-keys",
            headers=self.auth_headers(token),
            json=key_data
        )
        assert create_response.status_code == 200
        key_id = create_response.json()["id"]
        
        # Revoke the key
        response = self.session.delete(
            f"{BASE_URL}/api/rbac/api-keys/{key_id}",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Should have success message"
        print(f"✓ Revoked API key: {key_id}")
    
    # ==================== ACTIVITY LOG ====================
    
    def test_22_get_activity_log(self):
        """GET /api/rbac/activity-log - Get activity audit log"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/activity-log",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "logs" in data, "Response should contain 'logs'"
        assert "total" in data, "Response should contain 'total'"
        print(f"✓ Found {data['total']} activity log entries")
    
    def test_23_get_activity_log_with_filters(self):
        """GET /api/rbac/activity-log - Get activity log with filters"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/activity-log?action=create&limit=10",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Activity log with filters working")
    
    def test_24_export_activity_log(self):
        """GET /api/rbac/activity-log/export - Export activity log"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/activity-log/export?from_date=2026-01-01&to_date=2026-12-31",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify export structure
        assert "export_date" in data, "Should have export_date"
        assert "period" in data, "Should have period"
        assert "total_records" in data, "Should have total_records"
        assert "data" in data, "Should have data array"
        
        print(f"✓ Exported {data['total_records']} activity log records")
    
    # ==================== BULK PERMISSION UPDATES ====================
    
    def test_25_bulk_update_permissions(self):
        """POST /api/rbac/bulk-update-permissions - Bulk update permissions"""
        token = self.get_superadmin_token()
        
        # Get some users first
        users_response = self.session.get(
            f"{BASE_URL}/api/users",
            headers=self.auth_headers(token)
        )
        
        if users_response.status_code != 200:
            pytest.skip("Could not get users for bulk update test")
        
        users = users_response.json()
        if len(users) < 1:
            pytest.skip("No users available for bulk update test")
        
        # Use fake user IDs to avoid modifying real users
        bulk_data = {
            "user_ids": ["fake_user_1", "fake_user_2"],
            "permissions": {
                "sales": ["view", "create"],
                "inventory": ["view"]
            },
            "mode": "replace"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/rbac/bulk-update-permissions",
            headers=self.auth_headers(token),
            json=bulk_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Should have success message"
        assert "updated_count" in data, "Should have updated_count"
        print(f"✓ Bulk permission update: {data['updated_count']} users updated")
    
    # ==================== PERMISSION CHECK ====================
    
    def test_26_check_permission(self):
        """GET /api/rbac/check-permission - Check specific permission"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/check-permission?module=sales&action=create",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "has_permission" in data, "Should have has_permission"
        assert data["has_permission"] == True, "Superadmin should have all permissions"
        
        print(f"✓ Permission check: has_permission={data['has_permission']}")
    
    def test_27_check_permission_for_other_user(self):
        """GET /api/rbac/check-permission - Check permission for another user"""
        token = self.get_superadmin_token()
        
        # Get a non-admin user
        users_response = self.session.get(
            f"{BASE_URL}/api/users",
            headers=self.auth_headers(token)
        )
        
        if users_response.status_code != 200:
            pytest.skip("Could not get users")
        
        users = users_response.json()
        non_admin_user = next((u for u in users if u.get("role") not in ["admin", "superadmin"]), None)
        
        if not non_admin_user:
            pytest.skip("No non-admin user available")
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/check-permission?module=sales&action=create&target_user_id={non_admin_user['id']}",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "has_permission" in data
        print(f"✓ Permission check for user {non_admin_user['id']}: has_permission={data['has_permission']}")
    
    # ==================== RBAC STATS ====================
    
    def test_28_get_rbac_stats(self):
        """GET /api/rbac/stats - Get RBAC dashboard statistics"""
        token = self.get_superadmin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/rbac/stats",
            headers=self.auth_headers(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_users" in data, "Should have total_users"
        assert "users_by_role" in data, "Should have users_by_role"
        assert "total_roles" in data, "Should have total_roles"
        assert "active_sessions" in data, "Should have active_sessions"
        assert "active_api_keys" in data, "Should have active_api_keys"
        assert "failed_logins_24h" in data, "Should have failed_logins_24h"
        
        print(f"✓ RBAC Stats: {data['total_users']} users, {data['active_sessions']} active sessions")
    
    # ==================== ACCESS CONTROL TESTS ====================
    
    def test_29_staff_cannot_access_admin_endpoints(self):
        """Verify staff users cannot access admin-only RBAC endpoints"""
        staff_token = self.get_staff_token()
        
        if not staff_token:
            pytest.skip("Staff user not available")
        
        # Try to access admin-only endpoints
        admin_endpoints = [
            "/api/rbac/sessions",
            "/api/rbac/ip-whitelist",
            "/api/rbac/access-schedule",
            "/api/rbac/api-keys",
            "/api/rbac/activity-log",
            "/api/rbac/stats"
        ]
        
        for endpoint in admin_endpoints:
            response = self.session.get(
                f"{BASE_URL}{endpoint}",
                headers=self.auth_headers(staff_token)
            )
            assert response.status_code == 403, f"Staff should not access {endpoint}, got {response.status_code}"
        
        print("✓ Staff correctly denied access to admin-only endpoints")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
