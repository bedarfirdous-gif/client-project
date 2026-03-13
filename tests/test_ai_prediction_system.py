"""
AI Error Prediction System and AutoHeal Agent Tests
====================================================
Tests for:
1. AutoHeal scan button (POST /api/real-autoheal/scan)
2. AI Prediction quick scan (POST /api/ai-prediction/scan-quick)
3. AI Prediction dashboard (GET /api/ai-prediction/dashboard)
4. AI Prediction auto-fix all (POST /api/ai-prediction/auto-fix-all)
5. Performance Agent analyze (GET /api/performance/analyze)
6. Performance Agent auto-optimize (POST /api/performance/auto-optimize)
7. Verify all 3 agents connected to prediction system
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuthentication:
    """Get auth token for protected endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestHealthCheck(TestAuthentication):
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test basic API health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health check passed")


class TestRealAutoHealScan(TestAuthentication):
    """Test Real AutoHeal scan functionality - scan button should work without timeout"""
    
    def test_autoheal_scan_returns_detected_errors(self, auth_headers):
        """
        POST /api/real-autoheal/scan should return detected errors
        This was previously causing 520 timeout error - now fixed
        """
        response = requests.post(
            f"{BASE_URL}/api/real-autoheal/scan",
            headers=auth_headers,
            timeout=30  # Should complete within 30 seconds
        )
        
        assert response.status_code == 200, f"Scan failed with status {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "errors_detected" in data, "Missing errors_detected field"
        assert "fixes_attempted" in data, "Missing fixes_attempted field"
        assert "fixes_successful" in data, "Missing fixes_successful field"
        assert "errors" in data, "Missing errors field"
        
        # Verify data types
        assert isinstance(data["errors_detected"], int), "errors_detected should be int"
        assert isinstance(data["errors"], list), "errors should be list"
        
        print(f"✓ AutoHeal scan returned {data['errors_detected']} errors detected")
        print(f"  - Fixes attempted: {data['fixes_attempted']}")
        print(f"  - Fixes successful: {data['fixes_successful']}")
        
        # Verify error structure if any errors
        if len(data["errors"]) > 0:
            error = data["errors"][0]
            assert "error_id" in error, "Error missing error_id"
            assert "category" in error, "Error missing category"
            assert "severity" in error, "Error missing severity"
            assert "message" in error, "Error missing message"
            print(f"  - Sample error: {error['category']} - {error['message'][:50]}...")
    
    def test_autoheal_dashboard(self, auth_headers):
        """GET /api/real-autoheal/dashboard should return stats"""
        response = requests.get(
            f"{BASE_URL}/api/real-autoheal/dashboard",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        assert "total_errors_detected" in data, "Missing total_errors_detected"
        assert "success_rate" in data, "Missing success_rate"
        assert "errors_by_category" in data, "Missing errors_by_category"
        
        print(f"✓ AutoHeal dashboard: {data['total_errors_detected']} total errors, {data['success_rate']}% success rate")


class TestAIPredictionSystem(TestAuthentication):
    """Test AI Error Prediction System"""
    
    def test_quick_scan_detects_patterns(self, auth_headers):
        """
        POST /api/ai-prediction/scan-quick should detect code patterns and return predictions
        """
        response = requests.post(
            f"{BASE_URL}/api/ai-prediction/scan-quick",
            headers=auth_headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"Quick scan failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "predictions_found" in data, "Missing predictions_found"
        assert "predictions" in data, "Missing predictions array"
        
        print(f"✓ Quick scan found {data['predictions_found']} predictions")
        
        # Verify prediction structure if any
        if len(data["predictions"]) > 0:
            pred = data["predictions"][0]
            assert "prediction_id" in pred, "Prediction missing prediction_id"
            assert "type" in pred, "Prediction missing type"
            assert "severity" in pred, "Prediction missing severity"
            assert "file_path" in pred, "Prediction missing file_path"
            assert "description" in pred, "Prediction missing description"
            
            print(f"  - Sample prediction: {pred['type']} in {pred['component']} - {pred['description'][:50]}...")
    
    def test_dashboard_shows_prediction_stats(self, auth_headers):
        """
        GET /api/ai-prediction/dashboard should show:
        - total predictions
        - by severity breakdown
        - connected agents
        """
        response = requests.get(
            f"{BASE_URL}/api/ai-prediction/dashboard",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "total_predictions" in data, "Missing total_predictions"
        assert "by_severity" in data, "Missing by_severity"
        assert "connected_agents" in data, "Missing connected_agents"
        
        print(f"✓ AI Prediction Dashboard:")
        print(f"  - Total predictions: {data['total_predictions']}")
        print(f"  - By severity: {data['by_severity']}")
        print(f"  - Connected agents: {data['connected_agents']}")
        
        # Verify all 3 agents are connected
        connected = data["connected_agents"]
        assert "ui_blink_fix" in connected, "ui_blink_fix agent not connected"
        assert "real_autoheal" in connected, "real_autoheal agent not connected"
        assert "performance" in connected, "performance agent not connected"
        
        print("✓ All 3 agents connected to prediction system")
    
    def test_auto_fix_all_starts_background_process(self, auth_headers):
        """
        POST /api/ai-prediction/auto-fix-all should start background auto-fix process
        """
        response = requests.post(
            f"{BASE_URL}/api/ai-prediction/auto-fix-all",
            headers=auth_headers,
            params={"severity_threshold": "high", "dry_run": True}
        )
        
        assert response.status_code == 200, f"Auto-fix-all failed: {response.text}"
        data = response.json()
        
        assert "status" in data, "Missing status field"
        assert data["status"] == "running", f"Expected 'running' status, got {data['status']}"
        assert "message" in data, "Missing message field"
        
        print(f"✓ Auto-fix-all started: {data['message']}")
    
    def test_get_predictions_with_filters(self, auth_headers):
        """GET /api/ai-prediction/predictions should return filtered predictions"""
        # Get all predictions
        response = requests.get(
            f"{BASE_URL}/api/ai-prediction/predictions",
            headers=auth_headers,
            params={"limit": 20}
        )
        
        assert response.status_code == 200, f"Get predictions failed: {response.text}"
        data = response.json()
        
        assert "predictions" in data, "Missing predictions array"
        print(f"✓ Retrieved {len(data['predictions'])} predictions")
        
        # Filter by severity
        response_high = requests.get(
            f"{BASE_URL}/api/ai-prediction/predictions",
            headers=auth_headers,
            params={"severity": "high", "limit": 10}
        )
        
        assert response_high.status_code == 200
        data_high = response_high.json()
        print(f"✓ Retrieved {len(data_high['predictions'])} HIGH severity predictions")


class TestPerformanceAgent(TestAuthentication):
    """Test Performance Optimization Agent"""
    
    def test_performance_analyze_returns_issues(self, auth_headers):
        """
        GET /api/performance/analyze should return performance issues
        """
        response = requests.get(
            f"{BASE_URL}/api/performance/analyze",
            headers=auth_headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"Performance analyze failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "frontend_issues" in data, "Missing frontend_issues"
        assert "backend_issues" in data, "Missing backend_issues"
        assert "recommendations" in data, "Missing recommendations"
        assert "estimated_improvement_ms" in data, "Missing estimated_improvement_ms"
        
        total_issues = len(data["frontend_issues"]) + len(data["backend_issues"])
        
        print(f"✓ Performance analysis complete:")
        print(f"  - Frontend issues: {len(data['frontend_issues'])}")
        print(f"  - Backend issues: {len(data['backend_issues'])}")
        print(f"  - Estimated improvement: {data['estimated_improvement_ms']}ms")
        print(f"  - Recommendations: {len(data['recommendations'])}")
    
    def test_performance_auto_optimize_starts(self, auth_headers):
        """
        POST /api/performance/auto-optimize should start optimization
        """
        response = requests.post(
            f"{BASE_URL}/api/performance/auto-optimize",
            headers=auth_headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"Auto-optimize failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "optimizations_applied" in data, "Missing optimizations_applied"
        assert "improvements_ms" in data, "Missing improvements_ms"
        assert "files_modified" in data, "Missing files_modified"
        
        print(f"✓ Performance auto-optimize completed:")
        print(f"  - Optimizations applied: {data['optimizations_applied']}")
        print(f"  - Improvement: {data['improvements_ms']}ms")
        print(f"  - Files modified: {len(data['files_modified'])}")
    
    def test_performance_dashboard(self, auth_headers):
        """GET /api/performance/dashboard should return dashboard stats"""
        response = requests.get(
            f"{BASE_URL}/api/performance/dashboard",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Performance dashboard failed: {response.text}"
        data = response.json()
        
        assert "total_issues" in data, "Missing total_issues"
        assert "current_score" in data, "Missing current_score"
        assert "potential_improvement_ms" in data, "Missing potential_improvement_ms"
        
        print(f"✓ Performance Dashboard:")
        print(f"  - Total issues: {data['total_issues']}")
        print(f"  - Current score: {data['current_score']}")
        print(f"  - Potential improvement: {data['potential_improvement_ms']}ms")
    
    def test_performance_issues_list(self, auth_headers):
        """GET /api/performance/issues should return issues list"""
        response = requests.get(
            f"{BASE_URL}/api/performance/issues",
            headers=auth_headers,
            params={"status": "detected"}
        )
        
        assert response.status_code == 200, f"Performance issues failed: {response.text}"
        data = response.json()
        
        print(f"✓ Retrieved {len(data)} performance issues")


class TestAgentConnectivity(TestAuthentication):
    """Verify all agents are properly connected"""
    
    def test_all_agents_connected_to_prediction(self, auth_headers):
        """Verify ui_blink_fix, real_autoheal, and performance agents are connected"""
        response = requests.get(
            f"{BASE_URL}/api/ai-prediction/dashboard",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        connected = data.get("connected_agents", [])
        
        assert "ui_blink_fix" in connected, "ui_blink_fix not connected"
        assert "real_autoheal" in connected, "real_autoheal not connected"
        assert "performance" in connected, "performance not connected"
        
        print(f"✓ All 3 agents properly connected: {connected}")


class TestOrchestration(TestAuthentication):
    """Test orchestration of all agents"""
    
    def test_orchestrate_all_agents(self, auth_headers):
        """POST /api/ai-prediction/orchestrate-all should orchestrate all agents"""
        response = requests.post(
            f"{BASE_URL}/api/ai-prediction/orchestrate-all",
            headers=auth_headers,
            params={"auto_fix": False},  # Don't auto-fix for test
            timeout=120
        )
        
        assert response.status_code == 200, f"Orchestration failed: {response.text}"
        data = response.json()
        
        assert "agents_run" in data, "Missing agents_run field"
        assert "total_issues_found" in data, "Missing total_issues_found"
        
        print(f"✓ Agent orchestration completed:")
        print(f"  - Agents run: {data.get('agents_run', [])}")
        print(f"  - Total issues found: {data['total_issues_found']}")
        print(f"  - Total fixes applied: {data.get('total_fixes_applied', 0)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
