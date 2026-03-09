"""
GST Reports Module Tests
========================
Tests for GSTR-1, GSTR-3B, and HSN Summary reports API endpoints.
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestGSTReports:
    """GST Reports API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - authenticate and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Get date range (current month)
        today = datetime.now()
        first_day = today.replace(day=1)
        self.from_date = first_day.strftime('%Y-%m-%d')
        self.to_date = today.strftime('%Y-%m-%d')
        
        # Last month dates
        last_month = first_day - timedelta(days=1)
        self.last_month_from = last_month.replace(day=1).strftime('%Y-%m-%d')
        self.last_month_to = last_month.strftime('%Y-%m-%d')
    
    # GSTR-3B Tests
    def test_gstr3b_report_returns_200(self):
        """Test GSTR-3B report endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr3b",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        assert response.status_code == 200, f"GSTR-3B failed: {response.text}"
        print("GSTR-3B report endpoint returns 200 OK")
    
    def test_gstr3b_has_summary_section(self):
        """Test GSTR-3B contains summary with required fields"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr3b",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        assert "summary" in data, "Missing summary section"
        summary = data["summary"]
        
        # Verify summary fields
        assert "total_vouchers" in summary, "Missing total_vouchers"
        assert "total_output_tax" in summary, "Missing total_output_tax"
        assert "total_itc" in summary, "Missing total_itc"
        assert "net_tax_payable" in summary, "Missing net_tax_payable"
        
        # Verify data types (should be numbers, not NaN)
        assert isinstance(summary["total_vouchers"], (int, float)), "total_vouchers should be number"
        assert isinstance(summary["total_output_tax"], (int, float)), "total_output_tax should be number"
        assert isinstance(summary["total_itc"], (int, float)), "total_itc should be number"
        assert isinstance(summary["net_tax_payable"], (int, float)), "net_tax_payable should be number"
        
        print(f"GSTR-3B Summary: Vouchers={summary['total_vouchers']}, Output Tax={summary['total_output_tax']}, ITC={summary['total_itc']}, Net Payable={summary['net_tax_payable']}")
    
    def test_gstr3b_section_3_1_outward_supplies(self):
        """Test GSTR-3B Section 3.1 (Outward Supplies) structure"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr3b",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        assert "section_3_1" in data, "Missing section_3_1"
        section_3_1 = data["section_3_1"]
        
        # Check required subsections
        assert "a_outward_taxable_b2b" in section_3_1, "Missing B2B outward supplies"
        assert "b_outward_taxable_b2c" in section_3_1, "Missing B2C outward supplies"
        
        # Check B2B structure
        b2b = section_3_1["a_outward_taxable_b2b"]
        assert "description" in b2b, "Missing description in B2B"
        assert "taxable_value" in b2b, "Missing taxable_value in B2B"
        assert "integrated_tax" in b2b, "Missing integrated_tax in B2B"
        assert "central_tax" in b2b, "Missing central_tax (CGST) in B2B"
        assert "state_tax" in b2b, "Missing state_tax (SGST) in B2B"
        
        print(f"Section 3.1 B2B: Taxable={b2b['taxable_value']}, CGST={b2b['central_tax']}, SGST={b2b['state_tax']}")
    
    def test_gstr3b_section_4_itc(self):
        """Test GSTR-3B Section 4 (ITC) structure"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr3b",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        assert "section_4" in data, "Missing section_4 (ITC)"
        section_4 = data["section_4"]
        
        # Check ITC sections
        assert "a_itc_available" in section_4, "Missing ITC Available"
        assert "c_net_itc" in section_4, "Missing Net ITC"
        
        # Verify ITC structure
        itc = section_4["a_itc_available"]
        assert "integrated_tax" in itc, "Missing IGST in ITC"
        assert "central_tax" in itc, "Missing CGST in ITC"
        assert "state_tax" in itc, "Missing SGST in ITC"
        
        print(f"Section 4 ITC Available: IGST={itc['integrated_tax']}, CGST={itc['central_tax']}, SGST={itc['state_tax']}")
    
    def test_gstr3b_section_6_tax_payable(self):
        """Test GSTR-3B Section 6 (Tax Payable) structure"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr3b",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        assert "section_6" in data, "Missing section_6 (Tax Payable)"
        section_6 = data["section_6"]
        
        assert "tax_payable" in section_6, "Missing tax_payable"
        
        tax = section_6["tax_payable"]
        assert "integrated_tax" in tax, "Missing IGST in tax payable"
        assert "central_tax" in tax, "Missing CGST in tax payable"
        assert "state_tax" in tax, "Missing SGST in tax payable"
        assert "total" in tax, "Missing total in tax payable"
        
        print(f"Section 6 Tax Payable: IGST={tax['integrated_tax']}, CGST={tax['central_tax']}, SGST={tax['state_tax']}, Total={tax['total']}")
    
    # GSTR-1 Tests
    def test_gstr1_report_returns_200(self):
        """Test GSTR-1 report endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr1",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        assert response.status_code == 200, f"GSTR-1 failed: {response.text}"
        print("GSTR-1 report endpoint returns 200 OK")
    
    def test_gstr1_has_summary_section(self):
        """Test GSTR-1 contains summary with invoice counts"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr1",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        assert "summary" in data, "Missing summary section"
        summary = data["summary"]
        
        # Verify summary fields
        assert "total_invoices" in summary, "Missing total_invoices"
        assert "b2b_count" in summary, "Missing b2b_count"
        assert "b2c_large_count" in summary, "Missing b2c_large_count"
        assert "b2c_small_count" in summary, "Missing b2c_small_count"
        
        print(f"GSTR-1 Summary: Total={summary['total_invoices']}, B2B={summary['b2b_count']}, B2C Large={summary['b2c_large_count']}, B2C Small={summary['b2c_small_count']}")
    
    def test_gstr1_has_totals_section(self):
        """Test GSTR-1 contains totals with tax breakdown"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr1",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        assert "totals" in data, "Missing totals section"
        totals = data["totals"]
        
        # Verify totals fields
        assert "total_taxable" in totals, "Missing total_taxable"
        assert "total_cgst" in totals, "Missing total_cgst"
        assert "total_sgst" in totals, "Missing total_sgst"
        assert "total_igst" in totals, "Missing total_igst"
        assert "total_invoice_value" in totals, "Missing total_invoice_value"
        
        print(f"GSTR-1 Totals: Taxable={totals['total_taxable']}, CGST={totals['total_cgst']}, SGST={totals['total_sgst']}, Total Value={totals['total_invoice_value']}")
    
    def test_gstr1_b2b_invoices_section(self):
        """Test GSTR-1 B2B invoices section"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr1",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        assert "b2b" in data, "Missing B2B section"
        # B2B may be empty if no B2B invoices
        assert isinstance(data["b2b"], list), "B2B should be a list"
        print(f"GSTR-1 B2B Invoices: {len(data['b2b'])} records")
    
    def test_gstr1_b2c_invoices_section(self):
        """Test GSTR-1 B2C invoices sections"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr1",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        assert "b2c_large" in data, "Missing B2C Large section"
        assert "b2c_small" in data, "Missing B2C Small section"
        assert isinstance(data["b2c_large"], list), "B2C Large should be a list"
        assert isinstance(data["b2c_small"], list), "B2C Small should be a list"
        print(f"GSTR-1 B2C: Large={len(data['b2c_large'])}, Small={len(data['b2c_small'])}")
    
    def test_gstr1_hsn_summary_section(self):
        """Test GSTR-1 contains HSN summary"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr1",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        assert "hsn_summary" in data, "Missing hsn_summary section"
        assert isinstance(data["hsn_summary"], list), "HSN summary should be a list"
        print(f"GSTR-1 HSN Summary: {len(data['hsn_summary'])} HSN codes")
    
    # HSN Summary Tests
    def test_hsn_summary_returns_200(self):
        """Test HSN Summary report endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/hsn-summary",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        assert response.status_code == 200, f"HSN Summary failed: {response.text}"
        print("HSN Summary report endpoint returns 200 OK")
    
    def test_hsn_summary_structure(self):
        """Test HSN Summary has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/hsn-summary",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        # Check required sections
        assert "period" in data, "Missing period"
        assert "hsn_summary" in data, "Missing hsn_summary"
        assert "totals" in data, "Missing totals"
        assert "record_count" in data, "Missing record_count"
        
        print(f"HSN Summary: {data['record_count']} HSN codes for period {data['period']}")
    
    def test_hsn_summary_totals_structure(self):
        """Test HSN Summary totals have correct fields"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/hsn-summary",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        totals = data["totals"]
        assert "total_quantity" in totals, "Missing total_quantity"
        assert "total_value" in totals, "Missing total_value"
        assert "taxable_value" in totals, "Missing taxable_value"
        assert "igst" in totals, "Missing igst"
        assert "cgst" in totals, "Missing cgst"
        assert "sgst" in totals, "Missing sgst"
        
        print(f"HSN Totals: Qty={totals['total_quantity']}, Taxable={totals['taxable_value']}, CGST={totals['cgst']}, SGST={totals['sgst']}")
    
    # Export JSON Test
    def test_export_gstr1_json_returns_200(self):
        """Test GSTR-1 JSON export endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/export/gstr1-json",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        assert response.status_code == 200, f"Export JSON failed: {response.text}"
        data = response.json()
        
        # Should have filename and data
        assert "filename" in data, "Missing filename in export"
        assert "data" in data, "Missing data in export"
        
        print(f"Export JSON: filename={data['filename']}")
    
    # Date Filter Tests
    def test_date_filters_work_this_month(self):
        """Test date filters work for current month"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr3b",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        assert "period" in data, "Missing period"
        assert data["period"]["from"] == self.from_date, "From date mismatch"
        assert data["period"]["to"] == self.to_date, "To date mismatch"
        
        print(f"Date filters working: {data['period']}")
    
    def test_date_filters_work_last_month(self):
        """Test date filters work for last month"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr3b",
            params={"from_date": self.last_month_from, "to_date": self.last_month_to},
            headers=self.headers
        )
        data = response.json()
        
        assert "period" in data, "Missing period"
        assert data["period"]["from"] == self.last_month_from, "From date mismatch for last month"
        
        print(f"Last month filter working: {data['period']}")
    
    # Values Not NaN Tests
    def test_gstr3b_values_not_nan(self):
        """Test GSTR-3B values are not NaN or null"""
        response = requests.get(
            f"{BASE_URL}/api/gst-reports/gstr3b",
            params={"from_date": self.from_date, "to_date": self.to_date},
            headers=self.headers
        )
        data = response.json()
        
        # Check section 3.1 values
        if "section_3_1" in data:
            for key, section in data["section_3_1"].items():
                if "taxable_value" in section:
                    val = section["taxable_value"]
                    assert val is not None, f"taxable_value is None in {key}"
                    assert isinstance(val, (int, float)), f"taxable_value is not a number in {key}"
                if "central_tax" in section:
                    val = section["central_tax"]
                    assert val is not None, f"central_tax is None in {key}"
                if "state_tax" in section:
                    val = section["state_tax"]
                    assert val is not None, f"state_tax is None in {key}"
        
        print("GSTR-3B values are valid numbers (no NaN)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
