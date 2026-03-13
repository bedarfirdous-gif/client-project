"""
AI Agent Orchestration System Tests
Tests for:
- AI Agent status endpoint
- AI Agent chat endpoint  
- AI Agent session management (create, list, delete)
- AI Agent conversation history
- 4 agents initialization (Business, Assistant, Operations, Analytics)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "admin123"


class TestAIAgentOrchestration:
    """AI Agent Orchestration System Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - authenticate as super admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Super admin login failed - skipping AI Agent tests")
        
        login_data = login_response.json()
        self.token = login_data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.test_session_id = None
        
    # ========== STATUS ENDPOINT TESTS ==========
    
    def test_ai_agent_status_endpoint_returns_200(self):
        """Test GET /api/superadmin/ai-agent/status returns 200"""
        response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ AI Agent status endpoint returns 200")
    
    def test_ai_agent_status_returns_agents(self):
        """Test status endpoint returns agents object"""
        response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/status")
        data = response.json()
        
        assert "agents" in data, "Response should contain 'agents' key"
        assert isinstance(data["agents"], dict), "agents should be a dict"
        print(f"✓ Status returns agents: {list(data['agents'].keys())}")
    
    def test_ai_agent_status_has_4_agents(self):
        """Test that 4 agents are initialized: Business, Assistant, Operations, Analytics"""
        response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/status")
        data = response.json()
        
        agents = data.get("agents", {})
        assert len(agents) == 4, f"Expected 4 agents, got {len(agents)}"
        
        # Check expected agent IDs
        expected_agents = ["business-agent", "assistant-agent", "operations-agent", "analytics-agent"]
        for agent_id in expected_agents:
            assert agent_id in agents, f"Missing agent: {agent_id}"
        
        print(f"✓ All 4 agents initialized: {list(agents.keys())}")
    
    def test_ai_agent_status_agent_has_required_fields(self):
        """Test each agent has required fields: type, status, capabilities"""
        response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/status")
        data = response.json()
        
        agents = data.get("agents", {})
        required_fields = ["type", "status", "capabilities", "performance_score", "tasks_completed"]
        
        for agent_id, agent_data in agents.items():
            for field in required_fields:
                assert field in agent_data, f"Agent {agent_id} missing field: {field}"
        
        print("✓ All agents have required fields")
    
    def test_ai_agent_status_agent_types(self):
        """Test agent types match expected values"""
        response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/status")
        data = response.json()
        
        agents = data.get("agents", {})
        expected_types = {
            "business-agent": "business",
            "assistant-agent": "assistant", 
            "operations-agent": "operations",
            "analytics-agent": "analytics"
        }
        
        for agent_id, expected_type in expected_types.items():
            assert agents[agent_id]["type"] == expected_type, \
                f"Agent {agent_id} type mismatch: expected {expected_type}, got {agents[agent_id]['type']}"
        
        print("✓ All agent types are correct")
    
    def test_ai_agent_status_returns_total_agents(self):
        """Test status returns total_agents count"""
        response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/status")
        data = response.json()
        
        assert "total_agents" in data, "Response should contain 'total_agents'"
        assert data["total_agents"] == 4, f"Expected 4 total agents, got {data['total_agents']}"
        print("✓ total_agents count is correct")
    
    # ========== CHAT ENDPOINT TESTS ==========
    
    def test_ai_agent_chat_endpoint_returns_200(self):
        """Test POST /api/superadmin/ai-agent/chat returns 200"""
        response = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "Hello, what can you do?"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ AI Agent chat endpoint returns 200")
    
    def test_ai_agent_chat_returns_response(self):
        """Test chat endpoint returns response in natural language"""
        response = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "What is your purpose?"
        })
        data = response.json()
        
        assert "response" in data, "Response should contain 'response' key"
        assert isinstance(data["response"], str), "response should be a string"
        assert len(data["response"]) > 0, "response should not be empty"
        print(f"✓ Chat returns response: {data['response'][:100]}...")
    
    def test_ai_agent_chat_returns_session_id(self):
        """Test chat endpoint returns session_id"""
        response = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "Test message"
        })
        data = response.json()
        
        assert "session_id" in data, "Response should contain 'session_id'"
        assert isinstance(data["session_id"], str), "session_id should be a string"
        self.test_session_id = data["session_id"]
        print(f"✓ Chat returns session_id: {data['session_id']}")
    
    def test_ai_agent_chat_returns_agent_info(self):
        """Test chat endpoint returns agent and agent_type"""
        response = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "What is the system health?"
        })
        data = response.json()
        
        assert "agent" in data, "Response should contain 'agent'"
        assert "agent_type" in data, "Response should contain 'agent_type'"
        print(f"✓ Chat returns agent info: agent={data['agent']}, type={data['agent_type']}")
    
    def test_ai_agent_chat_system_health_query(self):
        """Test asking about system health"""
        response = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "Check system health status"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        # Should get a meaningful response about system health
        print(f"✓ System health query works: {data['response'][:150]}...")
    
    def test_ai_agent_chat_sales_query(self):
        """Test asking about sales summary"""
        response = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "Show me sales summary for this week"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        print(f"✓ Sales query works: {data['response'][:150]}...")
    
    def test_ai_agent_chat_with_existing_session(self):
        """Test continuing conversation with existing session ID"""
        # First message
        response1 = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "Remember my name is TestUser"
        })
        data1 = response1.json()
        session_id = data1.get("session_id")
        
        # Wait for processing
        time.sleep(1)
        
        # Second message with same session
        response2 = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "What was I saying earlier?",
            "session_id": session_id
        })
        
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2.get("session_id") == session_id, "Should use same session ID"
        print(f"✓ Session continuity works with session: {session_id}")
    
    # ========== SESSION MANAGEMENT TESTS ==========
    
    def test_ai_agent_sessions_list_endpoint(self):
        """Test GET /api/superadmin/ai-agent/sessions returns list"""
        response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/sessions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "sessions" in data, "Response should contain 'sessions'"
        assert isinstance(data["sessions"], list), "sessions should be a list"
        print(f"✓ Sessions endpoint returns list with {len(data['sessions'])} sessions")
    
    def test_ai_agent_session_has_required_fields(self):
        """Test sessions have required fields"""
        # Create a session first
        self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "TEST_session_fields test"
        })
        
        time.sleep(1)
        
        response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/sessions")
        data = response.json()
        
        if data["sessions"]:
            session = data["sessions"][0]
            required_fields = ["_id", "last_message", "last_timestamp", "message_count"]
            for field in required_fields:
                assert field in session, f"Session missing field: {field}"
            print(f"✓ Session has required fields: {list(session.keys())}")
        else:
            print("⚠ No sessions to verify fields")
    
    # ========== CONVERSATION HISTORY TESTS ==========
    
    def test_ai_agent_history_endpoint(self):
        """Test GET /api/superadmin/ai-agent/history/{session_id}"""
        # Create a conversation first
        chat_response = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "TEST_history test message"
        })
        session_id = chat_response.json().get("session_id")
        
        time.sleep(1)
        
        # Get history
        response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/history/{session_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "history" in data, "Response should contain 'history'"
        assert "session_id" in data, "Response should contain 'session_id'"
        assert data["session_id"] == session_id
        print(f"✓ History endpoint works for session: {session_id}")
    
    def test_ai_agent_history_contains_messages(self):
        """Test history contains user and assistant messages"""
        # Create a conversation
        chat_response = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "TEST_history_messages test"
        })
        session_id = chat_response.json().get("session_id")
        
        time.sleep(2)
        
        # Get history
        response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/history/{session_id}")
        data = response.json()
        
        history = data.get("history", [])
        assert len(history) >= 2, f"Expected at least 2 messages (user + assistant), got {len(history)}"
        
        # Check message roles
        roles = [msg.get("role") for msg in history]
        assert "user" in roles, "History should contain user message"
        assert "assistant" in roles, "History should contain assistant message"
        print(f"✓ History contains {len(history)} messages with roles: {set(roles)}")
    
    # ========== SESSION DELETE TESTS ==========
    
    def test_ai_agent_delete_session(self):
        """Test DELETE /api/superadmin/ai-agent/session/{session_id}"""
        # Create a session first
        chat_response = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "TEST_delete_session test"
        })
        session_id = chat_response.json().get("session_id")
        
        time.sleep(1)
        
        # Delete the session
        delete_response = self.session.delete(f"{BASE_URL}/api/superadmin/ai-agent/session/{session_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        data = delete_response.json()
        assert data.get("success") == True, "Delete should return success=True"
        assert "deleted_count" in data, "Response should contain 'deleted_count'"
        print(f"✓ Session deleted successfully, deleted {data['deleted_count']} messages")
    
    def test_ai_agent_delete_session_verifies_removal(self):
        """Test that deleted session history is empty"""
        # Create a session
        chat_response = self.session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "TEST_delete_verify test"
        })
        session_id = chat_response.json().get("session_id")
        
        time.sleep(1)
        
        # Delete the session
        self.session.delete(f"{BASE_URL}/api/superadmin/ai-agent/session/{session_id}")
        
        # Verify history is empty
        history_response = self.session.get(f"{BASE_URL}/api/superadmin/ai-agent/history/{session_id}")
        data = history_response.json()
        
        assert len(data.get("history", [])) == 0, "Deleted session should have no history"
        print("✓ Deleted session has no history (verified)")
    
    # ========== PERMISSION TESTS ==========
    
    def test_ai_agent_chat_requires_superadmin(self):
        """Test that non-superadmin cannot access chat"""
        # Try with no auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.post(f"{BASE_URL}/api/superadmin/ai-agent/chat", json={
            "message": "Test"
        })
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated, got {response.status_code}"
        print("✓ Chat endpoint requires authentication")
    
    def test_ai_agent_status_requires_superadmin(self):
        """Test that non-superadmin cannot access status"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.get(f"{BASE_URL}/api/superadmin/ai-agent/status")
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated, got {response.status_code}"
        print("✓ Status endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
