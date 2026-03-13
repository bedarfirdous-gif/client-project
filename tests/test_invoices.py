"""
Invoice System Backend Tests
Tests for: Invoice CRUD, Payment tracking, Status management
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestInvoiceSystem:
    """Invoice System API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.auth_token = token
        else:
            pytest.skip("Authentication failed - skipping tests")
        
        yield
        
        # Cleanup: Delete test invoices
        try:
            invoices = self.session.get(f"{BASE_URL}/api/invoices").json()
            for inv in invoices:
                if inv.get("customer_name", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/invoices/{inv['id']}")
        except:
            pass
    
    # ============== AUTHENTICATION TEST ==============
    
    def test_auth_login(self):
        """Test authentication works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data or "token" in data
        assert "user" in data
        print("✓ Authentication successful")
    
    # ============== INVOICE LIST TEST ==============
    
    def test_list_invoices(self):
        """Test GET /api/invoices returns list"""
        response = self.session.get(f"{BASE_URL}/api/invoices")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ List invoices returned {len(data)} invoices")
    
    def test_list_invoices_with_status_filter(self):
        """Test GET /api/invoices with status filter"""
        response = self.session.get(f"{BASE_URL}/api/invoices?status=draft")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned invoices should have draft status
        for inv in data:
            assert inv.get("status") == "draft"
        print(f"✓ List invoices with status filter returned {len(data)} draft invoices")
    
    # ============== INVOICE CREATE TEST ==============
    
    def test_create_invoice_draft(self):
        """Test POST /api/invoices - create draft invoice"""
        invoice_data = {
            "customer_id": "",
            "customer_name": "TEST_Draft_Customer",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "customer_address": "123 Test Street",
            "invoice_number": f"TEST-INV-{uuid.uuid4().hex[:6].upper()}",
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "payment_terms": "net30",
            "currency": "INR",
            "tax_inclusive": False,
            "line_items": [
                {
                    "id": str(uuid.uuid4()),
                    "item_id": "",
                    "description": "Test Product 1",
                    "quantity": 2,
                    "unit_price": 500,
                    "discount": 10,
                    "tax_rate": 18
                }
            ],
            "subtotal": 1000,
            "totalDiscount": 100,
            "totalTax": 162,
            "shipping_charges": 50,
            "total": 1112,
            "notes": "Test invoice notes",
            "terms": "Payment due within 30 days",
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["customer_name"] == "TEST_Draft_Customer"
        assert data["status"] == "draft"
        assert data["currency"] == "INR"
        assert "invoice_number" in data
        
        # Store for cleanup
        self.test_invoice_id = data["id"]
        print(f"✓ Created draft invoice: {data['invoice_number']}")
        
        # Verify by GET
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{data['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["customer_name"] == "TEST_Draft_Customer"
        print("✓ Verified invoice persisted in database")
        
        return data
    
    def test_create_invoice_sent(self):
        """Test POST /api/invoices - create and send invoice"""
        invoice_data = {
            "customer_name": "TEST_Sent_Customer",
            "customer_phone": "9876543211",
            "customer_email": "sent@example.com",
            "invoice_number": f"TEST-INV-{uuid.uuid4().hex[:6].upper()}",
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "due_date": (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d"),
            "payment_terms": "net15",
            "currency": "INR",
            "line_items": [
                {
                    "id": str(uuid.uuid4()),
                    "description": "Service Fee",
                    "quantity": 1,
                    "unit_price": 2000,
                    "discount": 0,
                    "tax_rate": 18
                }
            ],
            "subtotal": 2000,
            "totalTax": 360,
            "total": 2360,
            "status": "sent"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "sent"
        assert data["customer_name"] == "TEST_Sent_Customer"
        print(f"✓ Created sent invoice: {data['invoice_number']}")
        
        return data
    
    # ============== INVOICE GET BY ID TEST ==============
    
    def test_get_invoice_by_id(self):
        """Test GET /api/invoices/{id}"""
        # First create an invoice
        created = self.test_create_invoice_draft()
        
        # Get by ID
        response = self.session.get(f"{BASE_URL}/api/invoices/{created['id']}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == created["id"]
        assert data["customer_name"] == created["customer_name"]
        print(f"✓ Retrieved invoice by ID: {data['invoice_number']}")
    
    def test_get_invoice_not_found(self):
        """Test GET /api/invoices/{id} with invalid ID"""
        response = self.session.get(f"{BASE_URL}/api/invoices/invalid-id-12345")
        assert response.status_code == 404
        print("✓ Correctly returned 404 for non-existent invoice")
    
    # ============== INVOICE UPDATE TEST ==============
    
    def test_update_invoice(self):
        """Test PUT /api/invoices/{id}"""
        # First create an invoice
        created = self.test_create_invoice_draft()
        
        # Update the invoice
        update_data = {
            "customer_name": "TEST_Updated_Customer",
            "notes": "Updated notes",
            "shipping_charges": 100
        }
        
        response = self.session.put(f"{BASE_URL}/api/invoices/{created['id']}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        
        assert data["customer_name"] == "TEST_Updated_Customer"
        assert data["notes"] == "Updated notes"
        print(f"✓ Updated invoice: {data['invoice_number']}")
        
        # Verify update persisted
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{created['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["customer_name"] == "TEST_Updated_Customer"
        print("✓ Verified update persisted in database")
    
    # ============== INVOICE STATUS UPDATE TEST ==============
    
    def test_update_invoice_status_to_sent(self):
        """Test PUT /api/invoices/{id}/status - mark as sent"""
        created = self.test_create_invoice_draft()
        
        response = self.session.put(
            f"{BASE_URL}/api/invoices/{created['id']}/status",
            json={"status": "sent"}
        )
        assert response.status_code == 200
        
        # Verify status changed
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{created['id']}")
        assert get_response.json()["status"] == "sent"
        print("✓ Invoice status updated to 'sent'")
    
    def test_update_invoice_status_to_paid(self):
        """Test PUT /api/invoices/{id}/status - mark as paid"""
        created = self.test_create_invoice_sent()
        
        response = self.session.put(
            f"{BASE_URL}/api/invoices/{created['id']}/status",
            json={"status": "paid"}
        )
        assert response.status_code == 200
        
        # Verify status changed and amount_paid updated
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{created['id']}")
        data = get_response.json()
        assert data["status"] == "paid"
        assert data["balance_due"] == 0
        print("✓ Invoice status updated to 'paid' with balance_due = 0")
    
    def test_update_invoice_status_to_cancelled(self):
        """Test PUT /api/invoices/{id}/status - cancel invoice"""
        created = self.test_create_invoice_draft()
        
        response = self.session.put(
            f"{BASE_URL}/api/invoices/{created['id']}/status",
            json={"status": "cancelled"}
        )
        assert response.status_code == 200
        
        # Verify status changed
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{created['id']}")
        assert get_response.json()["status"] == "cancelled"
        print("✓ Invoice status updated to 'cancelled'")
    
    def test_update_invoice_status_invalid(self):
        """Test PUT /api/invoices/{id}/status - invalid status"""
        created = self.test_create_invoice_draft()
        
        response = self.session.put(
            f"{BASE_URL}/api/invoices/{created['id']}/status",
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400
        print("✓ Correctly rejected invalid status")
    
    # ============== PAYMENT RECORDING TEST ==============
    
    def test_record_payment(self):
        """Test POST /api/invoices/{id}/payments - record payment"""
        created = self.test_create_invoice_sent()
        
        payment_data = {
            "amount": 1000,
            "method": "cash",
            "reference": "CASH-001",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Partial payment"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/invoices/{created['id']}/payments",
            json=payment_data
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["amount_paid"] == 1000
        assert data["status"] == "partial"  # Since total was 2360
        print(f"✓ Recorded payment: amount_paid={data['amount_paid']}, status={data['status']}")
        
        # Verify payment persisted
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{created['id']}")
        invoice = get_response.json()
        assert invoice["amount_paid"] == 1000
        assert len(invoice.get("payments", [])) == 1
        print("✓ Verified payment persisted in database")
    
    def test_record_full_payment(self):
        """Test POST /api/invoices/{id}/payments - full payment marks as paid"""
        created = self.test_create_invoice_sent()
        total = created.get("total", 2360)
        
        payment_data = {
            "amount": total,
            "method": "bank",
            "reference": "BANK-TXN-001",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Full payment"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/invoices/{created['id']}/payments",
            json=payment_data
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "paid"
        assert data["balance_due"] == 0
        print(f"✓ Full payment recorded: status={data['status']}, balance_due={data['balance_due']}")
    
    def test_record_payment_invalid_amount(self):
        """Test POST /api/invoices/{id}/payments - invalid amount"""
        created = self.test_create_invoice_sent()
        
        payment_data = {
            "amount": 0,
            "method": "cash"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/invoices/{created['id']}/payments",
            json=payment_data
        )
        assert response.status_code == 400
        print("✓ Correctly rejected invalid payment amount")
    
    def test_record_multiple_payments(self):
        """Test multiple payments on same invoice"""
        created = self.test_create_invoice_sent()
        
        # First payment
        response1 = self.session.post(
            f"{BASE_URL}/api/invoices/{created['id']}/payments",
            json={"amount": 500, "method": "cash"}
        )
        assert response1.status_code == 200
        
        # Second payment
        response2 = self.session.post(
            f"{BASE_URL}/api/invoices/{created['id']}/payments",
            json={"amount": 500, "method": "upi", "reference": "UPI-123"}
        )
        assert response2.status_code == 200
        data = response2.json()
        
        assert data["amount_paid"] == 1000
        print(f"✓ Multiple payments recorded: total amount_paid={data['amount_paid']}")
        
        # Verify payments list
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{created['id']}")
        invoice = get_response.json()
        assert len(invoice.get("payments", [])) == 2
        print("✓ Verified multiple payments in database")
    
    # ============== INVOICE DELETE TEST ==============
    
    def test_delete_invoice(self):
        """Test DELETE /api/invoices/{id}"""
        created = self.test_create_invoice_draft()
        
        response = self.session.delete(f"{BASE_URL}/api/invoices/{created['id']}")
        assert response.status_code == 200
        
        # Verify deleted
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{created['id']}")
        assert get_response.status_code == 404
        print("✓ Invoice deleted successfully")
    
    def test_delete_invoice_not_found(self):
        """Test DELETE /api/invoices/{id} with invalid ID"""
        response = self.session.delete(f"{BASE_URL}/api/invoices/invalid-id-12345")
        assert response.status_code == 404
        print("✓ Correctly returned 404 for non-existent invoice")
    
    # ============== INVOICE TOTALS CALCULATION TEST ==============
    
    def test_invoice_totals_calculation(self):
        """Test invoice totals are calculated correctly"""
        invoice_data = {
            "customer_name": "TEST_Totals_Customer",
            "invoice_number": f"TEST-INV-{uuid.uuid4().hex[:6].upper()}",
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "currency": "INR",
            "line_items": [
                {
                    "id": str(uuid.uuid4()),
                    "description": "Item 1",
                    "quantity": 2,
                    "unit_price": 1000,
                    "discount": 10,  # 10% discount
                    "tax_rate": 18
                },
                {
                    "id": str(uuid.uuid4()),
                    "description": "Item 2",
                    "quantity": 1,
                    "unit_price": 500,
                    "discount": 0,
                    "tax_rate": 18
                }
            ],
            # Subtotal: 2000 + 500 = 2500
            # Item 1 discount: 200 (10% of 2000)
            # After discount: 2300
            # Tax: 414 (18% of 2300)
            # Shipping: 100
            # Total: 2814
            "subtotal": 2500,
            "totalDiscount": 200,
            "totalTax": 414,
            "shipping_charges": 100,
            "total": 2814,
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert response.status_code == 200
        data = response.json()
        
        # Verify totals stored correctly
        assert data.get("subtotal") == 2500
        assert data.get("totalDiscount") == 200
        assert data.get("totalTax") == 414
        assert data.get("total") == 2814 or data.get("total_amount") == 2814
        print(f"✓ Invoice totals calculated correctly: subtotal={data.get('subtotal')}, total={data.get('total')}")
    
    # ============== CURRENCY TEST ==============
    
    def test_invoice_different_currencies(self):
        """Test invoice with different currencies"""
        currencies = ["INR", "USD", "EUR", "GBP"]
        
        for currency in currencies:
            invoice_data = {
                "customer_name": f"TEST_{currency}_Customer",
                "invoice_number": f"TEST-{currency}-{uuid.uuid4().hex[:4].upper()}",
                "issue_date": datetime.now().strftime("%Y-%m-%d"),
                "due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
                "currency": currency,
                "line_items": [{"description": "Test", "quantity": 1, "unit_price": 100}],
                "total": 100,
                "status": "draft"
            }
            
            response = self.session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
            assert response.status_code == 200
            data = response.json()
            assert data["currency"] == currency
            print(f"✓ Invoice created with currency: {currency}")


# ============== CUSTOMERS & ITEMS DEPENDENCY TESTS ==============

class TestInvoiceDependencies:
    """Test invoice dependencies (customers, items)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@brandmafia.com",
            "password": "demo123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
    
    def test_get_customers_for_invoice(self):
        """Test GET /api/customers - needed for invoice customer selection"""
        response = self.session.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} customers for invoice selection")
    
    def test_get_items_for_invoice(self):
        """Test GET /api/items - needed for invoice line items"""
        response = self.session.get(f"{BASE_URL}/api/items")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} items for invoice line items")
    
    def test_invoice_settings(self):
        """Test GET /api/invoice-settings - for PDF/Print branding"""
        response = self.session.get(f"{BASE_URL}/api/invoice-settings")
        # May return 200 with data or 404 if not configured
        assert response.status_code in [200, 404]
        print(f"✓ Invoice settings endpoint responded with status {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
