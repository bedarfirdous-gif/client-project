import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Shield, Users, Key, Clock, Globe, Activity, History, 
  Settings, Plus, Edit2, Trash2, RefreshCw, Search, 
  Copy, Eye, EyeOff, LogOut, Lock, Unlock, Download,
  ChevronRight, AlertTriangle, CheckCircle, XCircle,
  Monitor, Smartphone, Filter, MoreVertical, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { useAuth } from '../App';

// Permission modules list - Complete list for RBAC
const PERMISSION_MODULES = [
  // Super Admin Dashboard
  { key: 'superadmin_dashboard', label: 'Super Admin Dashboard', category: 'Super Admin Dashboard' },
  { key: 'market_analytics', label: 'Market Analytics', category: 'Super Admin Dashboard' },
  { key: 'subscriptions', label: 'Subscriptions', category: 'Super Admin Dashboard' },
  { key: 'rbac_admin', label: 'RBAC Admin Panel', category: 'Super Admin Dashboard' },
  { key: 'autoheal', label: 'AutoHeal AI', category: 'Super Admin Dashboard' },
  { key: 'security_center', label: 'Security Center', category: 'Super Admin Dashboard' },
  { key: 'ai_dashboard', label: 'AI Dashboard', category: 'Super Admin Dashboard' },
  
  // Dashboard & General
  { key: 'dashboard', label: 'Dashboard', category: 'Dashboard' },
  { key: 'analytics', label: 'Analytics', category: 'Dashboard' },
  
  // Point of Sale / Inventory
  { key: 'pos', label: 'Point of Sale', category: 'Inventory' },
  { key: 'items', label: 'Items', category: 'Inventory' },
  { key: 'inventory', label: 'Inventory', category: 'Inventory' },
  { key: 'stock_transfers', label: 'Stock Transfers', category: 'Inventory' },
  { key: 'stock_receiver', label: 'Stock Receiver', category: 'Inventory' },
  { key: 'stock_audit', label: 'Stock Audit Trail', category: 'Inventory' },
  { key: 'upload_history', label: 'Upload History', category: 'Inventory' },
  { key: 'smart_scanner', label: 'Smart Stock Scanner', category: 'Inventory' },
  
  // Sales
  { key: 'sales_dashboard', label: 'Sales Dashboard', category: 'Sales' },
  { key: 'sales_history', label: 'Sales History', category: 'Sales' },
  { key: 'quotations', label: 'Quotations', category: 'Sales' },
  { key: 'sales_orders', label: 'Sales Orders', category: 'Sales' },
  { key: 'orders', label: 'Orders', category: 'Sales' },
  { key: 'my_orders', label: 'My Orders', category: 'Sales' },
  { key: 'virtual_trial', label: 'Virtual Trial Room', category: 'Sales' },
  { key: 'invoices', label: 'Invoices', category: 'Sales' },
  { key: 'pricing', label: 'Pricing', category: 'Sales' },
  { key: 'delivery', label: 'Delivery', category: 'Sales' },
  { key: 'returns', label: 'Returns', category: 'Sales' },
  { key: 'sales_reports', label: 'Sales Reports', category: 'Sales' },
  { key: 'crm', label: 'CRM', category: 'Sales' },
  
  // Purchase
  { key: 'purchases', label: 'Purchases', category: 'Purchase' },
  { key: 'purchase_orders', label: 'Purchase Orders', category: 'Purchase' },
  { key: 'purchase_returns', label: 'Purchase Returns', category: 'Purchase' },
  { key: 'purchase_reports', label: 'Purchase Reports', category: 'Purchase' },
  
  // Parties & Ledger
  { key: 'customers', label: 'Customers', category: 'Parties & Ledger' },
  { key: 'customer_ledger', label: 'Customer Ledger', category: 'Parties & Ledger' },
  { key: 'suppliers', label: 'Suppliers', category: 'Parties & Ledger' },
  { key: 'supplier_ledger', label: 'Supplier Ledger', category: 'Parties & Ledger' },
  
  // Finance & Accounting
  { key: 'ledger_management', label: 'Ledger Management', category: 'Finance & Accounting' },
  { key: 'voucher_entry', label: 'Voucher Entry', category: 'Finance & Accounting' },
  { key: 'accounting_books', label: 'Day/Cash/Bank Book', category: 'Finance & Accounting' },
  { key: 'trial_balance', label: 'Trial Balance', category: 'Finance & Accounting' },
  { key: 'gst_reports', label: 'GST Reports', category: 'Finance & Accounting' },
  { key: 'central_accounting', label: 'Central Accounting', category: 'Finance & Accounting' },
  { key: 'expenditure', label: 'Expenditure', category: 'Finance & Accounting' },
  { key: 'ledger', label: 'Receipt & Payment Ledger', category: 'Finance & Accounting' },
  { key: 'accounting_reports', label: 'Accounting Reports', category: 'Finance & Accounting' },
  
  // Discounts & Offers
  { key: 'vouchers', label: 'Vouchers', category: 'Discounts & Offers' },
  { key: 'discount_manager', label: 'Discount Manager', category: 'Discounts & Offers' },
  { key: 'loyalty', label: 'Loyalty Program', category: 'Discounts & Offers' },
  
  // Stores
  { key: 'stores', label: 'Store Management', category: 'Stores' },
  
  // HR Management
  { key: 'employees', label: 'Employees', category: 'HR Management' },
  { key: 'employment_agreements', label: 'Employment Agreements', category: 'HR Management' },
  { key: 'document_verification', label: 'Document Verification', category: 'HR Management' },
  { key: 'task_management', label: 'Task Management', category: 'HR Management' },
  { key: 'centralized_attendance', label: 'Centralized Attendance', category: 'HR Management' },
  { key: 'daily_attendance', label: 'Daily Attendance', category: 'HR Management' },
  { key: 'face_attendance', label: 'Face Attendance', category: 'HR Management' },
  { key: 'barcode_attendance', label: 'Barcode Attendance', category: 'HR Management' },
  { key: 'attendance_sheet', label: 'Attendance Sheet', category: 'HR Management' },
  { key: 'attendance', label: 'Attendance', category: 'HR Management' },
  { key: 'leaves', label: 'Leave Management', category: 'HR Management' },
  { key: 'shifts', label: 'Shift Management', category: 'HR Management' },
  { key: 'employee_ratings', label: 'Employee Ratings', category: 'HR Management' },
  { key: 'payroll', label: 'Payroll', category: 'HR Management' },
  { key: 'salary_calculator', label: 'Salary Calculator', category: 'HR Management' },
  { key: 'employee_loans', label: 'Employee Loans', category: 'HR Management' },
  
  // Connect & Training
  { key: 'connect_hub', label: 'Connect Hub', category: 'Connect & Training' },
  { key: 'training_center', label: 'Training Center', category: 'Connect & Training' },
  
  // Marketing & AI
  { key: 'ai_agent', label: 'AI Business Agent', category: 'Marketing & AI' },
  { key: 'auto_poster', label: 'Auto Poster Studio', category: 'Marketing & AI' },
  { key: 'customer_import', label: 'Customer Import', category: 'Marketing & AI' },
  { key: 'agent_control_center', label: 'Agent Control Center', category: 'Marketing & AI' },
  { key: 'ai_control_center', label: 'AI Control Center', category: 'Marketing & AI' },
  { key: 'ecommerce', label: 'E-commerce Store', category: 'Marketing & AI' },
  
  // AI Agents
  { key: 'ui_blink_fix', label: 'UI Blink Fix Agent', category: 'AI Agents' },
  { key: 'error_autofix', label: 'Error Auto-Fix Agent', category: 'AI Agents' },
  { key: 'performance_agent', label: 'Performance Agent', category: 'AI Agents' },
  { key: 'agent_collaboration', label: 'Agent Collaboration', category: 'AI Agents' },
  
  // Settings
  { key: 'gst_master', label: 'GST Master', category: 'Settings' },
  { key: 'gst_automation', label: 'GST Automation', category: 'Settings' },
  { key: 'user_management', label: 'User Management', category: 'Settings' },
  { key: 'rbac_permissions', label: 'RBAC Permissions', category: 'Settings' },
  { key: 'printing_lab', label: 'Printing Lab', category: 'Settings' },
  { key: 'invoice_settings', label: 'Invoice Settings', category: 'Settings' },
  { key: 'backup_restore', label: 'Backup & Restore', category: 'Settings' },
  { key: 'billing', label: 'Billing & Plans', category: 'Settings' },
  { key: 'settings', label: 'App Settings', category: 'Settings' },
  { key: 'security_settings', label: 'Security Settings', category: 'Settings' },
  { key: 'recycle_bin', label: 'Recycle Bin', category: 'Settings' },
  { key: 'assistant', label: 'AI Assistant', category: 'Settings' },
  
  // Extra Features
  { key: 'fabric_catalogue', label: 'Fabric Catalogue', category: 'Extra Features' },
  { key: 'keyboard_shortcuts', label: 'Keyboard Shortcuts', category: 'Extra Features' },
];

const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

// Helper function to safely check if a permission exists
// Handles both array format ["view", "edit"] and boolean format {view: true, edit: true}
const hasPermission = (permissions, moduleKey, action) => {
  if (!permissions || !permissions[moduleKey]) return false;
  
  const modulePerms = permissions[moduleKey];
  
  // If it's an array, use includes
  if (Array.isArray(modulePerms)) {
    return modulePerms.includes(action);
  }
  
  // If it's a boolean (simple format from backend)
  if (typeof modulePerms === 'boolean') {
    return modulePerms && action === 'view'; // Boolean true means view access
  }
  
  // If it's an object like {view: true, edit: false}
  if (typeof modulePerms === 'object') {
    return modulePerms[action] === true;
  }
  
  return false;
};

// Helper to convert permissions to array format for form handling
const normalizePermissions = (permissions) => {
  if (!permissions) return {};
  
  const normalized = {};
  
  Object.entries(permissions).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      normalized[key] = value;
    } else if (typeof value === 'boolean' && value) {
      // Boolean true means all standard permissions
      normalized[key] = ['view'];
    } else if (typeof value === 'object' && value !== null) {
      // Object format {view: true, edit: false} -> ["view"]
      normalized[key] = Object.entries(value)
        .filter(([_, enabled]) => enabled)
        .map(([action]) => action);
    }
  });
  
  return normalized;
};

export default function RBACAdminPage() {
  const { api, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  // Keep a single source of truth for initial data hydration to avoid UI flashing
  // between `null` -> populated data on first paint.
  const [loading, setLoading] = useState(true);
  
  // Data states
  // NOTE: avoid `null` initial values here to prevent conditional rendering toggling
  // (e.g., `stats && ...`) from causing a visual flash during initial load.
  const [stats, setStats] = useState({});
  const [roles, setRoles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [grantablePermissions, setGrantablePermissions] = useState({});
  const [permissionHierarchy, setPermissionHierarchy] = useState({});
  
  // Check user's role for UI display
  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const canGrantPermissions = isSuperAdmin || isAdmin || user?.role === 'manager';
  // Same rationale as above: keep a stable shape to avoid first-render flash.
  const [loginSummary, setLoginSummary] = useState({});
  const [ipWhitelist, setIpWhitelist] = useState({ ip_whitelist_enabled: false, whitelisted_ips: [], whitelisted_ranges: [] });
  const [accessSchedules, setAccessSchedules] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  
  // All Admins state (for superadmin)
  const [allAdmins, setAllAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

  // FIX: avoid `null` so dependent UI doesn't mount/unmount on first paint (prevents flicker).
  // Use explicit loaded flags instead of relying on truthy checks.
  // Keep stable initial shapes so JSX doesn't toggle between "nothing" and "something" on hydration.
  const [selectedAdminForPermissions, setSelectedAdminForPermissions] = useState({});
  const [isSelectedAdminLoaded, setIsSelectedAdminLoaded] = useState(false);

  // Stable initial shape + loaded flag to avoid conditional rendering flicker.
  const [adminModules, setAdminModules] = useState({});
  const [isAdminModulesLoaded, setIsAdminModulesLoaded] = useState(false);

  const [savingAdminModules, setSavingAdminModules] = useState(false);
  
  // Dialo
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showIpDialog, setShowIpDialog] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  
  // Form states
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: {} });
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', permissions: {} });
  const [apiKeyForm, setApiKeyForm] = useState({ name: '', permissions: [], rate_limit: 1000, expires_at: '' });
  const [scheduleForm, setScheduleForm] = useState({ 
    name: '', role_id: '', user_id: '', 
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    start_time: '09:00', end_time: '18:00', timezone: 'Asia/Kolkata'
  });
  const [editingRole, setEditingRole] = useState(null);
  
  // Filters
  const [sessionFilter, setSessionFilter] = useState('');
  const [historyFilter, setHistoryFilter] = useState({ status: 'all', days: 7 });

  // Fetch all data
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [statsData, rolesData, templatesData, sessionsData, historyData, summarData, ipData, schedulesData, keysData, logsData, grantableData, hierarchyData] = await Promise.all([
        api('/api/rbac/stats').catch(() => null),
        api('/api/roles').catch(() => []),
        api('/api/rbac/permission-templates').catch(() => ({ templates: [] })),
        api('/api/rbac/sessions').catch(() => ({ sessions: [] })),
        api('/api/rbac/login-history?limit=100').catch(() => ({ history: [] })),
        api('/api/rbac/login-history/summary').catch(() => null),
        api('/api/rbac/ip-whitelist').catch(() => ({ ip_whitelist_enabled: false, whitelisted_ips: [], whitelisted_ranges: [] })),
        api('/api/rbac/access-schedule').catch(() => ({ schedules: [] })),
        api('/api/rbac/api-keys').catch(() => ({ api_keys: [] })),
        api('/api/rbac/activity-log?limit=50').catch(() => ({ logs: [] })),
        api('/api/admin/my-grantable-permissions').catch(() => ({ can_grant: false, grantable_permissions: {} })),
        api('/api/admin/permission-hierarchy').catch(() => null),
      ]);
      
      setStats(statsData);
      setRoles(rolesData || []);
      setTemplates(templatesData?.templates || []);
      setSessions(sessionsData?.sessions || []);
      setLoginHistory(historyData?.history || []);
      setLoginSummary(summarData);
      setIpWhitelist(ipData);
      setAccessSchedules(schedulesData?.schedules || []);
      setApiKeys(keysData?.api_keys || []);
      setActivityLog(logsData?.logs || []);
      setGrantablePermissions(grantableData || {});
      setPermissionHierarchy(hierarchyData);
    } catch (error) {
      console.error('Error fetching RBAC data:', error);
      toast.error('Failed to load RBAC data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all admins (for superadmin)
  const fetchAllAdmins = async () => {
    if (!user?.is_superadmin) return;
    setAdminsLoading(true);
    try {
      const data = await api('/api/superadmin/admins');
      setAllAdmins(data?.admins || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
      // Don't show error toast if not authorized
    } finally {
      setAdminsLoading(false);
    }
  };

  // Fetch admin modules for permission management
  const fetchAdminModules = async (admin) => {
    try {
      const data = await api(`/api/superadmin/admins/${admin.id}/modules`);
      // Convert the nested module structure to flat enabled/disabled format
      const flatModules = {};
      if (data?.modules) {
        Object.values(data.modules).forEach(category => {
          if (category.modules) {
            Object.entries(category.modules).forEach(([key, mod]) => {
              flatModules[key] = mod.enabled && mod.available;
            });
          }
        });
      }
      setAdminModules(flatModules);
      setSelectedAdminForPermissions(admin);
    } catch (error) {
      console.error('Error fetching admin modules:', error);
      toast.error('Failed to load admin modules');
    }
  };

  // Save admin module permissions
  const saveAdminModules = async () => {
    if (!selectedAdminForPermissions?.id || !adminModules) {
      toast.error('Please select an admin first');
      return;
    }
    setSavingAdminModules(true);
    try {
      await api(`/api/superadmin/admins/${selectedAdminForPermissions.id}/modules`, {
        method: 'PUT',
        body: JSON.stringify({ enabled_modules: adminModules })
      });
      toast.success('Module permissions saved successfully');
      setSelectedAdminForPermissions(null);
      setAdminModules(null);
    } catch (error) {
      console.error('Error saving admin modules:', error);
      toast.error('Failed to save module permissions');
    } finally {
      setSavingAdminModules(false);
    }
  };

  // Toggle module for admin
  const toggleAdminModule = (moduleKey) => {
    if (!adminModules) return;
    setAdminModules(prev => ({
      ...prev,
      [moduleKey]: !prev[moduleKey]
    }));
  };

  // Load admins when tab changes to 'admins'
  useEffect(() => {
    if (activeTab === 'admins' && user?.is_superadmin) {
      fetchAllAdmins();
    }
  }, [activeTab, user?.is_superadmin]);

  // Role Management
  const saveRole = async () => {
    if (!roleForm.name) {
      toast.error('Role name is required');
      return;
    }
    try {
      if (editingRole) {
        await api(`/api/roles/${editingRole.id}`, {
          method: 'PUT',
          body: JSON.stringify(roleForm)
        });
        toast.success('Role updated');
      } else {
        await api('/api/roles', {
          method: 'POST',
          body: JSON.stringify(roleForm)
        });
        toast.success('Role created');
      }
      setShowRoleDialog(false);
      setEditingRole(null);
      setRoleForm({ name: '', description: '', permissions: {} });
      fetchAllData();
    } catch (error) {
      toast.error(error.message || 'Failed to save role');
    }
  };

  const deleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      await api(`/api/roles/${roleId}`, { method: 'DELETE' });
      toast.success('Role deleted');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to delete role');
    }
  };

  const cloneRole = async (role) => {
    const newName = prompt('Enter name for cloned role:', `${role.name} (Copy)`);
    if (!newName) return;
    try {
      await api(`/api/rbac/roles/${role.id}/clone`, {
        method: 'POST',
        body: JSON.stringify({ new_name: newName })
      });
      toast.success('Role cloned');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to clone role');
    }
  };

  // Template Management
  const saveTemplate = async () => {
    if (!templateForm.name) {
      toast.error('Template name is required');
      return;
    }
    try {
      await api('/api/rbac/permission-templates', {
        method: 'POST',
        body: JSON.stringify(templateForm)
      });
      toast.success('Template created');
      setShowTemplateDialog(false);
      setTemplateForm({ name: '', description: '', permissions: {} });
      fetchAllData();
    } catch (error) {
      toast.error(error.message || 'Failed to save template');
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await api(`/api/rbac/permission-templates/${templateId}`, { method: 'DELETE' });
      toast.success('Template deleted');
      fetchAllData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const applyTemplate = (template) => {
    setRoleForm({
      ...roleForm,
      permissions: { ...template.permissions }
    });
    toast.success(`Applied "${template.name}" template`);
  };

  // Session Management
  const revokeSession = async (sessionId) => {
    if (!window.confirm('Revoke this session? The user will be logged out.')) return;
    try {
      await api(`/api/rbac/sessions/${sessionId}`, { method: 'DELETE' });
      toast.success('Session revoked');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to revoke session');
    }
  };

  const revokeAllSessions = async (userId, userName) => {
    if (!window.confirm(`Revoke all sessions for ${userName}? They will be logged out from all devices.`)) return;
    try {
      await api(`/api/rbac/sessions/revoke-all/${userId}`, { method: 'POST' });
      toast.success('All sessions revoked');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to revoke sessions');
    }
  };

  // API Key Management
  const createApiKey = async () => {
    if (!apiKeyForm.name) {
      toast.error('API key name is required');
      return;
    }
    try {
      const result = await api('/api/rbac/api-keys', {
        method: 'POST',
        body: JSON.stringify(apiKeyForm)
      });
      setNewApiKey(result);
      toast.success('API key created');
      fetchAllData();
    } catch (error) {
      toast.error(error.message || 'Failed to create API key');
    }
  };

  const revokeApiKey = async (keyId) => {
    if (!window.confirm('Revoke this API key? Any integrations using it will stop working.')) return;
    try {
      await api(`/api/rbac/api-keys/${keyId}`, { method: 'DELETE' });
      toast.success('API key revoked');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // IP Whitelist Management
  const saveIpWhitelist = async () => {
    try {
      await api('/api/rbac/ip-whitelist', {
        method: 'PUT',
        body: JSON.stringify(ipWhitelist)
      });
      toast.success('IP whitelist updated');
      setShowIpDialog(false);
    } catch (error) {
      toast.error('Failed to update IP whitelist');
    }
  };

  // Access Schedule Management
  const saveSchedule = async () => {
    if (!scheduleForm.name) {
      toast.error('Schedule name is required');
      return;
    }
    try {
      await api('/api/rbac/access-schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleForm)
      });
      toast.success('Schedule created');
      setShowScheduleDialog(false);
      setScheduleForm({ 
        name: '', role_id: '', user_id: '', 
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        start_time: '09:00', end_time: '18:00', timezone: 'Asia/Kolkata'
      });
      fetchAllData();
    } catch (error) {
      toast.error(error.message || 'Failed to create schedule');
    }
  };

  const deleteSchedule = async (scheduleId) => {
    if (!window.confirm('Delete this access schedule?')) return;
    try {
      await api(`/api/rbac/access-schedule/${scheduleId}`, { method: 'DELETE' });
      toast.success('Schedule deleted');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to delete schedule');
    }
  };

  // Export Activity Log
  const exportActivityLog = async () => {
    const fromDate = prompt('From date (YYYY-MM-DD):', new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]);
    const toDate = prompt('To date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!fromDate || !toDate) return;
    
    try {
      const data = await api(`/api/rbac/activity-log/export?from_date=${fromDate}&to_date=${toDate}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity_log_${fromDate}_${toDate}.json`;
      a.click();
      toast.success('Activity log exported');
    } catch (error) {
      toast.error('Failed to export activity log');
    }
  };

  // Toggle permission in form
  const togglePermission = (formSetter, form, module, action) => {
    // Normalize current permissions to array format
    let currentPerms = form.permissions[module];
    
    // Handle different formats
    if (!currentPerms) {
      currentPerms = [];
    } else if (!Array.isArray(currentPerms)) {
      // Convert from object/boolean to array
      if (typeof currentPerms === 'boolean') {
        currentPerms = currentPerms ? ['view'] : [];
      } else if (typeof currentPerms === 'object') {
        currentPerms = Object.entries(currentPerms)
          .filter(([_, enabled]) => enabled)
          .map(([act]) => act);
      } else {
        currentPerms = [];
      }
    }
    
    const newPerms = currentPerms.includes(action)
      ? currentPerms.filter(a => a !== action)
      : [...currentPerms, action];
    
    formSetter({
      ...form,
      permissions: {
        ...form.permissions,
        [module]: newPerms.length > 0 ? newPerms : undefined
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="rbac-admin-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            RBAC Admin Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Manage roles, permissions, sessions, and security settings</p>
        </div>
        <Button variant="outline" onClick={fetchAllData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Total Users</p>
                  <p className="text-2xl font-bold">{stats.total_users}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Active Sessions</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active_sessions}</p>
                </div>
                <Monitor className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Roles</p>
                  <p className="text-2xl font-bold">{stats.total_roles}</p>
                </div>
                <Shield className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">API Keys</p>
                  <p className="text-2xl font-bold">{stats.active_api_keys}</p>
                </div>
                <Key className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Failed Logins (24h)</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failed_logins_24h}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">{loginSummary?.success_rate || 0}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users by Role */}
      {stats?.users_by_role && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Users by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.users_by_role).map(([role, count]) => (
                <Badge key={role} variant="outline" className="text-sm py-1 px-3">
                  {role}: <span className="font-bold ml-1">{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 lg:grid-cols-9 w-full">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="hierarchy" className="text-xs">Hierarchy</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs">Roles</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs">Sessions</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">Login History</TabsTrigger>
          <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
          <TabsTrigger value="apikeys" className="text-xs">API Keys</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">Activity Log</TabsTrigger>
          {user?.is_superadmin && (
            <TabsTrigger value="admins" className="text-xs bg-purple-100 text-purple-700">All Admins</TabsTrigger>
          )}
        </TabsList>

        {/* Permission Hierarchy Tab */}
        <TabsContent value="hierarchy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Permission Hierarchy
              </CardTitle>
              <CardDescription>
                Understand how permissions flow from SuperAdmin → Admin → Users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Your Permission Level */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="font-semibold">{user?.name}</p>
                    <p className="text-sm text-muted-foreground">Role: <Badge variant="outline" className="ml-1">{user?.role?.toUpperCase()}</Badge></p>
                    <p className="text-xs text-blue-600 mt-1">
                      {grantablePermissions.can_grant 
                        ? `✓ You can grant ${Object.keys(grantablePermissions.grantable_permissions || {}).length} permissions`
                        : '✗ You cannot grant permissions to others'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Hierarchy Levels */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Permission Flow
                </h3>
                
                <div className="relative">
                  {/* SuperAdmin */}
                  <div className="flex items-start gap-4 pb-6">
                    <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="flex-1 pb-4 border-l-2 border-purple-300 pl-4 -ml-5 ml-5">
                      <p className="font-semibold text-purple-700">Super Admin</p>
                      <p className="text-sm text-muted-foreground">Full system control. Can grant any permission to any user.</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="secondary" className="text-xs">All Modules</Badge>
                        <Badge variant="secondary" className="text-xs">User Management</Badge>
                        <Badge variant="secondary" className="text-xs">System Settings</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Admin */}
                  <div className="flex items-start gap-4 pb-6">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Key className="w-5 h-5" />
                    </div>
                    <div className="flex-1 pb-4 border-l-2 border-blue-300 pl-4 -ml-5 ml-5">
                      <p className="font-semibold text-blue-700">Admin</p>
                      <p className="text-sm text-muted-foreground">Permissions granted by SuperAdmin. Can only grant permissions they have.</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">Granted by SuperAdmin</Badge>
                        <Badge variant="outline" className="text-xs">Can manage: Manager, Staff, Cashier</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Manager */}
                  <div className="flex items-start gap-4 pb-6">
                    <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 pb-4 border-l-2 border-green-300 pl-4 -ml-5 ml-5">
                      <p className="font-semibold text-green-700">Manager</p>
                      <p className="text-sm text-muted-foreground">Limited permission granting. Can manage Staff and Cashier roles.</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">Operational Access</Badge>
                        <Badge variant="outline" className="text-xs">Limited Granting</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Staff/Cashier/Viewer */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-500 text-white flex items-center justify-center shrink-0">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-700">Staff / Cashier / Viewer</p>
                      <p className="text-sm text-muted-foreground">End users. Cannot grant permissions to others.</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">Assigned Access Only</Badge>
                        <Badge variant="outline" className="text-xs">No Granting Rights</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Your Grantable Permissions */}
              {grantablePermissions.can_grant && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Permissions You Can Grant
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(grantablePermissions.grantable_permissions || {}).map(([key, value]) => (
                      value && (
                        <Badge key={key} variant="secondary" className="justify-center py-1">
                          {key.replace(/_/g, ' ')}
                        </Badge>
                      )
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Sessions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-64 overflow-auto">
                  {sessions.slice(0, 5).map(session => (
                    <div key={session.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{session.user_name}</p>
                        <p className="text-xs text-gray-500">{session.ip_address}</p>
                      </div>
                      <Badge variant={session.is_active ? "default" : "secondary"} className="text-xs">
                        {session.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-64 overflow-auto">
                  {activityLog.slice(0, 5).map(log => (
                    <div key={log.id} className="p-3">
                      <p className="font-medium text-sm">{log.user_name || 'System'}</p>
                      <p className="text-xs text-gray-500">{log.action} - {log.module}</p>
                      <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                  ))}
                  {activityLog.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">No recent activity</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Role Management</h2>
            <Button onClick={() => { setEditingRole(null); setRoleForm({ name: '', description: '', permissions: {} }); setShowRoleDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(role => (
              <Card key={role.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{role.name}</CardTitle>
                      <CardDescription className="text-xs">{role.description || 'No description'}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => cloneRole(role)} title="Clone">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditingRole(role); setRoleForm({ name: role.name, description: role.description || '', permissions: normalizePermissions(role.permissions) }); setShowRoleDialog(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteRole(role.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(role.permissions || {}).slice(0, 4).map(module => (
                      <Badge key={module} variant="outline" className="text-xs">{module}</Badge>
                    ))}
                    {Object.keys(role.permissions || {}).length > 4 && (
                      <Badge variant="secondary" className="text-xs">+{Object.keys(role.permissions).length - 4} more</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {roles.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No roles created yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Permission Templates</h2>
            <Button onClick={() => { setTemplateForm({ name: '', description: '', permissions: {} }); setShowTemplateDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <Card key={template.id} className={`hover:shadow-md transition-shadow ${template.is_system ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        {template.is_system && <Badge className="text-xs bg-blue-100 text-blue-800">System</Badge>}
                      </div>
                      <CardDescription className="text-xs">{template.description}</CardDescription>
                    </div>
                    {!template.is_system && (
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteTemplate(template.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {Object.keys(template.permissions || {}).slice(0, 5).map(module => (
                      <Badge key={module} variant="outline" className="text-xs">{module}</Badge>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => applyTemplate(template)}>
                    Apply to New Role
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Active Sessions ({sessions.filter(s => s.is_active).length})</h2>
            <Input
              placeholder="Search by user..."
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="w-64"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Last Active</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessions
                    .filter(s => !sessionFilter || s.user_name?.toLowerCase().includes(sessionFilter.toLowerCase()))
                    .map(session => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-sm">{session.user_name}</p>
                          <p className="text-xs text-gray-500">{session.user_email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{session.user_role}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{session.ip_address}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(session.last_activity || session.login_time).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {session.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => revokeSession(session.id)} title="Revoke Session">
                            <LogOut className="h-4 w-4 text-red-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => revokeAllSessions(session.user_id, session.user_name)} title="Revoke All Sessions">
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Login History Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Login History</h2>
            <div className="flex gap-2">
              <Select value={historyFilter.status} onValueChange={(v) => setHistoryFilter({ ...historyFilter, status: v })}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Login Summary */}
          {loginSummary && (
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-blue-50">
                <CardContent className="pt-4">
                  <p className="text-xs text-blue-600">Total Attempts</p>
                  <p className="text-xl font-bold text-blue-800">{loginSummary.total_attempts}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="pt-4">
                  <p className="text-xs text-green-600">Successful</p>
                  <p className="text-xl font-bold text-green-800">{loginSummary.successful}</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50">
                <CardContent className="pt-4">
                  <p className="text-xs text-red-600">Failed</p>
                  <p className="text-xl font-bold text-red-800">{loginSummary.failed}</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-50">
                <CardContent className="pt-4">
                  <p className="text-xs text-purple-600">Unique Users</p>
                  <p className="text-xl font-bold text-purple-800">{loginSummary.unique_users}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">IP Address</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loginHistory
                    .filter(h => historyFilter.status === 'all' || h.status === historyFilter.status)
                    .map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{new Date(entry.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{entry.user_email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{entry.ip_address}</td>
                      <td className="px-4 py-3 text-center">
                        {entry.status === 'success' ? (
                          <Badge className="bg-green-100 text-green-800">Success</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">Failed</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.failure_reason || '-'}</td>
                    </tr>
                  ))}
                  {loginHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No login history available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <h2 className="text-lg font-semibold">Security Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* IP Whitelist Card */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      IP Whitelist
                    </CardTitle>
                    <CardDescription>Restrict access to specific IP addresses</CardDescription>
                  </div>
                  <Switch 
                    checked={ipWhitelist.ip_whitelist_enabled} 
                    onCheckedChange={(checked) => setIpWhitelist({ ...ipWhitelist, ip_whitelist_enabled: checked })}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    {ipWhitelist.whitelisted_ips?.length || 0} IPs, {ipWhitelist.whitelisted_ranges?.length || 0} ranges configured
                  </p>
                  <Button variant="outline" onClick={() => setShowIpDialog(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Access Schedules Card */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Time-Based Access
                    </CardTitle>
                    <CardDescription>Restrict access by day and time</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowScheduleDialog(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {accessSchedules.map(schedule => (
                    <div key={schedule.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium text-sm">{schedule.name}</p>
                        <p className="text-xs text-gray-500">{schedule.start_time} - {schedule.end_time}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteSchedule(schedule.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                  {accessSchedules.length === 0 && (
                    <p className="text-sm text-gray-500">No schedules configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="apikeys" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">API Keys</h2>
            <Button onClick={() => { setApiKeyForm({ name: '', permissions: [], rate_limit: 1000, expires_at: '' }); setNewApiKey(null); setShowApiKeyDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Key Prefix</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Permissions</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Usage</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apiKeys.map(key => (
                    <tr key={key.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{key.name}</td>
                      <td className="px-4 py-3 font-mono text-sm">{key.key_prefix}...</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {key.permissions?.slice(0, 2).map(p => (
                            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                          ))}
                          {key.permissions?.length > 2 && <Badge variant="secondary" className="text-xs">+{key.permissions.length - 2}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">{key.usage_count?.toLocaleString() || 0}</td>
                      <td className="px-4 py-3 text-center">
                        {key.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Revoked</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {key.is_active && (
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => revokeApiKey(key.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {apiKeys.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        <Key className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>No API keys created</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Activity Log</h2>
            <Button variant="outline" onClick={exportActivityLog}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Module</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activityLog.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-sm">{log.user_name || 'System'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={
                          log.action === 'create' ? 'default' :
                          log.action === 'delete' ? 'destructive' :
                          'secondary'
                        } className="text-xs">{log.action}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">{log.module}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.description || '-'}</td>
                    </tr>
                  ))}
                  {activityLog.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        <Activity className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>No activity logged yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Admins Tab - For Superadmin Only */}
        {user?.is_superadmin && (
          <TabsContent value="admins" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      All Admins - Permission Management
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage module permissions for all admins in the system
                    </p>
                  </div>
                  <Button variant="outline" onClick={fetchAllAdmins} disabled={adminsLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${adminsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search admins by name or email..."
                      value={adminSearchQuery}
                      onChange={(e) => setAdminSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Admins Table */}
                {adminsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allAdmins
                        .filter(admin => 
                          admin.name?.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
                          admin.email?.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
                          admin.business_name?.toLowerCase().includes(adminSearchQuery.toLowerCase())
                        )
                        .map(admin => (
                          <tr key={admin.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                  <span className="text-purple-600 font-semibold">{admin.name?.charAt(0)}</span>
                                </div>
                                <div>
                                  <p className="font-medium">{admin.name}</p>
                                  <p className="text-xs text-gray-500">{admin.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">{admin.business_name || '-'}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="capitalize">
                                {admin.subscription_plan || 'free'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm">{admin.stats?.users || 0}</td>
                            <td className="px-4 py-3">
                              <Badge variant={admin.is_active ? 'default' : 'destructive'}>
                                {admin.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => fetchAdminModules(admin)}
                                className="gap-1"
                              >
                                <Shield className="w-4 h-4" />
                                Manage Permissions
                              </Button>
                            </td>
                          </tr>
                        ))
                      }
                      {allAdmins.length === 0 && !adminsLoading && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            No admins found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Admin Permissions Modal */}
      <Dialog open={!!selectedAdminForPermissions} onOpenChange={() => { setSelectedAdminForPermissions(null); setAdminModules(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Module Permissions - {selectedAdminForPermissions?.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedAdminForPermissions?.email} • Plan: {selectedAdminForPermissions?.subscription_plan || 'Free'}
            </p>
          </DialogHeader>
          
          {adminModules ? (
            <div className="space-y-6">
              {/* Module Categories */}
              {Object.entries(
                PERMISSION_MODULES.reduce((acc, mod) => {
                  if (!acc[mod.category]) acc[mod.category] = [];
                  acc[mod.category].push(mod);
                  return acc;
                }, {})
              ).map(([category, modules]) => (
                <div key={category} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 text-purple-700">{category}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {modules.map(mod => (
                      <div 
                        key={mod.key}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          adminModules[mod.key] 
                            ? 'bg-green-50 border-green-300 hover:bg-green-100' 
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                        onClick={() => toggleAdminModule(mod.key)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{mod.label}</span>
                          {adminModules[mod.key] ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => { setSelectedAdminForPermissions(null); setAdminModules(null); }}>
                  Cancel
                </Button>
                <Button 
                  onClick={saveAdminModules} 
                  disabled={savingAdminModules}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {savingAdminModules ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Shield className="w-4 h-4 mr-2" /> Save Permissions</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role Name *</Label>
                <Input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="e.g., Store Manager"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>
            </div>

            {/* Quick Apply Templates */}
            <div>
              <Label className="text-sm">Quick Apply Template</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {templates.filter(t => t.is_system).map(template => (
                  <Button key={template.id} variant="outline" size="sm" onClick={() => applyTemplate(template)}>
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Permissions Grid */}
            <div>
              <Label className="text-sm mb-2 block">Permissions</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Module</th>
                      {PERMISSION_ACTIONS.map(action => (
                        <th key={action} className="px-2 py-2 text-center font-medium capitalize">{action}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {PERMISSION_MODULES.map(module => (
                      <tr key={module.key} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{module.label}</td>
                        {PERMISSION_ACTIONS.map(action => (
                          <td key={action} className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={hasPermission(roleForm.permissions, module.key, action)}
                              onChange={() => togglePermission(setRoleForm, roleForm, module.key, action)}
                              className="rounded"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
            <Button onClick={saveRole}>{editingRole ? 'Update' : 'Create'} Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Permission Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Template Name *</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="e.g., Warehouse Staff"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>
            </div>

            {/* Permissions Grid */}
            <div>
              <Label className="text-sm mb-2 block">Permissions</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Module</th>
                      {PERMISSION_ACTIONS.map(action => (
                        <th key={action} className="px-2 py-2 text-center font-medium capitalize">{action}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {PERMISSION_MODULES.map(module => (
                      <tr key={module.key} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{module.label}</td>
                        {PERMISSION_ACTIONS.map(action => (
                          <td key={action} className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={hasPermission(templateForm.permissions, module.key, action)}
                              onChange={() => togglePermission(setTemplateForm, templateForm, module.key, action)}
                              className="rounded"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={saveTemplate}>Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          
          {newApiKey ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">API Key Created!</span>
                </div>
                <p className="text-sm text-green-700 mb-3">Copy this key now. It will not be shown again.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-white rounded border font-mono text-sm break-all">{newApiKey.key}</code>
                  <Button size="sm" onClick={() => copyToClipboard(newApiKey.key)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button className="w-full" onClick={() => { setShowApiKeyDialog(false); setNewApiKey(null); }}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Key Name *</Label>
                <Input
                  value={apiKeyForm.name}
                  onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })}
                  placeholder="e.g., ERP Integration"
                />
              </div>
              <div>
                <Label>Rate Limit (requests/day)</Label>
                <Input
                  type="number"
                  value={apiKeyForm.rate_limit}
                  onChange={(e) => setApiKeyForm({ ...apiKeyForm, rate_limit: parseInt(e.target.value) || 1000 })}
                />
              </div>
              <div>
                <Label>Expires At (optional)</Label>
                <Input
                  type="date"
                  value={apiKeyForm.expires_at}
                  onChange={(e) => setApiKeyForm({ ...apiKeyForm, expires_at: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">Permissions</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['read:all', 'read:items', 'read:inventory', 'read:sales', 'read:customers', 'write:sales', 'write:inventory'].map(perm => (
                    <label key={perm} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={apiKeyForm.permissions.includes(perm)}
                        onChange={(e) => {
                          const newPerms = e.target.checked
                            ? [...apiKeyForm.permissions, perm]
                            : apiKeyForm.permissions.filter(p => p !== perm);
                          setApiKeyForm({ ...apiKeyForm, permissions: newPerms });
                        }}
                        className="rounded"
                      />
                      {perm}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>Cancel</Button>
                <Button onClick={createApiKey}>Create Key</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* IP Whitelist Dialog */}
      <Dialog open={showIpDialog} onOpenChange={setShowIpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>IP Whitelist Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable IP Whitelist</Label>
              <Switch 
                checked={ipWhitelist.ip_whitelist_enabled} 
                onCheckedChange={(checked) => setIpWhitelist({ ...ipWhitelist, ip_whitelist_enabled: checked })}
              />
            </div>
            <div>
              <Label>Whitelisted IPs (one per line)</Label>
              <Textarea
                value={ipWhitelist.whitelisted_ips?.join('\n') || ''}
                onChange={(e) => setIpWhitelist({ ...ipWhitelist, whitelisted_ips: e.target.value.split('\n').filter(ip => ip.trim()) })}
                placeholder="192.168.1.100&#10;10.0.0.50"
                rows={4}
              />
            </div>
            <div>
              <Label>Whitelisted Ranges (CIDR, one per line)</Label>
              <Textarea
                value={ipWhitelist.whitelisted_ranges?.join('\n') || ''}
                onChange={(e) => setIpWhitelist({ ...ipWhitelist, whitelisted_ranges: e.target.value.split('\n').filter(r => r.trim()) })}
                placeholder="192.168.1.0/24&#10;10.0.0.0/16"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIpDialog(false)}>Cancel</Button>
            <Button onClick={saveIpWhitelist}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Access Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Schedule Name *</Label>
              <Input
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                placeholder="e.g., Business Hours"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={scheduleForm.start_time}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={scheduleForm.end_time}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Days</Label>
              <div className="flex flex-wrap gap-2">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <label key={day} className="flex items-center gap-1 text-sm capitalize">
                    <input
                      type="checkbox"
                      checked={scheduleForm.days.includes(day)}
                      onChange={(e) => {
                        const newDays = e.target.checked
                          ? [...scheduleForm.days, day]
                          : scheduleForm.days.filter(d => d !== day);
                        setScheduleForm({ ...scheduleForm, days: newDays });
                      }}
                      className="rounded"
                    />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
            <Button onClick={saveSchedule}>Create Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
