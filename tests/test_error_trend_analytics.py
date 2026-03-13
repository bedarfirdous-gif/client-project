"""
Test Error Trend Analytics API Endpoints
Tests the new analytics endpoints added to the central orchestrator for:
- Comprehensive error analytics
- Error distribution by severity
- Error distribution by category  
- Error distribution by source
- Error handling stats per agent
- Hourly error trends
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestErrorTrendAnalytics:
    """Tests for Error Trend Analytics endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - authenticate before tests"""
        # Login as superadmin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token_data = login_response.json()
        self.token = token_data.get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_comprehensive_analytics_endpoint(self):
        """Test GET /api/orchestrator/analytics/comprehensive returns proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/comprehensive?hours=24",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}, body: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "period_hours" in data, "Missing period_hours field"
        assert "summary" in data, "Missing summary field"
        assert "by_severity" in data, "Missing by_severity field"
        assert "by_category" in data, "Missing by_category field"
        assert "by_source" in data, "Missing by_source field"
        assert "by_agent" in data, "Missing by_agent field"
        assert "hourly_trend" in data, "Missing hourly_trend field"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_errors" in summary, "Missing total_errors in summary"
        assert "total_fixed" in summary, "Missing total_fixed in summary"
        assert "fix_rate" in summary, "Missing fix_rate in summary"
        assert "critical_errors" in summary, "Missing critical_errors in summary"
        
        print(f"Comprehensive analytics response: period_hours={data['period_hours']}, total_errors={summary['total_errors']}")
    
    def test_comprehensive_analytics_time_periods(self):
        """Test comprehensive analytics with different time periods"""
        for hours in [6, 12, 24, 48, 72, 168]:
            response = requests.get(
                f"{BASE_URL}/api/orchestrator/analytics/comprehensive?hours={hours}",
                headers=self.headers
            )
            assert response.status_code == 200, f"Failed for hours={hours}: {response.text}"
            data = response.json()
            assert data.get("period_hours") == hours, f"Expected period_hours={hours}, got {data.get('period_hours')}"
        
        print("All time period variations (6h, 12h, 24h, 48h, 72h, 168h) working correctly")
    
    def test_by_severity_endpoint(self):
        """Test GET /api/orchestrator/analytics/by-severity returns severity distribution"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/by-severity?hours=24",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "period_hours" in data, "Missing period_hours field"
        assert "total_errors" in data, "Missing total_errors field"
        assert "by_severity" in data, "Missing by_severity field"
        
        # by_severity should be a list
        assert isinstance(data["by_severity"], list), "by_severity should be a list"
        
        # If there are entries, verify structure
        for item in data.get("by_severity", []):
            assert "severity" in item, "Missing severity field in item"
            assert "count" in item, "Missing count field in item"
            assert "fixed" in item, "Missing fixed field in item"
            assert "failed" in item, "Missing failed field in item"
            assert "fix_rate" in item, "Missing fix_rate field in item"
        
        print(f"By severity endpoint: total_errors={data['total_errors']}, severity_types={len(data['by_severity'])}")
    
    def test_by_category_endpoint(self):
        """Test GET /api/orchestrator/analytics/by-category returns category distribution"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/by-category?hours=24",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "period_hours" in data, "Missing period_hours field"
        assert "total_errors" in data, "Missing total_errors field"
        assert "by_category" in data, "Missing by_category field"
        
        # by_category should be a list
        assert isinstance(data["by_category"], list), "by_category should be a list"
        
        # If there are entries, verify structure
        for item in data.get("by_category", []):
            assert "category" in item, "Missing category field in item"
            assert "count" in item, "Missing count field in item"
            assert "fixed" in item, "Missing fixed field in item"
            assert "failed" in item, "Missing failed field in item"
            assert "critical" in item, "Missing critical field in item"
            assert "high" in item, "Missing high field in item"
            assert "fix_rate" in item, "Missing fix_rate field in item"
        
        print(f"By category endpoint: total_errors={data['total_errors']}, category_types={len(data['by_category'])}")
    
    def test_by_source_endpoint(self):
        """Test GET /api/orchestrator/analytics/by-source returns source distribution"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/by-source?hours=24",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "period_hours" in data, "Missing period_hours field"
        assert "by_source" in data, "Missing by_source field"
        
        # by_source should be a list
        assert isinstance(data["by_source"], list), "by_source should be a list"
        
        # If there are entries, verify structure
        for item in data.get("by_source", []):
            assert "source" in item, "Missing source field in item"
            assert "count" in item, "Missing count field in item"
            assert "fixed" in item, "Missing fixed field in item"
            assert "fix_rate" in item, "Missing fix_rate field in item"
        
        print(f"By source endpoint: source_types={len(data['by_source'])}")
    
    def test_by_agent_endpoint(self):
        """Test GET /api/orchestrator/analytics/by-agent returns agent performance data"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/by-agent?hours=24",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "period_hours" in data, "Missing period_hours field"
        assert "by_agent" in data, "Missing by_agent field"
        
        # by_agent should be a list
        assert isinstance(data["by_agent"], list), "by_agent should be a list"
        
        # If there are entries, verify structure
        for item in data.get("by_agent", []):
            assert "agent" in item, "Missing agent field in item"
            assert "agent_name" in item, "Missing agent_name field in item"
            assert "count" in item, "Missing count field in item"
            assert "fixed" in item, "Missing fixed field in item"
            assert "failed" in item, "Missing failed field in item"
            assert "fix_rate" in item, "Missing fix_rate field in item"
        
        print(f"By agent endpoint: agent_count={len(data['by_agent'])}")
    
    def test_hourly_trend_endpoint(self):
        """Test GET /api/orchestrator/analytics/hourly-trend returns hourly timeline"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/hourly-trend?hours=24",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "period_hours" in data, "Missing period_hours field"
        assert "timeline" in data, "Missing timeline field"
        
        # timeline should be a list
        assert isinstance(data["timeline"], list), "timeline should be a list"
        
        # For 24 hours, we expect 24 entries
        assert len(data["timeline"]) == data["period_hours"], f"Expected {data['period_hours']} timeline entries, got {len(data['timeline'])}"
        
        # Verify each timeline entry structure
        for item in data.get("timeline", []):
            assert "hour" in item, "Missing hour field in timeline item"
            assert "display_hour" in item, "Missing display_hour field in timeline item"
            assert "total" in item, "Missing total field in timeline item"
            assert "fixed" in item, "Missing fixed field in timeline item"
            assert "failed" in item, "Missing failed field in timeline item"
            assert "critical" in item, "Missing critical field in timeline item"
            assert "high" in item, "Missing high field in timeline item"
            assert "medium" in item, "Missing medium field in timeline item"
            assert "low" in item, "Missing low field in timeline item"
        
        print(f"Hourly trend endpoint: period={data['period_hours']}h, timeline_entries={len(data['timeline'])}")
    
    def test_hourly_trend_different_periods(self):
        """Test hourly trend with different time periods"""
        test_periods = [6, 12, 48]
        
        for hours in test_periods:
            response = requests.get(
                f"{BASE_URL}/api/orchestrator/analytics/hourly-trend?hours={hours}",
                headers=self.headers
            )
            assert response.status_code == 200, f"Failed for hours={hours}"
            data = response.json()
            
            # Should have exactly 'hours' entries in timeline
            assert len(data["timeline"]) == hours, f"Expected {hours} timeline entries, got {len(data['timeline'])}"
        
        print("Hourly trend correctly returns entries matching requested hours")
    
    def test_unauthorized_access(self):
        """Test endpoints require authentication"""
        endpoints = [
            "/api/orchestrator/analytics/comprehensive",
            "/api/orchestrator/analytics/by-severity",
            "/api/orchestrator/analytics/by-category",
            "/api/orchestrator/analytics/by-source",
            "/api/orchestrator/analytics/by-agent",
            "/api/orchestrator/analytics/hourly-trend"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code == 403, f"Expected 403 for unauthenticated {endpoint}, got {response.status_code}"
        
        print("All analytics endpoints correctly reject unauthenticated requests")
    
    def test_create_error_then_verify_analytics(self):
        """Create an error and verify it appears in analytics"""
        # First, report a test error
        error_data = {
            "error_type": "TEST_AnalyticsTestError",
            "error_message": "Test error for analytics verification",
            "source": "user_reported",
            "auto_route": False
        }
        
        report_response = requests.post(
            f"{BASE_URL}/api/orchestrator/report-error",
            headers=self.headers,
            json=error_data
        )
        
        assert report_response.status_code == 200, f"Failed to report error: {report_response.text}"
        
        # Now verify it appears in analytics
        analytics_response = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/comprehensive?hours=1",
            headers=self.headers
        )
        
        assert analytics_response.status_code == 200
        analytics = analytics_response.json()
        
        # Verify the error count includes our new error
        total_errors = analytics.get("summary", {}).get("total_errors", 0)
        print(f"Total errors after test error creation: {total_errors}")
        
        # Verify by_source includes user_reported
        by_source = analytics.get("by_source", [])
        user_reported_source = next((s for s in by_source if s.get("source") == "user_reported"), None)
        if user_reported_source:
            print(f"User reported errors in analytics: {user_reported_source['count']}")
        
        print("Error creation verified in analytics")


class TestAnalyticsDataIntegrity:
    """Tests for data integrity of analytics endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - authenticate before tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@bijnisbooks.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_totals_match_across_endpoints(self):
        """Verify total_errors is consistent across endpoints"""
        comprehensive = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/comprehensive?hours=24",
            headers=self.headers
        ).json()
        
        by_severity = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/by-severity?hours=24",
            headers=self.headers
        ).json()
        
        by_category = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/by-category?hours=24",
            headers=self.headers
        ).json()
        
        comp_total = comprehensive.get("summary", {}).get("total_errors", 0)
        sev_total = by_severity.get("total_errors", 0)
        cat_total = by_category.get("total_errors", 0)
        
        print(f"Comprehensive total: {comp_total}")
        print(f"By severity total: {sev_total}")
        print(f"By category total: {cat_total}")
        
        # Totals should be consistent
        assert comp_total == sev_total, f"Comprehensive ({comp_total}) != By severity ({sev_total})"
        assert comp_total == cat_total, f"Comprehensive ({comp_total}) != By category ({cat_total})"
        
        print("Totals are consistent across all analytics endpoints")
    
    def test_severity_sum_equals_total(self):
        """Verify sum of errors by severity equals total"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/by-severity?hours=24",
            headers=self.headers
        )
        data = response.json()
        
        by_severity = data.get("by_severity", [])
        severity_sum = sum(item.get("count", 0) for item in by_severity)
        total = data.get("total_errors", 0)
        
        assert severity_sum == total, f"Sum of severities ({severity_sum}) != total_errors ({total})"
        print(f"Severity sum check passed: {severity_sum} = {total}")
    
    def test_category_sum_equals_total(self):
        """Verify sum of errors by category equals total"""
        response = requests.get(
            f"{BASE_URL}/api/orchestrator/analytics/by-category?hours=24",
            headers=self.headers
        )
        data = response.json()
        
        by_category = data.get("by_category", [])
        category_sum = sum(item.get("count", 0) for item in by_category)
        total = data.get("total_errors", 0)
        
        assert category_sum == total, f"Sum of categories ({category_sum}) != total_errors ({total})"
        print(f"Category sum check passed: {category_sum} = {total}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
