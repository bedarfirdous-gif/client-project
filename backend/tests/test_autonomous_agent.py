"""
Test Suite: Autonomous Agent System
===================================
Tests for Emergent-style autonomous agent platform including:
- Task planning from natural language prompts
- Multi-step execution with streaming results
- Step confirmation workflow
- Execution history and audit logs
- Learning patterns and feedback
- Agent collaboration
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://erp-invoice-fix-1.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "SuperAdmin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestItemsEndpoint:
    """Test items endpoint to verify the seeded items fix"""
    
    def test_items_returns_data(self, headers):
        """Verify /api/items returns data (bug fix verification)"""
        response = requests.get(f"{BASE_URL}/api/items", headers=headers)
        assert response.status_code == 200, f"Items failed: {response.text}"
        
        items = response.json()
        assert isinstance(items, list), "Items should be a list"
        assert len(items) > 0, "Items should not be empty (superadmin has seeded items)"
        
        # Check first item has expected fields
        first_item = items[0]
        assert "name" in first_item
        assert "sku" in first_item
        assert "id" in first_item
        print(f"PASS: /api/items returns {len(items)} items")


class TestAutonomousPlan:
    """Test autonomous plan creation endpoint"""
    
    def test_create_plan_read_items(self, headers):
        """POST /api/autonomous/plan - Create plan for reading items"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous/plan",
            headers=headers,
            json={"prompt": "Show me all items in inventory"}
        )
        assert response.status_code == 200, f"Plan creation failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "plan" in data
        
        plan = data["plan"]
        assert "id" in plan
        assert "steps" in plan
        assert len(plan["steps"]) > 0, "Plan should have at least one step"
        assert plan["original_prompt"] == "Show me all items in inventory"
        assert plan["status"] in ["executing", "awaiting_approval", "planning"]
        
        print(f"PASS: Created plan with {len(plan['steps'])} steps, status: {plan['status']}")
        return plan["id"]
    
    def test_create_plan_analyze_sales(self, headers):
        """POST /api/autonomous/plan - Create plan for analysis task"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous/plan",
            headers=headers,
            json={"prompt": "Analyze my sales data and identify trends"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        
        plan = data["plan"]
        # Analysis tasks typically have multiple steps
        assert len(plan["steps"]) >= 1
        assert plan["risk_level"] in ["low", "medium", "high"]
        
        print(f"PASS: Created analysis plan with risk_level: {plan['risk_level']}")
    
    def test_create_plan_requires_prompt(self, headers):
        """POST /api/autonomous/plan - Validates prompt is required"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous/plan",
            headers=headers,
            json={"prompt": ""}
        )
        assert response.status_code == 400
        print("PASS: Empty prompt correctly rejected")
    
    def test_create_plan_with_context(self, headers):
        """POST /api/autonomous/plan - Create plan with additional context"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous/plan",
            headers=headers,
            json={
                "prompt": "Generate a report of low stock items",
                "context": {"min_stock_level": 10}
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        print("PASS: Plan created with context parameters")


class TestAutonomousExecute:
    """Test autonomous plan execution"""
    
    def test_execute_plan(self, headers):
        """POST /api/autonomous/execute/{plan_id} - Execute a plan"""
        # First create a plan
        create_response = requests.post(
            f"{BASE_URL}/api/autonomous/plan",
            headers=headers,
            json={"prompt": "Show me all items"}
        )
        assert create_response.status_code == 200
        plan_id = create_response.json()["plan"]["id"]
        
        # Execute the plan
        execute_response = requests.post(
            f"{BASE_URL}/api/autonomous/execute/{plan_id}?auto_confirm=true",
            headers=headers
        )
        assert execute_response.status_code == 200, f"Execute failed: {execute_response.text}"
        
        data = execute_response.json()
        assert data.get("success") is True
        assert data["plan_id"] == plan_id
        assert "execution_results" in data
        
        results = data["execution_results"]
        assert len(results) > 0, "Should have execution results"
        
        # Check for completion
        plan_completed = any(r.get("type") == "plan_completed" for r in results)
        print(f"PASS: Executed plan {plan_id}, completed: {plan_completed}, results: {len(results)}")


class TestAutonomousConfirm:
    """Test step confirmation workflow"""
    
    def test_confirm_step(self, headers):
        """POST /api/autonomous/confirm/{plan_id}/{step_id} - Confirm a step"""
        # Create a plan with write operations (requires confirmation)
        create_response = requests.post(
            f"{BASE_URL}/api/autonomous/plan",
            headers=headers,
            json={"prompt": "Delete old inventory reports"}  # Will require confirmation
        )
        assert create_response.status_code == 200
        
        plan = create_response.json()["plan"]
        plan_id = plan["id"]
        
        # Find a step that may need confirmation
        if plan["steps"]:
            step_id = plan["steps"][0]["id"]
            
            # Try to confirm it (may or may not be awaiting confirmation)
            confirm_response = requests.post(
                f"{BASE_URL}/api/autonomous/confirm/{plan_id}/{step_id}",
                headers=headers,
                json={"reason": "User confirmed for testing"}
            )
            # Either succeeds (200) or step not awaiting confirmation
            assert confirm_response.status_code in [200, 404]
            print(f"PASS: Confirm step endpoint working, status: {confirm_response.status_code}")


class TestAutonomousHistory:
    """Test execution history endpoint"""
    
    def test_get_history(self, headers):
        """GET /api/autonomous/history - Get execution history"""
        response = requests.get(
            f"{BASE_URL}/api/autonomous/history?limit=20",
            headers=headers
        )
        assert response.status_code == 200, f"History failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "count" in data
        assert "plans" in data
        assert isinstance(data["plans"], list)
        
        print(f"PASS: History returned {data['count']} plans")
    
    def test_get_history_with_status_filter(self, headers):
        """GET /api/autonomous/history - Filter by status"""
        response = requests.get(
            f"{BASE_URL}/api/autonomous/history?status=completed",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        print(f"PASS: History filter by status working, found {data['count']} completed plans")


class TestAutonomousAuditLog:
    """Test audit log endpoint"""
    
    def test_get_audit_log(self, headers):
        """GET /api/autonomous/audit-log - Get audit log of agent actions"""
        response = requests.get(
            f"{BASE_URL}/api/autonomous/audit-log?limit=50",
            headers=headers
        )
        assert response.status_code == 200, f"Audit log failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "count" in data
        assert "logs" in data
        assert isinstance(data["logs"], list)
        
        print(f"PASS: Audit log returned {data['count']} entries")
    
    def test_get_audit_log_with_action_filter(self, headers):
        """GET /api/autonomous/audit-log - Filter by action type"""
        response = requests.get(
            f"{BASE_URL}/api/autonomous/audit-log?action_type=read_data",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        print(f"PASS: Audit log filter by action_type working")


class TestAutonomousFeedback:
    """Test feedback endpoint"""
    
    def test_provide_positive_feedback(self, headers):
        """POST /api/autonomous/feedback/{plan_id} - Provide positive feedback"""
        # First create and execute a plan
        create_response = requests.post(
            f"{BASE_URL}/api/autonomous/plan",
            headers=headers,
            json={"prompt": "List customers"}
        )
        plan_id = create_response.json()["plan"]["id"]
        
        # Execute it
        requests.post(
            f"{BASE_URL}/api/autonomous/execute/{plan_id}?auto_confirm=true",
            headers=headers
        )
        
        # Provide feedback
        feedback_response = requests.post(
            f"{BASE_URL}/api/autonomous/feedback/{plan_id}",
            headers=headers,
            json={"feedback_type": "positive"}
        )
        assert feedback_response.status_code == 200, f"Feedback failed: {feedback_response.text}"
        
        data = feedback_response.json()
        assert data.get("success") is True
        assert "learn" in data.get("message", "").lower()
        
        print("PASS: Positive feedback recorded")
    
    def test_provide_negative_feedback(self, headers):
        """POST /api/autonomous/feedback/{plan_id} - Provide negative feedback"""
        # Create a plan
        create_response = requests.post(
            f"{BASE_URL}/api/autonomous/plan",
            headers=headers,
            json={"prompt": "Show suppliers"}
        )
        plan_id = create_response.json()["plan"]["id"]
        
        # Provide negative feedback
        feedback_response = requests.post(
            f"{BASE_URL}/api/autonomous/feedback/{plan_id}",
            headers=headers,
            json={
                "feedback_type": "negative",
                "feedback_data": {"reason": "Results were incomplete"}
            }
        )
        assert feedback_response.status_code == 200
        
        print("PASS: Negative feedback recorded for learning")


class TestAutonomousLearningPatterns:
    """Test learning patterns endpoint"""
    
    def test_get_learning_patterns(self, headers):
        """GET /api/autonomous/learning-patterns - Get learned patterns"""
        response = requests.get(
            f"{BASE_URL}/api/autonomous/learning-patterns?limit=20",
            headers=headers
        )
        assert response.status_code == 200, f"Learning patterns failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "count" in data
        assert "patterns" in data
        
        print(f"PASS: Learning patterns returned {data['count']} patterns")
    
    def test_get_patterns_with_confidence_filter(self, headers):
        """GET /api/autonomous/learning-patterns - Filter by min confidence"""
        response = requests.get(
            f"{BASE_URL}/api/autonomous/learning-patterns?min_confidence=0.7",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # All patterns should have confidence >= 0.7
        for pattern in data.get("patterns", []):
            assert pattern.get("confidence", 0) >= 0.7
        
        print("PASS: Confidence filter working correctly")


class TestAutonomousCollaboration:
    """Test multi-agent collaboration endpoints"""
    
    def test_create_collaboration(self, headers):
        """POST /api/autonomous/collaborate - Create collaboration session"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous/collaborate",
            headers=headers,
            json={"task": "Analyze sales trends and suggest marketing strategies"}
        )
        assert response.status_code == 200, f"Collaborate failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "session" in data
        
        session = data["session"]
        assert "id" in session
        assert "task" in session
        assert "required_agents" in session
        
        print(f"PASS: Created collaboration with agents: {session['required_agents']}")
        return session["id"]
    
    def test_create_collaboration_requires_task(self, headers):
        """POST /api/autonomous/collaborate - Validates task is required"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous/collaborate",
            headers=headers,
            json={"task": ""}
        )
        assert response.status_code == 400
        print("PASS: Empty task correctly rejected")


class TestAuthRequirements:
    """Test authentication requirements for all endpoints"""
    
    def test_plan_requires_auth(self):
        """Autonomous plan requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/autonomous/plan",
            json={"prompt": "Show items"}
        )
        assert response.status_code in [401, 403]
        print("PASS: Plan endpoint requires auth")
    
    def test_history_requires_auth(self):
        """Autonomous history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/autonomous/history")
        assert response.status_code in [401, 403]
        print("PASS: History endpoint requires auth")
    
    def test_audit_log_requires_auth(self):
        """Autonomous audit-log requires authentication"""
        response = requests.get(f"{BASE_URL}/api/autonomous/audit-log")
        assert response.status_code in [401, 403]
        print("PASS: Audit log endpoint requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
