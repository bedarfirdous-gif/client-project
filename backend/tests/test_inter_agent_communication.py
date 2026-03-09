"""
Test Inter-Agent Communication API Endpoints
============================================
Tests for the new inter-agent communication feature:
- GET /api/orchestrator/communication/log
- GET /api/orchestrator/communication/stats  
- POST /api/orchestrator/communication/send
- POST /api/orchestrator/communication/handoff
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for superadmin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("access_token")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestCommunicationLogEndpoint:
    """Tests for GET /api/orchestrator/communication/log"""
    
    def test_get_communication_log_success(self, auth_headers):
        """Test getting communication log returns 200 and correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/communication/log?limit=50&hours=24",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "messages" in data, "Response should have 'messages' field"
        assert "stats" in data, "Response should have 'stats' field"
        assert isinstance(data["messages"], list), "messages should be a list"
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_messages" in stats, "Stats should have 'total_messages'"
        assert "handoffs" in stats, "Stats should have 'handoffs'"
        assert "consultations" in stats, "Stats should have 'consultations'"
        assert "escalations" in stats, "Stats should have 'escalations'"
        print(f"Communication log retrieved: {len(data['messages'])} messages, stats={stats}")
    
    def test_get_communication_log_unauthenticated(self):
        """Test that unauthenticated request is rejected"""
        response = requests.get(f"{BASE_URL}/api/orchestrator/communication/log")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Unauthenticated request correctly rejected")
    
    def test_get_communication_log_with_filters(self, auth_headers):
        """Test communication log with various filter parameters"""
        # Test with message_type filter
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/communication/log?message_type=handoff&hours=24",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Filter by message_type failed: {response.text}"
        print(f"Filter by message_type works, got {len(response.json().get('messages', []))} messages")


class TestCommunicationStatsEndpoint:
    """Tests for GET /api/orchestrator/communication/stats"""
    
    def test_get_communication_stats_success(self, auth_headers):
        """Test getting per-agent communication stats"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/communication/stats?hours=24",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure - can have 'agents' array
        assert isinstance(data, dict), "Response should be a dict"
        # Stats endpoint returns agent-level statistics
        if "agents" in data:
            assert isinstance(data["agents"], list), "agents should be a list"
            print(f"Communication stats retrieved: {len(data.get('agents', []))} agents tracked")
        else:
            print(f"Communication stats retrieved: {data}")
    
    def test_get_communication_stats_different_hours(self, auth_headers):
        """Test stats with different time periods"""
        for hours in [6, 24, 48]:
            response = requests.get(
                f"{BASE_URL}/api/orchestrator/communication/stats?hours={hours}",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Stats for {hours}h failed: {response.text}"
        print("Stats with different time periods works correctly")


class TestSendMessageEndpoint:
    """Tests for POST /api/orchestrator/communication/send"""
    
    def test_send_message_success(self, auth_headers):
        """Test sending a message between agents"""
        message_data = {
            "from_agent": "error_autofix",
            "to_agent": "ui_blink_fix",
            "message_type": "consultation",
            "content": {
                "question": "TEST: Need analysis on UI component rendering issue",
                "context": "Testing inter-agent communication endpoint"
            },
            "priority": "normal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/communication/send",
            headers=auth_headers,
            json=message_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message_id" in data, "Response should have message_id"
        assert data.get("type") == "consultation", f"Expected type 'consultation', got {data.get('type')}"
        print(f"Message sent successfully: {data}")
    
    def test_send_message_missing_fields(self, auth_headers):
        """Test that missing required fields returns error"""
        # Missing to_agent
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/communication/send",
            headers=auth_headers,
            json={"from_agent": "test", "message_type": "notification", "content": {}}
        )
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"
        print("Missing fields correctly rejected with 422")


class TestHandoffEndpoint:
    """Tests for POST /api/orchestrator/communication/handoff"""
    
    def test_handoff_with_nonexistent_error(self, auth_headers):
        """Test handoff with non-existent error returns 404"""
        handoff_data = {
            "error_id": "nonexistent-error-id-12345",
            "from_agent": "error_autofix",
            "to_agent": "ui_blink_fix",
            "reason": "Testing handoff endpoint"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/communication/handoff",
            headers=auth_headers,
            json=handoff_data
        )
        # Should return 404 as error doesn't exist
        assert response.status_code == 404, f"Expected 404 for non-existent error, got {response.status_code}: {response.text}"
        print("Handoff with non-existent error correctly returns 404")
    
    def test_handoff_unauthenticated(self):
        """Test handoff requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/orchestrator/communication/handoff",
            json={"error_id": "test", "from_agent": "a", "to_agent": "b", "reason": "test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Handoff correctly requires authentication")


class TestCommunicationIntegration:
    """Integration tests for the complete communication flow"""
    
    def test_send_then_check_log(self, auth_headers):
        """Test that sent messages appear in the communication log"""
        # Send a unique test message
        unique_id = str(uuid.uuid4())[:8]
        message_data = {
            "from_agent": "error_autofix",
            "to_agent": "performance_agent",
            "message_type": "notification",
            "content": {
                "message": f"TEST_MSG_{unique_id}: Integration test message"
            },
            "priority": "normal"
        }
        
        # Send message
        send_response = requests.post(
            f"{BASE_URL}/api/orchestrator/communication/send",
            headers=auth_headers,
            json=message_data
        )
        assert send_response.status_code == 200, f"Send failed: {send_response.text}"
        sent_message = send_response.json()
        message_id = sent_message.get("message_id")
        print(f"Sent test message with ID: {message_id}")
        
        # Retrieve log and verify message appears
        log_response = requests.get(
            f"{BASE_URL}/api/orchestrator/communication/log?limit=10&hours=1",
            headers=auth_headers
        )
        assert log_response.status_code == 200, f"Log retrieval failed: {log_response.text}"
        
        log_data = log_response.json()
        messages = log_data.get("messages", [])
        
        # Find our test message
        found = any(m.get("message_id") == message_id for m in messages)
        assert found, f"Sent message {message_id} not found in communication log"
        print(f"Integration test passed: Message {message_id} found in log")
    
    def test_message_type_statistics(self, auth_headers):
        """Test that message types are correctly counted in stats"""
        # Get initial stats
        initial_response = requests.get(
            f"{BASE_URL}/api/orchestrator/communication/log?hours=24",
            headers=auth_headers
        )
        assert initial_response.status_code == 200
        initial_stats = initial_response.json().get("stats", {})
        
        # Stats should have the expected keys
        expected_keys = ["total_messages", "handoffs", "consultations", "escalations"]
        for key in expected_keys:
            assert key in initial_stats, f"Stats missing '{key}' field"
        
        print(f"Stats structure correct with values: {initial_stats}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
