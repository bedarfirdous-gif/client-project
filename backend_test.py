#!/usr/bin/env python3

import requests
import sys
from datetime import datetime

class BrandMafiaAPITester:
    def __init__(self, base_url="https://erp-invoice-fix-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    json_data = response.json()
                    if isinstance(json_data, list):
                        print(f"   📊 Returned {len(json_data)} items")
                    elif isinstance(json_data, dict) and 'total_items' in json_data:
                        print(f"   📊 Dashboard stats: {json_data}")
                    return True, json_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")

            return success, response.json() if success else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self):
        """Test login and get token"""
        success, response = self.run_test(
            "Login",
            "POST",
            "/api/auth/login",
            200,
            data={"email": "demo@brandmafia.com", "password": "demo123"}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   🔑 Token obtained for user: {response.get('user', {}).get('name', 'Unknown')}")
            return True
        return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "/api/dashboard/stats",
            200
        )
        return success, response

    def test_items_list(self):
        """Test items listing"""
        success, response = self.run_test(
            "Items List",
            "GET",
            "/api/items",
            200
        )
        return success, response

    def test_customers_list(self):
        """Test customers listing"""
        success, response = self.run_test(
            "Customers List",
            "GET",
            "/api/customers",
            200
        )
        return success, response

    def test_stores_list(self):
        """Test stores listing"""
        success, response = self.run_test(
            "Stores List",
            "GET",
            "/api/stores",
            200
        )
        return success, response

    def test_employees_list(self):
        """Test employees listing"""
        success, response = self.run_test(
            "Employees List",
            "GET",
            "/api/employees",
            200
        )
        return success, response

    def test_categories_list(self):
        """Test categories listing"""
        success, response = self.run_test(
            "Categories List",
            "GET",
            "/api/categories",
            200
        )
        return success, response

    def test_brands_list(self):
        """Test brands listing"""
        success, response = self.run_test(
            "Brands List",
            "GET",
            "/api/brands",
            200
        )
        return success, response

    def test_vouchers_list(self):
        """Test vouchers listing"""
        success, response = self.run_test(
            "Vouchers List",
            "GET",
            "/api/vouchers",
            200
        )
        return success, response

    def test_inventory_list(self):
        """Test inventory listing"""
        success, response = self.run_test(
            "Inventory List",
            "GET",
            "/api/inventory",
            200
        )
        return success, response

def main():
    print("🚀 Starting Brand Mafia POS API Testing...")
    print("=" * 50)
    
    tester = BrandMafiaAPITester()
    
    # Test login first
    if not tester.test_login():
        print("❌ Login failed, stopping tests")
        return 1

    # Test all endpoints
    print("\n📊 Testing Data Endpoints...")
    
    # Dashboard stats
    stats_success, stats_data = tester.test_dashboard_stats()
    
    # Core data endpoints
    items_success, items_data = tester.test_items_list()
    customers_success, customers_data = tester.test_customers_list()
    stores_success, stores_data = tester.test_stores_list()
    employees_success, employees_data = tester.test_employees_list()
    
    # Settings endpoints
    categories_success, categories_data = tester.test_categories_list()
    brands_success, brands_data = tester.test_brands_list()
    vouchers_success, vouchers_data = tester.test_vouchers_list()
    
    # Inventory
    inventory_success, inventory_data = tester.test_inventory_list()

    # Print summary
    print("\n" + "=" * 50)
    print("📋 TEST SUMMARY")
    print("=" * 50)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if stats_success and stats_data:
        print(f"\n📊 RESTORED DATA VERIFICATION:")
        print(f"   Items: {stats_data.get('total_items', 0)} (Expected: 7)")
        print(f"   Customers: {stats_data.get('total_customers', 0)} (Expected: 5)")
        print(f"   Stores: {stats_data.get('total_stores', 0)} (Expected: 4)")
        print(f"   Employees: {stats_data.get('total_employees', 0)}")
        print(f"   Low Stock Items: {stats_data.get('low_stock_items', 0)}")
    
    # Verify expected counts
    success_rate = (tester.tests_passed / tester.tests_run) * 100
    print(f"\n🎯 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("✅ Backend APIs are working well!")
        return 0
    else:
        print("❌ Backend has significant issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())