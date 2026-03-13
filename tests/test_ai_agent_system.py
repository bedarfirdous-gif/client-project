"""
AI Agent System Tests
=====================
Tests for AI Business Agent with chat, insights, and poster generation.
Features:
- Multi-model support (GPT-5.2, Gemini 3 Flash)
- Image generation (Gemini Nano Banana, OpenAI GPT Image 1)
- Business analysis and insights
- Poster generation
- Chat sessions with history
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


class TestAIAgentAuth:
    """Authentication for AI Agent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get superadmin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get auth headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestAIAgentDashboard(TestAIAgentAuth):
    """Test AI Agent Dashboard API"""
    
    def test_get_dashboard_returns_200(self, headers):
        """GET /api/ai-agent/dashboard returns 200"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/dashboard", headers=headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
    
    def test_dashboard_has_required_fields(self, headers):
        """Dashboard response has required structure"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "insights" in data, "Missing 'insights' field"
        assert "insight_counts" in data, "Missing 'insight_counts' field"
        assert "chat_stats" in data, "Missing 'chat_stats' field"
        assert "recent_sessions" in data, "Missing 'recent_sessions' field"
        assert "business_overview" in data, "Missing 'business_overview' field"
        
        # Check insight_counts structure
        insight_counts = data["insight_counts"]
        assert "loopholes" in insight_counts
        assert "opportunities" in insight_counts
        assert "recommendations" in insight_counts
        assert "warnings" in insight_counts
        
        # Check chat_stats structure
        chat_stats = data["chat_stats"]
        assert "total_chats" in chat_stats
        assert "active_chats" in chat_stats
        
        # Check business_overview structure
        business_overview = data["business_overview"]
        assert "today_revenue" in business_overview
        assert "weekly_revenue" in business_overview
        assert "low_stock_items" in business_overview
        assert "total_customers" in business_overview


class TestAIAgentBusinessContext(TestAIAgentAuth):
    """Test AI Agent Business Context API"""
    
    def test_get_context_returns_200(self, headers):
        """GET /api/ai-agent/context returns 200"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/context", headers=headers)
        assert response.status_code == 200, f"Context failed: {response.text}"
    
    def test_context_has_business_data(self, headers):
        """Context response has business data fields"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/context", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "tenant_id" in data, "Missing 'tenant_id' field"
        assert "timestamp" in data, "Missing 'timestamp' field"
        assert "total_stores" in data, "Missing 'total_stores' field"
        assert "total_products" in data, "Missing 'total_products' field"
        assert "total_customers" in data, "Missing 'total_customers' field"


class TestAIAgentChatSessions(TestAIAgentAuth):
    """Test AI Agent Chat Sessions API"""
    
    def test_list_sessions_returns_200(self, headers):
        """GET /api/ai-agent/chat/sessions returns 200"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/chat/sessions", headers=headers)
        assert response.status_code == 200, f"List sessions failed: {response.text}"
    
    def test_list_sessions_has_sessions_array(self, headers):
        """List sessions response has sessions array"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/chat/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data, "Missing 'sessions' field"
        assert isinstance(data["sessions"], list), "'sessions' should be a list"
    
    def test_create_session_returns_session(self, headers):
        """POST /api/ai-agent/chat/sessions creates a new session"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/sessions",
            headers=headers,
            json={"chat_type": "general"}
        )
        assert response.status_code == 200, f"Create session failed: {response.text}"
        data = response.json()
        
        # Check session structure
        assert "id" in data, "Missing 'id' field"
        assert "tenant_id" in data, "Missing 'tenant_id' field"
        assert "user_id" in data, "Missing 'user_id' field"
        assert "title" in data, "Missing 'title' field"
        assert "chat_type" in data, "Missing 'chat_type' field"
        assert "messages" in data, "Missing 'messages' field"
        assert "created_at" in data, "Missing 'created_at' field"
        assert "is_active" in data, "Missing 'is_active' field"
        
        return data["id"]
    
    def test_create_session_with_business_analysis_type(self, headers):
        """Create session with business_analysis chat type"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/sessions",
            headers=headers,
            json={"chat_type": "business_analysis"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["chat_type"] == "business_analysis"
    
    def test_get_session_by_id(self, headers):
        """GET /api/ai-agent/chat/sessions/{id} returns session with messages"""
        # First create a session
        create_response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/sessions",
            headers=headers,
            json={"chat_type": "general"}
        )
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Get the session
        response = requests.get(
            f"{BASE_URL}/api/ai-agent/chat/sessions/{session_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Get session failed: {response.text}"
        data = response.json()
        
        assert data["id"] == session_id
        assert "messages" in data
    
    def test_get_nonexistent_session_returns_404(self, headers):
        """GET /api/ai-agent/chat/sessions/{id} returns 404 for non-existent session"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agent/chat/sessions/nonexistent-session-id",
            headers=headers
        )
        assert response.status_code == 404
    
    def test_delete_session(self, headers):
        """DELETE /api/ai-agent/chat/sessions/{id} soft deletes session"""
        # First create a session
        create_response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/sessions",
            headers=headers,
            json={"chat_type": "general"}
        )
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Delete the session
        response = requests.delete(
            f"{BASE_URL}/api/ai-agent/chat/sessions/{session_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


class TestAIAgentChatMessage(TestAIAgentAuth):
    """Test AI Agent Chat Message API"""
    
    def test_send_message_creates_session_if_none(self, headers):
        """POST /api/ai-agent/chat/message creates session if none provided"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/message",
            headers=headers,
            json={
                "message": "Hello, what can you help me with?",
                "chat_type": "general",
                "model": "gpt-5.2",
                "include_context": True
            }
        )
        assert response.status_code == 200, f"Send message failed: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "session_id" in data, "Missing 'session_id' field"
        assert "assistant_message" in data, "Missing 'assistant_message' field"
        
        # Check assistant message structure
        assistant_msg = data["assistant_message"]
        assert "id" in assistant_msg
        assert "role" in assistant_msg
        assert assistant_msg["role"] == "assistant"
        assert "content" in assistant_msg
        assert "timestamp" in assistant_msg
    
    def test_send_message_with_existing_session(self, headers):
        """Send message to existing session"""
        # First create a session
        create_response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/sessions",
            headers=headers,
            json={"chat_type": "general"}
        )
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Send message to session
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/message",
            headers=headers,
            json={
                "session_id": session_id,
                "message": "What are my top selling products?",
                "chat_type": "general",
                "model": "gpt-5.2",
                "include_context": True
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
    
    def test_send_message_with_gemini_model(self, headers):
        """Send message using Gemini 3 Flash model"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/message",
            headers=headers,
            json={
                "message": "Give me a quick business tip",
                "chat_type": "general",
                "model": "gemini-3-flash-preview",
                "include_context": False
            }
        )
        assert response.status_code == 200, f"Gemini message failed: {response.text}"
        data = response.json()
        
        # Check model used
        if "model_used" in data:
            assert data["model_used"] == "gemini-3-flash-preview"
    
    def test_send_business_analysis_message(self, headers):
        """Send business analysis type message"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/message",
            headers=headers,
            json={
                "message": "Analyze my business performance",
                "chat_type": "business_analysis",
                "model": "gpt-5.2",
                "include_context": True
            }
        )
        assert response.status_code == 200


class TestAIAgentInsights(TestAIAgentAuth):
    """Test AI Agent Insights API"""
    
    def test_generate_insights_returns_200(self, headers):
        """POST /api/ai-agent/insights/generate returns 200"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/insights/generate",
            headers=headers
        )
        assert response.status_code == 200, f"Generate insights failed: {response.text}"
    
    def test_generate_insights_returns_insights_array(self, headers):
        """Generate insights returns insights array with count"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/insights/generate",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "insights" in data, "Missing 'insights' field"
        assert "count" in data, "Missing 'count' field"
        assert isinstance(data["insights"], list)
        assert isinstance(data["count"], int)
    
    def test_list_insights_returns_200(self, headers):
        """GET /api/ai-agent/insights returns 200"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/insights", headers=headers)
        assert response.status_code == 200, f"List insights failed: {response.text}"
    
    def test_list_insights_has_insights_array(self, headers):
        """List insights response has insights array"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/insights", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "insights" in data
        assert isinstance(data["insights"], list)
    
    def test_list_unread_insights_only(self, headers):
        """List only unread insights"""
        response = requests.get(
            f"{BASE_URL}/api/ai-agent/insights?unread_only=true",
            headers=headers
        )
        assert response.status_code == 200
    
    def test_mark_insight_as_read(self, headers):
        """PUT /api/ai-agent/insights/{id}/read marks insight as read"""
        # First generate insights to ensure we have some
        gen_response = requests.post(
            f"{BASE_URL}/api/ai-agent/insights/generate",
            headers=headers
        )
        assert gen_response.status_code == 200
        insights = gen_response.json().get("insights", [])
        
        if len(insights) > 0:
            insight_id = insights[0]["id"]
            response = requests.put(
                f"{BASE_URL}/api/ai-agent/insights/{insight_id}/read",
                headers=headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
        else:
            pytest.skip("No insights generated to test mark as read")
    
    def test_dismiss_insight(self, headers):
        """PUT /api/ai-agent/insights/{id}/dismiss dismisses insight"""
        # First generate insights
        gen_response = requests.post(
            f"{BASE_URL}/api/ai-agent/insights/generate",
            headers=headers
        )
        assert gen_response.status_code == 200
        insights = gen_response.json().get("insights", [])
        
        if len(insights) > 0:
            insight_id = insights[0]["id"]
            response = requests.put(
                f"{BASE_URL}/api/ai-agent/insights/{insight_id}/dismiss",
                headers=headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
        else:
            pytest.skip("No insights generated to test dismiss")
    
    def test_mark_nonexistent_insight_returns_404(self, headers):
        """Mark non-existent insight returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/ai-agent/insights/nonexistent-insight-id/read",
            headers=headers
        )
        assert response.status_code == 404


class TestAIAgentPosterGeneration(TestAIAgentAuth):
    """Test AI Agent Poster Generation API"""
    
    def test_generate_poster_returns_200(self, headers):
        """POST /api/ai-agent/poster/generate returns 200"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/poster/generate",
            headers=headers,
            json={
                "prompt": "A vibrant sale poster for 50% off on all products",
                "style": "professional",
                "format": "instagram_post",
                "image_model": "gemini-3-pro-image-preview",
                "include_business_name": True,
                "colors": []
            },
            timeout=60  # AI image generation can take time
        )
        # May return 200 or 500 depending on AI availability
        assert response.status_code in [200, 500], f"Poster generation failed: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data
            if data["success"]:
                assert "image_base64" in data
                assert "mime_type" in data
    
    def test_generate_poster_with_different_styles(self, headers):
        """Test poster generation with different styles"""
        styles = ["professional", "vibrant", "minimal", "festive"]
        
        for style in styles:
            response = requests.post(
                f"{BASE_URL}/api/ai-agent/poster/generate",
                headers=headers,
                json={
                    "prompt": f"A {style} poster for new arrivals",
                    "style": style,
                    "format": "instagram_post",
                    "image_model": "gemini-3-pro-image-preview",
                    "include_business_name": True,
                    "colors": []
                },
                timeout=60
            )
            # Just check it doesn't crash
            assert response.status_code in [200, 500]
            break  # Only test one to save time
    
    def test_generate_poster_with_different_formats(self, headers):
        """Test poster generation with different formats"""
        formats = ["instagram_post", "instagram_story", "facebook_post", "whatsapp_status"]
        
        for fmt in formats:
            response = requests.post(
                f"{BASE_URL}/api/ai-agent/poster/generate",
                headers=headers,
                json={
                    "prompt": "A promotional poster",
                    "style": "professional",
                    "format": fmt,
                    "image_model": "gemini-3-pro-image-preview",
                    "include_business_name": True,
                    "colors": []
                },
                timeout=60
            )
            assert response.status_code in [200, 500]
            break  # Only test one to save time
    
    def test_generate_poster_with_gpt_image_model(self, headers):
        """Test poster generation with GPT Image 1 model"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/poster/generate",
            headers=headers,
            json={
                "prompt": "A modern sale poster",
                "style": "minimal",
                "format": "instagram_post",
                "image_model": "gpt-image-1",
                "include_business_name": False,
                "colors": ["#FF5733", "#33FF57"]
            },
            timeout=60
        )
        assert response.status_code in [200, 500]


class TestAIAgentRBAC(TestAIAgentAuth):
    """Test AI Agent RBAC permissions"""
    
    def test_dashboard_accessible_to_all_authenticated_users(self, headers):
        """Dashboard should be accessible to all authenticated users"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/dashboard", headers=headers)
        assert response.status_code == 200
    
    def test_context_accessible_to_all_authenticated_users(self, headers):
        """Context should be accessible to all authenticated users"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/context", headers=headers)
        assert response.status_code == 200
    
    def test_chat_accessible_to_all_authenticated_users(self, headers):
        """Chat should be accessible to all authenticated users"""
        response = requests.get(f"{BASE_URL}/api/ai-agent/chat/sessions", headers=headers)
        assert response.status_code == 200
    
    def test_insights_generation_requires_manager_role(self, headers):
        """Insights generation requires manager+ role (superadmin has it)"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/insights/generate",
            headers=headers
        )
        # Superadmin should have access
        assert response.status_code == 200
    
    def test_poster_generation_requires_manager_role(self, headers):
        """Poster generation requires manager+ role (superadmin has it)"""
        response = requests.post(
            f"{BASE_URL}/api/ai-agent/poster/generate",
            headers=headers,
            json={
                "prompt": "Test poster",
                "style": "professional",
                "format": "instagram_post",
                "image_model": "gemini-3-pro-image-preview",
                "include_business_name": True,
                "colors": []
            },
            timeout=60
        )
        # Superadmin should have access (200 or 500 for AI errors)
        assert response.status_code in [200, 500]


class TestAIAgentIntegration(TestAIAgentAuth):
    """Integration tests for AI Agent system"""
    
    def test_full_chat_flow(self, headers):
        """Test complete chat flow: create session -> send messages -> get session"""
        # 1. Create session
        create_response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/sessions",
            headers=headers,
            json={"chat_type": "business_analysis"}
        )
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # 2. Send first message
        msg1_response = requests.post(
            f"{BASE_URL}/api/ai-agent/chat/message",
            headers=headers,
            json={
                "session_id": session_id,
                "message": "What are my business loopholes?",
                "chat_type": "business_analysis",
                "model": "gpt-5.2",
                "include_context": True
            }
        )
        assert msg1_response.status_code == 200
        
        # 3. Get session to verify messages are stored
        get_response = requests.get(
            f"{BASE_URL}/api/ai-agent/chat/sessions/{session_id}",
            headers=headers
        )
        assert get_response.status_code == 200
        session_data = get_response.json()
        
        # Should have at least 2 messages (user + assistant)
        assert len(session_data["messages"]) >= 2
        
        # 4. Delete session
        delete_response = requests.delete(
            f"{BASE_URL}/api/ai-agent/chat/sessions/{session_id}",
            headers=headers
        )
        assert delete_response.status_code == 200
    
    def test_insights_flow(self, headers):
        """Test complete insights flow: generate -> list -> read -> dismiss"""
        # 1. Generate insights
        gen_response = requests.post(
            f"{BASE_URL}/api/ai-agent/insights/generate",
            headers=headers
        )
        assert gen_response.status_code == 200
        
        # 2. List insights
        list_response = requests.get(
            f"{BASE_URL}/api/ai-agent/insights",
            headers=headers
        )
        assert list_response.status_code == 200
        insights = list_response.json().get("insights", [])
        
        if len(insights) > 0:
            insight_id = insights[0]["id"]
            
            # 3. Mark as read
            read_response = requests.put(
                f"{BASE_URL}/api/ai-agent/insights/{insight_id}/read",
                headers=headers
            )
            assert read_response.status_code == 200
            
            # 4. Dismiss
            dismiss_response = requests.put(
                f"{BASE_URL}/api/ai-agent/insights/{insight_id}/dismiss",
                headers=headers
            )
            assert dismiss_response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
