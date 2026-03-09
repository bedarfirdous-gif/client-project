# BijnisBooks ERP - Product Requirements Document

## Original Problem Statement
Build an enterprise-grade ERP system with comprehensive features for retail business management including POS, inventory, purchases, sales, accounting, GST compliance, and multi-store support.

## User Personas
1. **Store Owner/Superadmin** - Full access to all features, manages multiple stores
2. **Store Manager** - Access to POS, inventory, sales for their assigned store
3. **Sales Staff** - Limited to POS operations
4. **Accountant** - Access to accounting, ledger, and reports

## Core Requirements
### Completed Features
- [x] Multi-store POS system with GST support
- [x] Inventory management with stock transfers
- [x] Customer management with loyalty points
- [x] Supplier/vendor management
- [x] Purchase orders and purchase invoices
- [x] Sales invoicing with CGST/SGST breakdown
- [x] Double-entry accounting system
- [x] Central GST configuration (default 5% GST)
- [x] RBAC (Role-Based Access Control)
- [x] Dashboard with analytics
- [x] E-commerce checkout flow for public store
- [x] WhatsApp integration for invoice sharing
- [x] Thermal printer support
- [x] PDF invoice generation with CGST/SGST split

### In Progress
- [ ] Backend refactoring - modular routers created, need to remove duplicates from server.py
- [ ] Performance optimization - lazy loading improvements
- [ ] Purchase Orders link visibility in RBAC

### Backlog (P1-P2)
- [ ] AiSensy WhatsApp API integration (JWT provided)
- [ ] Item-wise GST mapping via HSN codes
- [ ] Store subdomain DNS configuration

## Technical Architecture
```
/app
├── backend
│   ├── routes/              # Modular FastAPI routers
│   │   ├── sales.py
│   │   ├── purchase.py
│   │   ├── inventory.py
│   │   ├── settings.py
│   │   └── ...
│   ├── tests/
│   │   └── test_routers.py
│   ├── utils/deps.py        # JWT and DB utilities
│   └── server.py            # Main server (41K+ lines - needs cleanup)
└── frontend
    └── src/
        ├── pages/
        ├── components/
        └── contexts/
```

## Key Integrations
- MongoDB for data storage
- JWT authentication
- ExchangeRate-API for currency conversion
- WhatsApp Web for invoice sharing

## Session Updates

### March 4, 2026
- **FIXED RBAC Module Count**: Updated RBAC Permissions page to show all **84 modules** (was showing 78)
  - Added missing modules: `superadmin_dashboard`, `subscriptions`, `rbac_admin`, `autoheal`, `settings`, `stock_receiver`, `smart_scanner`
  - Synced `PermissionContext.js` with `RBACPermissionsPage.js` for consistency
  - Updated module count in User Management and Role Templates tabs

- **REFACTORED PDF Generation**: Created centralized utility at `/app/frontend/src/utils/invoicePdfGenerator.js`
  - Eliminates duplicated PDF code across POSPage.js, SalesPage.js, ReceiptGenerator.js
  - Professional A4 invoice format with proper alignment
  - Includes MRP column, CGST/SGST split, Terms & Conditions
- Updated POSPage.js, SalesPage.js, ReceiptGenerator.js to use the centralized utility
- Testing confirmed: PDF generation working correctly with proper formatting

### March 2, 2026
- Fixed PDF and thermal print formats to show CGST/SGST breakdown instead of single GST line
- Updated 10+ files across POS, Sales, Invoices, Receipts, Quotations, and more
- All invoice formats now show: `CGST (X%): ₹amount` + `SGST (X%): ₹amount`

## Test Credentials
- **Superadmin**: superadmin@bijnisbooks.com / admin123
- **Test Store**: Test Store (default)

## Known Issues
1. ~~Purchase Orders link not visible for some users~~ - **RESOLVED**: Visible for superadmin. Non-superadmin users need `purchase_orders` permission in RBAC
2. Large server.py file (41K+ lines) with duplicate code from modular routers - needs cleanup
