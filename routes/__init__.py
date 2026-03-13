"""
Routes Package for BijnisBooks Backend

This package contains modular route handlers for the backend API.
The routes are organized by feature/domain for better maintainability.

Current Structure:
├── routes/
│   ├── __init__.py          - Package initialization
│   ├── auth.py              - Authentication routes (login, logout, etc.)
│   ├── chat.py              - Team chat routes
│   ├── salary.py            - Salary calculator routes
│   ├── employees.py         - Employee management routes
│   ├── inventory.py         - Inventory management routes
│   ├── items.py             - Product/Item CRUD routes
│   ├── ecommerce.py         - E-commerce storefront routes
│   ├── superadmin.py        - Superadmin-only routes
│   ├── recycle_bin.py       - Recycle bin routes (soft delete/restore)
│   ├── face_attendance.py   - Face recognition attendance routes
│   ├── users.py             - User management routes
│   ├── fabric_catalogue.py  - Fabric catalogue routes
│   ├── ledger.py            - Ledger and accounting routes
│   └── customers.py         - Customer/CRM routes (NEW - Feb 2026)

Migration Status (Feb 2026):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MIGRATED:
  - ledger.py (Accounting ledger routes)
  - items.py (Product/Item CRUD - partial)
  - ecommerce.py (E-commerce routes - partial)

🔄 IN PROGRESS:
  - customers.py (CRM routes - template ready)

📋 PENDING (by priority):
  1. Sales Module (~1500 lines) - sales, invoices, quotations
  2. Purchase Module (~1000 lines) - POs, purchase returns
  3. Inventory Module (~800 lines) - stock management
  4. Reports Module (~600 lines) - analytics & reports
  5. HR Module (~500 lines) - employees, attendance
  6. Settings Module (~400 lines) - configurations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To add a new route module:
1. Create routes/your_feature.py with an APIRouter
2. Define your routes with appropriate prefixes and tags
3. Import and include in server.py: 
   app.include_router(your_router, prefix="/api")

Example usage in server.py:
```python
from routes.items import router as items_router
from routes.ecommerce import router as ecommerce_router

app.include_router(items_router, prefix="/api")
app.include_router(ecommerce_router, prefix="/api")
```

Benefits of Modular Routes:
- Faster code navigation
- Easier testing
- Better code reviews
- Reduced merge conflicts
- Clearer ownership
"""

# Import routers for easy access
# NOTE: These imports are disabled until the routes are fully refactored
# The routes currently rely on utils.auth which doesn't exist yet
# from .auth import router as auth_router
# from .chat import router as chat_router
# from .salary import router as salary_router
# from .employees import router as employees_router
# from .inventory import router as inventory_router
# from .superadmin import router as superadmin_router
# from .recycle_bin import router as recycle_bin_router
# from .face_attendance import router as face_attendance_router
from .items import router as items_router
from .ecommerce import router as ecommerce_router
from .ledger import router as ledger_router
from .purchase_orders import router as purchase_orders_router
from .quotations import router as quotations_router
from .sales_orders import router as sales_orders_router
from .stock import router as stock_router
from .reports import router as reports_router
from .hr import router as hr_router
from .settings import router as settings_router
from .accounting_reports import router as accounting_reports_router
from .gst_reports import router as gst_reports_router
# from .customers import router as customers_router  # Coming soon

__all__ = [
    'auth_router',
    'chat_router', 
    'salary_router',
    'employees_router',
    'inventory_router',
    'superadmin_router',
    'recycle_bin_router',
    'face_attendance_router',
    'items_router',
    'ecommerce_router',
    'ledger_router',
    'customers_router',
    'purchase_orders_router',
    'quotations_router',
    'sales_orders_router',
    'stock_router',
    'reports_router',
    'hr_router',
    'settings_router',
    'accounting_reports_router',
    'gst_reports_router'
]

