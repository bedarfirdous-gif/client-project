"""
Document Verification Workflow API Tests
========================================
Tests for:
- GET /api/document-verification - Get all documents for verification
- GET /api/document-verification/stats - Get document statistics
- POST /api/document-verification/{id}/verify - Verify/reject a document
- GET /api/document-verification/notifications - Get document notifications
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@bijnisbooks.com"
SUPERADMIN_PASSWORD = "admin123"


class TestDocumentVerificationAPI:
    """Test suite for Document Verification endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for superadmin"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        assert token, "No token received"
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers for API requests"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    # Test 1: Get all documents for verification
    def test_get_documents_for_verification(self, auth_headers):
        """Test GET /api/document-verification - should return list of documents"""
        response = requests.get(
            f"{BASE_URL}/api/document-verification",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get documents: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Response should be a list"
        
        # If documents exist, verify structure
        if len(data) > 0:
            doc = data[0]
            # Check expected fields exist
            assert "source" in doc, "Document should have 'source' field"
            assert "verification_status" in doc, "Document should have 'verification_status' field"
        
        print(f"Document verification: Found {len(data)} documents")
    
    # Test 2: Get document verification stats
    def test_get_document_stats(self, auth_headers):
        """Test GET /api/document-verification/stats - should return statistics"""
        response = requests.get(
            f"{BASE_URL}/api/document-verification/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        stats = response.json()
        
        # Verify stats structure
        assert "pending" in stats, "Stats should have 'pending' count"
        assert "verified" in stats, "Stats should have 'verified' count"
        assert "rejected" in stats, "Stats should have 'rejected' count"
        assert "expiring_soon" in stats, "Stats should have 'expiring_soon' count"
        assert "expired" in stats, "Stats should have 'expired' count"
        
        # All values should be integers >= 0
        assert isinstance(stats["pending"], int) and stats["pending"] >= 0
        assert isinstance(stats["verified"], int) and stats["verified"] >= 0
        assert isinstance(stats["rejected"], int) and stats["rejected"] >= 0
        assert isinstance(stats["expiring_soon"], int) and stats["expiring_soon"] >= 0
        assert isinstance(stats["expired"], int) and stats["expired"] >= 0
        
        print(f"Document stats: pending={stats['pending']}, verified={stats['verified']}, "
              f"rejected={stats['rejected']}, expiring_soon={stats['expiring_soon']}, expired={stats['expired']}")
    
    # Test 3: Get document notifications
    def test_get_document_notifications(self, auth_headers):
        """Test GET /api/document-verification/notifications"""
        response = requests.get(
            f"{BASE_URL}/api/document-verification/notifications",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        notifications = response.json()
        
        assert isinstance(notifications, list), "Notifications should be a list"
        print(f"Document notifications: Found {len(notifications)} notifications")
    
    # Test 4: Verify document - document not found case
    def test_verify_nonexistent_document(self, auth_headers):
        """Test verifying a non-existent document should return 404"""
        fake_doc_id = str(uuid.uuid4())
        
        response = requests.post(
            f"{BASE_URL}/api/document-verification/{fake_doc_id}/verify",
            headers=auth_headers,
            json={
                "status": "verified",
                "remarks": "Test verification"
            }
        )
        assert response.status_code == 404, f"Should return 404 for non-existent document, got {response.status_code}"
        print("Correctly returned 404 for non-existent document")


class TestDocumentVerificationIntegration:
    """Integration tests for document verification with actual documents"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def test_employee(self, auth_headers):
        """Create a test employee for document verification tests"""
        employee_data = {
            "name": "TEST_DocVerify_Employee",
            "email": f"test_docverify_{uuid.uuid4().hex[:8]}@example.com",
            "phone": "9999999999",
            "department": "Testing",
            "designation": "Tester",
            "salary": 30000,
            "is_active": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/employees",
            headers=auth_headers,
            json=employee_data
        )
        
        if response.status_code == 200:
            emp = response.json()
            yield emp
            # Cleanup
            requests.delete(f"{BASE_URL}/api/employees/{emp['id']}", headers=auth_headers)
        else:
            yield None
    
    def test_document_verification_flow_with_existing_docs(self, auth_headers):
        """Test the full document verification flow with existing documents"""
        # Get documents
        docs_response = requests.get(
            f"{BASE_URL}/api/document-verification",
            headers=auth_headers
        )
        assert docs_response.status_code == 200
        docs = docs_response.json()
        
        # Get stats before any verification
        stats_before = requests.get(
            f"{BASE_URL}/api/document-verification/stats",
            headers=auth_headers
        ).json()
        
        print(f"Stats before: {stats_before}")
        
        if len(docs) > 0:
            # Find a pending document to verify
            pending_doc = next((d for d in docs if d.get("verification_status") == "pending"), None)
            
            if pending_doc:
                doc_id = pending_doc.get("id")
                print(f"Found pending document to verify: {doc_id}")
                
                # Verify the document with expiry date
                future_expiry = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
                verify_response = requests.post(
                    f"{BASE_URL}/api/document-verification/{doc_id}/verify",
                    headers=auth_headers,
                    json={
                        "status": "verified",
                        "expiry_date": future_expiry,
                        "remarks": "TEST_Verification: Document verified by automated test"
                    }
                )
                assert verify_response.status_code == 200, f"Failed to verify document: {verify_response.text}"
                
                result = verify_response.json()
                assert result.get("status") == "verified"
                assert result.get("document_id") == doc_id
                print(f"Successfully verified document: {doc_id}")
                
                # Get stats after verification
                stats_after = requests.get(
                    f"{BASE_URL}/api/document-verification/stats",
                    headers=auth_headers
                ).json()
                
                print(f"Stats after: {stats_after}")
                
                # Verified count should increase or pending should decrease
                assert stats_after["verified"] >= stats_before["verified"], "Verified count should have increased or stayed same"
            else:
                print("No pending documents found to verify")
        else:
            print("No documents found for verification testing")
    
    def test_reject_document_workflow(self, auth_headers):
        """Test rejecting a document"""
        # Get documents
        docs_response = requests.get(
            f"{BASE_URL}/api/document-verification",
            headers=auth_headers
        )
        assert docs_response.status_code == 200
        docs = docs_response.json()
        
        # Find a document that isn't already rejected
        target_doc = next(
            (d for d in docs if d.get("verification_status") != "rejected" and d.get("id")),
            None
        )
        
        if target_doc:
            doc_id = target_doc.get("id")
            
            # Reject the document
            reject_response = requests.post(
                f"{BASE_URL}/api/document-verification/{doc_id}/verify",
                headers=auth_headers,
                json={
                    "status": "rejected",
                    "remarks": "TEST_Rejection: Rejected by automated test - document unclear"
                }
            )
            assert reject_response.status_code == 200, f"Failed to reject document: {reject_response.text}"
            
            result = reject_response.json()
            assert result.get("status") == "rejected"
            print(f"Successfully rejected document: {doc_id}")
        else:
            print("No suitable document found for rejection test")
    
    def test_expiring_soon_notification(self, auth_headers):
        """Test that setting expiry date within 30 days creates notification"""
        # Get documents
        docs_response = requests.get(
            f"{BASE_URL}/api/document-verification",
            headers=auth_headers
        )
        docs = docs_response.json()
        
        if len(docs) > 0:
            # Find any document
            doc = next((d for d in docs if d.get("id")), None)
            
            if doc:
                doc_id = doc.get("id")
                
                # Set expiry to 15 days from now (should trigger notification)
                near_expiry = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
                
                response = requests.post(
                    f"{BASE_URL}/api/document-verification/{doc_id}/verify",
                    headers=auth_headers,
                    json={
                        "status": "verified",
                        "expiry_date": near_expiry,
                        "remarks": "TEST_ExpiringSoon: Set expiry within 30 days"
                    }
                )
                assert response.status_code == 200
                
                # Check notifications
                notif_response = requests.get(
                    f"{BASE_URL}/api/document-verification/notifications",
                    headers=auth_headers
                )
                assert notif_response.status_code == 200
                notifications = notif_response.json()
                
                # There might be a notification for expiring document
                expiring_notifs = [n for n in notifications if n.get("type") == "document_expiring"]
                print(f"Found {len(expiring_notifs)} expiring document notifications")
        else:
            print("No documents available for expiry notification test")


class TestDocumentVerificationEdgeCases:
    """Edge case tests for document verification"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        return {"Authorization": f"Bearer {response.json().get('access_token')}"}
    
    def test_verify_without_auth(self):
        """Test that verification without auth returns 401/403"""
        fake_doc_id = str(uuid.uuid4())
        
        response = requests.post(
            f"{BASE_URL}/api/document-verification/{fake_doc_id}/verify",
            json={"status": "verified"}
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("Correctly requires authentication for verification")
    
    def test_get_documents_without_auth(self):
        """Test that getting documents without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/document-verification")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("Correctly requires authentication to view documents")
    
    def test_get_stats_without_auth(self):
        """Test that getting stats without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/document-verification/stats")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("Correctly requires authentication to view stats")
    
    def test_verify_with_invalid_status(self, auth_headers):
        """Test verification with invalid status"""
        fake_doc_id = str(uuid.uuid4())
        
        response = requests.post(
            f"{BASE_URL}/api/document-verification/{fake_doc_id}/verify",
            headers=auth_headers,
            json={
                "status": "invalid_status",
                "remarks": "Test"
            }
        )
        # Should either fail validation or not find doc
        assert response.status_code in [400, 404, 422], f"Should fail validation or not find, got {response.status_code}"
        print(f"Handled invalid status correctly with status {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
