"""
Backend API Tests for BIJNISBOOKS Analytics and Real-time Features
Tests: Analytics Dashboard, WebSocket, Security Center, Online Users
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "demo@brandmafia.com"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestAnalyticsDashboard:
    """Analytics Dashboard API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_analytics_dashboard_7d(self, auth_headers):
        """Test analytics dashboard with 7 day range"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_range=7d",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "salesTrend" in data
        assert "topProducts" in data
        assert "revenueByCategory" in data
        assert "customerGrowth" in data
        assert "paymentMethods" in data
        assert "hourlyDistribution" in data
        assert "summary" in data
        
        # Verify salesTrend has 7 days
        assert len(data["salesTrend"]) == 7
        
        # Verify salesTrend structure
        for day in data["salesTrend"]:
            assert "date" in day
            assert "revenue" in day
            assert "orders" in day
            assert "profit" in day
    
    def test_analytics_dashboard_30d(self, auth_headers):
        """Test analytics dashboard with 30 day range"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_range=30d",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify salesTrend has 30 days
        assert len(data["salesTrend"]) == 30
    
    def test_analytics_dashboard_90d(self, auth_headers):
        """Test analytics dashboard with 90 day range"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_range=90d",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify salesTrend has 90 days
        assert len(data["salesTrend"]) == 90
    
    def test_analytics_dashboard_1y(self, auth_headers):
        """Test analytics dashboard with 1 year range"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_range=1y",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify salesTrend has 365 days
        assert len(data["salesTrend"]) == 365
    
    def test_analytics_dashboard_summary(self, auth_headers):
        """Test analytics dashboard summary data"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_range=7d",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data["summary"]
        assert "totalRevenue" in summary
        assert "totalOrders" in summary
        assert "avgOrderValue" in summary
        assert "totalCustomers" in summary
    
    def test_analytics_unauthorized(self):
        """Test analytics without auth"""
        response = requests.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code in [401, 403]


class TestOnlineUsers:
    """Online Users API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_online_users(self, auth_headers):
        """Test getting online/offline users list"""
        response = requests.get(
            f"{BASE_URL}/api/users/online",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "online" in data
        assert "offline" in data
        assert isinstance(data["online"], list)
        assert isinstance(data["offline"], list)
        
        # Verify user structure if there are online users
        if data["online"]:
            user = data["online"][0]
            assert "id" in user
            assert "name" in user
            assert "email" in user
            assert "role" in user


class TestSecurityAlerts:
    """Security Alerts API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_security_alerts(self, auth_headers):
        """Test getting security alerts"""
        response = requests.get(
            f"{BASE_URL}/api/security/alerts",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "alerts" in data
        assert "unacknowledged_count" in data
        assert isinstance(data["alerts"], list)
    
    def test_get_unacknowledged_alerts(self, auth_headers):
        """Test getting only unacknowledged alerts"""
        response = requests.get(
            f"{BASE_URL}/api/security/alerts?unacknowledged_only=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned alerts should be unacknowledged
        for alert in data["alerts"]:
            assert alert.get("acknowledged") == False


class TestDashboardStats:
    """Dashboard Stats API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_dashboard_stats(self, auth_headers):
        """Test dashboard stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_items" in data
        assert "total_customers" in data
        assert "total_stores" in data
        assert "today_revenue" in data
        assert "today_orders" in data
    
    def test_recent_sales(self, auth_headers):
        """Test recent sales endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/recent-sales",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
    
    def test_low_stock_items(self, auth_headers):
        """Test low stock items endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/low-stock",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)


class TestHeartbeat:
    """Heartbeat/Session API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_heartbeat(self, auth_headers):
        """Test heartbeat endpoint for session keepalive"""
        response = requests.post(
            f"{BASE_URL}/api/auth/heartbeat",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert data["status"] == "ok"
        assert "timestamp" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
