# Backend Architecture Guide

## Current Structure

The `server.py` file contains all API routes organized by sections. This document maps the structure and provides guidance for future modularization.

## Route Sections Map

| Section | Line Range | Description |
|---------|------------|-------------|
| AUTH HELPERS | 867-937 | Password hashing, JWT, permission checks |
| AUTH ROUTES | 938-1134 | Login, logout, heartbeat |
| ONLINE USERS & SECURITY | 1135-1281 | Security alerts, online users |
| USERS ROUTES | 1282-1570 | User CRUD, profile management |
| ROLES MANAGEMENT | 1571-1700 | Role CRUD, audit trail |
| ENHANCED RBAC | 1701-2468 | Permission templates, sessions, IP whitelist |
| DASHBOARD | 2469-2531 | Dashboard stats, recent sales |
| GLOBAL SEARCH | 2532-2596 | Multi-entity search |
| PUBLIC CATALOGUE | 2597-2662 | Public product catalog |
| ITEMS ROUTES | 2663-2885 | Product CRUD, AI image generation |
| VARIANTS | 2886-2924 | Product variants |
| INVENTORY | 2925-3092 | Stock management |
| STOCK AUDIT TRAIL | 3093-3297 | Stock audit history |
| STORES | 3298-3337 | Store CRUD |
| CUSTOMERS | 3338-3392 | Customer CRUD |
| SUPPLIERS | 3393-3425 | Supplier CRUD |
| EMPLOYEES | 3426-3470 | Employee CRUD |
| ATTENDANCE | 3471-3540 | Attendance tracking |
| SALARY STRUCTURES | 3541-3573 | Salary management |
| PAYROLL | 3574-3764 | Payroll processing |
| CATEGORIES & BRANDS | 3765-3815 | Category/brand CRUD |
| GST MASTER | 3816-3940 | GST slabs |
| HSN CODE MASTER | 3941-4029 | HSN codes |
| GST LEDGER | 4030-4261 | GST transactions |
| SALES MODULE | 4262-4949 | Quotations, orders, invoices |
| LOYALTY POINTS | 4950-4998 | Points management |
| VOUCHERS | 4999-5073 | Voucher CRUD |
| ITEM DISCOUNTS | 5110-5223 | Item-level discounts |
| BOGO OFFERS | 5224-5340 | Buy-one-get-one |
| TIERED DISCOUNTS | 5341-5442 | Tiered pricing |
| DISCOUNT CALCULATOR | 5443-5527 | Combined discounts |
| PURCHASE INVOICES | 5528-5558 | Purchase management |
| PURCHASE RETURNS | 5559-5634 | Return processing |
| PURCHASE REPORTS | 5635-5795 | Purchase analytics |
| CUSTOMER LEDGER | 5796-5886 | Customer transactions |
| SUPPLIER LEDGER | 5887-6015 | Supplier transactions |
| STOCK TRANSFERS | 6281-6563 | Inter-store transfers |
| STOCK ALERTS | 6564-6612 | Low stock notifications |
| SALES | 6613-6851 | Sales processing |
| SALES RETURNS | 6852-7056 | Return handling |
| RESTOCK ALERTS | 7057-7117 | Restock notifications |
| PRINT TEMPLATES | 7118-7135 | Receipt templates |
| FILE UPLOAD | 7136-7190 | Image uploads |
| AI REVIEW REPLY | 7191-7246 | AI-powered replies |
| AI IMAGE GENERATION | 7247-7417 | Product image gen |
| VIRTUAL TRIAL ROOM | 7418-7548 | AR try-on |
| SHOPPING CART | 7549-7886 | Cart management |
| DATA RESTORE | 7887-7920 | Backup restore |
| SYSTEM MAINTENANCE | 7921-8090 | System repair |
| ANALYTICS DASHBOARD | 8091-8265 | Advanced analytics |
| NETWORK PRINTER | 8266-8292 | Printer proxy |
| PUSH NOTIFICATIONS | 8293-8320 | Push API |
| SMART STOCK SCANNER | 8321-8952 | AI scanner |
| LEGACY SCANNER | 8953-9188 | Alternative scanner |
| LOYALTY PROGRAM | 9189-9384 | Loyalty features |
| MEMBERSHIP CARD | 9385-9609 | Card PDF generation |
| EMPLOYEE RATINGS | 9610-9723 | Employee feedback |
| INVOICE SETTINGS | 9724-9810 | Invoice config |
| BACKUP & RESTORE | 9811-10165 | Data backup |
| MFA & SECURITY | 10166-10377 | 2FA, security |
| TRASH / RECYCLE BIN | 10378-10442 | Soft delete |
| ACCOUNTING REPORTS | 10443-11532 | Financial reports |
| EMPLOYMENT AGREEMENTS | 11533-11872 | HR agreements |
| EMPLOYMENT APPLICATIONS | 11873-12074 | Job applications |
| GOOGLE MY BUSINESS | 12075-12516 | GMB integration |
| SUPER ADMIN SYSTEM | 12517-13293 | Super admin features |
| CENTRALIZED INVENTORY | 13294-14029 | Inventory API |
| SUPER ADMIN USER MGMT | 14030-14278 | Admin user management |
| MODULE MANAGEMENT | 14279-14494 | Module config |
| SUBSCRIPTION PLANS | 14495-14939 | Plan management |
| SUBSCRIPTION BILLING | 14940-15513 | Billing system |
| ADMIN UPGRADES | 15514-15820 | Plan upgrades |
| CENTRALIZED SUBSCRIPTIONS | 15821-16312 | Subscription API |
| TRAINING SYSTEM | 16313-16605 | Screen share training |
| AUTO POSTER | 16606-16815 | Social media posting |
| AI AGENT SYSTEM | 16816-17021 | AI agents |
| WHATSAPP CRM | 17022-17194 | WhatsApp integration |
| CUSTOMER IMPORT | 17195-17494 | Bulk import |
| VIRTUAL TRY-ON | 17495-17661 | AI try-on |
| WEBSOCKET | 17662-17722 | Real-time connections |

## Future Modular Structure (Recommended)

```
/app/backend/
├── main.py                 # FastAPI app initialization
├── server.py              # Legacy (keep for compatibility)
├── routes/
│   ├── __init__.py
│   ├── auth.py            # Authentication routes
│   ├── users.py           # User management
│   ├── rbac.py            # Role-based access control
│   ├── dashboard.py       # Dashboard & analytics
│   ├── items.py           # Product management
│   ├── inventory.py       # Stock & inventory
│   ├── stores.py          # Store management
│   ├── customers.py       # Customer management
│   ├── suppliers.py       # Supplier management
│   ├── employees.py       # HR & employees
│   ├── sales.py           # Sales & invoices
│   ├── purchases.py       # Purchase management
│   ├── discounts.py       # Vouchers & discounts
│   ├── superadmin.py      # Super admin features
│   ├── subscriptions.py   # Subscription system
│   ├── ai.py              # AI features (scanner, try-on)
│   └── integrations.py    # External integrations
├── models/
│   ├── __init__.py
│   ├── user.py            # User models
│   ├── item.py            # Product models
│   ├── sales.py           # Sales models
│   └── schemas.py         # Pydantic schemas
├── utils/
│   ├── __init__.py
│   ├── auth.py            # Auth helpers
│   ├── db.py              # Database utilities
│   └── helpers.py         # Common helpers
└── services/
    ├── __init__.py
    ├── email.py           # Email service
    ├── ai.py              # AI service wrapper
    └── notification.py    # Push notifications
```

## How to Add New Routes

When adding new features, follow this pattern:

1. Create a new router file in `routes/`:
```python
# routes/new_feature.py
from fastapi import APIRouter, Depends
from utils.auth import get_current_user

router = APIRouter(prefix="/new-feature", tags=["New Feature"])

@router.get("/")
async def list_items(user: dict = Depends(get_current_user)):
    return {"items": []}
```

2. Register the router in `server.py`:
```python
from routes.new_feature import router as new_feature_router
app.include_router(new_feature_router, prefix="/api")
```

## Database Collections

- `users` - User accounts
- `roles` - RBAC roles
- `items` - Products
- `variants` - Product variants
- `inventory` - Stock records
- `stores` - Store locations
- `customers` - Customer records
- `suppliers` - Supplier records
- `employees` - Employee records
- `sales` - Sales transactions
- `invoices` - Invoice records
- `purchases` - Purchase records
- `vouchers` - Discount vouchers
- `security_alerts` - Security events
- `user_sessions` - Active sessions
- `login_history` - Login audit trail
- `subscription_plans` - Subscription tiers
- `tenant_subscriptions` - Tenant plans

## Environment Variables

Required:
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name
- `JWT_SECRET` - JWT signing key

Optional:
- `EMERGENT_LLM_KEY` - AI features
- `DAILY_API_KEY` - Video conferencing
