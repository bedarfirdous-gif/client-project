"""
Test Suite for Scheduled Blog Post Publishing Feature
Tests: Blog post CRUD with scheduled status, scheduler-status endpoint, and background scheduler
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "admin123"


class TestBlogSchedulerFeature:
    """Tests for Scheduled Blog Post Publishing"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        assert token, "No access token received"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_post_ids = []
        
        yield
        
        # Cleanup: Delete test posts
        for post_id in self.created_post_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/ecommerce/blog/posts/{post_id}")
            except:
                pass
    
    def test_01_list_blog_posts_returns_scheduled_count(self):
        """Test that blog posts API returns scheduled count in stats"""
        response = self.session.get(f"{BASE_URL}/api/ecommerce/blog/posts?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert "posts" in data
        assert "stats" in data
        
        stats = data["stats"]
        assert "published" in stats
        assert "drafts" in stats
        assert "scheduled" in stats, "Stats should include 'scheduled' count"
        assert "ai_generated" in stats
        
        print(f"Blog stats - Published: {stats['published']}, Drafts: {stats['drafts']}, Scheduled: {stats['scheduled']}")
    
    def test_02_create_scheduled_blog_post(self):
        """Test creating a blog post with 'scheduled' status and scheduled_at datetime"""
        # Schedule post for 2 hours from now
        scheduled_time = (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"
        
        post_data = {
            "title": f"TEST_Scheduled Post {datetime.now().timestamp()}",
            "content": "This is a test scheduled blog post content for automated testing.",
            "excerpt": "Test scheduled post excerpt",
            "category": "general",
            "tags": ["test", "scheduled"],
            "status": "scheduled",
            "scheduled_at": scheduled_time
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/ecommerce/blog/posts",
            json=post_data
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert "post" in data
        
        post = data["post"]
        self.created_post_ids.append(post["id"])
        
        assert post["status"] == "scheduled", f"Expected status 'scheduled', got {post['status']}"
        assert post["scheduled_at"] is not None, "scheduled_at should be set"
        
        print(f"Created scheduled post: {post['id']}, scheduled_at: {post['scheduled_at']}")
    
    def test_03_create_draft_blog_post(self):
        """Test creating a draft post (no scheduled_at)"""
        post_data = {
            "title": f"TEST_Draft Post {datetime.now().timestamp()}",
            "content": "This is a test draft post.",
            "status": "draft"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/ecommerce/blog/posts",
            json=post_data
        )
        
        assert response.status_code == 200
        
        data = response.json()
        post = data["post"]
        self.created_post_ids.append(post["id"])
        
        assert post["status"] == "draft"
        print(f"Created draft post: {post['id']}")
    
    def test_04_create_published_blog_post(self):
        """Test creating a published post"""
        post_data = {
            "title": f"TEST_Published Post {datetime.now().timestamp()}",
            "content": "This is a test published post.",
            "status": "published"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/ecommerce/blog/posts",
            json=post_data
        )
        
        assert response.status_code == 200
        
        data = response.json()
        post = data["post"]
        self.created_post_ids.append(post["id"])
        
        assert post["status"] == "published"
        print(f"Created published post: {post['id']}")
    
    def test_05_get_scheduler_status(self):
        """Test scheduler-status endpoint returns running status and upcoming posts"""
        response = self.session.get(f"{BASE_URL}/api/ecommerce/blog/scheduler-status")
        
        assert response.status_code == 200, f"Scheduler status failed: {response.text}"
        
        data = response.json()
        
        assert "scheduler" in data, "Response should contain 'scheduler' status"
        assert "upcoming_posts" in data, "Response should contain 'upcoming_posts'"
        assert "total_scheduled" in data, "Response should contain 'total_scheduled'"
        
        scheduler_info = data["scheduler"]
        assert "running" in scheduler_info, "Scheduler should report 'running' status"
        assert "check_interval" in scheduler_info, "Scheduler should report 'check_interval'"
        
        print(f"Scheduler status: running={scheduler_info['running']}, interval={scheduler_info['check_interval']}s")
        print(f"Upcoming scheduled posts: {data['total_scheduled']}")
    
    def test_06_scheduler_running_status(self):
        """Test that the scheduler is actually running"""
        response = self.session.get(f"{BASE_URL}/api/ecommerce/blog/scheduler-status")
        assert response.status_code == 200
        
        data = response.json()
        scheduler = data.get("scheduler", {})
        
        # Scheduler should be running
        assert scheduler.get("running") == True, "Scheduler should be running"
        
        # Check interval should be 60 seconds (as per background_jobs.py)
        assert scheduler.get("check_interval") == 60, f"Check interval should be 60, got {scheduler.get('check_interval')}"
        
        print("Scheduler is running correctly")
    
    def test_07_update_post_status_to_scheduled(self):
        """Test updating an existing post to scheduled status"""
        # First create a draft post
        post_data = {
            "title": f"TEST_Update to Scheduled {datetime.now().timestamp()}",
            "content": "Post to be scheduled later.",
            "status": "draft"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/ecommerce/blog/posts",
            json=post_data
        )
        assert create_response.status_code == 200
        
        post_id = create_response.json()["post"]["id"]
        self.created_post_ids.append(post_id)
        
        # Now update to scheduled
        scheduled_time = (datetime.utcnow() + timedelta(hours=3)).isoformat() + "Z"
        
        update_response = self.session.put(
            f"{BASE_URL}/api/ecommerce/blog/posts/{post_id}",
            json={
                "status": "scheduled",
                "scheduled_at": scheduled_time
            }
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify the update
        get_response = self.session.get(f"{BASE_URL}/api/ecommerce/blog/posts/{post_id}")
        assert get_response.status_code == 200
        
        updated_post = get_response.json()
        assert updated_post["status"] == "scheduled"
        assert updated_post["scheduled_at"] is not None
        
        print(f"Successfully updated post {post_id} to scheduled status")
    
    def test_08_filter_posts_by_scheduled_status(self):
        """Test filtering posts by scheduled status"""
        response = self.session.get(f"{BASE_URL}/api/ecommerce/blog/posts?status=scheduled")
        
        assert response.status_code == 200
        
        data = response.json()
        posts = data.get("posts", [])
        
        # All returned posts should have scheduled status
        for post in posts:
            assert post["status"] == "scheduled", f"Expected scheduled status, got {post['status']}"
        
        print(f"Found {len(posts)} scheduled posts")
    
    def test_09_get_seo_dashboard(self):
        """Test SEO dashboard endpoint"""
        response = self.session.get(f"{BASE_URL}/api/ecommerce/blog/seo-dashboard")
        
        assert response.status_code == 200, f"SEO dashboard failed: {response.text}"
        
        data = response.json()
        assert "stats" in data
        
        stats = data["stats"]
        assert "total_posts" in stats
        assert "avg_seo_score" in stats
        
        print(f"SEO Dashboard - Total posts: {stats['total_posts']}, Avg SEO: {stats['avg_seo_score']}%")
    
    def test_10_delete_blog_post(self):
        """Test deleting (soft delete) a blog post"""
        # Create a post to delete
        post_data = {
            "title": f"TEST_Delete Post {datetime.now().timestamp()}",
            "content": "Post to be deleted.",
            "status": "draft"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/ecommerce/blog/posts",
            json=post_data
        )
        assert create_response.status_code == 200
        
        post_id = create_response.json()["post"]["id"]
        
        # Delete the post
        delete_response = self.session.delete(f"{BASE_URL}/api/ecommerce/blog/posts/{post_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify post is deleted (should return 404)
        get_response = self.session.get(f"{BASE_URL}/api/ecommerce/blog/posts/{post_id}")
        assert get_response.status_code == 404
        
        print(f"Successfully deleted post {post_id}")
    
    def test_11_scheduled_count_increments(self):
        """Test that scheduled count increments when creating scheduled posts"""
        # Get initial count
        initial_response = self.session.get(f"{BASE_URL}/api/ecommerce/blog/posts")
        assert initial_response.status_code == 200
        initial_scheduled = initial_response.json()["stats"]["scheduled"]
        
        # Create a scheduled post
        scheduled_time = (datetime.utcnow() + timedelta(hours=5)).isoformat() + "Z"
        post_data = {
            "title": f"TEST_Count Check Post {datetime.now().timestamp()}",
            "content": "Checking scheduled count.",
            "status": "scheduled",
            "scheduled_at": scheduled_time
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/ecommerce/blog/posts",
            json=post_data
        )
        assert create_response.status_code == 200
        
        post_id = create_response.json()["post"]["id"]
        self.created_post_ids.append(post_id)
        
        # Check new count
        new_response = self.session.get(f"{BASE_URL}/api/ecommerce/blog/posts")
        assert new_response.status_code == 200
        new_scheduled = new_response.json()["stats"]["scheduled"]
        
        assert new_scheduled == initial_scheduled + 1, f"Expected {initial_scheduled + 1}, got {new_scheduled}"
        
        print(f"Scheduled count incremented from {initial_scheduled} to {new_scheduled}")
    
    def test_12_blog_post_model_validation(self):
        """Test blog post model accepts all required fields"""
        scheduled_time = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        
        post_data = {
            "title": f"TEST_Full Model Test {datetime.now().timestamp()}",
            "content": "<h1>Full Model Test</h1><p>Testing all fields.</p>",
            "excerpt": "Test excerpt for the blog post",
            "category": "tips-guides",
            "tags": ["test", "model", "validation"],
            "featured_image": "https://example.com/image.jpg",
            "meta_title": "Test Meta Title",
            "meta_description": "Test meta description for SEO",
            "status": "scheduled",
            "scheduled_at": scheduled_time
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/ecommerce/blog/posts",
            json=post_data
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        post = response.json()["post"]
        self.created_post_ids.append(post["id"])
        
        assert post["title"] == post_data["title"]
        assert post["status"] == "scheduled"
        assert post["category"] == "tips-guides"
        assert "test" in post["tags"]
        assert post["meta_title"] == "Test Meta Title"
        
        print("All blog post fields accepted correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
