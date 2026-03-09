import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../App';

const PermissionContext = createContext(null);

// Map page IDs to permission keys - All 52+ modules
const PAGE_PERMISSION_MAP = {
  // Dashboard & Analytics
  'dashboard': 'dashboard',
  'analytics': 'analytics',
  'market-analytics': 'market_analytics',
  
  // Point of Sale
  'pos': 'pos',
  
  // Items & Inventory
  'items': 'items',
  'smart-scanner': 'smart_scanner',
  'inventory': 'inventory',
  'transfers': 'stock_transfers',
  'upload-history': 'upload_history',
  'stock-audit': 'stock_audit',
  'stock-receiver': 'stock_receiver',
  
  // Sales Module
  'sales': 'sales_history',
  'sales-dashboard': 'sales_dashboard',
  'quotations': 'quotations',
  'sales-orders': 'sales_orders',
  'orders': 'orders',
  'order-history': 'my_orders',
  'sales-invoices': 'invoices',
  'sales-pricing': 'pricing',
  'sales-delivery': 'delivery',
  'sales-returns': 'returns',
  'sales-reports': 'sales_reports',
  
  // CRM & Customers
  'crm': 'crm',
  'customer-import': 'customer_import',
  'customers': 'customers',
  'customer-ledger': 'customer_ledger',
  
  // Purchases
  'purchases': 'purchases',
  'purchase-orders': 'purchase_orders',
  'purchase-returns': 'purchase_returns',
  'purchase-reports': 'purchase_reports',
  
  // Suppliers
  'suppliers': 'suppliers',
  'supplier-ledger': 'supplier_ledger',
  
  // Discounts & Offers
  'vouchers': 'vouchers',
  'discounts': 'discount_manager',
  'loyalty': 'loyalty',
  
  // Stores
  'stores': 'stores',
  
  // HR Management
  'employees': 'employees',
  'employment-agreements': 'employment_agreements',
  'document-verification': 'document_verification',
  'task-management': 'task_management',
  'centralized-attendance': 'centralized_attendance',
  'daily-attendance': 'daily_attendance',
  'face-attendance': 'face_attendance',
  'barcode-attendance': 'barcode_attendance',
  'attendance-sheet': 'attendance_sheet',
  'attendance': 'attendance',
  'leaves': 'leaves',
  'shifts': 'shifts',
  'employee-ratings': 'employee_ratings',
  'payroll': 'payroll',
  'salary-calculator': 'salary_calculator',
  'employee-loans': 'employee_loans',
  
  // Connect & Training
  'connect-hub': 'connect_hub',
  'training': 'training_center',
  
  // Marketing & AI
  'ai-agent': 'ai_agent',
  'auto-poster': 'auto_poster',
  'agent-control-center': 'agent_control_center',
  'ai-agents-dashboard': 'ai_dashboard',
  'ai-dashboard': 'ai_dashboard',
  
  // AI Development & Debug Tools
  'agent-collaboration': 'agent_collaboration',
  'autoheal': 'autoheal',
  'ui-blink-fix': 'ui_blink_fix',
  'error-autofix': 'error_autofix',
  'performance-agent': 'performance_agent',
  
  // Extra Features
  'virtual-tryon': 'virtual_trial',
  'fabric-catalogue': 'fabric_catalogue',
  'keyboard-shortcuts': 'keyboard_shortcuts',
  
  // E-Commerce
  'ecommerce': 'ecommerce',
  
  // Finance & Accounting
  'ledger-management': 'ledger_management',
  'voucher-entry': 'voucher_entry',
  'accounting-books': 'accounting_books',
  'trial-balance': 'trial_balance',
  'gst-reports': 'gst_reports',
  'central-accounting': 'central_accounting',
  'expenditure': 'expenditure',
  'ledger': 'ledger',
  'accounting-reports': 'accounting_reports',
  
  // Settings & Admin
  'users': 'user_management',
  'rbac-permissions': 'rbac_permissions',
  'printing-lab': 'printing_lab',
  'invoice-settings': 'invoice_settings',
  'backup-restore': 'backup_restore',
  'recycle-bin': 'recycle_bin',
  'billing': 'billing',
  'gst-master': 'gst_master',
  'gst-automation': 'gst_automation',
  'security-settings': 'security_settings',
  'security-dashboard': 'security_center',
  'settings': 'settings',
  'assistant': 'assistant',
  
  // Superadmin specific
  'superadmin-dashboard': 'superadmin_dashboard',
  'subscriptions': 'subscriptions',
  'rbac-admin': 'rbac_admin',
};

// SUPER_ADMIN exclusive permissions - these NEVER need permission records
const SUPERADMIN_EXCLUSIVE_PERMISSIONS = [
  'superadmin_dashboard',
  'manage_admins',
  'view_all_tenants',
  'god_mode',
  'global_audit_log',
  'system_settings',
  'create_tenant',
  'delete_tenant',
  'impersonate_user',
];

// Role hierarchy for determining access levels
const ROLE_HIERARCHY = {
  'superadmin': 100,
  'admin': 80,
  'manager': 60,
  'staff': 40,
  'cashier': 30,
  'viewer': 20,
};

// Roles that have read-only access (cannot create, edit, delete)
const READ_ONLY_ROLES = ['viewer'];

// Roles with limited write access (can create invoices but limited other actions)
const LIMITED_WRITE_ROLES = ['staff', 'cashier'];

// Actions that require write permission
const WRITE_ACTIONS = ['create', 'edit', 'delete', 'update', 'adjust', 'transfer', 'approve', 'reject'];

// Actions that staff can perform even with limited access
const STAFF_ALLOWED_ACTIONS = {
  'invoices': ['create', 'edit'],
  'customers': ['create', 'edit'],
  'orders': ['create', 'edit'],
  'returns': ['create'],
  'purchases': ['create', 'edit'],
  'purchase_returns': ['create'],
  'quotations': ['create', 'edit'],
  'items': ['create', 'edit'],  // Allow staff to add/edit products
  'inventory': ['adjust', 'transfer'],  // Allow staff to adjust inventory
};

// Actions that cashier can perform
const CASHIER_ALLOWED_ACTIONS = {
  'invoices': ['create'],
  'customers': ['create'],
  'returns': ['create'],
};

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const { user, api } = useAuth();
  const [userPermissions, setUserPermissions] = useState(null);
  const [loading, setLoading] = useState(false);
  const permsFetchedRef = React.useRef(false);
  const initialLoadComplete = React.useRef(false);

  // Convert permissions array to object format for easy lookup
  const normalizePermissions = (perms) => {
    if (!perms) return {};
    // If already an object, return as-is
    if (typeof perms === 'object' && !Array.isArray(perms)) {
      return perms;
    }
    // If it's an array, convert to object with true values
    if (Array.isArray(perms)) {
      const permObj = {};
      perms.forEach(p => {
        permObj[p] = true;
      });
      return permObj;
    }
    return {};
  };

  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (!user?.id) {
        setUserPermissions(null);
        setLoading(false);
        permsFetchedRef.current = false; // Reset when user logs out
        initialLoadComplete.current = false;
        return;
      }

      // Prevent multiple fetches for the same user
      if (permsFetchedRef.current) {
        setLoading(false);
        return;
      }
      
      // Only show loading on initial load, not on subsequent checks
      if (!initialLoadComplete.current) {
        setLoading(true);
      }
      permsFetchedRef.current = true;

      try {
        // SUPER_ADMIN: Permanent, unrestricted access - NO permission records needed
        if (user.role === 'superadmin') {
          const allPerms = {};
          // Grant ALL module permissions automatically
          Object.values(PAGE_PERMISSION_MAP).forEach(perm => {
            allPerms[perm] = true;
          });
          // Add superadmin-exclusive permissions
          SUPERADMIN_EXCLUSIVE_PERMISSIONS.forEach(perm => {
            allPerms[perm] = true;
          });
          // Future-proof: any new permission is automatically granted
          allPerms['_superadmin_bypass'] = true;
          setUserPermissions(allPerms);
          setLoading(false);
          initialLoadComplete.current = true;
          return;
        }
        
        // ADMIN: Permission-based - must have explicit permissions
        // First, try to use permissions from the user object
        if (user.permissions && (Array.isArray(user.permissions) ? user.permissions.length > 0 : Object.keys(user.permissions).length > 0)) {
          console.log('Using permissions from user object:', user.permissions);
          setUserPermissions(normalizePermissions(user.permissions));
          setLoading(false);
          initialLoadComplete.current = true;
          return;
        }

        // Otherwise, fetch user's specific permissions from API
        // Use direct fetch to avoid logout loop from api() function
        console.log('Fetching permissions from API for user:', user.id);
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('No token available, skipping permissions fetch');
          setUserPermissions({});
          setLoading(false);
          initialLoadComplete.current = true;
          return;
        }
        
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          // Don't trigger logout, just use empty permissions
          console.log('Failed to fetch permissions, using empty permissions');
          setUserPermissions({});
          setLoading(false);
          initialLoadComplete.current = true;
          return;
        }
        
        const userData = await response.json();
        console.log('Fetched user permissions:', userData.permissions);
        setUserPermissions(normalizePermissions(userData.permissions) || {});
      } catch (err) {
        console.error('Failed to fetch user permissions:', err);
        setUserPermissions({});
      } finally {
        setLoading(false);
        initialLoadComplete.current = true;
      }
    };

    fetchUserPermissions();
  }, [user?.id, user?.role]);

  // Check if user has permission for a specific page - memoized to prevent re-renders
  const hasPageAccess = useCallback((pageId) => {
    // SUPER_ADMIN: Always has access to everything (current + future modules)
    if (user?.role === 'superadmin') return true;
    
    if (!userPermissions) return false;
    
    // Get the permission key for this page
    const permissionKey = PAGE_PERMISSION_MAP[pageId];
    if (!permissionKey) return false; // Unknown pages require explicit permission
    
    // Check if user has this specific permission enabled
    return userPermissions[permissionKey] === true;
  }, [user?.role, userPermissions]);

  // Check if user has a specific permission - memoized
  const hasPermission = useCallback((permissionKey) => {
    // SUPER_ADMIN: Always has all permissions
    if (user?.role === 'superadmin') return true;
    
    if (!userPermissions) return false;
    
    // Check if it's a superadmin-exclusive permission
    if (SUPERADMIN_EXCLUSIVE_PERMISSIONS.includes(permissionKey)) {
      return false; // Only superadmin can have these
    }
    
    // Check user's explicit permissions
    return userPermissions[permissionKey] === true;
  }, [user?.role, userPermissions]);

  // Check if user is in read-only mode - memoized
  const isReadOnly = useCallback(() => {
    if (!user?.role) return true;
    if (user.role === 'superadmin') return false;
    return READ_ONLY_ROLES.includes(user.role) || userPermissions?.read_only === true;
  }, [user?.role, userPermissions]);

  // Check if user has limited write access (staff/cashier) - memoized
  const hasLimitedWrite = useCallback(() => {
    if (!user?.role) return false;
    return LIMITED_WRITE_ROLES.includes(user.role);
  }, [user?.role]);

  // Check if user can perform a specific action on a module - memoized
  // This is the core function for RBAC enforcement
  const canPerformAction = useCallback((module, action) => {
    if (!user?.role) return false;
    
    // SUPER_ADMIN: Can do everything
    if (user.role === 'superadmin') return true;
    
    // For all other roles, check explicit permissions first
    if (!userPermissions) return false;
    
    // Check if user has permission for this module
    if (userPermissions[module] !== true) {
      return false; // No permission for this module
    }
    
    // ADMIN: Can do everything on modules they have permission for
    if (user.role === 'admin') {
      return true;
    }
    
    // MANAGER: Can do most things except system settings on permitted modules
    if (user.role === 'manager' || user.role === 'store_manager') {
      const restrictedModules = ['user_management', 'settings', 'backup_restore', 'billing'];
      if (restrictedModules.includes(module) && WRITE_ACTIONS.includes(action)) {
        return false;
      }
      return true;
    }
    
    // VIEWER: Read-only, cannot perform any write actions
    if (user.role === 'viewer') {
      return !WRITE_ACTIONS.includes(action);
    }
    
    // STAFF: Can perform limited write actions on permitted modules
    if (user.role === 'staff') {
      // Check if action is a write action
      if (WRITE_ACTIONS.includes(action)) {
        // Check if staff is allowed this action on this module
        const allowedActions = STAFF_ALLOWED_ACTIONS[module];
        if (allowedActions && allowedActions.includes(action)) {
          return true;
        }
        return false;
      }
      return true; // Read actions are allowed
    }
    
    // CASHIER: Very limited write access on permitted modules
    if (user.role === 'cashier') {
      if (WRITE_ACTIONS.includes(action)) {
        const allowedActions = CASHIER_ALLOWED_ACTIONS[module];
        if (allowedActions && allowedActions.includes(action)) {
          return true;
        }
        return false;
      }
      return true; // Read actions are allowed
    }
    
    // Default: deny
    return false;
  }, [user?.role, userPermissions]);

  // Get user's role level for comparison - memoized
  const getRoleLevel = useCallback(() => {
    return ROLE_HIERARCHY[user?.role] || 0;
  }, [user?.role]);

  // Check if current user's role is at least a certain level - memoized
  const hasMinimumRole = useCallback((minRole) => {
    const currentLevel = ROLE_HIERARCHY[user?.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 100;
    return currentLevel >= requiredLevel;
  }, [user?.role]);

  // Get filtered navigation items based on permissions - memoized
  const filterNavItems = useCallback((navItems) => {
    if (!userPermissions) return [];
    
    // SUPER_ADMIN: See all navigation items
    if (user?.role === 'superadmin') return navItems;

    return navItems.filter(item => {
      if (item.type === 'divider') return true;
      return hasPageAccess(item.id);
    }).filter((item, index, arr) => {
      // Remove dividers that have no items after them
      if (item.type === 'divider') {
        const nextItem = arr[index + 1];
        return nextItem && nextItem.type !== 'divider';
      }
      return true;
    });
  }, [user?.role, userPermissions, hasPageAccess]);

  // Get role display info - memoized
  const getRoleInfo = useCallback(() => {
    const roleConfig = {
      'superadmin': { label: 'Super Admin', color: 'purple', badge: 'bg-purple-100 text-purple-800' },
      'admin': { label: 'Admin', color: 'blue', badge: 'bg-blue-100 text-blue-800' },
      'manager': { label: 'Manager', color: 'green', badge: 'bg-green-100 text-green-800' },
      'staff': { label: 'Staff', color: 'amber', badge: 'bg-amber-100 text-amber-800' },
      'cashier': { label: 'Cashier', color: 'orange', badge: 'bg-orange-100 text-orange-800' },
      'viewer': { label: 'Viewer (Read-Only)', color: 'gray', badge: 'bg-gray-100 text-gray-800' },
    };
    return roleConfig[user?.role] || { label: 'Unknown', color: 'gray', badge: 'bg-gray-100 text-gray-800' };
  }, [user?.role]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    permissions: userPermissions,
    loading,
    hasPageAccess,
    hasPermission,
    filterNavItems,
    PAGE_PERMISSION_MAP,
    // New RBAC functions
    isReadOnly,
    hasLimitedWrite,
    canPerformAction,
    getRoleLevel,
    hasMinimumRole,
    getRoleInfo,
    // Role constants for reference
    ROLE_HIERARCHY,
    READ_ONLY_ROLES,
    LIMITED_WRITE_ROLES,
    userRole: user?.role,
  }), [
    userPermissions,
    loading,
    hasPageAccess,
    hasPermission,
    filterNavItems,
    isReadOnly,
    hasLimitedWrite,
    canPerformAction,
    getRoleLevel,
    hasMinimumRole,
    getRoleInfo,
    user?.role
  ]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

export default PermissionContext;
