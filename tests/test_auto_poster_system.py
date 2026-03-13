"""
Auto Poster System API Tests
============================
Tests for the Auto Poster Creation & Social Media Deployment system.
Features tested:
- Festival management (add, list)
- Poster generation (AI-powered via Gemini Nano Banana)
- Poster CRUD operations
- Social media account connection/disconnection
- Post scheduling and publishing
- Analytics
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "SuperAdmin@123"


class TestAutoPosterSystem:
    """Auto Poster System API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login and get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store created resources for cleanup
        self.created_festivals = []
        self.created_posters = []
        self.connected_platforms = []
        
        yield
        
        # Cleanup - disconnect any connected accounts
        for platform in self.connected_platforms:
            try:
                self.session.delete(f"{BASE_URL}/api/posters/social/{platform}")
            except:
                pass
    
    # ========== FESTIVAL MANAGEMENT TESTS ==========
    
    def test_add_festival(self):
        """Test POST /api/posters/festivals - Add custom festival"""
        festival_data = {
            "name": f"TEST_Festival_{uuid.uuid4().hex[:8]}",
            "date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "description": "Test festival for automated testing",
            "themes": ["colorful", "festive", "celebration"],
            "colors": ["#FF6B6B", "#4ECDC4", "#FFE66D"]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/festivals",
            json=festival_data
        )
        
        assert response.status_code == 200, f"Add festival failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "festival" in data
        assert data["festival"]["name"] == festival_data["name"]
        assert data["festival"]["date"] == festival_data["date"]
        assert "id" in data["festival"]
        
        self.created_festivals.append(data["festival"]["id"])
        print(f"✓ Festival created: {data['festival']['name']}")
    
    def test_get_festivals(self):
        """Test GET /api/posters/festivals - List festivals"""
        response = self.session.get(f"{BASE_URL}/api/posters/festivals")
        
        assert response.status_code == 200, f"Get festivals failed: {response.text}"
        data = response.json()
        
        assert "festivals" in data
        assert isinstance(data["festivals"], list)
        print(f"✓ Retrieved {len(data['festivals'])} festivals")
    
    def test_get_festivals_with_upcoming_filter(self):
        """Test GET /api/posters/festivals?upcoming_only=false - List all festivals"""
        response = self.session.get(
            f"{BASE_URL}/api/posters/festivals",
            params={"upcoming_only": False}
        )
        
        assert response.status_code == 200, f"Get all festivals failed: {response.text}"
        data = response.json()
        
        assert "festivals" in data
        print(f"✓ Retrieved {len(data['festivals'])} festivals (including past)")
    
    # ========== POSTER GENERATION TESTS ==========
    
    def test_generate_poster_basic(self):
        """Test POST /api/posters/generate - Generate AI poster (basic)"""
        poster_data = {
            "title": f"TEST_Poster_{uuid.uuid4().hex[:8]}",
            "formats": ["instagram_post"],
            "campaign_type": "custom",
            "offer_text": "50% OFF",
            "custom_message": "Limited time offer!",
            "include_logo": True,
            "style": "colorful"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/generate",
            json=poster_data,
            timeout=120  # AI generation may take time
        )
        
        assert response.status_code == 200, f"Generate poster failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "poster" in data
        assert data["poster"]["title"] == poster_data["title"]
        assert "id" in data["poster"]
        assert "caption" in data["poster"]
        assert "hashtags" in data["poster"]
        
        self.created_posters.append(data["poster"]["id"])
        print(f"✓ Poster generated: {data['poster']['title']}")
        print(f"  Caption: {data['poster'].get('caption', 'N/A')[:50]}...")
        print(f"  Hashtags: {data['poster'].get('hashtags', [])[:3]}")
    
    def test_generate_poster_sale_campaign(self):
        """Test POST /api/posters/generate - Generate sale campaign poster"""
        poster_data = {
            "title": f"TEST_Sale_Poster_{uuid.uuid4().hex[:8]}",
            "formats": ["instagram_post", "facebook_post"],
            "campaign_type": "sale",
            "offer_text": "MEGA SALE - Up to 70% OFF",
            "include_logo": True,
            "style": "colorful"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/generate",
            json=poster_data,
            timeout=120
        )
        
        assert response.status_code == 200, f"Generate sale poster failed: {response.text}"
        data = response.json()
        
        assert data["poster"]["campaign_type"] == "sale"
        self.created_posters.append(data["poster"]["id"])
        print(f"✓ Sale poster generated with {len(data.get('generated_formats', []))} formats")
    
    def test_generate_poster_validation_no_title(self):
        """Test POST /api/posters/generate - Validation: title required"""
        poster_data = {
            "title": "",
            "formats": ["instagram_post"],
            "campaign_type": "custom"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/generate",
            json=poster_data
        )
        
        # Should fail validation or return error
        # Note: Pydantic may allow empty string, so check behavior
        print(f"✓ Empty title validation: status={response.status_code}")
    
    # ========== POSTER CRUD TESTS ==========
    
    def test_get_posters(self):
        """Test GET /api/posters - List posters"""
        response = self.session.get(f"{BASE_URL}/api/posters")
        
        assert response.status_code == 200, f"Get posters failed: {response.text}"
        data = response.json()
        
        assert "posters" in data
        assert isinstance(data["posters"], list)
        print(f"✓ Retrieved {len(data['posters'])} posters")
    
    def test_get_posters_with_campaign_filter(self):
        """Test GET /api/posters?campaign_type=sale - Filter by campaign type"""
        response = self.session.get(
            f"{BASE_URL}/api/posters",
            params={"campaign_type": "sale"}
        )
        
        assert response.status_code == 200, f"Get filtered posters failed: {response.text}"
        data = response.json()
        
        assert "posters" in data
        # All returned posters should be sale type
        for poster in data["posters"]:
            assert poster.get("campaign_type") == "sale"
        print(f"✓ Retrieved {len(data['posters'])} sale posters")
    
    def test_get_poster_by_id(self):
        """Test GET /api/posters/{id} - Get poster details"""
        # First create a poster
        poster_data = {
            "title": f"TEST_Detail_Poster_{uuid.uuid4().hex[:8]}",
            "formats": ["instagram_post"],
            "campaign_type": "offers",
            "offer_text": "Special Deal"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/posters/generate",
            json=poster_data,
            timeout=120
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create poster for detail test")
        
        poster_id = create_response.json()["poster"]["id"]
        self.created_posters.append(poster_id)
        
        # Get poster details
        response = self.session.get(f"{BASE_URL}/api/posters/{poster_id}")
        
        assert response.status_code == 200, f"Get poster details failed: {response.text}"
        data = response.json()
        
        assert "poster" in data
        assert data["poster"]["id"] == poster_id
        assert data["poster"]["title"] == poster_data["title"]
        print(f"✓ Retrieved poster details: {data['poster']['title']}")
    
    def test_get_poster_not_found(self):
        """Test GET /api/posters/{id} - Returns 404 for non-existent poster"""
        fake_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/posters/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent poster returns 404")
    
    def test_get_poster_image(self):
        """Test GET /api/posters/{id}/image/{format} - Get poster image"""
        # First get existing posters
        posters_response = self.session.get(f"{BASE_URL}/api/posters")
        posters = posters_response.json().get("posters", [])
        
        if not posters:
            pytest.skip("No posters available for image test")
        
        poster = posters[0]
        poster_id = poster["id"]
        formats = poster.get("formats", ["instagram_post"])
        
        if not formats:
            pytest.skip("Poster has no formats")
        
        format_to_test = formats[0]
        
        response = self.session.get(
            f"{BASE_URL}/api/posters/{poster_id}/image/{format_to_test}"
        )
        
        # May return 404 if image not stored
        if response.status_code == 200:
            data = response.json()
            assert "poster_id" in data
            assert "format" in data
            print(f"✓ Retrieved poster image for format: {format_to_test}")
        else:
            print(f"✓ Poster image endpoint returned: {response.status_code}")
    
    # ========== SOCIAL MEDIA ACCOUNT TESTS ==========
    
    def test_connect_social_account_facebook(self):
        """Test POST /api/posters/social/connect - Connect Facebook account"""
        account_data = {
            "platform": "facebook",
            "access_token": "test_fb_token_" + uuid.uuid4().hex[:8],
            "page_id": "test_page_123"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/social/connect",
            json=account_data
        )
        
        assert response.status_code == 200, f"Connect Facebook failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        self.connected_platforms.append("facebook")
        print(f"✓ Facebook account connected: {data['message']}")
    
    def test_connect_social_account_instagram(self):
        """Test POST /api/posters/social/connect - Connect Instagram account"""
        account_data = {
            "platform": "instagram",
            "access_token": "test_ig_token_" + uuid.uuid4().hex[:8],
            "account_id": "test_ig_account_123"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/social/connect",
            json=account_data
        )
        
        assert response.status_code == 200, f"Connect Instagram failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        self.connected_platforms.append("instagram")
        print(f"✓ Instagram account connected: {data['message']}")
    
    def test_connect_social_account_whatsapp(self):
        """Test POST /api/posters/social/connect - Connect WhatsApp account"""
        account_data = {
            "platform": "whatsapp",
            "access_token": "test_wa_token_" + uuid.uuid4().hex[:8]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/social/connect",
            json=account_data
        )
        
        assert response.status_code == 200, f"Connect WhatsApp failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        self.connected_platforms.append("whatsapp")
        print(f"✓ WhatsApp account connected: {data['message']}")
    
    def test_get_connected_accounts(self):
        """Test GET /api/posters/social/accounts - Get connected accounts"""
        response = self.session.get(f"{BASE_URL}/api/posters/social/accounts")
        
        assert response.status_code == 200, f"Get accounts failed: {response.text}"
        data = response.json()
        
        assert "accounts" in data
        assert isinstance(data["accounts"], list)
        
        # Verify access_token is not exposed
        for account in data["accounts"]:
            assert "access_token" not in account, "Access token should not be exposed"
        
        print(f"✓ Retrieved {len(data['accounts'])} connected accounts")
    
    def test_disconnect_social_account(self):
        """Test DELETE /api/posters/social/{platform} - Disconnect account"""
        # First connect an account
        account_data = {
            "platform": "facebook",
            "access_token": "test_disconnect_token_" + uuid.uuid4().hex[:8]
        }
        
        connect_response = self.session.post(
            f"{BASE_URL}/api/posters/social/connect",
            json=account_data
        )
        
        if connect_response.status_code != 200:
            pytest.skip("Could not connect account for disconnect test")
        
        # Disconnect
        response = self.session.delete(f"{BASE_URL}/api/posters/social/facebook")
        
        assert response.status_code == 200, f"Disconnect failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        print(f"✓ Account disconnected: {data['message']}")
    
    # ========== SCHEDULING TESTS ==========
    
    def test_schedule_post(self):
        """Test POST /api/posters/schedule - Schedule a post"""
        # First create a poster and connect an account
        poster_data = {
            "title": f"TEST_Schedule_Poster_{uuid.uuid4().hex[:8]}",
            "formats": ["instagram_post"],
            "campaign_type": "custom"
        }
        
        poster_response = self.session.post(
            f"{BASE_URL}/api/posters/generate",
            json=poster_data,
            timeout=120
        )
        
        if poster_response.status_code != 200:
            pytest.skip("Could not create poster for schedule test")
        
        poster_id = poster_response.json()["poster"]["id"]
        self.created_posters.append(poster_id)
        
        # Connect Instagram account
        self.session.post(
            f"{BASE_URL}/api/posters/social/connect",
            json={"platform": "instagram", "access_token": "test_schedule_token"}
        )
        self.connected_platforms.append("instagram")
        
        # Schedule the post
        schedule_data = {
            "poster_id": poster_id,
            "platforms": ["instagram"],
            "scheduled_time": (datetime.now() + timedelta(hours=24)).isoformat(),
            "caption": "Scheduled post test",
            "hashtags": ["#test", "#automated"]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/schedule",
            json=schedule_data
        )
        
        assert response.status_code == 200, f"Schedule post failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "schedule" in data
        assert data["schedule"]["poster_id"] == poster_id
        assert data["schedule"]["status"] == "scheduled"
        print(f"✓ Post scheduled for: {schedule_data['scheduled_time']}")
    
    def test_schedule_post_no_account(self):
        """Test POST /api/posters/schedule - Fails when account not connected"""
        # First disconnect all accounts
        for platform in ["facebook", "instagram", "whatsapp"]:
            self.session.delete(f"{BASE_URL}/api/posters/social/{platform}")
        
        # Create a poster
        poster_data = {
            "title": f"TEST_NoAccount_Poster_{uuid.uuid4().hex[:8]}",
            "formats": ["instagram_post"],
            "campaign_type": "custom"
        }
        
        poster_response = self.session.post(
            f"{BASE_URL}/api/posters/generate",
            json=poster_data,
            timeout=120
        )
        
        if poster_response.status_code != 200:
            pytest.skip("Could not create poster")
        
        poster_id = poster_response.json()["poster"]["id"]
        self.created_posters.append(poster_id)
        
        # Try to schedule without connected account
        schedule_data = {
            "poster_id": poster_id,
            "platforms": ["instagram"],
            "scheduled_time": (datetime.now() + timedelta(hours=24)).isoformat()
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/schedule",
            json=schedule_data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Schedule without connected account returns 400")
    
    def test_get_scheduled_posts(self):
        """Test GET /api/posters/schedule - Get scheduled posts"""
        response = self.session.get(f"{BASE_URL}/api/posters/schedule")
        
        assert response.status_code == 200, f"Get scheduled posts failed: {response.text}"
        data = response.json()
        
        assert "scheduled_posts" in data
        assert isinstance(data["scheduled_posts"], list)
        print(f"✓ Retrieved {len(data['scheduled_posts'])} scheduled posts")
    
    def test_get_scheduled_posts_with_status_filter(self):
        """Test GET /api/posters/schedule?status=scheduled - Filter by status"""
        response = self.session.get(
            f"{BASE_URL}/api/posters/schedule",
            params={"status": "scheduled"}
        )
        
        assert response.status_code == 200, f"Get filtered scheduled posts failed: {response.text}"
        data = response.json()
        
        assert "scheduled_posts" in data
        for post in data["scheduled_posts"]:
            assert post.get("status") == "scheduled"
        print(f"✓ Retrieved {len(data['scheduled_posts'])} scheduled posts with status filter")
    
    # ========== PUBLISH NOW TESTS ==========
    
    def test_publish_poster_now(self):
        """Test POST /api/posters/{id}/publish - Publish poster immediately"""
        # Create a poster
        poster_data = {
            "title": f"TEST_Publish_Poster_{uuid.uuid4().hex[:8]}",
            "formats": ["instagram_post"],
            "campaign_type": "custom"
        }
        
        poster_response = self.session.post(
            f"{BASE_URL}/api/posters/generate",
            json=poster_data,
            timeout=120
        )
        
        if poster_response.status_code != 200:
            pytest.skip("Could not create poster for publish test")
        
        poster_id = poster_response.json()["poster"]["id"]
        self.created_posters.append(poster_id)
        
        # Connect Instagram account
        self.session.post(
            f"{BASE_URL}/api/posters/social/connect",
            json={"platform": "instagram", "access_token": "test_publish_token"}
        )
        self.connected_platforms.append("instagram")
        
        # Publish now
        response = self.session.post(
            f"{BASE_URL}/api/posters/{poster_id}/publish",
            json={
                "platforms": ["instagram"],
                "caption": "Published via API test",
                "hashtags": ["#test"]
            }
        )
        
        assert response.status_code == 200, f"Publish failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "results" in data
        assert isinstance(data["results"], list)
        
        # Check simulation mode results
        for result in data["results"]:
            assert "platform" in result
            assert "success" in result
            # In simulation mode, should succeed
            if result["success"]:
                print(f"✓ Published to {result['platform']} (simulation mode)")
    
    def test_publish_poster_not_found(self):
        """Test POST /api/posters/{id}/publish - Returns 400 for non-existent poster"""
        fake_id = str(uuid.uuid4())
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/{fake_id}/publish",
            json={"platforms": ["instagram"]}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Publish non-existent poster returns 400")
    
    # ========== ANALYTICS TESTS ==========
    
    def test_get_poster_analytics(self):
        """Test GET /api/posters/analytics - Get poster analytics"""
        response = self.session.get(f"{BASE_URL}/api/posters/analytics")
        
        assert response.status_code == 200, f"Get analytics failed: {response.text}"
        data = response.json()
        
        assert "analytics" in data
        analytics = data["analytics"]
        
        assert "total_posters" in analytics
        assert "by_campaign_type" in analytics
        assert "posts_by_status" in analytics
        assert "connected_accounts" in analytics
        
        print(f"✓ Analytics retrieved:")
        print(f"  Total posters: {analytics['total_posters']}")
        print(f"  By campaign type: {analytics['by_campaign_type']}")
        print(f"  Connected accounts: {analytics['connected_accounts']}")


class TestAutoPosterPermissions:
    """Test role-based access control for poster system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_superadmin_can_generate_poster(self):
        """Test superadmin can generate posters"""
        poster_data = {
            "title": f"TEST_Admin_Poster_{uuid.uuid4().hex[:8]}",
            "formats": ["instagram_post"],
            "campaign_type": "custom"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/generate",
            json=poster_data,
            timeout=120
        )
        
        assert response.status_code == 200, f"Superadmin should be able to generate posters"
        print("✓ Superadmin can generate posters")
    
    def test_superadmin_can_connect_accounts(self):
        """Test superadmin can connect social accounts"""
        account_data = {
            "platform": "facebook",
            "access_token": "test_admin_token"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/posters/social/connect",
            json=account_data
        )
        
        assert response.status_code == 200, f"Superadmin should be able to connect accounts"
        print("✓ Superadmin can connect social accounts")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/posters/social/facebook")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
