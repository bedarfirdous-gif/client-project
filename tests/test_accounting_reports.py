"""
Test suite for Accounting Reports API endpoints
Tests: Income Statement, Balance Sheet, Cash Flow, Trial Balance, General Ledger
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAccountingReports:
    """Accounting Reports API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    # ============== INCOME STATEMENT TESTS ==============
    
    def test_income_statement_basic(self):
        """Test Income Statement endpoint returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/income-statement?start_date=2026-01-01&end_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "period" in data
        assert "revenue" in data
        assert "cost_of_goods_sold" in data
        assert "gross_profit" in data
        assert "operating_expenses" in data
        assert "net_profit" in data
        assert "profit_margin" in data
        
        # Verify revenue structure
        revenue = data["revenue"]
        assert "sales_revenue" in revenue
        assert "invoice_revenue" in revenue
        assert "gross_revenue" in revenue
        assert "discounts" in revenue
        assert "sales_returns" in revenue
        assert "net_revenue" in revenue
        
        # Verify COGS structure
        cogs = data["cost_of_goods_sold"]
        assert "purchases" in cogs
        assert "total_cogs" in cogs
        
        # Verify operating expenses structure
        opex = data["operating_expenses"]
        assert "salaries_wages" in opex
        assert "total_operating_expenses" in opex
    
    def test_income_statement_with_store_filter(self):
        """Test Income Statement with store filter"""
        # First get stores
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=self.headers)
        assert stores_response.status_code == 200
        stores = stores_response.json()
        
        if stores:
            store_id = stores[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/accounting/income-statement?start_date=2026-01-01&end_date=2026-02-02&store_id={store_id}",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["period"]["store_id"] == store_id
    
    def test_income_statement_date_range(self):
        """Test Income Statement with different date ranges"""
        # This Month
        response = requests.get(
            f"{BASE_URL}/api/accounting/income-statement?start_date=2026-02-01&end_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        
        # This Year
        response = requests.get(
            f"{BASE_URL}/api/accounting/income-statement?start_date=2026-01-01&end_date=2026-12-31",
            headers=self.headers
        )
        assert response.status_code == 200
    
    # ============== BALANCE SHEET TESTS ==============
    
    def test_balance_sheet_basic(self):
        """Test Balance Sheet endpoint returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/balance-sheet?as_of_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "as_of_date" in data
        assert "assets" in data
        assert "liabilities" in data
        assert "equity" in data
        assert "total_liabilities_and_equity" in data
        
        # Verify assets structure
        assets = data["assets"]
        assert "current_assets" in assets
        assert "total_assets" in assets
        
        current_assets = assets["current_assets"]
        assert "cash" in current_assets
        assert "accounts_receivable" in current_assets
        assert "inventory" in current_assets
        assert "total_current_assets" in current_assets
        
        # Verify liabilities structure
        liabilities = data["liabilities"]
        assert "current_liabilities" in liabilities
        assert "total_liabilities" in liabilities
        
        # Verify equity structure
        equity = data["equity"]
        assert "owners_capital" in equity
        assert "total_equity" in equity
    
    def test_balance_sheet_accounting_equation(self):
        """Test Balance Sheet follows accounting equation: Assets = Liabilities + Equity"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/balance-sheet?as_of_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        total_assets = data["assets"]["total_assets"]
        total_liabilities_and_equity = data["total_liabilities_and_equity"]
        
        # Assets should equal Liabilities + Equity
        assert abs(total_assets - total_liabilities_and_equity) < 0.01, \
            f"Accounting equation not balanced: Assets={total_assets}, L+E={total_liabilities_and_equity}"
    
    def test_balance_sheet_inventory_value(self):
        """Test Balance Sheet shows inventory value"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/balance-sheet?as_of_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        inventory = data["assets"]["current_assets"]["inventory"]
        # Based on context, inventory should be around ₹2,66,300
        assert inventory >= 0, "Inventory should be non-negative"
        print(f"Inventory value: ₹{inventory}")
    
    def test_balance_sheet_with_store_filter(self):
        """Test Balance Sheet with store filter"""
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=self.headers)
        stores = stores_response.json()
        
        if stores:
            store_id = stores[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/accounting/balance-sheet?as_of_date=2026-02-02&store_id={store_id}",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["store_id"] == store_id
    
    # ============== CASH FLOW TESTS ==============
    
    def test_cash_flow_basic(self):
        """Test Cash Flow Statement endpoint returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/cash-flow?start_date=2026-01-01&end_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "period" in data
        assert "operating_activities" in data
        assert "investing_activities" in data
        assert "financing_activities" in data
        assert "net_change_in_cash" in data
        
        # Verify operating activities structure
        operating = data["operating_activities"]
        assert "inflows" in operating
        assert "outflows" in operating
        assert "net_operating_cash" in operating
        
        # Verify inflows structure
        inflows = operating["inflows"]
        assert "cash_from_sales" in inflows
        assert "cash_from_invoices" in inflows
        assert "total_inflows" in inflows
        
        # Verify outflows structure
        outflows = operating["outflows"]
        assert "cash_for_purchases" in outflows
        assert "cash_for_payroll" in outflows
        assert "cash_for_refunds" in outflows
        assert "total_outflows" in outflows
    
    def test_cash_flow_net_calculation(self):
        """Test Cash Flow net calculation is correct"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/cash-flow?start_date=2026-01-01&end_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        operating = data["operating_activities"]
        total_inflows = operating["inflows"]["total_inflows"]
        total_outflows = operating["outflows"]["total_outflows"]
        net_operating = operating["net_operating_cash"]
        
        # Net = Inflows - Outflows
        expected_net = total_inflows - total_outflows
        assert abs(net_operating - expected_net) < 0.01, \
            f"Net operating cash calculation error: expected {expected_net}, got {net_operating}"
    
    def test_cash_flow_with_store_filter(self):
        """Test Cash Flow with store filter"""
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=self.headers)
        stores = stores_response.json()
        
        if stores:
            store_id = stores[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/accounting/cash-flow?start_date=2026-01-01&end_date=2026-02-02&store_id={store_id}",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["period"]["store_id"] == store_id
    
    # ============== TRIAL BALANCE TESTS ==============
    
    def test_trial_balance_basic(self):
        """Test Trial Balance endpoint returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/trial-balance?as_of_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "as_of_date" in data
        assert "accounts" in data
        assert "totals" in data
        
        # Verify totals structure
        totals = data["totals"]
        assert "total_debits" in totals
        assert "total_credits" in totals
        assert "is_balanced" in totals
    
    def test_trial_balance_is_balanced(self):
        """Test Trial Balance debits equal credits"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/trial-balance?as_of_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        totals = data["totals"]
        assert totals["is_balanced"] == True, \
            f"Trial Balance not balanced: Debits={totals['total_debits']}, Credits={totals['total_credits']}"
        
        # Verify debits equal credits
        assert abs(totals["total_debits"] - totals["total_credits"]) < 0.01
    
    def test_trial_balance_account_structure(self):
        """Test Trial Balance accounts have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/trial-balance?as_of_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        accounts = data["accounts"]
        for account in accounts:
            assert "account_code" in account
            assert "account_name" in account
            assert "debit" in account
            assert "credit" in account
            # Each account should have either debit or credit, not both
            assert not (account["debit"] > 0 and account["credit"] > 0), \
                f"Account {account['account_name']} has both debit and credit"
    
    def test_trial_balance_with_store_filter(self):
        """Test Trial Balance with store filter"""
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=self.headers)
        stores = stores_response.json()
        
        if stores:
            store_id = stores[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/accounting/trial-balance?as_of_date=2026-02-02&store_id={store_id}",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["store_id"] == store_id
    
    # ============== GENERAL LEDGER TESTS ==============
    
    def test_general_ledger_basic(self):
        """Test General Ledger endpoint returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/general-ledger?start_date=2026-01-01&end_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "period" in data
        assert "account_filter" in data
        assert "entries" in data
        assert "summary" in data
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_entries" in summary
        assert "total_debits" in summary
        assert "total_credits" in summary
        assert "accounts_affected" in summary
    
    def test_general_ledger_entry_structure(self):
        """Test General Ledger entries have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/general-ledger?start_date=2026-01-01&end_date=2026-02-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        entries = data["entries"]
        for entry in entries:
            assert "date" in entry
            assert "reference" in entry
            assert "description" in entry
            assert "account_code" in entry
            assert "account_name" in entry
            assert "debit" in entry
            assert "credit" in entry
            assert "running_balance" in entry
    
    def test_general_ledger_with_account_filter(self):
        """Test General Ledger with account code filter"""
        # Filter by Cash account (1000)
        response = requests.get(
            f"{BASE_URL}/api/accounting/general-ledger?start_date=2026-01-01&end_date=2026-02-02&account_code=1000",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["account_filter"] == "1000"
        # All entries should be for account 1000
        for entry in data["entries"]:
            assert entry["account_code"] == "1000"
    
    def test_general_ledger_with_store_filter(self):
        """Test General Ledger with store filter"""
        stores_response = requests.get(f"{BASE_URL}/api/stores", headers=self.headers)
        stores = stores_response.json()
        
        if stores:
            store_id = stores[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/accounting/general-ledger?start_date=2026-01-01&end_date=2026-02-02&store_id={store_id}",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["period"]["store_id"] == store_id
    
    # ============== CHART OF ACCOUNTS TEST ==============
    
    def test_chart_of_accounts(self):
        """Test Chart of Accounts endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/chart-of-accounts",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return predefined accounts
        assert isinstance(data, (list, dict))


class TestAccountingReportsEdgeCases:
    """Edge case tests for Accounting Reports"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_income_statement_no_dates(self):
        """Test Income Statement without date parameters"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/income-statement",
            headers=self.headers
        )
        assert response.status_code == 200
    
    def test_balance_sheet_no_date(self):
        """Test Balance Sheet without as_of_date"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/balance-sheet",
            headers=self.headers
        )
        assert response.status_code == 200
    
    def test_cash_flow_no_dates(self):
        """Test Cash Flow without date parameters"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/cash-flow",
            headers=self.headers
        )
        assert response.status_code == 200
    
    def test_trial_balance_no_date(self):
        """Test Trial Balance without as_of_date"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/trial-balance",
            headers=self.headers
        )
        assert response.status_code == 200
    
    def test_general_ledger_no_dates(self):
        """Test General Ledger without date parameters"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/general-ledger",
            headers=self.headers
        )
        assert response.status_code == 200
    
    def test_invalid_store_id(self):
        """Test reports with invalid store ID"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/income-statement?store_id=invalid-store-id",
            headers=self.headers
        )
        # Should return 200 with empty/zero data, not error
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
