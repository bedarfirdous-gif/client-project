"""
AI Dashboard API Tests - Tests all endpoints used by the AI Dashboard UI
Features tested:
- Agent listing (/api/ai-agents/available)
- Agent chat processing (/api/ai-agents/{agent}/process)
- Agent collaboration (/api/ai-agents/{agent}/collaborate)
- Agent memory (/api/ai-agents/{agent}/memory)
- Collaboration history (/api/ai-agents/collaboration/history)
- AutoHeal reports (/api/autoheal/reports)
- AutoHeal stats (/api/autoheal/stats)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://erp-invoice-fix-1.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "SuperAdmin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    """Get auth headers for authenticated requests"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestAgentAvailability:
    """Test AI Agent availability endpoint"""
    
    def test_get_available_agents(self, auth_headers):
        """GET /api/ai-agents/available - Should return 4 agents"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/available",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "agents" in data
        
        agents = data["agents"]
        assert len(agents) == 4, f"Expected 4 agents, got {len(agents)}"
        
        # Verify all 4 agent types exist
        agent_ids = [a["id"] for a in agents]
        assert "assistant" in agent_ids, "Missing assistant agent"
        assert "business" in agent_ids, "Missing business agent"
        assert "operations" in agent_ids, "Missing operations agent"
        assert "analytics" in agent_ids, "Missing analytics agent"
        
        # Verify each agent has required fields
        for agent in agents:
            assert "id" in agent
            assert "name" in agent
            assert "description" in agent
            assert "capabilities" in agent
            assert "has_memory" in agent
            assert "supports_collaboration" in agent
            assert agent["has_memory"] == True


class TestAgentChat:
    """Test AI Agent chat processing"""
    
    def test_assistant_agent_process(self, auth_headers):
        """POST /api/ai-agents/assistant/process - Send message and get response"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/process",
            headers=auth_headers,
            json={"prompt": "What features are available?"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
        assert len(data["message"]) > 0, "Response message is empty"
        
    def test_business_agent_process(self, auth_headers):
        """POST /api/ai-agents/business/process - Business intelligence query"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/business/process",
            headers=auth_headers,
            json={"prompt": "Give me a sales summary"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
        
    def test_operations_agent_process(self, auth_headers):
        """POST /api/ai-agents/operations/process - System operations query"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/operations/process",
            headers=auth_headers,
            json={"prompt": "Check system health"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
        
    def test_analytics_agent_process(self, auth_headers):
        """POST /api/ai-agents/analytics/process - Data analytics query"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/analytics/process",
            headers=auth_headers,
            json={"prompt": "Analyze recent trends"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "message" in data


class TestAgentCollaboration:
    """Test AI Agent collaboration endpoints"""
    
    def test_agent_collaborate(self, auth_headers):
        """POST /api/ai-agents/assistant/collaborate - Multi-agent collaboration"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/collaborate",
            headers=auth_headers,
            json={
                "prompt": "Get me business insights",
                "collaboration_type": "collaborate"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
        
    def test_get_collaboration_history(self, auth_headers):
        """GET /api/ai-agents/collaboration/history - Collaboration history"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/collaboration/history?limit=5",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "history" in data
        assert "count" in data
        # History can be empty array but should exist
        assert isinstance(data["history"], list)


class TestAgentMemory:
    """Test AI Agent memory endpoints"""
    
    def test_get_assistant_memory(self, auth_headers):
        """GET /api/ai-agents/assistant/memory - Get agent memories"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/assistant/memory?limit=5",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "agent_id" in data
        assert "memories" in data
        assert "memory_count" in data
        assert isinstance(data["memories"], list)
        
    def test_get_business_memory(self, auth_headers):
        """GET /api/ai-agents/business/memory - Get business agent memories"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/business/memory?limit=5",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "agent_id" in data
        assert "memories" in data


class TestAutoHeal:
    """Test AutoHeal endpoints used by AI Dashboard"""
    
    def test_get_autoheal_reports(self, auth_headers):
        """GET /api/autoheal/reports - Get error reports list"""
        response = requests.get(
            f"{BASE_URL}/api/autoheal/reports?limit=5",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Response is a list of reports
        assert isinstance(data, list)
        
        # If reports exist, verify structure
        if len(data) > 0:
            report = data[0]
            assert "id" in report or "report_id" in report
            assert "error_type" in report
            assert "severity" in report
            
    def test_get_autoheal_stats(self, auth_headers):
        """GET /api/autoheal/stats - Get error statistics"""
        response = requests.get(
            f"{BASE_URL}/api/autoheal/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify stats structure - should have today/week breakdown
        assert "today" in data or "today_total" in data, "Missing today stats"
        
        # Check for key metrics
        if "today" in data:
            assert "total_errors" in data["today"]
            assert "auto_resolved" in data["today"]
        
        if "error_breakdown" in data:
            assert isinstance(data["error_breakdown"], list)


class TestDashboardIntegration:
    """Integration tests for full dashboard flow"""
    
    def test_full_chat_flow(self, auth_headers):
        """Test complete chat flow: send message, get response with confidence"""
        # Send message
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/process",
            headers=auth_headers,
            json={"prompt": "Hello, what can you help me with?"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
        
        # LLM responses should have high confidence
        if "confidence" in data:
            # Confidence is typically 0.5-1.0 for LLM responses
            assert data.get("confidence", 0.5) >= 0.5
            
    def test_agent_selection_and_chat(self, auth_headers):
        """Test switching agents and chatting"""
        agents = ['assistant', 'business', 'operations', 'analytics']
        
        for agent in agents:
            response = requests.post(
                f"{BASE_URL}/api/ai-agents/{agent}/process",
                headers=auth_headers,
                json={"prompt": "Quick status check"}
            )
            assert response.status_code == 200, f"Failed for agent {agent}: {response.text}"
            data = response.json()
            assert data.get("success") == True, f"Agent {agent} returned success=False"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
