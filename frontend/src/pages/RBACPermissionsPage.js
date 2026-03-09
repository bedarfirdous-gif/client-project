import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Shield, Users, Save, RefreshCw, Check, X, ChevronDown, ChevronRight,
  Settings, ShoppingCart, Package, Truck, FileText, UserCircle, Wallet,
  BarChart3, Tag, Store, Clock, Star, Receipt, CreditCard, Building2,
  Plus, Trash2, Edit, Copy, Video, Brain, Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';

// Define all permission modules with categories - SYNCED WITH BACKEND (100+ modules)
const PERMISSION_MODULES = {
  superadmin: {
    label: 'Super Admin Dashboard',
    icon: Shield,
    color: 'bg-red-600',
    permissions: [
      { key: 'superadmin_dashboard', label: 'Super Admin Dashboard', description: 'Access superadmin control panel' },
      { key: 'market_analytics', label: 'Market Analytics', description: 'View market analytics & trends' },
      { key: 'subscriptions', label: 'Subscriptions', description: 'Manage all tenant subscriptions' },
      { key: 'rbac_admin', label: 'RBAC Admin Panel', description: 'Global RBAC administration' },
      { key: 'autoheal', label: 'AutoHeal AI', description: 'AI-powered system health & fixes' },
      { key: 'security_center', label: 'Security Center', description: 'Security monitoring & alerts' },
      { key: 'ai_dashboard', label: 'AI Dashboard', description: 'AI system performance & metrics' },
    ]
  },
  core: {
    label: 'Main Dashboard',
    icon: BarChart3,
    color: 'bg-blue-500',
    permissions: [
      { key: 'dashboard', label: 'Dashboard', description: 'View main dashboard' },
      { key: 'analytics', label: 'Analytics', description: 'View analytics & reports' },
      { key: 'pos', label: 'Point of Sale', description: 'Access POS billing' },
    ]
  },
  inventory: {
    label: 'Inventory',
    icon: Package,
    color: 'bg-emerald-500',
    permissions: [
      { key: 'items', label: 'Items', description: 'Manage products & items' },
      { key: 'inventory', label: 'Inventory', description: 'View & manage stock levels' },
      { key: 'stock_transfers', label: 'Stock Transfers', description: 'Transfer stock between stores' },
      { key: 'stock_receiver', label: 'Stock Receiver', description: 'Receive incoming stock transfers' },
      { key: 'stock_audit', label: 'Stock Audit Trail', description: 'Audit all stock movements' },
      { key: 'upload_history', label: 'Upload History', description: 'View bulk upload history' },
      { key: 'smart_scanner', label: 'Smart Stock Scanner', description: 'Use AI document scanner' },
    ]
  },
  sales: {
    label: 'Sales',
    icon: ShoppingCart,
    color: 'bg-amber-500',
    permissions: [
      { key: 'sales_dashboard', label: 'Sales Dashboard', description: 'View sales overview' },
      { key: 'sales_history', label: 'Sales History', description: 'View sales history' },
      { key: 'quotations', label: 'Quotations', description: 'Create & manage quotes' },
      { key: 'sales_orders', label: 'Sales Orders', description: 'Manage sales orders' },
      { key: 'orders', label: 'Orders', description: 'Manage sales orders (legacy)' },
      { key: 'my_orders', label: 'My Orders', description: 'View order history' },
      { key: 'virtual_trial', label: 'Virtual Trial Room', description: 'AR virtual try-on feature' },
      { key: 'invoices', label: 'Invoices', description: 'Create & view invoices' },
      { key: 'pricing', label: 'Pricing', description: 'Manage product pricing' },
      { key: 'delivery', label: 'Delivery', description: 'Manage deliveries' },
      { key: 'returns', label: 'Returns', description: 'Process sales returns' },
      { key: 'sales_reports', label: 'Sales Reports', description: 'View sales reports' },
      { key: 'crm', label: 'CRM', description: 'Customer relationship management' },
    ]
  },
  purchase: {
    label: 'Purchase',
    icon: Truck,
    color: 'bg-purple-500',
    permissions: [
      { key: 'purchases', label: 'Purchases', description: 'Manage purchase invoices' },
      { key: 'purchase_orders', label: 'Purchase Orders', description: 'Create & manage purchase orders' },
      { key: 'purchase_returns', label: 'Purchase Returns', description: 'Process purchase returns' },
      { key: 'purchase_reports', label: 'Purchase Reports', description: 'View purchase reports' },
    ]
  },
  parties: {
    label: 'Parties & Ledger',
    icon: Users,
    color: 'bg-cyan-500',
    permissions: [
      { key: 'customers', label: 'Customers', description: 'Manage customer records' },
      { key: 'customer_ledger', label: 'Customer Ledger', description: 'View customer accounts' },
      { key: 'suppliers', label: 'Suppliers', description: 'Manage supplier records' },
      { key: 'supplier_ledger', label: 'Supplier Ledger', description: 'View supplier accounts' },
    ]
  },
  finance: {
    label: 'Finance & Accounting',
    icon: Wallet,
    color: 'bg-green-600',
    permissions: [
      { key: 'ledger_management', label: 'Ledger Management', description: 'Manage ledger accounts' },
      { key: 'voucher_entry', label: 'Voucher Entry', description: 'Create journal vouchers' },
      { key: 'accounting_books', label: 'Day/Cash/Bank Book', description: 'View accounting books' },
      { key: 'trial_balance', label: 'Trial Balance', description: 'View trial balance' },
      { key: 'gst_reports', label: 'GST Reports', description: 'View GST reports & filings' },
      { key: 'central_accounting', label: 'Central Accounting', description: 'Centralized accounting dashboard' },
      { key: 'expenditure', label: 'Expenditure', description: 'Manage expenses & payments' },
      { key: 'ledger', label: 'Receipt & Payment Ledger', description: 'Manage receipts, payments, and running balance' },
      { key: 'accounting_reports', label: 'Accounting Reports', description: 'View financial reports' },
    ]
  },
  discounts: {
    label: 'Discounts & Offers',
    icon: Tag,
    color: 'bg-pink-500',
    permissions: [
      { key: 'vouchers', label: 'Vouchers', description: 'Create & manage vouchers' },
      { key: 'discount_manager', label: 'Discount Manager', description: 'Manage discounts' },
      { key: 'loyalty', label: 'Loyalty Program', description: 'Manage loyalty points & tiers' },
    ]
  },
  stores: {
    label: 'Stores',
    icon: Store,
    color: 'bg-sky-500',
    permissions: [
      { key: 'stores', label: 'Store Management', description: 'Manage store locations' },
    ]
  },
  hr: {
    label: 'HR Management',
    icon: UserCircle,
    color: 'bg-indigo-500',
    permissions: [
      { key: 'employees', label: 'Employees', description: 'Manage employee records' },
      { key: 'employment_agreements', label: 'Employment Agreements', description: 'Manage employment contracts' },
      { key: 'document_verification', label: 'Document Verification', description: 'Verify employee documents' },
      { key: 'task_management', label: 'Task Management', description: 'Task and project management' },
      { key: 'centralized_attendance', label: 'Centralized Attendance', description: 'View all store attendance' },
      { key: 'daily_attendance', label: 'Daily Attendance', description: 'Mark daily attendance' },
      { key: 'face_attendance', label: 'Face Attendance', description: 'Face recognition attendance' },
      { key: 'barcode_attendance', label: 'Barcode Attendance', description: 'Barcode-based attendance' },
      { key: 'attendance_sheet', label: 'Attendance Sheet', description: 'View attendance records' },
      { key: 'attendance', label: 'Attendance', description: 'Mark & view attendance' },
      { key: 'leaves', label: 'Leave Management', description: 'Manage leave requests' },
      { key: 'shifts', label: 'Shift Management', description: 'Manage work shifts' },
      { key: 'employee_ratings', label: 'Employee Ratings', description: 'Rate employee performance' },
      { key: 'payroll', label: 'Payroll', description: 'Manage salaries & payroll' },
      { key: 'salary_calculator', label: 'Salary Calculator', description: 'Calculate employee salaries' },
      { key: 'employee_loans', label: 'Employee Loans', description: 'Manage employee loan advances' },
    ]
  },
  connect_training: {
    label: 'Connect & Training',
    icon: Video,
    color: 'bg-teal-500',
    permissions: [
      { key: 'connect_hub', label: 'Connect Hub', description: 'Access communication hub' },
      { key: 'training_center', label: 'Training Center', description: 'Access training sessions & materials' },
    ]
  },
  marketing_ai: {
    label: 'Marketing & AI',
    icon: Brain,
    color: 'bg-violet-500',
    permissions: [
      { key: 'agent_control_center', label: 'Agent Control Center', description: 'Central AI agent management' },
      { key: 'ai_control_center', label: 'AI Control Center', description: 'AI system monitoring' },
      { key: 'ai_agent', label: 'AI Business Agent', description: 'Use AI assistant for business insights' },
      { key: 'auto_poster', label: 'Auto Poster Studio', description: 'Create marketing posters & content' },
      { key: 'customer_import', label: 'Customer Import', description: 'Import customers via scan or file' },
      { key: 'ecommerce', label: 'E-commerce Store', description: 'Online store management' },
    ]
  },
  ai_agents: {
    label: 'AI Agents',
    icon: Brain,
    color: 'bg-orange-500',
    permissions: [
      { key: 'ui_blink_fix', label: 'UI Blink Fix Agent', description: 'UI error auto-correction' },
      { key: 'error_autofix', label: 'Error Auto-Fix Agent', description: 'System error auto-repair' },
      { key: 'performance_agent', label: 'Performance Agent', description: 'Performance optimization' },
      { key: 'agent_collaboration', label: 'Agent Collaboration', description: 'Multi-agent coordination' },
    ]
  },
  settings: {
    label: 'Settings',
    icon: Settings,
    color: 'bg-gray-500',
    permissions: [
      { key: 'gst_master', label: 'GST Master', description: 'Manage GST slabs & rates' },
      { key: 'gst_automation', label: 'GST Automation', description: 'Automated GST filing' },
      { key: 'user_management', label: 'User Management', description: 'Manage users & roles' },
      { key: 'rbac_permissions', label: 'RBAC Permissions', description: 'Manage role permissions' },
      { key: 'printing_lab', label: 'Printing Lab', description: 'Configure print templates' },
      { key: 'invoice_settings', label: 'Invoice Settings', description: 'Configure invoice templates' },
      { key: 'backup_restore', label: 'Backup & Restore', description: 'Backup and restore data' },
      { key: 'billing', label: 'Billing & Plans', description: 'Manage billing and subscription' },
      { key: 'settings', label: 'App Settings', description: 'General app preferences' },
      { key: 'security_settings', label: 'Security Settings', description: 'Configure security options' },
      { key: 'recycle_bin', label: 'Recycle Bin', description: 'Restore deleted items' },
      { key: 'assistant', label: 'AI Assistant', description: 'AI chat assistant' },
    ]
  },
  extra_features: {
    label: 'Extra Features',
    icon: Sparkles,
    color: 'bg-rose-500',
    permissions: [
      { key: 'virtual_trial', label: 'Virtual Trial Room', description: 'AR virtual try-on' },
      { key: 'fabric_catalogue', label: 'Fabric Catalogue', description: 'Browse fabric collections' },
      { key: 'keyboard_shortcuts', label: 'Keyboard Shortcuts', description: 'Keyboard shortcuts help' },
    ]
  }
};

// Pre-defined role templates
const ROLE_TEMPLATES = {
  superadmin: {
    label: 'Super Administrator',
    description: 'Full access including system administration',
    color: 'bg-red-600',
    permissions: 'all'
  },
  admin: {
    label: 'Administrator',
    description: 'Full access to all tenant modules',
    color: 'bg-red-500',
    permissions: 'all'
  },
  manager: {
    label: 'Store Manager',
    description: 'Manage store operations, sales, inventory',
    color: 'bg-blue-500',
    permissions: [
      'dashboard', 'analytics', 'pos', 'items', 'inventory', 'stock_transfers',
      'sales_dashboard', 'quotations', 'orders', 'invoices', 'pricing', 'sales_reports',
      'purchases', 'customers', 'customer_ledger', 'suppliers', 'supplier_ledger',
      'vouchers', 'discount_manager', 'employees', 'attendance', 'employee_ratings',
      'expenditure', 'recycle_bin', 'online_store'
    ]
  },
  cashier: {
    label: 'Cashier',
    description: 'POS billing, basic inventory view',
    color: 'bg-green-500',
    permissions: [
      'dashboard', 'pos', 'items', 'inventory', 'customers', 'vouchers'
    ]
  },
  accountant: {
    label: 'Accountant',
    description: 'Financial reports, ledgers, invoices',
    color: 'bg-purple-500',
    permissions: [
      'dashboard', 'analytics', 'sales_dashboard', 'invoices', 'sales_reports',
      'purchases', 'purchase_reports', 'customer_ledger', 'supplier_ledger', 'payroll',
      'expenditure', 'accounting_reports'
    ]
  },
  hr_manager: {
    label: 'HR Manager',
    description: 'Manage employees, attendance, payroll',
    color: 'bg-indigo-500',
    permissions: [
      'dashboard', 'employees', 'employment_agreements', 'daily_attendance', 'face_attendance',
      'attendance_sheet', 'attendance', 'employee_ratings', 'payroll', 'salary_calculator', 'employee_loans'
    ]
  },
  inventory_staff: {
    label: 'Inventory Staff',
    description: 'Manage stock and transfers',
    color: 'bg-emerald-500',
    permissions: [
      'dashboard', 'items', 'inventory', 'stock_transfers', 'upload_history', 'purchases',
      'smart_scanner', 'stock_audit'
    ]
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to reports',
    color: 'bg-gray-500',
    permissions: [
      'dashboard', 'analytics', 'sales_dashboard', 'sales_reports', 'purchase_reports'
    ]
  }
};

// Get all permission keys
const getAllPermissionKeys = () => {
  const keys = [];
  Object.values(PERMISSION_MODULES).forEach(category => {
    category.permissions.forEach(perm => {
      keys.push(perm.key);
    });
  });
  return keys;
};

export default function RBACPermissionsPage() {
  const { api, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // FIX: avoid initializing to `null` which can cause a brief "no selection" render (flash)
  // before async data/effects hydrate the state.
  // FIX: Avoid initializing to `null` (can cause a brief UI flash when JSX conditionally
  // renders based on truthiness). Use a stable non-null initial value and rely on the
  // explicit `isSelectedUserLoaded` flag to gate any user-dependent UI.
  const [selectedUser, setSelectedUser] = useState({});
  const [isSelectedUserLoaded, setIsSelectedUserLoaded] = useState(false);

  const [userPermissions, setUserPermissions] = useState({});

  const [assignedRole, setAssignedRole] = useState(''); // Track assigned role (empty string = no role yet)
  const [isAssignedRoleLoaded, setIsAssignedRoleLoaded] = useState(false);

  const [expandedCategories, setExpandedCategories] = useState({});
  const [showRoleModal, setShowRoleModal] = useState(false);

  const [editingRole, setEditingRole] = useState({});
  const [isEditingRoleLoaded, setIsEditingRoleLoaded] = useState(false);

  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: {} });
  const [roleExpandedCategories, setRoleExpandedCategories] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [selectedUsers, setSelectedUsers] = useState([]); // For bulk selection
  const [showBulkRoleModal, setShowBulkRoleModal] = useState(false);
  const [bulkRoleId, setBulkRoleId] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false); // For single user role assignment

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([
        api('/api/users'),
        api('/api/roles').catch(() => [])
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setSelectedUsers([]); // Clear selection on refresh
      
      // Expand all categories by default
      const expanded = {};
      Object.keys(PERMISSION_MODULES).forEach(key => {
        expanded[key] = true;
      });
      setExpandedCategories(expanded);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const selectUser = (user) => {
    // Prevent selecting superadmin for permission editing
    if (user.role === 'superadmin') {
      toast.info('SuperAdmin has all permissions by default and cannot be modified.');
      return;
    }
    setSelectedUser(user);
    setUserPermissions(user.permissions || {});
    setAssignedRole(user.assigned_role_id || null);
  };

  const toggleCategory = (categoryKey) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const togglePermission = (permKey) => {
    setUserPermissions(prev => ({
      ...prev,
      [permKey]: !prev[permKey]
    }));
  };

  const toggleAllInCategory = (categoryKey, value) => {
    const category = PERMISSION_MODULES[categoryKey];
    const updates = {};
    category.permissions.forEach(perm => {
      updates[perm.key] = value;
    });
    setUserPermissions(prev => ({ ...prev, ...updates }));
  };

  const applyRoleTemplate = (templateKey) => {
    const template = ROLE_TEMPLATES[templateKey];
    if (!template) return;

    const newPerms = {};
    if (template.permissions === 'all') {
      getAllPermissionKeys().forEach(key => {
        newPerms[key] = true;
      });
    } else {
      getAllPermissionKeys().forEach(key => {
        newPerms[key] = false;
      });
      template.permissions.forEach(key => {
        newPerms[key] = true;
      });
    }
    setUserPermissions(newPerms);
    toast.success(`Applied "${template.label}" template`);
  };

  const saveUserPermissions = async () => {
    if (!selectedUser || !selectedUser.id) return;
    
    setSaving(true);
    try {
      await api(`/api/users/${selectedUser.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: userPermissions, assigned_role_id: assignedRole })
      });
      toast.success(`Permissions saved for ${selectedUser.name}`);
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id ? { ...u, permissions: userPermissions, assigned_role_id: assignedRole } : u
      ));
      setSelectedUser(prev => ({ ...prev, permissions: userPermissions, assigned_role_id: assignedRole }));
    } catch (err) {
      toast.error('Failed to save permissions: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Assign a role to the selected user
  const assignRoleToUser = async (roleId) => {
    if (!selectedUser || !selectedUser.id) return;
    
    let permissions = {};
    let roleName = '';
    
    if (roleId === 'none') {
      // Clear role assignment but keep current permissions
      setAssignedRole(null);
      toast.info('Role assignment cleared. Permissions unchanged.');
      return;
    } else if (roleId.startsWith('template_')) {
      // Pre-defined template
      const templateKey = roleId.replace('template_', '');
      const template = ROLE_TEMPLATES[templateKey];
      if (!template) return;
      
      roleName = template.label;
      if (template.permissions === 'all') {
        getAllPermissionKeys().forEach(key => {
          permissions[key] = true;
        });
      } else {
        getAllPermissionKeys().forEach(key => {
          permissions[key] = false;
        });
        template.permissions.forEach(key => {
          permissions[key] = true;
        });
      }
      setAssignedRole(`template_${templateKey}`);
    } else {
      // Custom role
      const role = roles.find(r => r.id === roleId);
      if (!role) return;
      
      roleName = role.name;
      permissions = { ...role.permissions };
      setAssignedRole(roleId);
    }
    
    setUserPermissions(permissions);
    toast.success(`Applied "${roleName}" role. Click Save to confirm.`);
  };

  // Get role name by ID
  const getRoleName = (roleId) => {
    if (!roleId) return null;
    if (roleId.startsWith('template_')) {
      const templateKey = roleId.replace('template_', '');
      return ROLE_TEMPLATES[templateKey]?.label || 'Unknown Template';
    }
    const role = roles.find(r => r.id === roleId);
    return role?.name || 'Unknown Role';
  };

  // Open role modal for creating new role
  const openCreateRoleModal = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '', permissions: {} });
    // Expand all categories in role modal
    const expanded = {};
    Object.keys(PERMISSION_MODULES).forEach(key => {
      expanded[key] = true;
    });
    setRoleExpandedCategories(expanded);
    setShowRoleModal(true);
  };

  // Open role modal for editing existing role
  const openEditRoleModal = (role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || {}
    });
    const expanded = {};
    Object.keys(PERMISSION_MODULES).forEach(key => {
      expanded[key] = true;
    });
    setRoleExpandedCategories(expanded);
    setShowRoleModal(true);
  };

  // Duplicate a role template as custom role
  const duplicateTemplateAsRole = (templateKey) => {
    const template = ROLE_TEMPLATES[templateKey];
    if (!template) return;
    
    const perms = {};
    if (template.permissions === 'all') {
      getAllPermissionKeys().forEach(key => {
        perms[key] = true;
      });
    } else {
      template.permissions.forEach(key => {
        perms[key] = true;
      });
    }
    
    setEditingRole(null);
    setRoleForm({
      name: `${template.label} (Copy)`,
      description: template.description,
      permissions: perms
    });
    const expanded = {};
    Object.keys(PERMISSION_MODULES).forEach(key => {
      expanded[key] = true;
    });
    setRoleExpandedCategories(expanded);
    setShowRoleModal(true);
  };

  // Toggle permission in role form
  const toggleRolePermission = (permKey) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permKey]: !prev.permissions[permKey]
      }
    }));
  };

  // Toggle all permissions in category for role
  const toggleRoleCategoryAll = (categoryKey, value) => {
    const category = PERMISSION_MODULES[categoryKey];
    const updates = {};
    category.permissions.forEach(perm => {
      updates[perm.key] = value;
    });
    setRoleForm(prev => ({
      ...prev,
      permissions: { ...prev.permissions, ...updates }
    }));
  };

  // Get stats for role form
  const getRoleFormStats = (categoryKey) => {
    const category = PERMISSION_MODULES[categoryKey];
    const total = category.permissions.length;
    const enabled = category.permissions.filter(p => roleForm.permissions[p.key]).length;
    return { enabled, total };
  };

  const getRoleFormTotalStats = () => {
    const allKeys = getAllPermissionKeys();
    const total = allKeys.length;
    const enabled = allKeys.filter(k => roleForm.permissions[k]).length;
    return { enabled, total };
  };

  const saveRole = async () => {
    if (!roleForm.name) {
      toast.error('Role name is required');
      return;
    }
    
    setSaving(true);
    try {
      if (editingRole) {
        // Update existing role
        const response = await api(`/api/roles/${editingRole.id}`, {
          method: 'PUT',
          body: JSON.stringify(roleForm)
        });
        toast.success(`Role "${roleForm.name}" updated`);
        setRoles(prev => prev.map(r => r.id === editingRole.id ? response : r));
      } else {
        // Create new role
        const response = await api('/api/roles', {
          method: 'POST',
          body: JSON.stringify(roleForm)
        });
        toast.success(`Role "${roleForm.name}" created`);
        setRoles(prev => [...prev, response]);
      }
      setShowRoleModal(false);
      setRoleForm({ name: '', description: '', permissions: {} });
      setEditingRole(null);
    } catch (err) {
      toast.error('Failed to save role: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (roleId, roleName) => {
    if (!confirm(`Delete role "${roleName}"? This cannot be undone.`)) return;
    
    try {
      await api(`/api/roles/${roleId}`, { method: 'DELETE' });
      toast.success(`Role "${roleName}" deleted`);
      setRoles(prev => prev.filter(r => r.id !== roleId));
    } catch (err) {
      toast.error('Failed to delete role: ' + err.message);
    }
  };

  // Apply custom role to user permissions
  const applyCustomRole = (role) => {
    setUserPermissions(role.permissions || {});
    toast.success(`Applied "${role.name}" permissions`);
  };

  const getCategoryStats = (categoryKey) => {
    const category = PERMISSION_MODULES[categoryKey];
    const total = category.permissions.length;
    const enabled = category.permissions.filter(p => userPermissions[p.key]).length;
    return { enabled, total };
  };

  const getTotalStats = () => {
    const allKeys = getAllPermissionKeys();
    const total = allKeys.length;
    const enabled = allKeys.filter(k => userPermissions[k]).length;
    return { enabled, total };
  };

  // Filter users
  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Toggle user selection for bulk actions
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Select all non-admin users
  const selectAllUsers = () => {
    const nonAdminUsers = filteredUsers.filter(u => u.role !== 'admin').map(u => u.id);
    setSelectedUsers(nonAdminUsers);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedUsers([]);
  };

  // Bulk assign role
  const bulkAssignRole = async () => {
    if (!bulkRoleId || selectedUsers.length === 0) {
      toast.error('Please select a role and at least one user');
      return;
    }

    setBulkAssigning(true);
    
    let permissions = {};
    let roleName = '';
    
    if (bulkRoleId.startsWith('template_')) {
      const templateKey = bulkRoleId.replace('template_', '');
      const template = ROLE_TEMPLATES[templateKey];
      if (!template) {
        toast.error('Invalid template');
        setBulkAssigning(false);
        return;
      }
      
      roleName = template.label;
      if (template.permissions === 'all') {
        getAllPermissionKeys().forEach(key => {
          permissions[key] = true;
        });
      } else {
        getAllPermissionKeys().forEach(key => {
          permissions[key] = false;
        });
        template.permissions.forEach(key => {
          permissions[key] = true;
        });
      }
    } else {
      const role = roles.find(r => r.id === bulkRoleId);
      if (!role) {
        toast.error('Invalid role');
        setBulkAssigning(false);
        return;
      }
      roleName = role.name;
      permissions = { ...role.permissions };
    }

    try {
      // Use bulk endpoint
      await api('/api/users/bulk-assign-role', {
        method: 'POST',
        body: JSON.stringify({
          user_ids: selectedUsers,
          assigned_role_id: bulkRoleId,
          permissions: permissions
        })
      });
      
      toast.success(`Assigned "${roleName}" role to ${selectedUsers.length} users`);
      
      // Update local state
      setUsers(prev => prev.map(u => 
        selectedUsers.includes(u.id) 
          ? { ...u, permissions, assigned_role_id: bulkRoleId }
          : u
      ));
      
      setShowBulkRoleModal(false);
      setSelectedUsers([]);
      setBulkRoleId('');
    } catch (err) {
      toast.error('Failed to assign roles: ' + err.message);
    } finally {
      setBulkAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalStats = selectedUser?.id ? getTotalStats() : { enabled: 0, total: 0 };
  const selectableUsers = filteredUsers.filter(u => u.role !== 'admin');
  const allSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedUsers.includes(u.id));

  return (
    <div className="space-y-6" data-testid="rbac-permissions-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            RBAC Permissions
          </h1>
          <p className="text-muted-foreground">Manage user roles and module permissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedUsers.length > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="text-base px-3 py-1">
                  {selectedUsers.length} users selected
                </Badge>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="w-4 h-4 mr-1" /> Clear
                </Button>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setShowBulkRoleModal(true)} className="bg-primary">
                  <Shield className="w-4 h-4 mr-2" /> Assign Role to Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" /> User Permissions
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Shield className="w-4 h-4 mr-2" /> Role Templates
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Users</CardTitle>
                  {selectableUsers.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={allSelected ? clearSelection : selectAllUsers}
                      className="text-xs"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-2"
                />
              </CardHeader>
              <CardContent className="max-h-[500px] overflow-y-auto">
                <div className="space-y-2">
                  {filteredUsers.map(u => {
                    const userRoleName = getRoleName(u.assigned_role_id);
                    const isSelected = selectedUsers.includes(u.id);
                    const isAdmin = u.role === 'admin';
                    const isSuperAdmin = u.role === 'superadmin';
                    
                    return (
                      <div
                        key={u.id}
                        className={`p-3 rounded-lg transition-colors ${
                          isSuperAdmin
                            ? 'bg-amber-50 border border-amber-200 cursor-not-allowed opacity-75'
                            : selectedUser?.id === u.id 
                            ? 'bg-primary text-primary-foreground' 
                            : isSelected
                              ? 'bg-primary/20 border border-primary/30'
                              : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Checkbox for bulk selection (not for admins or superadmins) */}
                          {!isAdmin && !isSuperAdmin && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleUserSelection(u.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                          )}
                          <div 
                            className={`flex items-center gap-3 flex-1 ${isSuperAdmin ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            onClick={() => selectUser(u)}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                              isSuperAdmin ? 'bg-amber-500' : isAdmin ? 'bg-red-500' : 'bg-blue-500'
                            }`}>
                              {u.name?.charAt(0)?.toUpperCase() || '#'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {u.name}
                                {isSuperAdmin && <span className="ml-2 text-xs text-amber-600">(All permissions)</span>}
                              </p>
                              <p className={`text-xs truncate ${selectedUser?.id === u.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {u.email}
                              </p>
                              {userRoleName && (
                                <p className={`text-xs ${selectedUser?.id === u.id ? 'text-primary-foreground/80' : 'text-primary'}`}>
                                  Role: {userRoleName}
                                </p>
                              )}
                            </div>
                            <Badge variant={isAdmin ? 'destructive' : 'secondary'} className="text-xs">
                              {u.role}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Permissions Editor */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedUser?.id ? `Permissions for ${selectedUser.name}` : 'Select a User'}
                    </CardTitle>
                    {selectedUser?.id && (
                      <CardDescription className="flex items-center gap-2">
                        {totalStats.enabled} of {totalStats.total} permissions enabled
                        {assignedRole && (
                          <Badge variant="outline" className="bg-primary/10 text-primary">
                            Role: {getRoleName(assignedRole)}
                          </Badge>
                        )}
                      </CardDescription>
                    )}
                  </div>
                  {selectedUser?.id && selectedUser.role !== 'admin' && (
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={saveUserPermissions} disabled={saving}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="max-h-[500px] overflow-y-auto">
                {!selectedUser?.id ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a user to manage their permissions</p>
                  </div>
                ) : selectedUser.role === 'admin' ? (
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 mx-auto mb-4 text-red-500" />
                    <p className="text-lg font-semibold text-red-500">Administrator</p>
                    <p className="text-muted-foreground">Admins have full access to all modules</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Permission Mode Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Role Assignment Mode */}
                      <div 
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          assignedRole 
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                            : 'border-muted hover:border-primary/50'
                        }`}
                        onClick={() => {
                          // This card already shows role selector when no role is assigned
                          // Just focus on the select if needed
                        }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${assignedRole ? 'bg-primary' : 'bg-muted'}`}>
                            <Shield className={`w-5 h-5 ${assignedRole ? 'text-white' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold">Role-Based Permissions</h3>
                            <p className="text-xs text-muted-foreground">Assign a predefined role</p>
                          </div>
                          {assignedRole && (
                            <Badge className="ml-auto bg-primary text-white">Active</Badge>
                          )}
                        </div>
                        
                        {assignedRole ? (
                          <div className="space-y-2">
                            <div className="p-3 bg-white dark:bg-card rounded-lg border flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-500" />
                                <span className="font-medium">{getRoleName(assignedRole)}</span>
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-red-500 hover:text-red-600 h-7"
                                onClick={(e) => { e.stopPropagation(); assignRoleToUser('none'); }}
                              >
                                <X className="w-4 h-4 mr-1" /> Remove
                              </Button>
                            </div>
                            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Permissions inherited from this role. Individual permissions disabled.
                            </p>
                          </div>
                        ) : (
                          <Select onValueChange={assignRoleToUser}>
                            <SelectTrigger className="bg-white dark:bg-card">
                              <SelectValue placeholder="Select a role to assign..." />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">System Templates</div>
                              {Object.entries(ROLE_TEMPLATES).map(([key, template]) => (
                                <SelectItem key={`template_${key}`} value={`template_${key}`}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${template.color}`} />
                                    {template.label}
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({template.permissions === 'all' ? 'Full Access' : `${template.permissions.length} perms`})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                              {roles.length > 0 && (
                                <>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Custom Roles</div>
                                  {roles.map(role => (
                                    <SelectItem key={role.id} value={role.id}>
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                        {role.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Custom Permissions Mode */}
                      <div 
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          !assignedRole 
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10 ring-2 ring-purple-500/20' 
                            : 'border-muted hover:border-purple-500/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${!assignedRole ? 'bg-purple-500' : 'bg-muted'}`}>
                            <Settings className={`w-5 h-5 ${!assignedRole ? 'text-white' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold">Custom Permissions</h3>
                            <p className="text-xs text-muted-foreground">Set individual permissions</p>
                          </div>
                          {!assignedRole && (
                            <Badge className="ml-auto bg-purple-500 text-white">Active</Badge>
                          )}
                        </div>
                        
                        {!assignedRole ? (
                          <p className="text-xs text-purple-600 bg-purple-100 dark:bg-purple-900/30 p-2 rounded flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            You can toggle individual permissions below.
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground p-2">
                            Remove the assigned role to enable custom permissions.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Permissions Section Header */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Module Permissions</h3>
                        {assignedRole && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                            <Shield className="w-3 h-3 mr-1" />
                            Inherited from {getRoleName(assignedRole)}
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline">
                        {totalStats.enabled}/{totalStats.total} enabled
                      </Badge>
                    </div>

                    {/* Permission Categories */}
                    {Object.entries(PERMISSION_MODULES).map(([categoryKey, category]) => {
                      const stats = getCategoryStats(categoryKey);
                      const isExpanded = expandedCategories[categoryKey];
                      const Icon = category.icon;
                      const isRoleBased = !!assignedRole;
                      
                      return (
                        <div key={categoryKey} className={`border rounded-lg overflow-hidden ${isRoleBased ? 'opacity-80' : ''}`}>
                          {/* Category Header */}
                          <div 
                            className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 ${category.color} bg-opacity-10`}
                            onClick={() => toggleCategory(categoryKey)}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              <div className={`p-1.5 rounded ${category.color}`}>
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <span className="font-medium">{category.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">
                                {stats.enabled}/{stats.total}
                              </Badge>
                              {!isRoleBased && (
                                <div className="flex gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={(e) => { e.stopPropagation(); toggleAllInCategory(categoryKey, true); }}
                                  >
                                    <Check className="w-3 h-3 mr-1" /> All
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={(e) => { e.stopPropagation(); toggleAllInCategory(categoryKey, false); }}
                                  >
                                    <X className="w-3 h-3 mr-1" /> None
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Permissions List */}
                          {isExpanded && (
                            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/20">
                              {category.permissions.map(perm => {
                                const isEnabled = userPermissions[perm.key] || false;
                                return (
                                  <div 
                                    key={perm.key}
                                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                      isEnabled 
                                        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                                        : 'bg-white dark:bg-card'
                                    } ${isRoleBased ? 'cursor-not-allowed' : ''}`}
                                  >
                                    <Checkbox
                                      id={perm.key}
                                      checked={isEnabled}
                                      onCheckedChange={() => !isRoleBased && togglePermission(perm.key)}
                                      disabled={isRoleBased}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Label htmlFor={perm.key} className={`font-medium ${isRoleBased ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                          {perm.label}
                                        </Label>
                                        {isRoleBased && isEnabled && (
                                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50 py-0 h-5">
                                            Inherited
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Role Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          {/* Custom Roles Section */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Custom Roles
                  </CardTitle>
                  <CardDescription>Create and manage your own role templates</CardDescription>
                </div>
                <Button onClick={openCreateRoleModal} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" /> Create Role
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {roles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No custom roles yet. Create one to get started!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roles.map(role => {
                    const permCount = Object.values(role.permissions || {}).filter(Boolean).length;
                    return (
                      <Card key={role.id} className="hover:shadow-md transition-shadow bg-white dark:bg-card">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-lg bg-primary">
                                <Shield className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <CardTitle className="text-base">{role.name}</CardTitle>
                                {role.description && (
                                  <CardDescription className="text-xs">{role.description}</CardDescription>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditRoleModal(role)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteRole(role.id, role.name)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-2">
                          <Badge variant="outline" className="text-xs">
                            {permCount} permissions
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pre-defined Templates */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Pre-defined Templates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(ROLE_TEMPLATES).map(([key, template]) => {
                const permCount = template.permissions === 'all' 
                  ? getAllPermissionKeys().length 
                  : template.permissions.length;
                
                return (
                  <Card key={key} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${template.color}`}>
                            <Shield className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{template.label}</CardTitle>
                            <CardDescription>{template.description}</CardDescription>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => duplicateTemplateAsRole(key)} title="Copy as custom role">
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">
                          {permCount} permissions
                        </Badge>
                        {template.permissions === 'all' ? (
                          <Badge className="bg-red-500">Full Access</Badge>
                        ) : (
                          <Badge variant="secondary">Limited</Badge>
                        )}
                      </div>
                      
                      {template.permissions !== 'all' && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {template.permissions.slice(0, 6).map(p => (
                            <Badge key={p} variant="outline" className="text-xs">
                              {p.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {template.permissions.length > 6 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.permissions.length - 6} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Module Overview */}
          <Card>
            <CardHeader>
              <CardTitle>All Available Permissions</CardTitle>
              <CardDescription>Complete list of {getAllPermissionKeys().length} permissions across {Object.keys(PERMISSION_MODULES).length} modules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(PERMISSION_MODULES).map(([key, category]) => {
                  const Icon = category.icon;
                  return (
                    <div key={key} className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`p-1.5 rounded ${category.color}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium">{category.label}</span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {category.permissions.length}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {category.permissions.map(perm => (
                          <p key={perm.key} className="text-sm text-muted-foreground">
                            • {perm.label}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Role Modal */}
      <Dialog open={showRoleModal} onOpenChange={setShowRoleModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {editingRole ? `Edit Role: ${editingRole.name}` : 'Create Custom Role'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Role Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name *</Label>
                <Input
                  id="role-name"
                  placeholder="e.g., Sales Executive"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-desc">Description</Label>
                <Input
                  id="role-desc"
                  placeholder="Brief description of this role"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            {/* Permission Stats */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Permissions Selected</span>
                <Badge variant="outline" className="text-base px-3">
                  {getRoleFormTotalStats().enabled} / {getRoleFormTotalStats().total}
                </Badge>
              </div>
            </div>

            {/* Permissions Grid */}
            <div className="space-y-3">
              {Object.entries(PERMISSION_MODULES).map(([categoryKey, category]) => {
                const stats = getRoleFormStats(categoryKey);
                const isExpanded = roleExpandedCategories[categoryKey];
                const Icon = category.icon;
                
                return (
                  <div key={categoryKey} className="border rounded-lg overflow-hidden">
                    {/* Category Header */}
                    <div 
                      className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 ${category.color} bg-opacity-10`}
                      onClick={() => setRoleExpandedCategories(prev => ({ ...prev, [categoryKey]: !prev[categoryKey] }))}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <div className={`p-1.5 rounded ${category.color}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium">{category.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{stats.enabled}/{stats.total}</Badge>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" variant="ghost" 
                            className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={(e) => { e.stopPropagation(); toggleRoleCategoryAll(categoryKey, true); }}
                          >
                            <Check className="w-3 h-3 mr-1" /> All
                          </Button>
                          <Button 
                            size="sm" variant="ghost" 
                            className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => { e.stopPropagation(); toggleRoleCategoryAll(categoryKey, false); }}
                          >
                            <X className="w-3 h-3 mr-1" /> None
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Permissions */}
                    {isExpanded && (
                      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 bg-muted/20">
                        {category.permissions.map(perm => (
                          <div 
                            key={perm.key}
                            className={`flex items-center gap-3 p-2 rounded-lg border transition-colors cursor-pointer ${
                              roleForm.permissions[perm.key] 
                                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                                : 'bg-white dark:bg-card hover:bg-muted/50'
                            }`}
                            onClick={() => toggleRolePermission(perm.key)}
                          >
                            <Checkbox
                              checked={roleForm.permissions[perm.key] || false}
                              onCheckedChange={() => toggleRolePermission(perm.key)}
                            />
                            <div className="flex-1">
                              <span className="font-medium text-sm">{perm.label}</span>
                              <p className="text-xs text-muted-foreground">{perm.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveRole} disabled={saving || !roleForm.name} className="bg-primary">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Role Assignment Modal */}
      <Dialog open={showBulkRoleModal} onOpenChange={setShowBulkRoleModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Bulk Role Assignment
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Selected Users Summary */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Selected Users ({selectedUsers.length})</p>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {selectedUsers.map(userId => {
                  const u = users.find(user => user.id === userId);
                  return u ? (
                    <Badge key={userId} variant="outline" className="bg-white">
                      {u.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label className="font-semibold">Select Role to Assign</Label>
              <Select value={bulkRoleId} onValueChange={setBulkRoleId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a role..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Pre-defined Templates</div>
                  {Object.entries(ROLE_TEMPLATES).map(([key, template]) => {
                    const permCount = template.permissions === 'all' 
                      ? getAllPermissionKeys().length 
                      : template.permissions.length;
                    return (
                      <SelectItem key={`template_${key}`} value={`template_${key}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${template.color}`} />
                          <span>{template.label}</span>
                          <span className="text-xs text-muted-foreground">({permCount} perms)</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                  {roles.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Custom Roles</div>
                      {roles.map(role => {
                        const permCount = Object.values(role.permissions || {}).filter(Boolean).length;
                        return (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span>{role.name}</span>
                              <span className="text-xs text-muted-foreground">({permCount} perms)</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {bulkRoleId && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  This will assign "{getRoleName(bulkRoleId)}" to {selectedUsers.length} users
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  All selected users will receive the same permissions from this role.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBulkRoleModal(false); setBulkRoleId(''); }}>
              Cancel
            </Button>
            <Button 
              onClick={bulkAssignRole} 
              disabled={bulkAssigning || !bulkRoleId} 
              className="bg-primary"
            >
              <Shield className="w-4 h-4 mr-2" />
              {bulkAssigning ? 'Assigning...' : `Assign to ${selectedUsers.length} Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
