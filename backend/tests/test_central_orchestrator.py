"""
Test Central Agent Orchestrator APIs
Tests for auto-start, unified status, notifications, and analytics
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCentralOrchestrator:
    """Central Agent Orchestrator API Tests"""
    
    @pytest.fixture(scope='class')
    def auth_token(self):
        """Get authentication token for superadmin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("access_token")
    
    @pytest.fixture(scope='class')
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    # ========== Orchestrator Status Tests ==========
    
    def test_get_orchestrator_status(self, auth_headers):
        """Test GET /api/orchestrator/status returns unified status with agent list"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/status", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify required fields
        assert "orchestrator_running" in data
        assert "total_agents" in data
        assert "running_agents" in data
        assert "stopped_agents" in data
        assert "total_errors_handled" in data
        assert "total_fixes_applied" in data
        assert "unread_notifications" in data
        assert "failed_fixes_24h" in data
        assert "agents" in data
        
        # Verify agents list
        assert isinstance(data["agents"], list)
        assert data["total_agents"] >= 4, "Should have at least 4 registered agents"
        
        # Check agent structure
        if len(data["agents"]) > 0:
            agent = data["agents"][0]
            assert "agent_id" in agent
            assert "agent_name" in agent
            assert "agent_type" in agent
            assert "status" in agent
            assert "capabilities" in agent
            assert "errors_handled" in agent
            assert "fixes_applied" in agent
        
        print(f"Orchestrator Status: running={data['orchestrator_running']}, agents={data['total_agents']}, running={data['running_agents']}")
    
    def test_status_contains_all_expected_agents(self, auth_headers):
        """Verify all 4 registered agents are present in status"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/status", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        agent_ids = [a["agent_id"] for a in data["agents"]]
        
        # Check for 4 expected agents
        expected_agents = ["ui_blink_fix", "error_autofix", "performance_agent", "error_fix_52"]
        for agent_id in expected_agents:
            assert agent_id in agent_ids, f"Agent {agent_id} not found in status"
        
        print(f"All expected agents found: {expected_agents}")
    
    def test_agent_status_values(self, auth_headers):
        """Check that agent statuses are valid values"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/status", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        valid_statuses = ["running", "stopped", "starting", "error", "paused"]
        
        for agent in data["agents"]:
            assert agent["status"] in valid_statuses, f"Invalid status {agent['status']} for agent {agent['agent_id']}"
        
        # Log status of each agent
        for agent in data["agents"]:
            print(f"Agent {agent['agent_id']}: {agent['status']}")
    
    # ========== Start/Stop All Tests ==========
    
    def test_start_all_agents(self, auth_headers):
        """Test POST /api/orchestrator/start-all starts all agents"""
        response = requests.post(f"{BASE_URL}/api/orchestrator/start-all", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "result" in data
        
        result = data["result"]
        assert "started" in result
        assert "failed" in result
        assert "already_running" in result
        
        print(f"Start All Result: started={len(result.get('started', []))}, already_running={len(result.get('already_running', []))}, failed={len(result.get('failed', []))}")
    
    def test_stop_all_agents(self, auth_headers):
        """Test POST /api/orchestrator/stop-all stops all agents"""
        response = requests.post(f"{BASE_URL}/api/orchestrator/stop-all", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "result" in data
        
        result = data["result"]
        assert "stopped" in result
        assert "failed" in result
        
        print(f"Stop All Result: stopped={len(result.get('stopped', []))}, failed={len(result.get('failed', []))}")
    
    def test_start_agents_after_stop(self, auth_headers):
        """Test that agents can be started after being stopped"""
        # Start again after the stop test
        response = requests.post(f"{BASE_URL}/api/orchestrator/start-all", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        result = data["result"]
        
        # Verify some agents were started or were already running
        total = len(result.get("started", [])) + len(result.get("already_running", [])) + len(result.get("no_auto_start", []))
        assert total > 0, "No agents were started or running"
        
        print(f"Restart Result: started={len(result.get('started', []))}, already_running={len(result.get('already_running', []))}")
    
    # ========== Notifications Tests ==========
    
    def test_get_notifications(self, auth_headers):
        """Test GET /api/orchestrator/notifications returns notification list"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/notifications", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "notifications" in data
        assert "total" in data
        assert isinstance(data["notifications"], list)
        
        print(f"Notifications count: {data['total']}")
        
        # If there are notifications, check structure
        if len(data["notifications"]) > 0:
            notif = data["notifications"][0]
            assert "notification_id" in notif
            assert "notification_type" in notif
            assert "title" in notif
            assert "message" in notif
            assert "severity" in notif
            assert "created_at" in notif
            assert "read" in notif
            assert "dismissed" in notif
            print(f"Sample notification: {notif['title']}")
    
    def test_get_notifications_with_limit(self, auth_headers):
        """Test GET /api/orchestrator/notifications with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/notifications?limit=5", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert len(data["notifications"]) <= 5, "Limit not respected"
        print(f"Notifications returned with limit=5: {len(data['notifications'])}")
    
    def test_get_unread_notifications_only(self, auth_headers):
        """Test GET /api/orchestrator/notifications with unread_only=true"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/notifications?unread_only=true", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # All returned notifications should be unread
        for notif in data["notifications"]:
            assert notif["read"] == False, f"Found read notification when requesting unread only"
        
        print(f"Unread notifications: {len(data['notifications'])}")
    
    # ========== Mark Read / Dismiss Tests ==========
    
    def test_mark_notification_read(self, auth_headers):
        """Test PUT /api/orchestrator/notifications/{id}/read marks as read"""
        # First get notifications
        response = requests.get(f"{BASE_URL}/api/orchestrator/notifications?unread_only=true&limit=1", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        if len(data["notifications"]) == 0:
            pytest.skip("No unread notifications to test with")
        
        notif_id = data["notifications"][0]["notification_id"]
        
        # Mark as read
        response = requests.put(f"{BASE_URL}/api/orchestrator/notifications/{notif_id}/read", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert "success" in result
        print(f"Mark read result for {notif_id}: {result['success']}")
    
    def test_dismiss_notification(self, auth_headers):
        """Test DELETE /api/orchestrator/notifications/{id} dismisses notification"""
        # First get notifications
        response = requests.get(f"{BASE_URL}/api/orchestrator/notifications?limit=1", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        if len(data["notifications"]) == 0:
            pytest.skip("No notifications to test dismiss with")
        
        notif_id = data["notifications"][0]["notification_id"]
        
        # Dismiss notification
        response = requests.delete(f"{BASE_URL}/api/orchestrator/notifications/{notif_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert "success" in result
        print(f"Dismiss result for {notif_id}: {result['success']}")
    
    # ========== Analytics Tests ==========
    
    def test_get_routing_analytics(self, auth_headers):
        """Test GET /api/orchestrator/analytics returns routing analytics"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/analytics", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "period_hours" in data
        assert "total_errors_routed" in data
        assert "total_fixed" in data
        assert "overall_success_rate" in data
        assert "by_category" in data
        assert "by_agent" in data
        
        print(f"Analytics: errors_routed={data['total_errors_routed']}, fixed={data['total_fixed']}, success_rate={data['overall_success_rate']}%")
    
    def test_get_analytics_custom_hours(self, auth_headers):
        """Test GET /api/orchestrator/analytics with custom hours parameter"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/analytics?hours=48", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["period_hours"] == 48
        print(f"Analytics for 48h: {data['total_errors_routed']} errors routed")
    
    # ========== Route Error Test ==========
    
    def test_route_error_to_agent(self, auth_headers):
        """Test POST /api/orchestrator/route-error routes an error to appropriate agent"""
        payload = {
            "error_type": "runtime",
            "error_message": "Test error for routing",
            "file_path": "/app/test.py",
            "context": {"test": True}
        }
        response = requests.post(f"{BASE_URL}/api/orchestrator/route-error", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "error_category" in data
        assert "routing_attempted" in data
        assert "fix_applied" in data
        assert "notifications_created" in data
        
        print(f"Route error result: category={data['error_category']}, agents_tried={data['routing_attempted']}, fixed={data['fix_applied']}")
    
    # ========== Authorization Tests ==========
    
    def test_orchestrator_status_requires_auth(self):
        """Test that orchestrator status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/status")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_start_all_requires_auth(self):
        """Test that start-all requires authentication"""
        response = requests.post(f"{BASE_URL}/api/orchestrator/start-all")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
