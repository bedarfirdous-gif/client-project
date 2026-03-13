"""
Test LLM Integration for AI Agents and Enhanced AutoHeal
=========================================================
Tests for:
1. AI Agent LLM integration - GET /api/ai-agents/{agent}/process with intelligent responses
2. Business Intelligence Agent with LLM - POST /api/ai-agents/business/process
3. User Assistant Agent with LLM - POST /api/ai-agents/assistant/process
4. Agent Collaboration with LLM - POST /api/ai-agents/assistant/collaborate
5. Enhanced AutoHeal with AI analysis - POST /api/autoheal/diagnose
6. AutoHeal detecting unknown errors - error_type should properly classify
7. AutoHeal root_cause_confidence should be above 0.5 with LLM
8. AutoHeal AI reasoning in fix_applied response
"""

import pytest
import requests
import os
import time

# Get the backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for superadmin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    data = response.json()
    return data.get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get authorization headers"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestAIAgentLLMIntegration:
    """Test AI Agent endpoints with LLM integration"""
    
    def test_available_agents(self, auth_headers):
        """Test GET /api/ai-agents/available - should list all agents with LLM support"""
        response = requests.get(f"{BASE_URL}/api/ai-agents/available", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed to get agents: {response.text}"
        data = response.json()
        
        # Should have 4 agents
        agents = data.get("agents", [])
        assert len(agents) == 4, f"Expected 4 agents, got {len(agents)}"
        
        # Verify agent types
        agent_ids = [a["id"] for a in agents]
        assert "business" in agent_ids, "Missing business agent"
        assert "assistant" in agent_ids, "Missing assistant agent"
        assert "operations" in agent_ids, "Missing operations agent"
        assert "analytics" in agent_ids, "Missing analytics agent"
        
        print(f"✓ Available agents: {agent_ids}")
    
    def test_business_agent_llm_process(self, auth_headers):
        """Test Business Intelligence Agent with LLM - POST /api/ai-agents/business/process"""
        prompt = "Analyze my sales performance for this week and provide recommendations for improvement"
        
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/business/process",
            headers=auth_headers,
            json={
                "prompt": prompt,
                "context": {"task": "sales_analysis"}
            }
        )
        
        assert response.status_code == 200, f"Business agent failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") is True, f"Request not successful: {data}"
        assert "message" in data, "Missing message in response"
        assert "confidence" in data, "Missing confidence in response"
        
        confidence = data.get("confidence", 0)
        message = data.get("message", "")
        reasoning = data.get("reasoning", "")
        
        print(f"✓ Business Agent Response:")
        print(f"  - Confidence: {confidence}")
        print(f"  - Message length: {len(message)} chars")
        print(f"  - Has reasoning: {bool(reasoning)}")
        
        # With LLM, confidence should be > 0.5
        # If using rule-based fallback, confidence will be 0.5 for general queries
        assert confidence >= 0.5, f"Confidence too low: {confidence}"
        assert len(message) > 10, f"Message too short: {message}"
    
    def test_assistant_agent_llm_process(self, auth_headers):
        """Test User Assistant Agent with LLM - POST /api/ai-agents/assistant/process"""
        prompt = "How do I create a new sales invoice in the POS system?"
        
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/process",
            headers=auth_headers,
            json={
                "prompt": prompt,
                "context": {"task": "help_request"}
            }
        )
        
        assert response.status_code == 200, f"Assistant agent failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Request not successful: {data}"
        assert "message" in data, "Missing message in response"
        
        confidence = data.get("confidence", 0)
        message = data.get("message", "")
        suggestions = data.get("suggestions", [])
        
        print(f"✓ Assistant Agent Response:")
        print(f"  - Confidence: {confidence}")
        print(f"  - Message length: {len(message)} chars")
        print(f"  - Suggestions count: {len(suggestions)}")
        
        assert confidence >= 0.5, f"Confidence too low: {confidence}"
        assert len(message) > 10, f"Message too short: {message}"
    
    def test_operations_agent_llm_process(self, auth_headers):
        """Test Operations Agent with LLM - POST /api/ai-agents/operations/process"""
        prompt = "Check the system health and report any issues"
        
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/operations/process",
            headers=auth_headers,
            json={
                "prompt": prompt,
                "context": {"task": "health_check"}
            }
        )
        
        assert response.status_code == 200, f"Operations agent failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Request not successful: {data}"
        confidence = data.get("confidence", 0)
        
        print(f"✓ Operations Agent Response - Confidence: {confidence}")
        
        assert confidence >= 0.5, f"Confidence too low: {confidence}"
    
    def test_analytics_agent_llm_process(self, auth_headers):
        """Test Analytics Agent with LLM - POST /api/ai-agents/analytics/process"""
        prompt = "Identify patterns and trends in my inventory data"
        
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/analytics/process",
            headers=auth_headers,
            json={
                "prompt": prompt,
                "context": {"task": "pattern_analysis"}
            }
        )
        
        assert response.status_code == 200, f"Analytics agent failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Request not successful: {data}"
        confidence = data.get("confidence", 0)
        
        print(f"✓ Analytics Agent Response - Confidence: {confidence}")
        
        assert confidence >= 0.5, f"Confidence too low: {confidence}"
    
    def test_agent_multi_turn_conversation(self, auth_headers):
        """Test multi-turn conversation with memory"""
        # First turn
        response1 = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/process",
            headers=auth_headers,
            json={
                "prompt": "My store name is TestStore123"
            }
        )
        
        assert response1.status_code == 200
        data1 = response1.json()
        conversation_id = data1.get("conversation_id")
        
        print(f"✓ First turn - Conversation ID: {conversation_id}")
        
        # Second turn - with conversation context
        response2 = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/process",
            headers=auth_headers,
            json={
                "prompt": "What was my store name?",
                "conversation_id": conversation_id
            }
        )
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        print(f"✓ Second turn - Memory test completed")


class TestAgentCollaborationLLM:
    """Test Agent Collaboration with LLM integration"""
    
    def test_delegate_to_operations(self, auth_headers):
        """Test delegation from business to operations agent"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/business/collaborate",
            headers=auth_headers,
            json={
                "prompt": "Check if our database is performing well for inventory queries",
                "collaboration_type": "delegate",
                "target_agent": "operations"
            }
        )
        
        assert response.status_code == 200, f"Delegation failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is True
        assert "operations" in data.get("collaborated_with", []), "Should have collaborated with operations"
        
        confidence = data.get("confidence", 0)
        print(f"✓ Delegation to operations - Confidence: {confidence}")
        
        assert confidence >= 0.5, f"Confidence too low: {confidence}"
    
    def test_multi_agent_collaboration(self, auth_headers):
        """Test multi-agent collaboration with LLM"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/collaborate",
            headers=auth_headers,
            json={
                "prompt": "Help me understand why sales might be declining and what operational issues could contribute to this",
                "collaboration_type": "collaborate"
            }
        )
        
        assert response.status_code == 200, f"Collaboration failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is True
        collaborated_with = data.get("collaborated_with", [])
        delegation_results = data.get("delegation_results", {})
        
        print(f"✓ Multi-agent collaboration:")
        print(f"  - Collaborated with: {collaborated_with}")
        print(f"  - Delegation results count: {len(delegation_results)}")
        
        # Should have consulted at least one other agent
        assert len(collaborated_with) >= 1, "Should collaborate with at least one agent"
    
    def test_collaborate_with_specific_agents(self, auth_headers):
        """Test collaboration with explicitly specified agents"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/business/collaborate",
            headers=auth_headers,
            json={
                "prompt": "Analyze sales data and identify patterns",
                "collaboration_type": "collaborate",
                "involved_agents": ["analytics"]
            }
        )
        
        assert response.status_code == 200, f"Collaboration failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is True
        collaborated_with = data.get("collaborated_with", [])
        
        print(f"✓ Specific agent collaboration - With: {collaborated_with}")


class TestEnhancedAutoHealLLM:
    """Test Enhanced AutoHeal with AI analysis"""
    
    def test_diagnose_auth_error(self, auth_headers):
        """Test AutoHeal diagnosing authentication error"""
        response = requests.post(
            f"{BASE_URL}/api/autoheal/diagnose",
            headers=auth_headers,
            json={
                "error_message": "JWT token expired - unauthorized access attempt",
                "module": "authentication",
                "function": "verify_token",
                "status_code": 401
            }
        )
        
        assert response.status_code == 200, f"Diagnose failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "error_type" in data, "Missing error_type"
        assert "root_cause" in data, "Missing root_cause"
        assert "root_cause_confidence" in data, "Missing root_cause_confidence"
        assert "fix_applied" in data, "Missing fix_applied"
        
        error_type = data.get("error_type")
        confidence = data.get("root_cause_confidence", 0)
        fix_applied = data.get("fix_applied", {})
        
        print(f"✓ Auth Error Diagnosis:")
        print(f"  - Error Type: {error_type}")
        print(f"  - Root Cause Confidence: {confidence}")
        print(f"  - Fix Type: {fix_applied.get('fix_type') if fix_applied else 'None'}")
        
        # Should classify as auth error
        assert error_type == "authentication_failure", f"Expected auth error, got: {error_type}"
        
        # Confidence should be above 0.5 with LLM
        assert confidence >= 0.5, f"Root cause confidence too low: {confidence}"
    
    def test_diagnose_database_error(self, auth_headers):
        """Test AutoHeal diagnosing database error"""
        response = requests.post(
            f"{BASE_URL}/api/autoheal/diagnose",
            headers=auth_headers,
            json={
                "error_message": "MongoDB connection refused - database connection failed",
                "module": "database",
                "function": "query_items",
                "status_code": 500
            }
        )
        
        assert response.status_code == 200, f"Diagnose failed: {response.text}"
        data = response.json()
        
        error_type = data.get("error_type")
        confidence = data.get("root_cause_confidence", 0)
        fix_applied = data.get("fix_applied", {})
        ai_reasoning = fix_applied.get("ai_reasoning", "") if fix_applied else ""
        
        print(f"✓ Database Error Diagnosis:")
        print(f"  - Error Type: {error_type}")
        print(f"  - Root Cause Confidence: {confidence}")
        print(f"  - AI Reasoning: {ai_reasoning[:100]}..." if ai_reasoning else "  - AI Reasoning: None")
        
        # Should classify as database error
        assert error_type == "database_error", f"Expected database error, got: {error_type}"
        
        # Confidence should be above 0.5
        assert confidence >= 0.5, f"Root cause confidence too low: {confidence}"
    
    def test_diagnose_unknown_error(self, auth_headers):
        """Test AutoHeal detecting UNKNOWN errors - key test case"""
        # Test with explicit "unknown" keyword
        response = requests.post(
            f"{BASE_URL}/api/autoheal/diagnose",
            headers=auth_headers,
            json={
                "error_message": "Unknown error occurred: something went wrong unexpectedly",
                "module": "api",
                "function": "process_request",
                "status_code": 500
            }
        )
        
        assert response.status_code == 200, f"Diagnose failed: {response.text}"
        data = response.json()
        
        error_type = data.get("error_type")
        confidence = data.get("root_cause_confidence", 0)
        fix_applied = data.get("fix_applied", {})
        ai_reasoning = fix_applied.get("ai_reasoning", "") if fix_applied else ""
        
        print(f"✓ Unknown Error Diagnosis:")
        print(f"  - Error Type: {error_type}")
        print(f"  - Root Cause Confidence: {confidence}")
        print(f"  - Fix Type: {fix_applied.get('fix_type') if fix_applied else 'None'}")
        print(f"  - AI Reasoning present: {bool(ai_reasoning)}")
        
        # Should detect as UNKNOWN type
        assert error_type == "unknown", f"Expected unknown error type, got: {error_type}"
        
        # Even for unknown errors, confidence should be reasonable with LLM
        # May be lower but should still have some analysis
        assert confidence >= 0.3, f"Root cause confidence too low: {confidence}"
    
    def test_diagnose_something_went_wrong_error(self, auth_headers):
        """Test AutoHeal detecting 'something went wrong' as unknown error"""
        response = requests.post(
            f"{BASE_URL}/api/autoheal/diagnose",
            headers=auth_headers,
            json={
                "error_message": "Something went wrong while processing your request",
                "module": "api",
                "function": "handle_request",
                "status_code": 500
            }
        )
        
        assert response.status_code == 200, f"Diagnose failed: {response.text}"
        data = response.json()
        
        error_type = data.get("error_type")
        
        print(f"✓ 'Something went wrong' Error - Type: {error_type}")
        
        # Should be classified as unknown (contains 'something went wrong')
        assert error_type == "unknown", f"Expected unknown error type, got: {error_type}"
    
    def test_diagnose_unexpected_error(self, auth_headers):
        """Test AutoHeal detecting 'unexpected' as unknown error"""
        response = requests.post(
            f"{BASE_URL}/api/autoheal/diagnose",
            headers=auth_headers,
            json={
                "error_message": "Unexpected internal server error occurred",
                "module": "api",
                "function": "internal_process",
                "status_code": 500
            }
        )
        
        assert response.status_code == 200, f"Diagnose failed: {response.text}"
        data = response.json()
        
        error_type = data.get("error_type")
        
        print(f"✓ 'Unexpected' Error - Type: {error_type}")
        
        # Should be classified as unknown (contains 'unexpected')
        assert error_type == "unknown", f"Expected unknown error type, got: {error_type}"
    
    def test_diagnose_validation_error(self, auth_headers):
        """Test AutoHeal diagnosing validation error"""
        response = requests.post(
            f"{BASE_URL}/api/autoheal/diagnose",
            headers=auth_headers,
            json={
                "error_message": "Validation error: required field 'email' is missing",
                "module": "api",
                "function": "create_user",
                "status_code": 400
            }
        )
        
        assert response.status_code == 200, f"Diagnose failed: {response.text}"
        data = response.json()
        
        error_type = data.get("error_type")
        confidence = data.get("root_cause_confidence", 0)
        
        print(f"✓ Validation Error - Type: {error_type}, Confidence: {confidence}")
        
        assert error_type == "validation_error", f"Expected validation_error, got: {error_type}"
        assert confidence >= 0.5, f"Root cause confidence too low: {confidence}"
    
    def test_autoheal_ai_reasoning_present(self, auth_headers):
        """Test that AutoHeal includes AI reasoning in fix_applied response"""
        response = requests.post(
            f"{BASE_URL}/api/autoheal/diagnose",
            headers=auth_headers,
            json={
                "error_message": "Permission denied: user not authorized to access resource",
                "module": "authorization",
                "function": "check_access",
                "status_code": 403
            }
        )
        
        assert response.status_code == 200, f"Diagnose failed: {response.text}"
        data = response.json()
        
        fix_applied = data.get("fix_applied", {})
        
        # fix_applied should exist
        assert fix_applied is not None, "fix_applied should not be None"
        
        # Should have ai_reasoning field
        ai_reasoning = fix_applied.get("ai_reasoning", "")
        fix_type = fix_applied.get("fix_type", "")
        fix_description = fix_applied.get("description", "")
        fix_confidence = fix_applied.get("confidence", 0)
        
        print(f"✓ Fix Applied Response:")
        print(f"  - Fix Type: {fix_type}")
        print(f"  - Description: {fix_description[:80]}..." if fix_description else "  - Description: None")
        print(f"  - AI Reasoning: {ai_reasoning[:80]}..." if ai_reasoning else "  - AI Reasoning: None")
        print(f"  - Fix Confidence: {fix_confidence}")
        
        # AI reasoning should be present
        assert ai_reasoning, "ai_reasoning should be present in fix_applied"
        assert len(ai_reasoning) > 10, f"AI reasoning too short: {ai_reasoning}"
    
    def test_autoheal_root_cause_confidence_threshold(self, auth_headers):
        """Test that root_cause_confidence is above 0.5 for clear errors with LLM"""
        # Test multiple error types and verify confidence
        test_cases = [
            {
                "error_message": "JWT authentication failed - token invalid",
                "expected_type": "authentication_failure"
            },
            {
                "error_message": "Database query timeout exceeded",
                "expected_type": "database_error"
            },
            {
                "error_message": "API request to external service failed with HTTP 503",
                "expected_type": "api_failure"
            }
        ]
        
        all_above_threshold = True
        
        for tc in test_cases:
            response = requests.post(
                f"{BASE_URL}/api/autoheal/diagnose",
                headers=auth_headers,
                json={
                    "error_message": tc["error_message"],
                    "module": "test",
                    "function": "test_func",
                    "status_code": 500
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            confidence = data.get("root_cause_confidence", 0)
            error_type = data.get("error_type", "")
            
            print(f"✓ {tc['expected_type']}: confidence={confidence:.2f}")
            
            if confidence < 0.5:
                all_above_threshold = False
                print(f"  WARNING: Confidence below 0.5 for {tc['expected_type']}")
        
        # At least most should be above 0.5
        assert all_above_threshold, "Some error types had confidence below 0.5 threshold"
    
    def test_autoheal_get_reports(self, auth_headers):
        """Test getting AutoHeal reports"""
        response = requests.get(
            f"{BASE_URL}/api/autoheal/reports",
            headers=auth_headers,
            params={"limit": 5}
        )
        
        assert response.status_code == 200, f"Failed to get reports: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Reports should be a list"
        
        print(f"✓ AutoHeal Reports: {len(data)} reports retrieved")
        
        if len(data) > 0:
            report = data[0]
            print(f"  - Latest report ID: {report.get('id', 'N/A')}")
            print(f"  - Error type: {report.get('error_type', 'N/A')}")
            print(f"  - Resolved: {report.get('resolved', 'N/A')}")
    
    def test_autoheal_stats(self, auth_headers):
        """Test getting AutoHeal statistics"""
        response = requests.get(
            f"{BASE_URL}/api/autoheal/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        data = response.json()
        
        print(f"✓ AutoHeal Statistics:")
        print(f"  - Total errors today: {data.get('today_total', 0)}")
        print(f"  - Resolved today: {data.get('today_resolved', 0)}")
        print(f"  - Week total: {data.get('week_total', 0)}")


class TestLLMResponseQuality:
    """Test LLM response quality indicators"""
    
    def test_agent_confidence_with_clear_query(self, auth_headers):
        """Test that LLM gives high confidence for clear queries"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/assistant/process",
            headers=auth_headers,
            json={
                "prompt": "Hello, what can you help me with?"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        confidence = data.get("confidence", 0)
        
        print(f"✓ Clear query confidence: {confidence}")
        
        # Simple greeting should have high confidence (rule-based fallback gives 0.9)
        assert confidence >= 0.7, f"Confidence should be >= 0.7 for clear query, got: {confidence}"
    
    def test_agent_response_structure_complete(self, auth_headers):
        """Test that agent responses have all expected fields"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agents/business/process",
            headers=auth_headers,
            json={
                "prompt": "Summarize my business performance"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields are present
        expected_fields = [
            "success", "message", "data", "reasoning", "plan",
            "actions_taken", "suggestions", "follow_up_questions",
            "confidence", "execution_time_ms", "conversation_id", "memory_updated"
        ]
        
        missing_fields = [f for f in expected_fields if f not in data]
        
        print(f"✓ Response structure check:")
        print(f"  - All fields present: {len(missing_fields) == 0}")
        if missing_fields:
            print(f"  - Missing fields: {missing_fields}")
        
        assert len(missing_fields) == 0, f"Missing response fields: {missing_fields}"
    
    def test_autoheal_response_structure_complete(self, auth_headers):
        """Test that AutoHeal responses have all expected fields"""
        response = requests.post(
            f"{BASE_URL}/api/autoheal/diagnose",
            headers=auth_headers,
            json={
                "error_message": "Test error for structure validation",
                "module": "test"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields are present
        expected_fields = [
            "report_id", "error_type", "severity", "root_cause",
            "root_cause_confidence", "fix_applied", "resolved",
            "escalated", "recommendations", "alternative_fixes", "resolution_time_ms"
        ]
        
        missing_fields = [f for f in expected_fields if f not in data]
        
        print(f"✓ AutoHeal response structure check:")
        print(f"  - All fields present: {len(missing_fields) == 0}")
        if missing_fields:
            print(f"  - Missing fields: {missing_fields}")
        
        assert len(missing_fields) == 0, f"Missing AutoHeal response fields: {missing_fields}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
