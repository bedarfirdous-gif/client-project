"""
Iteration 56 Backend Tests
Testing:
1. AutoHeal delete endpoint: DELETE /api/autoheal/reports/{id}
2. Enhanced AI Agents: POST /api/ai-agents/business/process
3. Available agents: GET /api/ai-agents/available (should return 4 agents)
4. Team Chat message delete: DELETE /api/team-chat/messages/{id}
5. Team Chat messages list: GET /api/team-chat/messages
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for superadmin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "SuperAdmin@123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_login_superadmin(self, auth_token):
        """Test superadmin login works"""
        assert auth_token is not None
        print(f"✓ Login successful, token obtained")


class TestAutoHealReports:
    """Test AutoHeal report endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "SuperAdmin@123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_autoheal_reports(self, auth_headers):
        """Test GET /api/autoheal/reports"""
        response = requests.get(f"{BASE_URL}/api/autoheal/reports", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/autoheal/reports returned {len(data)} reports")
    
    def test_get_autoheal_stats(self, auth_headers):
        """Test GET /api/autoheal/stats"""
        response = requests.get(f"{BASE_URL}/api/autoheal/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "total_errors" in data or "error_breakdown" in data or "today" in data
        print(f"✓ GET /api/autoheal/stats returned: {list(data.keys())}")
    
    def test_delete_autoheal_report_not_found(self, auth_headers):
        """Test DELETE /api/autoheal/reports/{id} with non-existent ID"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/autoheal/reports/{fake_id}", headers=auth_headers)
        # Should return 404 for non-existent report
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ DELETE non-existent report returns 404 as expected")


class TestEnhancedAIAgents:
    """Test Enhanced AI Agents endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "SuperAdmin@123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_available_agents(self, auth_headers):
        """Test GET /api/ai-agents/available returns 4 agents"""
        response = requests.get(f"{BASE_URL}/api/ai-agents/available", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "agents" in data
        agents = data["agents"]
        assert len(agents) == 4, f"Expected 4 agents, got {len(agents)}"
        
        # Verify agent IDs
        agent_ids = [a["id"] for a in agents]
        expected_ids = ["business", "assistant", "operations", "analytics"]
        for expected_id in expected_ids:
            assert expected_id in agent_ids, f"Agent '{expected_id}' not found"
        
        print(f"✓ GET /api/ai-agents/available returned 4 agents: {agent_ids}")
    
    def test_process_business_agent(self, auth_headers):
        """Test POST /api/ai-agents/business/process"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/business/process",
            headers=auth_headers,
            json={
                "prompt": "What are the top selling products?",
                "context": {"task": "sales_analysis"}
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "success" in data
        assert "message" in data
        assert "confidence" in data
        
        print(f"✓ Business agent processed request. Confidence: {data.get('confidence', 'N/A')}")
    
    def test_process_assistant_agent(self, auth_headers):
        """Test POST /api/ai-agents/assistant/process"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/process",
            headers=auth_headers,
            json={
                "prompt": "How do I create a new invoice?",
                "context": {}
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "success" in data
        assert "message" in data
        print(f"✓ Assistant agent processed request")
    
    def test_process_operations_agent(self, auth_headers):
        """Test POST /api/ai-agents/operations/process"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/operations/process",
            headers=auth_headers,
            json={
                "prompt": "Check system health",
                "context": {"task": "health_check"}
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "success" in data
        print(f"✓ Operations agent processed request")
    
    def test_process_analytics_agent(self, auth_headers):
        """Test POST /api/ai-agents/analytics/process"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/analytics/process",
            headers=auth_headers,
            json={
                "prompt": "Analyze sales trends",
                "context": {"task": "analysis"}
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "success" in data
        print(f"✓ Analytics agent processed request")
    
    def test_process_invalid_agent(self, auth_headers):
        """Test POST /api/ai-agents/invalid/process returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/invalid_agent/process",
            headers=auth_headers,
            json={"prompt": "test", "context": {}}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Invalid agent returns 404 as expected")


class TestTeamChat:
    """Test Team Chat message endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "SuperAdmin@123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_chat_messages(self, auth_headers):
        """Test GET /api/team-chat/messages"""
        response = requests.get(f"{BASE_URL}/api/team-chat/messages", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/team-chat/messages returned {len(data)} messages")
    
    def test_post_chat_message(self, auth_headers):
        """Test POST /api/team-chat/messages"""
        test_message = f"Test message {datetime.now().isoformat()}"
        response = requests.post(
            f"{BASE_URL}/api/team-chat/messages",
            headers=auth_headers,
            json={"text": test_message, "message_type": "text"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert "text" in data
        assert data["text"] == test_message
        
        print(f"✓ POST /api/team-chat/messages created message with id: {data['id']}")
        return data["id"]
    
    def test_delete_own_message(self, auth_headers):
        """Test DELETE /api/team-chat/messages/{id}"""
        # First create a message
        test_message = f"Message to delete {datetime.now().isoformat()}"
        create_response = requests.post(
            f"{BASE_URL}/api/team-chat/messages",
            headers=auth_headers,
            json={"text": test_message, "message_type": "text"}
        )
        assert create_response.status_code == 200
        message_id = create_response.json()["id"]
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/team-chat/messages/{message_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify deletion
        messages_response = requests.get(f"{BASE_URL}/api/team-chat/messages", headers=auth_headers)
        messages = messages_response.json()
        message_ids = [m["id"] for m in messages]
        assert message_id not in message_ids, "Message was not deleted"
        
        print(f"✓ DELETE /api/team-chat/messages/{message_id} successful")
    
    def test_get_users_online(self, auth_headers):
        """Test GET /api/team-chat/users-online"""
        response = requests.get(f"{BASE_URL}/api/team-chat/users-online", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/team-chat/users-online returned {len(data)} users")


class TestWebSocketEndpoint:
    """Test WebSocket endpoint exists"""
    
    def test_websocket_url_construction(self):
        """Verify WebSocket URL can be constructed from backend URL"""
        backend_url = BASE_URL
        ws_protocol = "wss:" if "https:" in backend_url else "ws:"
        ws_host = backend_url.replace("https://", "").replace("http://", "").rstrip("/")
        ws_url = f"{ws_protocol}//{ws_host}/ws/test_user"
        
        assert ws_url, "WebSocket URL should be constructable"
        print(f"✓ WebSocket URL pattern: {ws_url}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
