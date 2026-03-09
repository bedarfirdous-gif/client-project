"""
Sales Report Export API Tests
=============================
Tests for Excel and Tally XML export functionality for sales reports.
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://erp-invoice-fix-1.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "superadmin@bijnisbooks.com"
TEST_PASSWORD = "superadmin123"


class TestSalesExport:
    """Test suite for Sales Report Export endpoints"""
    
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
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    # ===================== EXCEL EXPORT TESTS =====================
    
    def test_excel_export_all_payments_success(self):
        """Test Excel export with all payment types - should return 200 and xlsx content"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/excel",
            params={"payment_type": "all"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        assert "attachment" in response.headers.get("content-disposition", "")
        assert ".xlsx" in response.headers.get("content-disposition", "")
        assert len(response.content) > 0, "Excel file should not be empty"
        print(f"Excel export (all) SUCCESS - File size: {len(response.content)} bytes")
    
    def test_excel_export_cash_payments(self):
        """Test Excel export filtered by cash payment type"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/excel",
            params={"payment_type": "cash"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        print(f"Excel export (cash) SUCCESS - File size: {len(response.content)} bytes")
    
    def test_excel_export_credit_payments(self):
        """Test Excel export filtered by credit payment type"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/excel",
            params={"payment_type": "credit"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        print(f"Excel export (credit) SUCCESS - File size: {len(response.content)} bytes")
    
    def test_excel_export_upi_payments(self):
        """Test Excel export filtered by UPI payment type"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/excel",
            params={"payment_type": "upi"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"Excel export (upi) SUCCESS - File size: {len(response.content)} bytes")
    
    def test_excel_export_with_date_range(self):
        """Test Excel export with custom date range"""
        from_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        to_date = datetime.now().strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/excel",
            params={
                "payment_type": "all",
                "from_date": from_date,
                "to_date": to_date
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert f"{from_date}" in response.headers.get("content-disposition", "")
        print(f"Excel export with date range SUCCESS - File size: {len(response.content)} bytes")
    
    # ===================== TALLY EXPORT TESTS =====================
    
    def test_tally_export_all_payments_success(self):
        """Test Tally XML export with all payment types - should return 200 and XML content"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/tally",
            params={"payment_type": "all"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "application/xml" in response.headers.get("content-type", "")
        assert "attachment" in response.headers.get("content-disposition", "")
        assert ".xml" in response.headers.get("content-disposition", "")
        
        # Check XML content structure
        content = response.text
        assert "<?xml" in content, "Should have XML declaration"
        assert "<ENVELOPE>" in content, "Should have ENVELOPE root element"
        assert "<HEADER>" in content, "Should have HEADER element"
        assert "<TALLYREQUEST>Import Data</TALLYREQUEST>" in content, "Should have Tally import request"
        print(f"Tally export (all) SUCCESS - XML size: {len(content)} chars")
    
    def test_tally_export_cash_payments(self):
        """Test Tally XML export filtered by cash payment type"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/tally",
            params={"payment_type": "cash"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "application/xml" in response.headers.get("content-type", "")
        print(f"Tally export (cash) SUCCESS - XML size: {len(response.text)} chars")
    
    def test_tally_export_with_company_name(self):
        """Test Tally XML export with custom company name"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/tally",
            params={
                "payment_type": "all",
                "company_name": "BijnisBooks Test"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "BijnisBooks Test" in response.text, "Company name should be in XML"
        print(f"Tally export with company name SUCCESS")
    
    def test_tally_export_with_date_range(self):
        """Test Tally XML export with custom date range"""
        from_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        to_date = datetime.now().strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/tally",
            params={
                "payment_type": "all",
                "from_date": from_date,
                "to_date": to_date
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert f"{from_date}" in response.headers.get("content-disposition", "")
        print(f"Tally export with date range SUCCESS - XML size: {len(response.text)} chars")
    
    # ===================== AUTH/PERMISSION TESTS =====================
    
    def test_excel_export_requires_auth(self):
        """Test that Excel export requires authentication"""
        # Create a new session without auth
        unauth_session = requests.Session()
        
        response = unauth_session.get(
            f"{BASE_URL}/api/reports/sales/export/excel",
            params={"payment_type": "all"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Excel export auth check SUCCESS - returns {response.status_code} without auth")
    
    def test_tally_export_requires_auth(self):
        """Test that Tally export requires authentication"""
        # Create a new session without auth
        unauth_session = requests.Session()
        
        response = unauth_session.get(
            f"{BASE_URL}/api/reports/sales/export/tally",
            params={"payment_type": "all"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Tally export auth check SUCCESS - returns {response.status_code} without auth")
    
    # ===================== EDGE CASES =====================
    
    def test_excel_export_card_payments(self):
        """Test Excel export filtered by card payment type"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/excel",
            params={"payment_type": "card"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"Excel export (card) SUCCESS - File size: {len(response.content)} bytes")
    
    def test_excel_export_bank_transfer_payments(self):
        """Test Excel export filtered by bank_transfer payment type"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/sales/export/excel",
            params={"payment_type": "bank_transfer"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"Excel export (bank_transfer) SUCCESS - File size: {len(response.content)} bytes")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
