"""
AI Agent Persistent Memory Tests
================================
Tests for Emergent-Grade AI Agent system with persistent memory.

Features tested:
- Login as superadmin
- POST /api/ai-agents/assistant/process with prompt
- Verify conversation_id and memory_updated=true in response
- Multi-turn conversation with same conversation_id
- GET /api/ai-agents/assistant/memory - stored memories
- GET /api/ai-agents/assistant/conversations - conversation history
- POST /api/ai-agents/assistant/learn - teach preferences
- All 4 agents: business, assistant, operations, analytics
- GET /api/ai-agents/available - all agents with has_memory=true
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "SuperAdmin@123"


class TestAIAgentMemory:
    """Test suite for AI Agent Persistent Memory"""
    
    auth_token = None
    user_id = None
    test_conversation_id = None
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login once and reuse token"""
        if not TestAIAgentMemory.auth_token:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
            )
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestAIAgentMemory.auth_token = data["access_token"]
            TestAIAgentMemory.user_id = data["user"]["id"]
        
        self.headers = {
            "Authorization": f"Bearer {TestAIAgentMemory.auth_token}",
            "Content-Type": "application/json"
        }
    
    # ============== GET AVAILABLE AGENTS ==============
    
    def test_01_get_available_agents(self):
        """Test GET /api/ai-agents/available returns all agents with has_memory=true"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/available",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "agents" in data, "Response should contain 'agents' key"
        agents = data["agents"]
        
        # Should have 4 agents
        assert len(agents) >= 4, f"Expected at least 4 agents, got {len(agents)}"
        
        # Get agent IDs
        agent_ids = [a["id"] for a in agents]
        expected_agents = ["business", "assistant", "operations", "analytics"]
        
        for expected in expected_agents:
            assert expected in agent_ids, f"Missing agent: {expected}"
        
        # Verify has_memory=true for all agents
        for agent in agents:
            assert agent.get("has_memory") == True, f"Agent {agent['id']} should have has_memory=true"
            assert agent.get("supports_conversations") == True, f"Agent {agent['id']} should support conversations"
            assert "capabilities" in agent, f"Agent {agent['id']} should have capabilities"
            assert "name" in agent, f"Agent {agent['id']} should have name"
        
        print(f"✅ Found {len(agents)} agents, all with has_memory=true")
        for agent in agents:
            print(f"   - {agent['id']}: {agent['name']}")
    
    # ============== ASSISTANT AGENT TESTS ==============
    
    def test_02_assistant_process_with_prompt(self):
        """Test POST /api/ai-agents/assistant/process with user preferences prompt"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/process",
            headers=self.headers,
            json={
                "prompt": "Remember that I prefer reports in bullet point format and I work in the retail industry",
                "context": {"test": True}
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert data.get("success") == True, f"Expected success=true, got {data}"
        assert "message" in data, "Response should contain 'message'"
        assert "conversation_id" in data, "Response should contain 'conversation_id'"
        assert data.get("memory_updated") == True, f"Expected memory_updated=true, got {data.get('memory_updated')}"
        
        # Store conversation_id for follow-up tests
        TestAIAgentMemory.test_conversation_id = data["conversation_id"]
        
        print(f"✅ Assistant processed request successfully")
        print(f"   - conversation_id: {data['conversation_id']}")
        print(f"   - memory_updated: {data['memory_updated']}")
        print(f"   - confidence: {data.get('confidence')}")
    
    def test_03_assistant_follow_up_same_conversation(self):
        """Test follow-up message with same conversation_id"""
        assert TestAIAgentMemory.test_conversation_id, "Need conversation_id from previous test"
        
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/process",
            headers=self.headers,
            json={
                "prompt": "What format did I say I prefer for reports?",
                "conversation_id": TestAIAgentMemory.test_conversation_id,
                "context": {"follow_up": True}
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Follow-up should succeed"
        assert data.get("conversation_id") == TestAIAgentMemory.test_conversation_id, "Should use same conversation_id"
        assert data.get("memory_updated") == True, "Memory should be updated"
        
        print(f"✅ Follow-up processed with same conversation_id")
        print(f"   - Response: {data.get('message', '')[:100]}...")
    
    def test_04_get_assistant_memory(self):
        """Test GET /api/ai-agents/assistant/memory returns stored memories"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/assistant/memory",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "agent_id" in data, "Response should contain 'agent_id'"
        assert "user_id" in data, "Response should contain 'user_id'"
        assert "memory_count" in data, "Response should contain 'memory_count'"
        assert "memories" in data, "Response should contain 'memories'"
        
        # Should have at least 1 memory from our test
        memory_count = data.get("memory_count", 0)
        assert memory_count >= 1, f"Expected at least 1 memory, got {memory_count}"
        
        # Validate memory structure
        if data["memories"]:
            memory = data["memories"][0]
            assert "id" in memory, "Memory should have 'id'"
            assert "type" in memory, "Memory should have 'type'"
            assert "content" in memory, "Memory should have 'content'"
            assert "created_at" in memory, "Memory should have 'created_at'"
        
        print(f"✅ Found {memory_count} memories for assistant agent")
    
    def test_05_get_assistant_conversations(self):
        """Test GET /api/ai-agents/assistant/conversations returns conversation history"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/assistant/conversations",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "agent_id" in data, "Response should contain 'agent_id'"
        assert "conversation_count" in data, "Response should contain 'conversation_count'"
        assert "turns" in data, "Response should contain 'turns'"
        
        # Should have conversation turns from our tests
        conv_count = data.get("conversation_count", 0)
        assert conv_count >= 2, f"Expected at least 2 conversation turns, got {conv_count}"
        
        # Validate turn structure
        if data["turns"]:
            turn = data["turns"][0]
            assert "role" in turn, "Turn should have 'role'"
            assert "content" in turn, "Turn should have 'content'"
            assert "timestamp" in turn, "Turn should have 'timestamp'"
        
        print(f"✅ Found {conv_count} conversation turns")
    
    def test_06_teach_assistant_preference(self):
        """Test POST /api/ai-agents/assistant/learn to teach a preference"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/learn",
            headers=self.headers,
            json={
                "type": "preference",
                "key": "report_format",
                "value": "bullet_points"
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain 'message'"
        assert data.get("type") == "preference", f"Expected type='preference', got {data.get('type')}"
        
        print(f"✅ Preference learned successfully: {data.get('message')}")
    
    def test_07_teach_assistant_pattern(self):
        """Test POST /api/ai-agents/assistant/learn to teach a pattern"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/learn",
            headers=self.headers,
            json={
                "type": "pattern",
                "pattern_type": "custom",
                "pattern_data": {
                    "trigger": "daily_summary",
                    "format": "executive_brief"
                },
                "importance": 0.9
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("type") == "pattern", f"Expected type='pattern', got {data.get('type')}"
        
        print(f"✅ Pattern learned successfully: {data.get('message')}")
    
    # ============== BUSINESS AGENT TESTS ==============
    
    def test_08_business_agent_process(self):
        """Test POST /api/ai-agents/business/process"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/business/process",
            headers=self.headers,
            json={
                "prompt": "Give me a quick analysis of sales performance trends",
                "context": {"test_mode": True}
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Business agent should succeed"
        assert "conversation_id" in data, "Should return conversation_id"
        assert data.get("memory_updated") == True, "Memory should be updated"
        
        print(f"✅ Business agent processed successfully")
        print(f"   - conversation_id: {data.get('conversation_id')}")
    
    def test_09_business_agent_memory(self):
        """Test GET /api/ai-agents/business/memory"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/business/memory",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("agent_id") == "business-intelligence-agent", f"Expected business agent, got {data.get('agent_id')}"
        assert "memory_count" in data
        
        print(f"✅ Business agent memory retrieved: {data.get('memory_count')} memories")
    
    # ============== OPERATIONS AGENT TESTS ==============
    
    def test_10_operations_agent_process(self):
        """Test POST /api/ai-agents/operations/process"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/operations/process",
            headers=self.headers,
            json={
                "prompt": "Check system health status",
                "context": {"test_mode": True}
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Operations agent should succeed"
        assert "conversation_id" in data, "Should return conversation_id"
        assert data.get("memory_updated") == True, "Memory should be updated"
        
        print(f"✅ Operations agent processed successfully")
    
    def test_11_operations_agent_conversations(self):
        """Test GET /api/ai-agents/operations/conversations"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/operations/conversations",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("agent_id") == "system-operations-agent"
        assert "conversation_count" in data
        
        print(f"✅ Operations agent conversations: {data.get('conversation_count')} turns")
    
    # ============== ANALYTICS AGENT TESTS ==============
    
    def test_12_analytics_agent_process(self):
        """Test POST /api/ai-agents/analytics/process"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/analytics/process",
            headers=self.headers,
            json={
                "prompt": "What trends can you identify from recent sales data?",
                "context": {"test_mode": True}
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Analytics agent should succeed"
        assert "conversation_id" in data, "Should return conversation_id"
        assert data.get("memory_updated") == True, "Memory should be updated"
        
        print(f"✅ Analytics agent processed successfully")
    
    def test_13_analytics_agent_learn(self):
        """Test POST /api/ai-agents/analytics/learn"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/analytics/learn",
            headers=self.headers,
            json={
                "type": "preference",
                "key": "chart_style",
                "value": "bar_charts"
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("type") == "preference"
        print(f"✅ Analytics agent preference stored")
    
    # ============== MEMORY PERSISTENCE VERIFICATION ==============
    
    def test_14_verify_memory_persistence(self):
        """Verify memories are actually persisted to MongoDB"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/assistant/memory",
            headers=self.headers,
            params={"limit": 50}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check we have multiple memory types
        memory_types = set(m["type"] for m in data.get("memories", []))
        
        print(f"✅ Memory persistence verified")
        print(f"   - Total memories: {data.get('memory_count')}")
        print(f"   - Memory types: {memory_types}")
        
        # Should have conversation memories at minimum
        assert "conversation" in memory_types or data.get("memory_count", 0) > 0, "Should have some memories"
    
    def test_15_filter_memory_by_type(self):
        """Test filtering memories by type"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agents/assistant/memory",
            headers=self.headers,
            params={"memory_type": "user_preference"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All returned memories should be of type user_preference (if any exist)
        for memory in data.get("memories", []):
            assert memory["type"] == "user_preference", f"Expected user_preference, got {memory['type']}"
        
        print(f"✅ Memory filtering by type works: {len(data.get('memories', []))} user_preference memories")
    
    # ============== ALL AGENTS SUMMARY ==============
    
    def test_16_all_agents_have_memory_capability(self):
        """Final check: verify all 4 agents have memory capabilities"""
        agents = ["business", "assistant", "operations", "analytics"]
        results = {}
        
        for agent in agents:
            # Test memory endpoint
            mem_response = requests.get(
                f"{BASE_URL}/api/ai-agents/{agent}/memory",
                headers=self.headers
            )
            
            # Test conversations endpoint
            conv_response = requests.get(
                f"{BASE_URL}/api/ai-agents/{agent}/conversations",
                headers=self.headers
            )
            
            results[agent] = {
                "memory_status": mem_response.status_code,
                "memory_count": mem_response.json().get("memory_count", 0) if mem_response.status_code == 200 else 0,
                "conversations_status": conv_response.status_code,
                "conversation_count": conv_response.json().get("conversation_count", 0) if conv_response.status_code == 200 else 0
            }
        
        # All should return 200
        for agent, result in results.items():
            assert result["memory_status"] == 200, f"Agent {agent} memory endpoint failed"
            assert result["conversations_status"] == 200, f"Agent {agent} conversations endpoint failed"
        
        print(f"✅ All 4 agents have working memory capabilities:")
        for agent, result in results.items():
            print(f"   - {agent}: {result['memory_count']} memories, {result['conversation_count']} conversation turns")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
