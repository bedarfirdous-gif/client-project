"""
Training System API Tests
=========================
Tests for Internal Screen Share System for Employee Training
Features: Sessions, Attendance, Chat, Recordings, Breakout Rooms, Analytics
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


class TestTrainingSystemAuth:
    """Authentication and authorization tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email, password):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_training_sessions_requires_auth(self):
        """Test that training sessions endpoint requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/training/sessions")
        assert response.status_code == 403 or response.status_code == 401
        print("PASS: Training sessions endpoint requires authentication")
    
    def test_superadmin_can_access_training(self):
        """Test Super Admin can access training endpoints"""
        token = self.get_auth_token(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        assert token is not None, "Failed to get Super Admin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/training/sessions")
        
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        print(f"PASS: Super Admin can access training sessions - found {len(data['sessions'])} sessions")


class TestTrainingSessionsCRUD:
    """Training sessions CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, "Failed to login as Super Admin"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = response.json().get("user", {})
        
    def test_list_training_sessions(self):
        """Test GET /api/training/sessions - List accessible sessions"""
        response = self.session.get(f"{BASE_URL}/api/training/sessions")
        
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)
        print(f"PASS: Listed {len(data['sessions'])} training sessions")
        
        # Verify session structure if any exist
        if data["sessions"]:
            session = data["sessions"][0]
            assert "id" in session
            assert "title" in session
            assert "status" in session
            assert "session_type" in session
            print(f"PASS: Session structure verified - first session: {session['title']}")
    
    def test_create_training_session(self):
        """Test POST /api/training/sessions - Create training session"""
        # Schedule for tomorrow
        scheduled_start = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        
        session_data = {
            "title": "TEST_API_Training_Session",
            "description": "Test session created by API tests",
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20,
            "enable_recording": True,
            "enable_chat": True,
            "enable_screen_share": True,
            "enable_breakout_rooms": False,
            "is_tenant_wide": True,
            "invited_user_ids": []
        }
        
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json=session_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert "message" in data
        
        created_session = data["session"]
        assert created_session["title"] == "TEST_API_Training_Session"
        assert created_session["session_type"] == "training"
        assert created_session["status"] == "scheduled"
        assert created_session["enable_recording"] == True
        assert created_session["enable_chat"] == True
        
        # Store session ID for cleanup
        self.created_session_id = created_session["id"]
        print(f"PASS: Created training session with ID: {self.created_session_id}")
        
        return created_session["id"]
    
    def test_create_onboarding_session(self):
        """Test creating onboarding session type"""
        scheduled_start = (datetime.utcnow() + timedelta(days=2)).isoformat() + "Z"
        
        session_data = {
            "title": "TEST_Onboarding_Session",
            "description": "New employee onboarding",
            "session_type": "onboarding",
            "scheduled_start": scheduled_start,
            "duration_minutes": 90,
            "max_participants": 10,
            "enable_recording": True,
            "enable_chat": True,
            "enable_screen_share": True,
            "enable_breakout_rooms": True,
            "is_tenant_wide": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json=session_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["session"]["session_type"] == "onboarding"
        assert data["session"]["enable_breakout_rooms"] == True
        print(f"PASS: Created onboarding session: {data['session']['id']}")
    
    def test_create_live_support_session(self):
        """Test creating live support session type"""
        scheduled_start = (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"
        
        session_data = {
            "title": "TEST_Live_Support_Session",
            "description": "Live support for employees",
            "session_type": "live_support",
            "scheduled_start": scheduled_start,
            "duration_minutes": 30,
            "max_participants": 5,
            "enable_recording": False,
            "enable_chat": True,
            "enable_screen_share": True,
            "enable_breakout_rooms": False,
            "is_tenant_wide": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json=session_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["session"]["session_type"] == "live_support"
        print(f"PASS: Created live support session: {data['session']['id']}")
    
    def test_create_webinar_session(self):
        """Test creating webinar session type"""
        scheduled_start = (datetime.utcnow() + timedelta(days=3)).isoformat() + "Z"
        
        session_data = {
            "title": "TEST_Webinar_Session",
            "description": "Company-wide webinar",
            "session_type": "webinar",
            "scheduled_start": scheduled_start,
            "duration_minutes": 120,
            "max_participants": 100,
            "enable_recording": True,
            "enable_chat": True,
            "enable_screen_share": True,
            "enable_breakout_rooms": False,
            "is_tenant_wide": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json=session_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["session"]["session_type"] == "webinar"
        assert data["session"]["max_participants"] == 100
        print(f"PASS: Created webinar session: {data['session']['id']}")
    
    def test_get_session_details(self):
        """Test GET /api/training/sessions/{id} - Get session details"""
        # First create a session
        scheduled_start = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        create_response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": "TEST_Get_Details_Session",
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20,
            "enable_recording": True,
            "enable_chat": True,
            "enable_screen_share": True,
            "is_tenant_wide": True
        })
        
        assert create_response.status_code == 200
        session_id = create_response.json()["session"]["id"]
        
        # Get session details
        response = self.session.get(f"{BASE_URL}/api/training/sessions/{session_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert data["session"]["id"] == session_id
        assert data["session"]["title"] == "TEST_Get_Details_Session"
        print(f"PASS: Retrieved session details for: {session_id}")
    
    def test_get_nonexistent_session(self):
        """Test getting a non-existent session returns 404"""
        response = self.session.get(f"{BASE_URL}/api/training/sessions/nonexistent_id_12345")
        
        assert response.status_code == 404
        print("PASS: Non-existent session returns 404")
    
    def test_filter_sessions_by_status(self):
        """Test filtering sessions by status"""
        response = self.session.get(f"{BASE_URL}/api/training/sessions?status=scheduled")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned sessions should be scheduled
        for session in data["sessions"]:
            assert session["status"] == "scheduled"
        
        print(f"PASS: Filtered sessions by status=scheduled - found {len(data['sessions'])} sessions")
    
    def test_filter_sessions_by_type(self):
        """Test filtering sessions by session type"""
        response = self.session.get(f"{BASE_URL}/api/training/sessions?session_type=training")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned sessions should be training type
        for session in data["sessions"]:
            assert session["session_type"] == "training"
        
        print(f"PASS: Filtered sessions by type=training - found {len(data['sessions'])} sessions")


class TestSessionLifecycle:
    """Test session lifecycle: start, join, leave, end, cancel"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = response.json().get("user", {})
    
    def create_test_session(self, title="TEST_Lifecycle_Session"):
        """Helper to create a test session"""
        scheduled_start = (datetime.utcnow() + timedelta(minutes=5)).isoformat() + "Z"
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": title,
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20,
            "enable_recording": True,
            "enable_chat": True,
            "enable_screen_share": True,
            "is_tenant_wide": True
        })
        assert response.status_code == 200
        return response.json()["session"]["id"]
    
    def test_start_session(self):
        """Test POST /api/training/sessions/{id}/start - Start session"""
        session_id = self.create_test_session("TEST_Start_Session")
        
        response = self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/start")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "live"
        assert "message" in data
        print(f"PASS: Started session {session_id} - status is now 'live'")
        
        # Verify session status changed
        get_response = self.session.get(f"{BASE_URL}/api/training/sessions/{session_id}")
        assert get_response.json()["session"]["status"] == "live"
        
        return session_id
    
    def test_join_live_session(self):
        """Test POST /api/training/sessions/{id}/join - Join session"""
        # Create and start a session
        session_id = self.create_test_session("TEST_Join_Session")
        self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/start")
        
        # Join the session
        response = self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/join")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "session" in data
        print(f"PASS: Joined live session {session_id}")
        
        return session_id
    
    def test_cannot_join_scheduled_session(self):
        """Test that joining a scheduled (not live) session fails"""
        session_id = self.create_test_session("TEST_Cannot_Join_Scheduled")
        
        # Try to join without starting
        response = self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/join")
        
        assert response.status_code == 400
        print("PASS: Cannot join a session that is not live")
    
    def test_leave_session(self):
        """Test POST /api/training/sessions/{id}/leave - Leave session"""
        # Create, start, and join a session
        session_id = self.create_test_session("TEST_Leave_Session")
        self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/start")
        self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/join")
        
        # Leave the session
        response = self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/leave")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"PASS: Left session {session_id}")
    
    def test_end_session(self):
        """Test POST /api/training/sessions/{id}/end - End session"""
        # Create and start a session
        session_id = self.create_test_session("TEST_End_Session")
        self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/start")
        
        # End the session
        response = self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/end")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ended"
        print(f"PASS: Ended session {session_id}")
        
        # Verify session status
        get_response = self.session.get(f"{BASE_URL}/api/training/sessions/{session_id}")
        assert get_response.json()["session"]["status"] == "ended"
    
    def test_cancel_session(self):
        """Test POST /api/training/sessions/{id}/cancel - Cancel session"""
        session_id = self.create_test_session("TEST_Cancel_Session")
        
        # Cancel the session
        response = self.session.post(
            f"{BASE_URL}/api/training/sessions/{session_id}/cancel",
            json="Test cancellation reason"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"PASS: Cancelled session {session_id}")
        
        # Verify session status
        get_response = self.session.get(f"{BASE_URL}/api/training/sessions/{session_id}")
        assert get_response.json()["session"]["status"] == "cancelled"
    
    def test_cannot_cancel_live_session(self):
        """Test that cancelling a live session fails"""
        session_id = self.create_test_session("TEST_Cannot_Cancel_Live")
        self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/start")
        
        # Try to cancel
        response = self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/cancel")
        
        assert response.status_code == 400
        print("PASS: Cannot cancel a live session")


class TestChatFunctionality:
    """Test chat functionality in training sessions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = response.json().get("user", {})
    
    def create_live_session(self, title="TEST_Chat_Session"):
        """Helper to create and start a live session"""
        scheduled_start = (datetime.utcnow() + timedelta(minutes=5)).isoformat() + "Z"
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": title,
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20,
            "enable_recording": True,
            "enable_chat": True,
            "enable_screen_share": True,
            "is_tenant_wide": True
        })
        session_id = response.json()["session"]["id"]
        self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/start")
        return session_id
    
    def test_send_chat_message(self):
        """Test POST /api/training/sessions/{id}/chat - Send chat message"""
        session_id = self.create_live_session("TEST_Send_Chat")
        
        response = self.session.post(
            f"{BASE_URL}/api/training/sessions/{session_id}/chat",
            json={"content": "Hello, this is a test message!"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"]["content"] == "Hello, this is a test message!"
        print(f"PASS: Sent chat message in session {session_id}")
        
        return session_id, data["message"]["id"]
    
    def test_get_chat_messages(self):
        """Test GET /api/training/sessions/{id}/chat - Get chat messages"""
        session_id = self.create_live_session("TEST_Get_Chat")
        
        # Send a few messages
        for i in range(3):
            self.session.post(
                f"{BASE_URL}/api/training/sessions/{session_id}/chat",
                json={"content": f"Test message {i+1}"}
            )
        
        # Get messages
        response = self.session.get(f"{BASE_URL}/api/training/sessions/{session_id}/chat")
        
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert len(data["messages"]) >= 3
        print(f"PASS: Retrieved {len(data['messages'])} chat messages")
    
    def test_cannot_chat_in_scheduled_session(self):
        """Test that chatting in a non-live session fails"""
        scheduled_start = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": "TEST_No_Chat_Scheduled",
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20,
            "enable_chat": True,
            "is_tenant_wide": True
        })
        session_id = response.json()["session"]["id"]
        
        # Try to send chat
        chat_response = self.session.post(
            f"{BASE_URL}/api/training/sessions/{session_id}/chat",
            json={"content": "This should fail"}
        )
        
        assert chat_response.status_code == 400
        print("PASS: Cannot chat in a scheduled (non-live) session")


class TestAttendance:
    """Test attendance tracking functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_attendance(self):
        """Test GET /api/training/sessions/{id}/attendance - Get attendance"""
        # Create and start a session
        scheduled_start = (datetime.utcnow() + timedelta(minutes=5)).isoformat() + "Z"
        create_response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": "TEST_Attendance_Session",
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20,
            "enable_chat": True,
            "is_tenant_wide": True
        })
        session_id = create_response.json()["session"]["id"]
        
        # Start and join
        self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/start")
        self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/join")
        
        # Get attendance
        response = self.session.get(f"{BASE_URL}/api/training/sessions/{session_id}/attendance")
        
        assert response.status_code == 200
        data = response.json()
        assert "attendance" in data
        assert isinstance(data["attendance"], list)
        print(f"PASS: Retrieved attendance - {len(data['attendance'])} records")
    
    def test_attendance_includes_no_shows(self):
        """Test attendance with include_no_shows parameter"""
        scheduled_start = (datetime.utcnow() + timedelta(minutes=5)).isoformat() + "Z"
        create_response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": "TEST_NoShows_Session",
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20,
            "is_tenant_wide": True
        })
        session_id = create_response.json()["session"]["id"]
        
        response = self.session.get(
            f"{BASE_URL}/api/training/sessions/{session_id}/attendance?include_no_shows=true"
        )
        
        assert response.status_code == 200
        print("PASS: Attendance endpoint accepts include_no_shows parameter")


class TestBreakoutRooms:
    """Test breakout room functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def create_session_with_breakout(self):
        """Helper to create a session with breakout rooms enabled"""
        scheduled_start = (datetime.utcnow() + timedelta(minutes=5)).isoformat() + "Z"
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": "TEST_Breakout_Session",
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20,
            "enable_breakout_rooms": True,
            "is_tenant_wide": True
        })
        session_id = response.json()["session"]["id"]
        self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/start")
        return session_id
    
    def test_create_breakout_room(self):
        """Test POST /api/training/sessions/{id}/breakout-rooms - Create breakout room"""
        session_id = self.create_session_with_breakout()
        
        response = self.session.post(
            f"{BASE_URL}/api/training/sessions/{session_id}/breakout-rooms",
            json={"name": "Group A", "participant_ids": []}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "room" in data
        assert data["room"]["name"] == "Group A"
        print(f"PASS: Created breakout room 'Group A' in session {session_id}")
    
    def test_cannot_create_breakout_when_disabled(self):
        """Test that creating breakout room fails when feature is disabled"""
        scheduled_start = (datetime.utcnow() + timedelta(minutes=5)).isoformat() + "Z"
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": "TEST_No_Breakout_Session",
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20,
            "enable_breakout_rooms": False,
            "is_tenant_wide": True
        })
        session_id = response.json()["session"]["id"]
        self.session.post(f"{BASE_URL}/api/training/sessions/{session_id}/start")
        
        # Try to create breakout room
        breakout_response = self.session.post(
            f"{BASE_URL}/api/training/sessions/{session_id}/breakout-rooms",
            json={"name": "Should Fail", "participant_ids": []}
        )
        
        assert breakout_response.status_code == 400
        print("PASS: Cannot create breakout room when feature is disabled")


class TestRecordings:
    """Test recordings functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_recordings(self):
        """Test GET /api/training/recordings - Get recorded sessions"""
        response = self.session.get(f"{BASE_URL}/api/training/recordings")
        
        assert response.status_code == 200
        data = response.json()
        assert "recordings" in data
        assert isinstance(data["recordings"], list)
        print(f"PASS: Retrieved {len(data['recordings'])} recordings")


class TestTrainingAnalytics:
    """Test training analytics functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_training_analytics(self):
        """Test GET /api/training/analytics - Get training analytics"""
        response = self.session.get(f"{BASE_URL}/api/training/analytics")
        
        assert response.status_code == 200
        data = response.json()
        assert "analytics" in data
        
        analytics = data["analytics"]
        assert "total_sessions" in analytics
        assert "sessions_by_status" in analytics
        assert "sessions_by_type" in analytics
        assert "total_attendees" in analytics
        assert "total_watch_time_hours" in analytics
        assert "avg_session_duration_minutes" in analytics
        assert "total_training_hours" in analytics
        
        print(f"PASS: Retrieved training analytics - {analytics['total_sessions']} total sessions")


class TestValidation:
    """Test input validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_session_title_required(self):
        """Test that session title is required"""
        scheduled_start = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": "",  # Empty title
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20
        })
        
        assert response.status_code == 422  # Validation error
        print("PASS: Empty session title is rejected")
    
    def test_session_title_min_length(self):
        """Test session title minimum length"""
        scheduled_start = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": "AB",  # Too short (min 3)
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 20
        })
        
        assert response.status_code == 422
        print("PASS: Session title minimum length is enforced")
    
    def test_duration_limits(self):
        """Test duration minutes limits"""
        scheduled_start = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        
        # Test too short duration
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": "TEST_Short_Duration",
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 5,  # Too short (min 15)
            "max_participants": 20
        })
        
        assert response.status_code == 422
        print("PASS: Duration minimum limit is enforced")
    
    def test_max_participants_limits(self):
        """Test max participants limits"""
        scheduled_start = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        
        # Test too few participants
        response = self.session.post(f"{BASE_URL}/api/training/sessions", json={
            "title": "TEST_Few_Participants",
            "session_type": "training",
            "scheduled_start": scheduled_start,
            "duration_minutes": 60,
            "max_participants": 1  # Too few (min 2)
        })
        
        assert response.status_code == 422
        print("PASS: Max participants minimum limit is enforced")


# Cleanup test data
class TestCleanup:
    """Cleanup test data created during tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_cleanup_test_sessions(self):
        """Cleanup TEST_ prefixed sessions"""
        # Get all sessions
        response = self.session.get(f"{BASE_URL}/api/training/sessions?limit=100")
        sessions = response.json().get("sessions", [])
        
        test_sessions = [s for s in sessions if s["title"].startswith("TEST_")]
        cancelled_count = 0
        
        for session in test_sessions:
            if session["status"] == "scheduled":
                # Cancel scheduled sessions
                self.session.post(f"{BASE_URL}/api/training/sessions/{session['id']}/cancel")
                cancelled_count += 1
            elif session["status"] == "live":
                # End live sessions
                self.session.post(f"{BASE_URL}/api/training/sessions/{session['id']}/end")
                cancelled_count += 1
        
        print(f"PASS: Cleaned up {cancelled_count} test sessions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
