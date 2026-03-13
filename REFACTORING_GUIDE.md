# Backend Refactoring Guide

## Current State (Feb 2026)
- `server.py`: ~40,300 lines containing all routes and business logic
- `routes/`: Modular route files (partial migration in progress)

## Migration Progress
| Module | Status | Lines | Priority |
|--------|--------|-------|----------|
| ledger.py | ✅ Migrated | ~200 | - |
| items.py | 🔄 Partial | ~300 | P1 |
| ecommerce.py | 🔄 Partial | ~800 | P1 |
| customers.py | 📋 Template | ~100 | P2 |
| sales.py | ❌ Pending | ~1500 | P1 |
| purchase.py | ❌ Pending | ~1000 | P2 |
| inventory.py | ❌ Pending | ~800 | P2 |
| reports.py | ❌ Pending | ~600 | P3 |

## Shared Dependencies
The `utils/deps.py` module provides:
- `get_current_user` - JWT authentication
- `require_permission` - Permission checking
- `get_tenant_id` - Multi-tenant extraction
- `db` - Database connection (set via `set_database()`)

## Route Ordering Rules (CRITICAL)

FastAPI matches routes in declaration order. When using path parameters like `{item_id}`, **static paths MUST come BEFORE dynamic paths**.

### Bug Pattern (What Caused Empty Bin Bug)
```python
# WRONG ORDER - causes bugs
@router.post("/{item_id}/restore")  # Dynamic path
async def restore_item(...): ...

@router.delete("/{item_id}")  # Dynamic path  
async def delete_item(...): ...

@router.delete("/empty")  # Static path - BUT IT'S TOO LATE!
async def empty_bin(...): ...
# "/empty" matches "/{item_id}" where item_id="empty"
```

### Correct Order
```python
# CORRECT ORDER - static paths FIRST
@router.delete("/empty")  # Static path FIRST
async def empty_bin(...): ...

@router.get("/auto-delete/status")  # Static path
async def get_status(...): ...

@router.get("")  # Base path
async def get_all(...): ...

@router.post("/{item_id}/restore")  # Dynamic paths LAST
async def restore_item(...): ...

@router.delete("/{item_id}")  # Dynamic path LAST
async def delete_item(...): ...
```

## Route Groups in server.py

| Line Start | Section | Description |
|------------|---------|-------------|
| 1155 | AUTH | Login, logout, refresh, heartbeat |
| 1371 | SECURITY | Online users, security alerts |
| 1518 | RE-AUTH | PIN setup, re-authentication |
| 1610 | SENSITIVITY | Sensitivity settings for actions |
| 1919 | USERS | User CRUD, permissions |
| 2337 | ROLES | Role management |
| 2497 | RBAC | Role-based access control |
| 3265 | DASHBOARD | Dashboard data |
| 3328 | GLOBAL SEARCH | Search across entities |
| 3393 | PUBLIC CATALOGUE | No-auth product catalogue |
| 3459 | ITEMS | Item CRUD |
| 3753 | VARIANTS | Product variants |
| 3792 | INVENTORY | Inventory management |
| 3960 | STOCK AUDIT | Stock audit trail |
| 4165 | STORES | Store management |
| 4205 | TEAM CHAT | Team messaging |
| 4336 | CUSTOMERS | Customer CRUD |
| 4429 | LOYALTY CARDS | Customer loyalty cards |
| 4557 | EMPLOYEE ID CARDS | Employee ID generation |
| 4692 | SUPPLIERS | Supplier CRUD |
| 4725 | EMPLOYEES | Employee CRUD |
| 4966 | RECYCLE BIN | Soft delete/restore |
| 5163 | ATTENDANCE | Attendance tracking |
| 5234 | FACE ATTENDANCE | Face recognition attendance |
| 5350 | SALARY | Salary structures |
| 5383 | PAYROLL | Payroll processing |
| 5854 | EMPLOYEE LOANS | Loan management |
| 6108 | EMPLOYEE UPGRADE | Employee upgrades |
| 6202 | CATEGORIES/BRANDS | Product categorization |
| 6253 | GST MASTER | GST configuration |
| 6378 | HSN CODES | HSN code master |
| 6467 | GST LEDGER | GST ledger entries |
| 6699 | SALES MODULE | Quotations, orders, invoices |
| 7479 | VOUCHERS | Discount vouchers |
| 7590 | ITEM DISCOUNTS | Item-level discounts |
| 7735 | BOGO OFFERS | Buy one get one |
| 7895 | TIERED DISCOUNTS | Volume discounts |
| 8025 | DISCOUNT CALCULATOR | Combined discount logic |
| 8200 | PURCHASE INVOICES | Purchase invoice management |
| 8688 | PURCHASE ENDPOINTS | Purchase CRUD |
| 9027 | PURCHASE REPORTS | Purchase reporting |
| 9056 | AI SCANNER | AI invoice scanning |
| 9292 | STOCK TRANSFERS | Stock transfer between stores |
| 9575 | STOCK ALERTS | Low stock alerts |
| 9624 | SALES | Sales transactions |
| 9863 | SALES RETURNS | Return processing |
| 10068 | RESTOCK ALERTS | Restock notifications |
| 10129 | PRINT TEMPLATES | Print template management |
| 10147 | FILE UPLOAD | File upload handling |
| 10202 | AI REVIEW | AI review reply generation |
| 10258 | AI IMAGE | AI image generation |
| 10429 | VIRTUAL TRIAL | Virtual try-on |
| 10560 | SHOPPING CART | E-commerce cart |
| 10898 | DATA RESTORE | Data restoration |
| 10932 | MAINTENANCE | System maintenance |
| 11102 | ANALYTICS | Analytics dashboard |
| 11277 | NETWORK PRINTER | Printer proxy |
| 11304 | PUSH NOTIFICATIONS | Push notification system |
| 11332 | SMART SCANNER | Smart stock scanner |
| 12200 | LOYALTY PROGRAM | Loyalty program management |
| 12396 | MEMBERSHIP PDF | PDF card generation |
| 12620 | EMPLOYEE RATINGS | Employee ratings |
| 12734 | INVOICE SETTINGS | Invoice configuration |
| 12844 | BACKUP/RESTORE | Data backup |
| 13199 | MFA | Multi-factor authentication |
| 13411 | TRASH | Trash/recycle bin |
| 13476 | ACCOUNTING | Accounting reports |
| 14566 | EMPLOYMENT AGREEMENTS | HR agreements |
| 14916 | APPLICATIONS | Employment applications |
| 15118 | GOOGLE BUSINESS | GMB integration |
| 15560 | SUPER ADMIN | Super admin functions |
| 15690 | BACKUP CODES | User backup codes |
| 16433 | SELF-HEALING | Self-healing AI |
| 16616 | MONITORING | System monitoring |
| 17183 | CENTRALIZED INV | Central inventory |
| 17924 | ERROR MONITORING | Error tracking |
| 18087 | AI ORCHESTRATION | AI agent system |
| 18393 | SUPER ADMIN USERS | Super admin user mgmt |
| 18642 | MODULE MGMT | Module configuration |
| 18858 | SUBSCRIPTION PLANS | Plan management |
| 19303 | BILLING | Subscription billing |
| 20184 | SUBSCRIPTION API | Subscription endpoints |
| 20676 | TRAINING | Training system |
| 20969 | AUTO POSTER | Social media posting |
| 21230 | AI AGENT | AI agent system |
| 21436 | WHATSAPP CRM | WhatsApp integration |
| 21609 | BULK IMPORT | Customer import |
| 21909 | VIRTUAL TRY-ON | AR try-on |
| 22075 | EXPENDITURE | Expense management |
| 22525 | E-COMMERCE | E-commerce module |
| 23303 | BODY MEASUREMENTS | Size measurements |
| 23441 | FABRIC CATALOGUE | Fabric management |
| 23744 | AI SIZE | AI size prediction |
| 24235 | INV NOTIFICATIONS | Inventory alerts |
| 24401 | E-COMMERCE REPORTS | E-commerce analytics |
| 24622 | MULTI-CURRENCY | Currency support |
| 24752 | WEBSOCKET | Real-time updates |

## Migration Strategy

### Phase 1: Documentation (DONE)
- Document all route sections
- Create route ordering guide
- Identify route ordering issues

### Phase 2: Critical Route Fixes
- Fix route ordering issues as found
- Add comments to prevent future issues

### Phase 3: Incremental Migration
When adding NEW features:
1. Create new route file in `routes/`
2. Use APIRouter with proper prefix
3. Include router in server.py
4. DO NOT duplicate routes

### Phase 4: Gradual Module Extraction
Low-risk modules to extract first:
- `routes/recycle_bin.py` - Already extracted (needs server.py integration)
- `routes/loyalty.py` - Isolated functionality
- `routes/reports.py` - Read-only endpoints

## Adding New Routes

```python
# routes/your_feature.py
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/your-feature", tags=["Your Feature"])

# IMPORTANT: Static paths BEFORE dynamic paths!
@router.get("/summary")  # Static
async def get_summary(): ...

@router.get("")  # Base path
async def get_all(): ...

@router.get("/{id}")  # Dynamic LAST
async def get_by_id(id: str): ...
```

```python
# server.py - include the router
from routes.your_feature import router as your_feature_router

# In app setup
app.include_router(your_feature_router, prefix="/api")
```

## Common Pitfalls

1. **Route Order**: Always put static paths before dynamic `{param}` paths
2. **Duplicate Routes**: Don't define same route in both server.py and module
3. **Missing Prefix**: Remember `/api` prefix when testing
4. **Dependencies**: Ensure `db`, auth functions are properly passed to modules
