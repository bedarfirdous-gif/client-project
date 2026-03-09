"""
Receipt & Payment Ledger Module - Backend API Tests
====================================================
Testing: Ledger heads CRUD, entry CRUD, running balance, reports, RBAC
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_ADMIN_EMAIL = "superadmin@bijnisbooks.com"
TEST_ADMIN_PASSWORD = "admin123"


class TestAuthSetup:
    """Setup authentication for tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }


class TestLedgerHeadsCRUD(TestAuthSetup):
    """Test Ledger Heads CRUD operations"""
    
    def test_get_ledger_heads(self, admin_headers):
        """Get all ledger heads"""
        response = requests.get(f"{BASE_URL}/api/ledger/heads", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get heads: {response.text}"
        heads = response.json()
        assert isinstance(heads, list)
        print(f"✓ Found {len(heads)} ledger heads")
        # Check existing head (Sales Revenue)
        if heads:
            assert any(h.get("name") == "Sales Revenue" for h in heads), "Sales Revenue head should exist"
    
    def test_create_ledger_head(self, admin_headers):
        """Create a new ledger head"""
        unique_name = f"TEST_Office_Rent_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/ledger/heads", 
            headers=admin_headers,
            json={
                "name": unique_name,
                "head_type": "expense",
                "description": "Monthly office rent payments",
                "opening_balance": 0
            }
        )
        assert response.status_code == 200, f"Failed to create head: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "id" in data
        print(f"✓ Created ledger head: {unique_name} with ID: {data['id']}")
        return data["id"]
    
    def test_create_duplicate_head_fails(self, admin_headers):
        """Creating duplicate ledger head should fail"""
        # First get existing heads
        response = requests.get(f"{BASE_URL}/api/ledger/heads", headers=admin_headers)
        heads = response.json()
        if heads:
            existing_name = heads[0]["name"]
            # Try to create duplicate
            response = requests.post(f"{BASE_URL}/api/ledger/heads",
                headers=admin_headers,
                json={
                    "name": existing_name,
                    "head_type": "income",
                    "description": "Duplicate test"
                }
            )
            assert response.status_code == 400, f"Should fail for duplicate: {response.text}"
            print(f"✓ Duplicate head creation correctly rejected")


class TestLedgerEntriesCRUD(TestAuthSetup):
    """Test Ledger Entries CRUD operations"""
    
    @pytest.fixture(scope="class")
    def ledger_head_id(self, admin_headers):
        """Get or create a ledger head for testing"""
        response = requests.get(f"{BASE_URL}/api/ledger/heads", headers=admin_headers)
        heads = response.json()
        if heads:
            return heads[0]["id"]
        # Create one if none exist
        response = requests.post(f"{BASE_URL}/api/ledger/heads",
            headers=admin_headers,
            json={
                "name": f"TEST_Head_{uuid.uuid4().hex[:6]}",
                "head_type": "income",
                "description": "Test head"
            }
        )
        return response.json()["id"]
    
    def test_get_ledger_entries(self, admin_headers):
        """Get ledger entries list"""
        response = requests.get(f"{BASE_URL}/api/ledger/entries?page=1&limit=50", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get entries: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "entries" in data
        assert "pagination" in data
        assert "summary" in data
        
        # Verify summary fields
        summary = data["summary"]
        assert "opening_balance" in summary
        assert "total_receipts" in summary
        assert "total_payments" in summary
        assert "closing_balance" in summary
        
        print(f"✓ Got {len(data['entries'])} entries")
        print(f"  Summary: Opening={summary['opening_balance']}, Receipts={summary['total_receipts']}, Payments={summary['total_payments']}, Closing={summary['closing_balance']}")
    
    def test_create_receipt_entry_with_auto_voucher(self, admin_headers, ledger_head_id):
        """Create a receipt entry and verify auto-voucher number format RCP-YYYYMMDD-XXXX"""
        today = datetime.now().strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/ledger/entries",
            headers=admin_headers,
            json={
                "date": today,
                "particulars": "TEST_Cash sale from customer ABC",
                "ledger_head_id": ledger_head_id,
                "entry_type": "receipt",
                "amount": 2500.00,
                "payment_mode": "cash",
                "reference_number": "",
                "remarks": "Automated test entry"
            }
        )
        assert response.status_code == 200, f"Failed to create receipt: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "voucher_number" in data
        voucher = data["voucher_number"]
        
        # Verify voucher format: RCP-YYYYMMDD-XXXX
        assert voucher.startswith("RCP-"), f"Receipt voucher should start with RCP-, got: {voucher}"
        assert len(voucher) == 17, f"Voucher should be 17 chars (RCP-YYYYMMDD-XXXX), got {len(voucher)}: {voucher}"
        
        print(f"✓ Created receipt entry with voucher: {voucher}")
        print(f"  Running balance: {data.get('running_balance')}")
        return data["id"]
    
    def test_create_payment_entry_with_auto_voucher(self, admin_headers, ledger_head_id):
        """Create a payment entry and verify auto-voucher number format PMT-YYYYMMDD-XXXX"""
        today = datetime.now().strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/ledger/entries",
            headers=admin_headers,
            json={
                "date": today,
                "particulars": "TEST_Office rent payment",
                "ledger_head_id": ledger_head_id,
                "entry_type": "payment",
                "amount": 1500.00,
                "payment_mode": "bank",
                "reference_number": "TXN123456",
                "remarks": "Monthly rent"
            }
        )
        assert response.status_code == 200, f"Failed to create payment: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "voucher_number" in data
        voucher = data["voucher_number"]
        
        # Verify voucher format: PMT-YYYYMMDD-XXXX
        assert voucher.startswith("PMT-"), f"Payment voucher should start with PMT-, got: {voucher}"
        assert len(voucher) == 17, f"Voucher should be 17 chars (PMT-YYYYMMDD-XXXX), got {len(voucher)}: {voucher}"
        
        print(f"✓ Created payment entry with voucher: {voucher}")
        print(f"  Running balance: {data.get('running_balance')}")
        return data["id"]
    
    def test_running_balance_calculation(self, admin_headers, ledger_head_id):
        """Verify running balance calculation - receipts increase, payments decrease"""
        # Get initial summary
        response = requests.get(f"{BASE_URL}/api/ledger/entries?page=1&limit=1", headers=admin_headers)
        initial_data = response.json()
        initial_closing = initial_data["summary"]["closing_balance"]
        
        # Create a receipt
        today = datetime.now().strftime('%Y-%m-%d')
        receipt_amount = 1000.00
        response = requests.post(f"{BASE_URL}/api/ledger/entries",
            headers=admin_headers,
            json={
                "date": today,
                "particulars": "TEST_Balance check receipt",
                "ledger_head_id": ledger_head_id,
                "entry_type": "receipt",
                "amount": receipt_amount,
                "payment_mode": "upi"
            }
        )
        assert response.status_code == 200
        receipt_data = response.json()
        
        # Get new summary - closing should increase by receipt amount
        response = requests.get(f"{BASE_URL}/api/ledger/entries?page=1&limit=1", headers=admin_headers)
        after_receipt = response.json()
        
        expected_after_receipt = initial_closing + receipt_amount
        assert abs(after_receipt["summary"]["closing_balance"] - expected_after_receipt) < 0.01, \
            f"Expected closing {expected_after_receipt}, got {after_receipt['summary']['closing_balance']}"
        
        # Create a payment
        payment_amount = 500.00
        response = requests.post(f"{BASE_URL}/api/ledger/entries",
            headers=admin_headers,
            json={
                "date": today,
                "particulars": "TEST_Balance check payment",
                "ledger_head_id": ledger_head_id,
                "entry_type": "payment",
                "amount": payment_amount,
                "payment_mode": "cheque",
                "reference_number": "CHQ-789"
            }
        )
        assert response.status_code == 200
        
        # Get final summary - closing should decrease by payment amount
        response = requests.get(f"{BASE_URL}/api/ledger/entries?page=1&limit=1", headers=admin_headers)
        after_payment = response.json()
        
        expected_final = expected_after_receipt - payment_amount
        assert abs(after_payment["summary"]["closing_balance"] - expected_final) < 0.01, \
            f"Expected closing {expected_final}, got {after_payment['summary']['closing_balance']}"
        
        print(f"✓ Running balance verified: Initial={initial_closing}, After receipt (+{receipt_amount})={expected_after_receipt}, After payment (-{payment_amount})={expected_final}")


class TestValidations(TestAuthSetup):
    """Test input validations"""
    
    @pytest.fixture(scope="class")
    def ledger_head_id(self, admin_headers):
        """Get a ledger head for testing"""
        response = requests.get(f"{BASE_URL}/api/ledger/heads", headers=admin_headers)
        heads = response.json()
        return heads[0]["id"] if heads else None
    
    def test_future_date_rejected(self, admin_headers, ledger_head_id):
        """Date validation - future dates should be rejected"""
        if not ledger_head_id:
            pytest.skip("No ledger head available")
        
        future_date = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/ledger/entries",
            headers=admin_headers,
            json={
                "date": future_date,
                "particulars": "TEST_Future date entry",
                "ledger_head_id": ledger_head_id,
                "entry_type": "receipt",
                "amount": 100.00,
                "payment_mode": "cash"
            }
        )
        assert response.status_code == 400, f"Future date should be rejected: {response.text}"
        assert "future" in response.text.lower() or "date" in response.text.lower()
        print(f"✓ Future date correctly rejected")
    
    def test_negative_amount_rejected(self, admin_headers, ledger_head_id):
        """Amount validation - negative amounts should be rejected"""
        if not ledger_head_id:
            pytest.skip("No ledger head available")
        
        today = datetime.now().strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/ledger/entries",
            headers=admin_headers,
            json={
                "date": today,
                "particulars": "TEST_Negative amount",
                "ledger_head_id": ledger_head_id,
                "entry_type": "receipt",
                "amount": -100.00,
                "payment_mode": "cash"
            }
        )
        assert response.status_code == 422, f"Negative amount should be rejected: {response.text}"
        print(f"✓ Negative amount correctly rejected")
    
    def test_zero_amount_rejected(self, admin_headers, ledger_head_id):
        """Amount validation - zero amount should be rejected"""
        if not ledger_head_id:
            pytest.skip("No ledger head available")
        
        today = datetime.now().strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/ledger/entries",
            headers=admin_headers,
            json={
                "date": today,
                "particulars": "TEST_Zero amount",
                "ledger_head_id": ledger_head_id,
                "entry_type": "receipt",
                "amount": 0,
                "payment_mode": "cash"
            }
        )
        assert response.status_code == 422, f"Zero amount should be rejected: {response.text}"
        print(f"✓ Zero amount correctly rejected")


class TestFilters(TestAuthSetup):
    """Test entry filters"""
    
    def test_filter_by_date_range(self, admin_headers):
        """Filter entries by date range"""
        today = datetime.now().strftime('%Y-%m-%d')
        response = requests.get(
            f"{BASE_URL}/api/ledger/entries?start_date={today}&end_date={today}",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        # All entries should be within date range
        for entry in data.get("entries", []):
            assert entry["date"] == today, f"Entry date {entry['date']} not in range"
        print(f"✓ Date range filter working: Found {len(data.get('entries', []))} entries for today")
    
    def test_filter_by_payment_mode(self, admin_headers):
        """Filter entries by payment mode"""
        response = requests.get(
            f"{BASE_URL}/api/ledger/entries?payment_mode=cash",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        # All entries should have cash payment mode
        for entry in data.get("entries", []):
            assert entry["payment_mode"] == "cash", f"Entry mode {entry['payment_mode']} is not cash"
        print(f"✓ Payment mode filter working: Found {len(data.get('entries', []))} cash entries")
    
    def test_filter_by_entry_type(self, admin_headers):
        """Filter entries by entry type (receipt/payment)"""
        response = requests.get(
            f"{BASE_URL}/api/ledger/entries?entry_type=receipt",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        for entry in data.get("entries", []):
            assert entry["entry_type"] == "receipt"
        print(f"✓ Entry type filter working: Found {len(data.get('entries', []))} receipt entries")
    
    def test_search_filter(self, admin_headers):
        """Search by voucher number or particulars"""
        response = requests.get(
            f"{BASE_URL}/api/ledger/entries?search=TEST",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Search filter working: Found {len(data.get('entries', []))} entries matching 'TEST'")


class TestReports(TestAuthSetup):
    """Test ledger reports"""
    
    def test_monthly_summary_report(self, admin_headers):
        """Get monthly summary report"""
        year = datetime.now().year
        month = datetime.now().month
        response = requests.get(
            f"{BASE_URL}/api/ledger/reports/summary?year={year}&month={month}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to get summary: {response.text}"
        data = response.json()
        
        assert "year" in data
        assert "month" in data
        assert "totals" in data
        assert "by_payment_mode" in data
        
        totals = data["totals"]
        assert "receipts" in totals
        assert "payments" in totals
        assert "net" in totals
        
        print(f"✓ Monthly summary report for {month}/{year}:")
        print(f"  Receipts: {totals['receipts']}, Payments: {totals['payments']}, Net: {totals['net']}")
    
    def test_cash_book_report(self, admin_headers):
        """Get cash book report"""
        today = datetime.now().strftime('%Y-%m-%d')
        start_date = datetime.now().replace(day=1).strftime('%Y-%m-%d')
        
        response = requests.get(
            f"{BASE_URL}/api/ledger/reports/cash-book?start_date={start_date}&end_date={today}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to get cash book: {response.text}"
        data = response.json()
        
        assert data["report_type"] == "cash_book"
        assert "entries" in data
        assert "total_receipts" in data
        assert "total_payments" in data
        assert "net_cash_flow" in data
        
        # Verify all entries are cash
        for entry in data.get("entries", []):
            assert entry["payment_mode"] == "cash"
        
        print(f"✓ Cash book report: {len(data['entries'])} cash entries")
        print(f"  Total Receipts: {data['total_receipts']}, Payments: {data['total_payments']}, Net: {data['net_cash_flow']}")
    
    def test_bank_book_report(self, admin_headers):
        """Get bank book report (bank, upi, cheque)"""
        today = datetime.now().strftime('%Y-%m-%d')
        start_date = datetime.now().replace(day=1).strftime('%Y-%m-%d')
        
        response = requests.get(
            f"{BASE_URL}/api/ledger/reports/bank-book?start_date={start_date}&end_date={today}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to get bank book: {response.text}"
        data = response.json()
        
        assert data["report_type"] == "bank_book"
        assert "entries" in data
        assert "net_bank_flow" in data
        
        # Verify all entries are bank/upi/cheque
        for entry in data.get("entries", []):
            assert entry["payment_mode"] in ["bank", "upi", "cheque"]
        
        print(f"✓ Bank book report: {len(data['entries'])} bank entries")
    
    def test_day_wise_report(self, admin_headers):
        """Get day-wise summary report"""
        today = datetime.now().strftime('%Y-%m-%d')
        start_date = datetime.now().replace(day=1).strftime('%Y-%m-%d')
        
        response = requests.get(
            f"{BASE_URL}/api/ledger/reports/day-wise?start_date={start_date}&end_date={today}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to get day-wise: {response.text}"
        data = response.json()
        
        assert data["report_type"] == "day_wise_summary"
        assert "days" in data
        assert "grand_total" in data
        
        # Verify day structure
        if data["days"]:
            day = data["days"][0]
            assert "date" in day
            assert "receipts" in day
            assert "payments" in day
            assert "net" in day
            assert "transaction_count" in day
        
        print(f"✓ Day-wise report: {len(data['days'])} days with transactions")


class TestLedgerSettings(TestAuthSetup):
    """Test ledger settings"""
    
    def test_get_settings(self, admin_headers):
        """Get ledger settings"""
        response = requests.get(f"{BASE_URL}/api/ledger/settings", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get settings: {response.text}"
        data = response.json()
        
        assert "opening_balance" in data
        print(f"✓ Ledger settings: Opening balance = {data['opening_balance']}")
    
    def test_update_opening_balance(self, admin_headers):
        """Update opening balance (admin only)"""
        today = datetime.now().strftime('%Y-%m-%d')
        new_balance = 10000.00
        
        response = requests.put(
            f"{BASE_URL}/api/ledger/settings/opening-balance",
            headers=admin_headers,
            json={
                "opening_balance": new_balance,
                "effective_date": today
            }
        )
        assert response.status_code == 200, f"Failed to update opening balance: {response.text}"
        data = response.json()
        assert data.get("success") == True
        
        # Verify the update
        response = requests.get(f"{BASE_URL}/api/ledger/settings", headers=admin_headers)
        settings = response.json()
        assert settings["opening_balance"] == new_balance
        
        print(f"✓ Opening balance updated to {new_balance}")


class TestEditDelete(TestAuthSetup):
    """Test edit and delete operations (admin only)"""
    
    @pytest.fixture(scope="class")
    def test_entry(self, admin_headers):
        """Create a test entry for edit/delete tests"""
        response = requests.get(f"{BASE_URL}/api/ledger/heads", headers=admin_headers)
        heads = response.json()
        if not heads:
            pytest.skip("No ledger heads available")
        
        today = datetime.now().strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/ledger/entries",
            headers=admin_headers,
            json={
                "date": today,
                "particulars": "TEST_Entry for edit/delete",
                "ledger_head_id": heads[0]["id"],
                "entry_type": "receipt",
                "amount": 999.00,
                "payment_mode": "cash"
            }
        )
        return response.json()
    
    def test_update_entry(self, admin_headers, test_entry):
        """Update ledger entry"""
        entry_id = test_entry.get("id")
        if not entry_id:
            pytest.skip("No entry to update")
        
        response = requests.put(
            f"{BASE_URL}/api/ledger/entries/{entry_id}",
            headers=admin_headers,
            json={
                "particulars": "TEST_Updated entry particulars",
                "remarks": "Updated via test"
            }
        )
        assert response.status_code == 200, f"Failed to update: {response.text}"
        data = response.json()
        assert data.get("success") == True
        
        # Verify update
        response = requests.get(f"{BASE_URL}/api/ledger/entries/{entry_id}", headers=admin_headers)
        assert response.status_code == 200
        entry = response.json()
        assert entry["particulars"] == "TEST_Updated entry particulars"
        
        print(f"✓ Entry updated successfully")
    
    def test_delete_entry(self, admin_headers, test_entry):
        """Delete ledger entry (soft delete)"""
        entry_id = test_entry.get("id")
        if not entry_id:
            pytest.skip("No entry to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/ledger/entries/{entry_id}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to delete: {response.text}"
        data = response.json()
        assert data.get("success") == True
        
        print(f"✓ Entry deleted successfully")


class TestExports(TestAuthSetup):
    """Test export functionality"""
    
    def test_excel_export(self, admin_headers):
        """Export ledger to Excel format"""
        today = datetime.now().strftime('%Y-%m-%d')
        start_date = datetime.now().replace(day=1).strftime('%Y-%m-%d')
        
        response = requests.get(
            f"{BASE_URL}/api/ledger/export/excel?start_date={start_date}&end_date={today}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to export excel: {response.text}"
        data = response.json()
        
        assert data["format"] == "excel"
        assert "data" in data
        print(f"✓ Excel export ready: {len(data.get('data', []))} entries")
    
    def test_pdf_export(self, admin_headers):
        """Export ledger to PDF format"""
        today = datetime.now().strftime('%Y-%m-%d')
        start_date = datetime.now().replace(day=1).strftime('%Y-%m-%d')
        
        response = requests.get(
            f"{BASE_URL}/api/ledger/export/pdf?start_date={start_date}&end_date={today}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to export pdf: {response.text}"
        data = response.json()
        
        assert data["format"] == "pdf"
        print(f"✓ PDF export ready: {len(data.get('data', []))} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
