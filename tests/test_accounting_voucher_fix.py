"""
Test Accounting Voucher Fix - Route Conflict Resolution
Tests the fix for route conflict between /api/vouchers (promotional) and /api/accounting-vouchers

Test ledgers available:
- Main Cash Account: ddde76a6-6aa0-4643-bc02-c8df153ddb53
- Office Supplies Expense: 5250bc29-1572-4c1a-8c70-cab323a1aa48
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "bedarfirdous@gmail.com"
TEST_PASSWORD = "admin123"

# Test ledger IDs
CASH_LEDGER_ID = "ddde76a6-6aa0-4643-bc02-c8df153ddb53"
EXPENSE_LEDGER_ID = "5250bc29-1572-4c1a-8c70-cab323a1aa48"


@pytest.fixture(scope="session")
def auth_token():
    """Authenticate and get token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture
def api_client(auth_token):
    """Session with auth headers"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestAccountingVoucherRouteFix:
    """Test the route conflict fix - /api/accounting-vouchers/*"""
    
    def test_get_voucher_types(self, api_client):
        """Test GET /api/accounting-vouchers/types returns accounting voucher types"""
        response = api_client.get(f"{BASE_URL}/api/accounting-vouchers/types")
        assert response.status_code == 200
        
        data = response.json()
        assert "voucher_types" in data
        voucher_types = data["voucher_types"]
        
        # Verify all 6 voucher types exist
        expected_types = ["payment", "receipt", "journal", "contra", "sales", "purchase"]
        for vtype in expected_types:
            assert vtype in voucher_types, f"Missing voucher type: {vtype}"
            assert "prefix" in voucher_types[vtype]
            assert "name" in voucher_types[vtype]
    
    def test_create_payment_voucher(self, api_client):
        """Test POST /api/accounting-vouchers creates payment voucher with double-entry"""
        unique_ref = f"TEST-PMT-{uuid.uuid4().hex[:8]}"
        
        payload = {
            "voucher_type": "payment",
            "date": "2026-02-18",
            "line_items": [
                {"ledger_id": EXPENSE_LEDGER_ID, "debit": 150, "credit": 0, "narration": "Office expense test"},
                {"ledger_id": CASH_LEDGER_ID, "debit": 0, "credit": 150, "narration": "Cash payment test"}
            ],
            "narration": "Test Payment Voucher for route fix verification",
            "reference_number": unique_ref
        }
        
        response = api_client.post(f"{BASE_URL}/api/accounting-vouchers", json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert "voucher" in data
        voucher = data["voucher"]
        
        # Verify voucher data
        assert voucher["voucher_type"] == "payment"
        assert voucher["status"] == "pending"
        assert voucher["total_debit"] == 150.0
        assert voucher["total_credit"] == 150.0
        assert voucher["voucher_number"].startswith("PMT/")
        assert len(voucher["line_items"]) == 2
        
        return voucher["id"]
    
    def test_create_receipt_voucher(self, api_client):
        """Test POST /api/accounting-vouchers creates receipt voucher"""
        unique_ref = f"TEST-RCT-{uuid.uuid4().hex[:8]}"
        
        payload = {
            "voucher_type": "receipt",
            "date": "2026-02-18",
            "line_items": [
                {"ledger_id": CASH_LEDGER_ID, "debit": 200, "credit": 0, "narration": "Cash received"},
                {"ledger_id": EXPENSE_LEDGER_ID, "debit": 0, "credit": 200, "narration": "Income"}
            ],
            "narration": "Test Receipt Voucher",
            "reference_number": unique_ref
        }
        
        response = api_client.post(f"{BASE_URL}/api/accounting-vouchers", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["voucher"]["voucher_type"] == "receipt"
        assert data["voucher"]["voucher_number"].startswith("RCT/")
    
    def test_list_accounting_vouchers(self, api_client):
        """Test GET /api/accounting-vouchers returns accounting vouchers (not promotional)"""
        response = api_client.get(f"{BASE_URL}/api/accounting-vouchers")
        assert response.status_code == 200
        
        data = response.json()
        assert "vouchers" in data
        assert "total" in data
        
        # Verify these are accounting vouchers, not promotional
        if len(data["vouchers"]) > 0:
            voucher = data["vouchers"][0]
            # Accounting vouchers have these fields
            assert "voucher_type" in voucher
            assert "line_items" in voucher
            assert "status" in voucher  # pending/approved/rejected
            # Should NOT have promotional voucher fields
            assert "code" not in voucher
            assert "valid_from" not in voucher
            assert "valid_until" not in voucher
    
    def test_approve_voucher_posts_to_ledgers(self, api_client):
        """Test POST /api/accounting-vouchers/{id}/approve posts to ledgers"""
        # First create a new voucher
        unique_ref = f"TEST-APPRV-{uuid.uuid4().hex[:8]}"
        create_response = api_client.post(f"{BASE_URL}/api/accounting-vouchers", json={
            "voucher_type": "payment",
            "date": "2026-02-18",
            "line_items": [
                {"ledger_id": EXPENSE_LEDGER_ID, "debit": 75, "credit": 0, "narration": "Test expense"},
                {"ledger_id": CASH_LEDGER_ID, "debit": 0, "credit": 75, "narration": "Test cash"}
            ],
            "narration": "Test approve voucher",
            "reference_number": unique_ref
        })
        assert create_response.status_code == 200
        voucher_id = create_response.json()["voucher"]["id"]
        
        # Approve the voucher
        approve_response = api_client.post(f"{BASE_URL}/api/accounting-vouchers/{voucher_id}/approve")
        assert approve_response.status_code == 200
        assert "approved" in approve_response.json()["message"].lower() or "posted" in approve_response.json()["message"].lower()
        
        # Verify voucher status changed to approved
        detail_response = api_client.get(f"{BASE_URL}/api/accounting-vouchers/{voucher_id}")
        assert detail_response.status_code == 200
        assert detail_response.json()["voucher"]["status"] == "approved"
        assert detail_response.json()["voucher"]["posted_to_ledger"] == True
    
    def test_reject_voucher_with_reason(self, api_client):
        """Test POST /api/accounting-vouchers/{id}/reject rejects voucher"""
        # First create a new voucher
        unique_ref = f"TEST-REJ-{uuid.uuid4().hex[:8]}"
        create_response = api_client.post(f"{BASE_URL}/api/accounting-vouchers", json={
            "voucher_type": "journal",
            "date": "2026-02-18",
            "line_items": [
                {"ledger_id": EXPENSE_LEDGER_ID, "debit": 50, "credit": 0, "narration": "Journal debit"},
                {"ledger_id": CASH_LEDGER_ID, "debit": 0, "credit": 50, "narration": "Journal credit"}
            ],
            "narration": "Test journal voucher to reject",
            "reference_number": unique_ref
        })
        assert create_response.status_code == 200
        voucher_id = create_response.json()["voucher"]["id"]
        
        # Reject the voucher
        reject_response = api_client.post(
            f"{BASE_URL}/api/accounting-vouchers/{voucher_id}/reject",
            json={"reason": "Test rejection - invalid journal entry"}
        )
        assert reject_response.status_code == 200
        
        # Verify voucher status changed to rejected
        detail_response = api_client.get(f"{BASE_URL}/api/accounting-vouchers/{voucher_id}")
        assert detail_response.status_code == 200
        assert detail_response.json()["voucher"]["status"] == "rejected"
    
    def test_debit_credit_validation(self, api_client):
        """Test voucher creation fails when debit != credit"""
        payload = {
            "voucher_type": "payment",
            "date": "2026-02-18",
            "line_items": [
                {"ledger_id": EXPENSE_LEDGER_ID, "debit": 100, "credit": 0, "narration": "Debit"},
                {"ledger_id": CASH_LEDGER_ID, "debit": 0, "credit": 50, "narration": "Credit - unbalanced"}
            ],
            "narration": "Unbalanced voucher test",
            "reference_number": f"TEST-UNBAL-{uuid.uuid4().hex[:8]}"
        }
        
        response = api_client.post(f"{BASE_URL}/api/accounting-vouchers", json=payload)
        assert response.status_code == 400
        assert "equal" in response.text.lower() or "debit" in response.text.lower()
    
    def test_get_voucher_stats(self, api_client):
        """Test GET /api/accounting-vouchers/summary/stats returns statistics"""
        response = api_client.get(f"{BASE_URL}/api/accounting-vouchers/summary/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "pending" in data
        assert "approved" in data
        assert "rejected" in data
        assert "by_type" in data


class TestAccountingBooks:
    """Test accounting books with approved vouchers"""
    
    def test_day_book_shows_approved_vouchers(self, api_client):
        """Test GET /api/books/day-book shows only approved vouchers"""
        response = api_client.get(f"{BASE_URL}/api/books/day-book?start_date=2026-01-01&end_date=2026-12-31")
        assert response.status_code == 200
        
        data = response.json()
        assert "vouchers" in data
        
        # All vouchers in day book should be approved
        for voucher in data["vouchers"]:
            assert voucher["status"] == "approved"
    
    def test_cash_book_shows_cash_transactions(self, api_client):
        """Test GET /api/books/cash-book shows cash ledger transactions"""
        response = api_client.get(f"{BASE_URL}/api/books/cash-book?start_date=2026-01-01&end_date=2026-12-31")
        assert response.status_code == 200
        
        data = response.json()
        assert "transactions" in data
        
        # All transactions should be from cash ledger
        for txn in data["transactions"]:
            assert txn["ledger_id"] == CASH_LEDGER_ID
    
    def test_trial_balance_reflects_approved_vouchers(self, api_client):
        """Test GET /api/books/trial-balance shows updated ledger balances"""
        response = api_client.get(f"{BASE_URL}/api/books/trial-balance")
        assert response.status_code == 200
        
        data = response.json()
        assert "trial_balance" in data
        assert "summary" in data
        
        # Check summary fields
        summary = data["summary"]
        assert "total_debit" in summary
        assert "total_credit" in summary
        assert "as_on_date" in summary


class TestRouteConflictResolved:
    """Verify accounting vouchers are now separate from promotional vouchers"""
    
    def test_accounting_vouchers_no_longer_conflict(self, api_client):
        """Test that /api/accounting-vouchers is separate from promotional vouchers"""
        # Create an accounting voucher - should succeed now
        response = api_client.post(f"{BASE_URL}/api/accounting-vouchers", json={
            "voucher_type": "payment",
            "date": "2026-02-18",
            "line_items": [
                {"ledger_id": EXPENSE_LEDGER_ID, "debit": 25, "credit": 0, "narration": "Test"},
                {"ledger_id": CASH_LEDGER_ID, "debit": 0, "credit": 25, "narration": "Test"}
            ],
            "narration": "Route conflict test",
            "reference_number": f"TEST-ROUTE-{uuid.uuid4().hex[:8]}"
        })
        
        # Should NOT get 422 error requiring 'code', 'valid_from', 'valid_until'
        assert response.status_code == 200, f"Should succeed, not fail with promotional voucher validation: {response.text}"
        assert "voucher" in response.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
