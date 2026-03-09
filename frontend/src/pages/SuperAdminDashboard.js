import React, { useState, useEffect } from 'react';
import { useAuth, useTheme } from '../App';
import { toast } from 'sonner';
import { useCurrency, CURRENCIES } from '../contexts/CurrencyContext';
import { CurrencyIcon } from '../components/CurrencyIcon';
import {
  Users, Building2, ShoppingCart, TrendingUp, TrendingDown,
  Plus, Search, MoreVertical, Eye, EyeOff, Edit, Trash2, UserCheck, UserX,
  LogIn, RefreshCw, BarChart3, PieChart, Activity, Globe, Calendar,
  ChevronDown, ChevronRight, Download, Filter, ArrowUpRight, ArrowDownRight,
  Shield, Settings, Database, Loader2, Store, Package, FileText, AlertTriangle,
  Zap, Crown, Rocket, CreditCard, AlertCircle, CheckCircle, Key, Lock, 
  Unlock, Copy, Skull, Power, Ban, Check, UserCog, KeyRound, UserCircle,
  Sun, Moon, Palette, Bug, Sparkles, Wand2, Code2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import ErrorMonitoringDashboard from './ErrorMonitoringDashboard';
import EmbeddedAIAssistant from './EmbeddedAIAssistant';
import AIDevStudio from './AIDevStudio';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Progress } from '../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '../components/ui/dropdown-menu';
import {
  LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import ThemeSelector from '../components/ThemeSelector';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F'];

const PLAN_ICONS = {
  free: Building2,
  basic: Zap,
  pro: Crown,
  enterprise: Rocket
};

export default function SuperAdminDashboard({ onImpersonate, initialTab }) {
  const { api, user, startImpersonation } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [godModeForm, setGodModeForm] = useState(false);
  const [item, setItem] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  
  // Dashboard data
  // NOTE: `null` initial state causes a first render with missing sections,
  // then a second render when data arrives -> visible flash/flicker.
  // Use stable empty defaults + a loaded flag so UI can render consistently.
  const [dashboardData, setDashboardData] = useState({});
  const [isDashboardLoaded, setIsDashboardLoaded] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [adminsTotal, setAdminsTotal] = useState(0);
  const [marketAnalytics, setMarketAnalytics] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminsNeedingUpgrade, setAdminsNeedingUpgrade] = useState({ admins: [] });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [analyticsPeriod, setAnalyticsPeriod] = useState('month');
  
  // Modals
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);

  // FIX: Avoid `null` modal flags which can cause a first render mismatch (flash)
  // when the UI conditionally renders dialogs based on truthy/falsey checks.
  // Use `false` as the stable "closed" default; when opening, set to an id/object as before.
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showAdminDetails, setShowAdminDetails] = useState(false);

  // Selected entity can remain `null` (no selection) without causing UI flash by itself.
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [showGodModeModal, setShowGodModeModal] = useState(false);
  
  // Create admin form
  const [adminForm, setAdminForm] = useState({
    email: '', password: '', name: '', business_name: '',
    business_type: 'retail', phone: '', address: '', plan: 'free'
  });
  const [creating, setCreating] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  
  // Module management
  const [allModules, setAllModules] = useState(null);
  const [selectedAdminModules, setSelectedAdminModules] = useState(null);
  const [showModuleModal, setShowModuleModal] = useState(null);
  const [savingModules, setSavingModules] = useState(false);
  const [moduleStats, setModuleStats] = useState(null);
  
  // Plan management
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [subscriptionStats, setSubscriptionStats] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(null); // null, 'create', or plan object for edit
  const [planForm, setPlanForm] = useState({
    id: '', name: '', price: 0, currency: 'inr', interval: 'month',
    features: [], limits: { stores: 1, products: 100, users: 2, sales_per_month: 500, customers: 100 },
    is_active: true, is_popular: false, description: '', trial_days: 0
  });
  const [savingPlan, setSavingPlan] = useState(false);
  const [newFeature, setNewFeature] = useState('');
  
  // Upgrade Request Management
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [upgradeRequestsLoading, setUpgradeRequestsLoading] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(null);
  
  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: '', email: '', current_password: '', new_password: '', confirm_password: ''
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [showProfileCurrentPassword, setShowProfileCurrentPassword] = useState(false);
  const [showProfileNewPassword, setShowProfileNewPassword] = useState(false);
  const [showProfileConfirmPassword, setShowProfileConfirmPassword] = useState(false);
  
  // Backup codes
  const [backupCodes, setBackupCodes] = useState([]);
  const [backupCodesStatus, setBackupCodesStatus] = useState(null);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  
  // God mode
  const [godModeAction, setGodModeAction] = useState('');
  const [godModeTarget, setGodModeTarget] = useState('');
  const [godModePassword, setGodModePassword] = useState('');
  const [showGodModePassword, setShowGodModePassword] = useState(false);
  const [godModeNewRole, setGodModeNewRole] = useState('');
  const [godModeConfirmDelete, setGodModeConfirmDelete] = useState(false);
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState([]);
  const [executingGodMode, setExecutingGodMode] = useState(false);
  
  // User management in admin details
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(null);
  const [userForm, setUserForm] = useState({
    email: '', password: '', name: '', role: 'staff', store_ids: []
  });
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [showNewUserConfirmPassword, setShowNewUserConfirmPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [resetPasswordForm, setResetPasswordForm] = useState({ new_password: '', confirm_password: '' });

  // Sync activeTab with initialTab prop when it changes (for sidebar navigation)
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    fetchDashboard();
    fetchAdmins();
    fetchAdminsNeedingUpgrade();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchMarketAnalytics();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    } else if (activeTab === 'upgrades') {
      fetchAdminsNeedingUpgrade();
    } else if (activeTab === 'plans') {
      fetchSubscriptionPlans();
      fetchSubscriptionStats();
      fetchUpgradeRequests();
    } else if (activeTab === 'modules') {
      fetchAllModules();
      fetchModuleStats();
    }
  }, [activeTab, analyticsPeriod]);

  const fetchDashboard = async () => {
    try {
      const data = await api('/api/superadmin/dashboard');
      setDashboardData(data);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminsNeedingUpgrade = async () => {
    try {
      const data = await api('/api/superadmin/admins-needing-upgrades');
      setAdminsNeedingUpgrade(data);
    } catch (err) {
      console.error('Failed to fetch admins needing upgrades:', err);
    }
  };

  const fetchAdmins = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('limit', '100');
      
      const data = await api(`/api/superadmin/admins?${params}`);
      setAdmins(data.admins);
      setAdminsTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    }
  };

  const fetchAllModules = async () => {
    try {
      const data = await api('/api/superadmin/modules');
      setAllModules(data);
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    }
  };

  const fetchModuleStats = async () => {
    try {
      const data = await api('/api/superadmin/modules/stats');
      setModuleStats(data);
    } catch (err) {
      console.error('Failed to fetch module stats:', err);
    }
  };

  // Fetch upgrade requests for SuperAdmin
  const fetchUpgradeRequests = async () => {
    setUpgradeRequestsLoading(true);
    try {
      const data = await api('/api/superadmin/plan-requests');
      setUpgradeRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch upgrade requests:', err);
      toast.error('Failed to load upgrade requests');
    } finally {
      setUpgradeRequestsLoading(false);
    }
  };

  // Approve upgrade request
  const approveUpgradeRequest = async (requestId) => {
    setProcessingRequest(requestId);
    try {
      const result = await api(`/api/superadmin/plan-requests/${requestId}/approve`, {
        method: 'POST'
      });
      toast.success(result.message);
      fetchUpgradeRequests();
      fetchSubscriptionStats();
    } catch (err) {
      toast.error(err.message || 'Failed to approve request');
    } finally {
      setProcessingRequest(null);
    }
  };

  // Reject upgrade request
  const rejectUpgradeRequest = async (requestId, reason = 'Payment not received') => {
    setProcessingRequest(requestId);
    try {
      const result = await api(`/api/superadmin/plan-requests/${requestId}/reject?reason=${encodeURIComponent(reason)}`, {
        method: 'POST'
      });
      toast.success(result.message);
      fetchUpgradeRequests();
    } catch (err) {
      toast.error(err.message || 'Failed to reject request');
    } finally {
      setProcessingRequest(null);
    }
  };

  // Mark request as paid
  const markRequestPaid = async (requestId) => {
    setProcessingRequest(requestId);
    try {
      const result = await api(`/api/superadmin/plan-requests/${requestId}/mark-paid`, {
        method: 'POST'
      });
      toast.success(result.message);
      fetchUpgradeRequests();
    } catch (err) {
      toast.error(err.message || 'Failed to mark as paid');
    } finally {
      setProcessingRequest(null);
    }
  };

  const fetchAdminModules = async (adminId) => {
    try {
      const data = await api(`/api/superadmin/admins/${adminId}/modules`);
      setSelectedAdminModules(data);
      return data;
    } catch (err) {
      toast.error('Failed to load admin modules');
      return null;
    }
  };

  const handleSaveModules = async () => {
    if (!showModuleModal?.id || !selectedAdminModules) return;
    
    setSavingModules(true);
    try {
      // Build enabled modules map
      const enabledModules = {};
      for (const category of Object.values(selectedAdminModules.modules)) {
        for (const [moduleKey, module] of Object.entries(category.modules)) {
          if (module.available) {
            enabledModules[moduleKey] = module.enabled;
          }
        }
      }
      
      const response = await api(`/api/superadmin/admins/${showModuleModal.id}/modules`, {
        method: 'PUT',
        body: JSON.stringify({ enabled_modules: enabledModules })
      });
      
      toast.success(response.message || 'Module access updated');
      setShowModuleModal(null);
      setSelectedAdminModules(null);
      fetchModuleStats();
    } catch (err) {
      toast.error(err.message || 'Failed to update modules');
    } finally {
      setSavingModules(false);
    }
  };

  const handleResetModules = async () => {
    if (!showModuleModal?.id) return;
    
    if (!confirm('Reset all module settings to plan defaults?')) return;
    
    setSavingModules(true);
    try {
      const response = await api(`/api/superadmin/admins/${showModuleModal.id}/modules/reset`, {
        method: 'POST'
      });
      
      toast.success(response.message || 'Modules reset to defaults');
      // Refresh the admin modules
      await fetchAdminModules(showModuleModal.id);
    } catch (err) {
      toast.error(err.message || 'Failed to reset modules');
    } finally {
      setSavingModules(false);
    }
  };

  const toggleModule = (categoryKey, moduleKey) => {
    if (!selectedAdminModules) return;
    
    setSelectedAdminModules(prev => ({
      ...prev,
      modules: {
        ...prev.modules,
        [categoryKey]: {
          ...prev.modules[categoryKey],
          modules: {
            ...prev.modules[categoryKey].modules,
            [moduleKey]: {
              ...prev.modules[categoryKey].modules[moduleKey],
              enabled: !prev.modules[categoryKey].modules[moduleKey].enabled
            }
          }
        }
      }
    }));
  };

  // ========== SUBSCRIPTION PLAN MANAGEMENT ==========
  
  const fetchSubscriptionPlans = async () => {
    try {
      // Use new centralized subscription system endpoint
      const data = await api('/api/subscriptions/plans/master?include_inactive=true');
      // Format plans for the existing UI
      const formattedPlans = (data.plans || []).map(plan => ({
        id: plan.plan_code || plan.id,
        plan_id: plan.id, // UUID from new system
        name: plan.name,
        price: plan.base_price || 0,
        currency: (plan.currency || 'INR').toLowerCase(),
        interval: plan.billing_interval || 'month',
        features: plan.features || [],
        limits: plan.limits || { stores: 1, products: 100, users: 2, sales_per_month: 500, customers: 100 },
        is_active: plan.is_active !== false,
        is_popular: plan.is_popular || false,
        description: plan.description || '',
        trial_days: plan.trial_days || 0,
        subscriber_count: plan.subscriber_count || 0,
        renewal_config: plan.renewal_config || {},
        price_display: null // Use formatCurrency at render time
      }));
      setSubscriptionPlans(formattedPlans);
    } catch (err) {
      console.error('Failed to fetch plans:', err);
      // Fallback to old endpoint if new one fails
      try {
        const data = await api('/api/superadmin/plans');
        setSubscriptionPlans(data.plans || []);
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
      }
    }
  };

  const fetchSubscriptionStats = async () => {
    try {
      // Use new centralized analytics endpoint
      const data = await api('/api/subscriptions/analytics');
      // Format for existing UI
      setSubscriptionStats({
        total_admins: data.overview?.active_subscriptions || 0,
        total_mrr: data.revenue?.mrr || 0,
        total_arr: data.revenue?.arr || 0,
        plans_count: (data.plan_distribution || []).length,
        plan_distribution: (data.plan_distribution || []).reduce((acc, plan) => {
          acc[plan.plan] = { name: plan.plan, count: plan.subscribers, revenue: plan.revenue };
          return acc;
        }, {})
      });
    } catch (err) {
      console.error('Failed to fetch subscription stats:', err);
      // Fallback to old endpoint
      try {
        const data = await api('/api/superadmin/subscriptions/stats');
        setSubscriptionStats(data);
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
      }
    }
  };

  const handleCreatePlan = async () => {
    if (!planForm.id?.trim()) {
      toast.error('Please enter a plan ID');
      return;
    }
    if (!planForm.name?.trim()) {
      toast.error('Please enter a plan name');
      return;
    }
    
    setSavingPlan(true);
    try {
      // Use new centralized subscription system endpoint
      const planCode = planForm.id.toLowerCase().replace(/\s+/g, '_');
      const response = await api('/api/subscriptions/plans/master', {
        method: 'POST',
        body: JSON.stringify({
          plan_code: planCode,
          name: planForm.name,
          description: planForm.description || '',
          base_price: parseFloat(planForm.price) || 0,
          currency: (planForm.currency || 'INR').toUpperCase(),
          billing_interval: planForm.interval || 'month',
          billing_interval_count: 1,
          features: planForm.features || [],
          limits: {
            stores: planForm.limits?.stores || 1,
            products: planForm.limits?.products || 100,
            users: planForm.limits?.users || 2,
            customers: planForm.limits?.customers || 100,
            sales_per_month: planForm.limits?.sales_per_month || 500,
            api_calls_per_day: 1000,
            storage_gb: 1.0
          },
          renewal_config: {
            is_renewable: true,
            renewal_type: planForm.interval === 'year' ? 'yearly' : 'monthly',
            grace_period_days: 7,
            auto_renew_enabled: true
          },
          trial_days: planForm.trial_days || 0,
          is_popular: planForm.is_popular || false,
          display_order: 0,
          is_active: planForm.is_active !== false,
          is_public: true
        })
      });
      toast.success(response.message || 'Plan created successfully');
      setShowPlanModal(null);
      resetPlanForm();
      fetchSubscriptionPlans();
      fetchSubscriptionStats();
    } catch (err) {
      toast.error(err.message || 'Failed to create plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!showPlanModal?.plan_id && !showPlanModal?.id) return;
    
    setSavingPlan(true);
    try {
      // Use new centralized subscription system endpoint with versioning
      const planIdToUpdate = showPlanModal.plan_id || showPlanModal.id;
      const response = await api(`/api/subscriptions/plans/master/${planIdToUpdate}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: planForm.name,
          description: planForm.description || '',
          base_price: parseFloat(planForm.price) || 0,
          currency: (planForm.currency || 'INR').toUpperCase(),
          billing_interval: planForm.interval || 'month',
          features: planForm.features || [],
          limits: {
            stores: planForm.limits?.stores || 1,
            products: planForm.limits?.products || 100,
            users: planForm.limits?.users || 2,
            customers: planForm.limits?.customers || 100,
            sales_per_month: planForm.limits?.sales_per_month || 500,
            api_calls_per_day: 1000,
            storage_gb: 1.0
          },
          trial_days: planForm.trial_days || 0,
          is_popular: planForm.is_popular || false,
          is_active: planForm.is_active !== false,
          version_note: 'Updated via Super Admin Dashboard'
        })
      });
      toast.success(response.message || 'Plan updated successfully');
      setShowPlanModal(null);
      resetPlanForm();
      fetchSubscriptionPlans();
      fetchSubscriptionStats();
    } catch (err) {
      toast.error(err.message || 'Failed to update plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (planId, planName) => {
    if (!confirm(`Are you sure you want to delete "${planName}"? This action cannot be undone.`)) return;
    
    try {
      // Use new centralized subscription system endpoint
      const response = await api(`/api/subscriptions/plans/master/${planId}`, { method: 'DELETE' });
      toast.success(response.message || 'Plan deleted');
      fetchSubscriptionPlans();
      fetchSubscriptionStats();
    } catch (err) {
      toast.error(err.message || 'Failed to delete plan');
    }
  };

  const resetPlanForm = () => {
    setPlanForm({
      id: '', name: '', price: 0, currency: 'inr', interval: 'month',
      features: [], limits: { stores: 1, products: 100, users: 2, sales_per_month: 500, customers: 100 },
      is_active: true, is_popular: false, description: '', trial_days: 0
    });
    setNewFeature('');
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    setPlanForm(prev => ({ ...prev, features: [...prev.features, newFeature.trim()] }));
    setNewFeature('');
  };

  const removeFeature = (index) => {
    setPlanForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  };

  const openEditPlan = (plan) => {
    setPlanForm({
      id: plan.id || plan.plan_code,
      name: plan.name,
      price: plan.price || plan.base_price || 0,
      currency: (plan.currency || 'inr').toLowerCase(),
      interval: plan.interval || plan.billing_interval || 'month',
      features: plan.features || [],
      limits: plan.limits || { stores: 1, products: 100, users: 2, sales_per_month: 500, customers: 100 },
      is_active: plan.is_active !== false,
      is_popular: plan.is_popular || false,
      description: plan.description || '',
      trial_days: plan.trial_days || 0
    });
    // Keep track of plan_id for new system
    setShowPlanModal({ ...plan, plan_id: plan.plan_id || plan.id });
  };

  const handleChangePlan = async (adminId, newPlanId) => {
    setChangingPlan(true);
    try {
      await api(`/api/superadmin/admins/${adminId}/plan`, {
        method: 'PUT',
        body: JSON.stringify({ plan_id: newPlanId })
      });
      toast.success('Plan upgraded successfully!');
      setShowUpgradeModal(null);
      fetchAdminsNeedingUpgrade();
      fetchDashboard();
      fetchAdmins(); // Refresh admins list
      
      // If admin details modal is open, refresh it with new plan
      if (showAdminDetails && showAdminDetails.admin?.id === adminId) {
        const adminToRefresh = admins.find(a => a.id === adminId);
        if (adminToRefresh) {
          viewAdminDetails({ ...adminToRefresh, subscription_plan: newPlanId });
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to change plan');
    } finally {
      setChangingPlan(false);
    }
  };

  // Open profile modal with current data
  const openProfileModal = () => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
    setShowProfileModal(true);
  };

  // Update Super Admin profile
  const handleUpdateProfile = async () => {
    // Validate
    if (profileForm.new_password && profileForm.new_password !== profileForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (profileForm.new_password && profileForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    if (profileForm.new_password && !profileForm.current_password) {
      toast.error('Current password is required to change password');
      return;
    }
    
    setUpdatingProfile(true);
    try {
      const updateData = {};
      if (profileForm.name && profileForm.name !== user?.name) {
        updateData.name = profileForm.name;
      }
      if (profileForm.email && profileForm.email !== user?.email) {
        updateData.email = profileForm.email;
      }
      if (profileForm.new_password) {
        updateData.current_password = profileForm.current_password;
        updateData.new_password = profileForm.new_password;
      }
      
      if (Object.keys(updateData).length === 0) {
        toast.info('No changes to save');
        setShowProfileModal(false);
        return;
      }
      
      const result = await api('/api/superadmin/profile', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      
      toast.success('Profile updated successfully');
      setShowProfileModal(false);
      
      // If email changed, user needs to re-login
      if (updateData.email || updateData.new_password) {
        toast.info('Please login again with your new credentials');
        setTimeout(() => {
          localStorage.removeItem('token');
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Backup Codes Functions
  const fetchBackupCodesStatus = async () => {
    try {
      const data = await api('/api/superadmin/backup-codes/status');
      setBackupCodesStatus(data);
    } catch (err) {
      console.error('Failed to fetch backup codes status:', err);
    }
  };

  const generateBackupCodes = async () => {
    if (!confirm('This will invalidate all existing backup codes. Continue?')) return;
    
    setGeneratingCodes(true);
    try {
      const data = await api('/api/superadmin/backup-codes/generate', { method: 'POST' });
      setBackupCodes(data.codes);
      toast.success('Backup codes generated! Save them securely.');
      fetchBackupCodesStatus();
    } catch (err) {
      toast.error('Failed to generate backup codes');
    } finally {
      setGeneratingCodes(false);
    }
  };

  // God Mode Functions
  const executeGodModeAction = async () => {
    if (!godModeAction) {
      toast.error('Select an action');
      return;
    }
    
    setExecutingGodMode(true);
    try {
      let endpoint = '';
      let body = {};
      
      switch (godModeAction) {
        case 'reset_password':
          if (!godModeTarget || !godModePassword) {
            toast.error('User ID and new password required');
            setExecutingGodMode(false);
            return;
          }
          endpoint = '/api/superadmin/god-mode/reset-password';
          body = { user_id: godModeTarget, new_password: godModePassword };
          break;
        case 'force_logout':
          endpoint = '/api/superadmin/god-mode/force-logout';
          body = godModeTarget ? { user_id: godModeTarget } : { all_users: true };
          break;
        case 'freeze_tenant':
          if (!godModeTarget) {
            toast.error('Tenant ID required');
            setExecutingGodMode(false);
            return;
          }
          endpoint = '/api/superadmin/god-mode/freeze-tenant';
          body = { tenant_id: godModeTarget };
          break;
        case 'unfreeze_tenant':
          if (!godModeTarget) {
            toast.error('Tenant ID required');
            setExecutingGodMode(false);
            return;
          }
          endpoint = '/api/superadmin/god-mode/unfreeze-tenant';
          body = { tenant_id: godModeTarget };
          break;
        case 'impersonate':
          if (!godModeTarget) {
            toast.error('User ID required');
            setExecutingGodMode(false);
            return;
          }
          endpoint = '/api/superadmin/god-mode/impersonate';
          body = { target_user_id: godModeTarget };
          break;
        case 'change_role':
          if (!godModeTarget || !godModeNewRole) {
            toast.error('User ID and new role required');
            setExecutingGodMode(false);
            return;
          }
          endpoint = '/api/superadmin/god-mode/change-role';
          body = { target_user_id: godModeTarget, new_role: godModeNewRole };
          break;
        case 'generate_backup_codes':
          if (!godModeTarget) {
            toast.error('User ID required');
            setExecutingGodMode(false);
            return;
          }
          endpoint = '/api/superadmin/god-mode/generate-backup-codes';
          body = { target_user_id: godModeTarget };
          break;
        case 'delete_tenant_data':
          if (!godModeTarget) {
            toast.error('Tenant ID required');
            setExecutingGodMode(false);
            return;
          }
          if (!godModeConfirmDelete) {
            toast.error('You must confirm deletion by checking the checkbox');
            setExecutingGodMode(false);
            return;
          }
          endpoint = '/api/superadmin/god-mode/delete-tenant-data';
          body = { tenant_id: godModeTarget, confirm: true };
          break;
        default:
          toast.error('Unknown action');
          setExecutingGodMode(false);
          return;
      }
      
      const result = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      
      // Handle impersonation - store token and redirect
      if (godModeAction === 'impersonate' && result.access_token) {
        // Store original superadmin token
        const originalToken = localStorage.getItem('token');
        localStorage.setItem('original_superadmin_token', originalToken);
        localStorage.setItem('is_impersonating', 'true');
        localStorage.setItem('token', result.access_token);
        localStorage.setItem('user', JSON.stringify(result.user));
        toast.success(`Now impersonating ${result.user?.email}. Click "End Impersonation" to return.`);
        window.location.reload();
        return;
      }
      
      // Handle backup codes display
      if (godModeAction === 'generate_backup_codes' && result.codes) {
        setGeneratedBackupCodes(result.codes);
        toast.success(result.message);
        // Don't close modal - show codes
        setExecutingGodMode(false);
        return;
      }
      
      toast.success(result.message);
      setShowGodModeModal(false);
      resetGodModeForm();
      fetchAuditLogs();
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setExecutingGodMode(false);
    }
  };
  
  const resetGodModeForm = () => {
    setGodModeAction('');
    setGodModeTarget('');
    setGodModePassword('');
    setGodModeNewRole('');
    setGodModeConfirmDelete(false);
    setGeneratedBackupCodes([]);
  };

  // ========== USER MANAGEMENT FUNCTIONS ==========
  
  const handleCreateUser = async () => {
    if (!showAdminDetails?.admin?.id) return;
    
    if (!userForm.name?.trim()) {
      toast.error('Please enter user name');
      return;
    }
    if (!userForm.email?.trim()) {
      toast.error('Please enter user email');
      return;
    }
    if (!userForm.password?.trim()) {
      toast.error('Please enter password');
      return;
    }
    if (userForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setCreatingUser(true);
    try {
      const response = await api(`/api/superadmin/admins/${showAdminDetails.admin.id}/users`, {
        method: 'POST',
        body: JSON.stringify({
          ...userForm,
          email: userForm.email.trim().toLowerCase(),
          name: userForm.name.trim()
        })
      });
      toast.success(response.message || 'User created successfully');
      setShowCreateUserModal(false);
      setUserForm({ email: '', password: '', name: '', role: 'staff', store_ids: [] });
      // Refresh admin details to show new user
      viewAdminDetails(showAdminDetails.admin);
    } catch (err) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!showAdminDetails?.admin?.id || !showEditUserModal?.id) return;
    
    setUpdatingUser(true);
    try {
      const response = await api(`/api/superadmin/admins/${showAdminDetails.admin.id}/users/${showEditUserModal.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: showEditUserModal.name,
          role: showEditUserModal.role,
          is_active: showEditUserModal.is_active
        })
      });
      toast.success(response.message || 'User updated successfully');
      setShowEditUserModal(null);
      viewAdminDetails(showAdminDetails.admin);
    } catch (err) {
      toast.error(err.message || 'Failed to update user');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!showAdminDetails?.admin?.id) return;
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) return;
    
    setDeletingUserId(userId);
    try {
      const response = await api(`/api/superadmin/admins/${showAdminDetails.admin.id}/users/${userId}`, {
        method: 'DELETE'
      });
      toast.success(response.message || 'User deleted successfully');
      viewAdminDetails(showAdminDetails.admin);
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleResetUserPassword = async () => {
    if (!showAdminDetails?.admin?.id || !showResetPasswordModal?.id) return;
    
    if (!resetPasswordForm.new_password?.trim()) {
      toast.error('Please enter new password');
      return;
    }
    if (resetPasswordForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (resetPasswordForm.new_password !== resetPasswordForm.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    
    setUpdatingUser(true);
    try {
      const response = await api(`/api/superadmin/admins/${showAdminDetails.admin.id}/users/${showResetPasswordModal.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: resetPasswordForm.new_password })
      });
      toast.success(response.message || 'Password reset successfully');
      setShowResetPasswordModal(null);
      setResetPasswordForm({ new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setUpdatingUser(false);
    }
  };

  const fetchMarketAnalytics = async () => {
    try {
      const data = await api(`/api/superadmin/market-analytics?period=${analyticsPeriod}`);
      setMarketAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await api('/api/superadmin/audit-log?limit=100');
      setAuditLogs(data.logs);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  const handleCreateAdmin = async () => {
    // Validate required fields with specific messages
    if (!adminForm.name?.trim()) {
      toast.error('Please enter admin name');
      return;
    }
    if (!adminForm.email?.trim()) {
      toast.error('Please enter admin email');
      return;
    }
    if (!adminForm.password?.trim()) {
      toast.error('Please enter password');
      return;
    }
    if (!adminForm.business_name?.trim()) {
      toast.error('Please enter business name');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminForm.email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    // Validate password strength
    if (adminForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setCreating(true);
    try {
      const response = await api('/api/superadmin/admins', {
        method: 'POST',
        body: JSON.stringify({
          ...adminForm,
          email: adminForm.email.trim().toLowerCase(),
          name: adminForm.name.trim(),
          business_name: adminForm.business_name.trim()
        })
      });
      toast.success(`Admin "${response.admin?.name || adminForm.name}" created successfully`);
      setShowCreateAdmin(false);
      setAdminForm({
        email: '', password: '', name: '', business_name: '',
        business_type: 'retail', phone: '', address: '', plan: 'free'
      });
      fetchAdmins();
      fetchDashboard();
      fetchAdminsNeedingUpgrade();
    } catch (err) {
      console.error('Create admin error:', err);
      toast.error(err.message || 'Failed to create admin. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (admin, newStatus) => {
    try {
      await api(`/api/superadmin/admins/${admin.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: newStatus })
      });
      toast.success(`Admin ${newStatus ? 'activated' : 'deactivated'}`);
      fetchAdmins();
      fetchDashboard();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleImpersonate = async (admin) => {
    try {
      const data = await api(`/api/superadmin/impersonate/${admin.id}`, {
        method: 'POST'
      });
      toast.success(`Now logged in as ${admin.name}. Click "Return to Super Admin" in header to return.`);
      // Use the new startImpersonation function from auth context
      if (startImpersonation) {
        startImpersonation(data.access_token, data.user);
      } else {
        // Fallback to old method
        localStorage.setItem('originalToken', localStorage.getItem('token'));
        localStorage.setItem('token', data.access_token);
        window.location.reload();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to impersonate');
    }
  };

  const viewAdminDetails = async (admin) => {
    try {
      const data = await api(`/api/superadmin/admins/${admin.id}`);
      setShowAdminDetails(data);
      // Ensure subscription plans are loaded for the upgrade dropdown
      if (subscriptionPlans.length === 0) {
        fetchSubscriptionPlans();
      }
    } catch (err) {
      toast.error('Failed to load admin details');
    }
  };

  // formatCurrency now comes from useCurrency context

  const formatNumber = (num) => {
    if (num >= 10000000) return (num / 10000000).toFixed(1) + ' Cr';
    if (num >= 100000) return (num / 100000).toFixed(1) + ' L';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toLocaleString() || '0';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Super Admin Dashboard
          </h1>
          <p className="text-muted-foreground">Manage all admins and view global market analytics</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end items-center">
          {/* Theme Selector (Color Themes) */}
          <ThemeSelector />
          {/* Quick Theme Toggle */}
          <Button
            data-testid="superadmin-theme-toggle"
            variant="outline"
            onClick={toggleTheme}
            className="relative"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 mr-2 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 mr-2 text-slate-600" />
            )}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
          <Button data-testid="backup-codes-btn" variant="outline" onClick={() => { setShowBackupCodesModal(true); fetchBackupCodesStatus(); }} className="text-amber-600 border-amber-300 hover:bg-amber-50">
            <Key className="w-4 h-4 mr-2" />
            Backup Codes
          </Button>
          <Button data-testid="god-mode-btn" variant="outline" onClick={() => setShowGodModeModal(true)} className="text-red-600 border-red-300 hover:bg-red-50">
            <Skull className="w-4 h-4 mr-2" />
            God Mode
          </Button>
          <Button variant="outline" onClick={openProfileModal}>
            <Settings className="w-4 h-4 mr-2" />
            My Profile
          </Button>
          <Button variant="outline" onClick={() => { fetchDashboard(); fetchAdmins(); fetchAdminsNeedingUpgrade(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateAdmin(true)} data-testid="create-admin-btn">
            <Plus className="w-4 h-4 mr-2" />
            Create Admin
          </Button>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(dashboardData?.summary?.total_admins || 0)}</p>
                <p className="text-xs text-muted-foreground">Total Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(dashboardData?.summary?.active_admins || 0)}</p>
                <p className="text-xs text-muted-foreground">Active Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(dashboardData?.summary?.total_customers || 0)}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <CurrencyIcon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(dashboardData?.summary?.total_sales || 0)}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border-pink-200 dark:border-pink-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/20">
                <ShoppingCart className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(dashboardData?.summary?.total_orders || 0)}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border-indigo-200 dark:border-indigo-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/20">
                <Store className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(dashboardData?.summary?.total_stores || 0)}</p>
                <p className="text-xs text-muted-foreground">Total Stores</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-2 mb-2">
          <TabsList className="inline-flex h-auto p-1 min-w-max">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="admins" className="gap-2">
            <Users className="w-4 h-4" />
            Admins
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2" onClick={() => { fetchSubscriptionPlans(); fetchSubscriptionStats(); }}>
            <CreditCard className="w-4 h-4" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-2" onClick={() => { fetchAllModules(); fetchModuleStats(); }}>
            <Settings className="w-4 h-4" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="upgrades" className="gap-2 relative">
            <AlertTriangle className="w-4 h-4" />
            Upgrades
            {adminsNeedingUpgrade?.summary?.total_needing_upgrade > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {adminsNeedingUpgrade.summary.total_needing_upgrade}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <FileText className="w-4 h-4" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="errors" className="gap-2">
            <Bug className="w-4 h-4" />
            Error Monitoring
          </TabsTrigger>
          <TabsTrigger value="ai-assistant" className="gap-2" data-testid="ai-assistant-tab">
            <Sparkles className="w-4 h-4" />
            AI Assistant
          </TabsTrigger>
          <TabsTrigger value="ai-dev" className="gap-2" data-testid="ai-dev-tab">
            <Code2 className="w-4 h-4" />
            AI Dev Studio
          </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Admins Needing Upgrade Alert */}
          {adminsNeedingUpgrade?.summary?.total_needing_upgrade > 0 && (
            <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-500/20">
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                        {adminsNeedingUpgrade.summary.total_needing_upgrade} Admin{adminsNeedingUpgrade.summary.total_needing_upgrade > 1 ? 's' : ''} Need Upgrade
                      </h3>
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        {adminsNeedingUpgrade.summary.critical} critical, {adminsNeedingUpgrade.summary.warning} warning • 
                        Potential revenue: {formatCurrency(adminsNeedingUpgrade.summary.potential_monthly_revenue)}/month
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-100" onClick={() => setActiveTab('upgrades')}>
                    View All
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Performing Admins */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Top Performing Admins
                </CardTitle>
                <CardDescription>By revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData?.tenants?.slice(0, 5).map((tenant, idx) => (
                    <div key={tenant.tenant_id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                          idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-300'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium">{tenant.business_name}</p>
                          <p className="text-xs text-muted-foreground">{tenant.admin_email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">{formatCurrency(tenant.stats?.sales || 0)}</p>
                        <p className="text-xs text-muted-foreground">{tenant.stats?.orders || 0} orders</p>
                      </div>
                    </div>
                  ))}
                  {(!dashboardData?.tenants || dashboardData.tenants.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">No data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Admins */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Recently Added Admins
                </CardTitle>
                <CardDescription>Latest signups</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData?.recent_admins?.slice(0, 5).map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{admin.name?.charAt(0) || 'A'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{admin.name}</p>
                          <p className="text-xs text-muted-foreground">{admin.business_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={admin.is_active ? 'default' : 'secondary'}>
                          {admin.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(admin.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!dashboardData?.recent_admins || dashboardData.recent_admins.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">No admins yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Stats Distribution */}
          {dashboardData?.tenants && dashboardData.tenants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution by Admin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.tenants.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="business_name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                      <YAxis tickFormatter={(v) => formatNumber(v)} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Bar dataKey="stats.sales" fill="#8884d8" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Admins Tab */}
        <TabsContent value="admins" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Admin Management</CardTitle>
                  <CardDescription>Manage all admin accounts ({adminsTotal} total)</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search admins..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchAdmins()}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setTimeout(fetchAdmins, 100); }}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={fetchAdmins}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-accent">
                    <tr>
                      <th className="p-3 text-left text-sm font-medium">Admin</th>
                      <th className="p-3 text-left text-sm font-medium">Business</th>
                      <th className="p-3 text-center text-sm font-medium">Plan</th>
                      <th className="p-3 text-center text-sm font-medium">Users</th>
                      <th className="p-3 text-center text-sm font-medium">Stores</th>
                      <th className="p-3 text-center text-sm font-medium">Sales</th>
                      <th className="p-3 text-center text-sm font-medium">Status</th>
                      <th className="p-3 text-center text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr key={admin.id} className="border-t hover:bg-accent/30">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{admin.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{admin.name}</p>
                              <p className="text-xs text-muted-foreground">{admin.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="font-medium">{admin.business_name || '-'}</p>
                          <p className="text-xs text-muted-foreground">{admin.business_type || 'retail'}</p>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={admin.plan === 'pro' ? 'default' : 'secondary'}>
                            {admin.plan || 'free'}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">{admin.stats?.users || 0}</td>
                        <td className="p-3 text-center">{admin.stats?.stores || 0}</td>
                        <td className="p-3 text-center">{admin.stats?.sales || 0}</td>
                        <td className="p-3 text-center">
                          <Badge variant={admin.is_active ? 'default' : 'destructive'}>
                            {admin.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => viewAdminDetails(admin)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleImpersonate(admin)}>
                                <LogIn className="w-4 h-4 mr-2" />
                                Login as Admin
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleToggleStatus(admin, !admin.is_active)}
                                className={admin.is_active ? 'text-red-600' : 'text-green-600'}
                              >
                                {admin.is_active ? (
                                  <><UserX className="w-4 h-4 mr-2" /> Deactivate</>
                                ) : (
                                  <><UserCheck className="w-4 h-4 mr-2" /> Activate</>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {admins.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No admins found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Subscription Plan Management</h3>
              <p className="text-sm text-muted-foreground">Create, edit, and manage subscription plans for your platform</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { fetchSubscriptionPlans(); fetchSubscriptionStats(); }}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => { resetPlanForm(); setShowPlanModal('create'); }} data-testid="create-plan-btn">
                <Plus className="w-4 h-4 mr-2" />
                Create Plan
              </Button>
            </div>
          </div>

          {/* Subscription Stats */}
          {subscriptionStats && (
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold">{subscriptionStats.total_admins}</p>
                  <p className="text-sm text-muted-foreground">Total Subscribers</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{formatCurrency((subscriptionStats.total_mrr || 0))}</p>
                  <p className="text-sm text-muted-foreground">Monthly Revenue (MRR)</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{formatCurrency((subscriptionStats.total_arr || 0))}</p>
                  <p className="text-sm text-muted-foreground">Annual Revenue (ARR)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold">{subscriptionStats.plans_count}</p>
                  <p className="text-sm text-muted-foreground">Active Plans</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Plan Distribution */}
          {subscriptionStats?.plan_distribution && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscriber Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  {Object.entries(subscriptionStats?.plan_distribution || {}).map(([planId, data]) => (
                    <div key={planId} className="p-4 rounded-lg border text-center">
                      <p className="font-semibold capitalize">{data.name || planId}</p>
                      <p className="text-2xl font-bold mt-2">{data.count}</p>
                      <p className="text-xs text-muted-foreground">subscribers</p>
                      <p className="text-sm text-green-600 mt-1">{formatCurrency((data.revenue || 0))}/mo</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Upgrade Requests - SuperAdmin Approval Section */}
          <Card className={upgradeRequests.filter(r => r.status === 'pending').length > 0 ? 'border-amber-300' : ''}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Pending Upgrade Requests
                  </CardTitle>
                  <CardDescription>Approve or reject plan upgrade requests after payment confirmation</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchUpgradeRequests}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${upgradeRequestsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {upgradeRequestsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : upgradeRequests.filter(r => r.status === 'pending').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>No pending upgrade requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admin</TableHead>
                      <TableHead>Upgrade</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upgradeRequests.filter(r => r.status === 'pending').map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.admin_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{request.admin_email}</p>
                            <p className="text-xs text-muted-foreground">Tenant: {request.tenant_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-gray-100">{request.from_plan_name}</Badge>
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                              {request.to_plan_name}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-green-600">{formatCurrency(request.amount_due || 0)}</span>
                          <p className="text-xs text-muted-foreground">/{request.billing_cycle}</p>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={request.payment_status === 'paid' 
                              ? 'bg-green-100 text-green-700 border-green-300' 
                              : 'bg-amber-100 text-amber-700 border-amber-300'}
                          >
                            {request.payment_status === 'paid' ? '✓ Paid' : '⏳ Unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{new Date(request.created_at).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground">{new Date(request.created_at).toLocaleTimeString()}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {request.payment_status !== 'paid' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => markRequestPaid(request.id)}
                                disabled={processingRequest === request.id}
                              >
                                {processingRequest === request.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CurrencyIcon className="w-4 h-4 mr-1" />
                                    Mark Paid
                                  </>
                                )}
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => approveUpgradeRequest(request.id)}
                              disabled={processingRequest === request.id}
                            >
                              {processingRequest === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => rejectUpgradeRequest(request.id, 'Payment not received')}
                              disabled={processingRequest === request.id}
                            >
                              {processingRequest === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Ban className="w-4 h-4 mr-1" />
                                  Reject
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Plans Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Subscription Plans</CardTitle>
              <CardDescription>Click on a plan to view or edit its details</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Limits</TableHead>
                    <TableHead>Subscribers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptionPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${
                            plan.id === 'enterprise' ? 'bg-purple-100 dark:bg-purple-900/30' :
                            plan.id === 'pro' ? 'bg-blue-100 dark:bg-blue-900/30' :
                            plan.id === 'basic' ? 'bg-green-100 dark:bg-green-900/30' :
                            'bg-gray-100 dark:bg-gray-800'
                          }`}>
                            {plan.id === 'enterprise' ? <Rocket className="w-5 h-5 text-purple-600" /> :
                             plan.id === 'pro' ? <Crown className="w-5 h-5 text-blue-600" /> :
                             plan.id === 'basic' ? <Zap className="w-5 h-5 text-green-600" /> :
                             <Package className="w-5 h-5 text-gray-600" />}
                          </div>
                          <div>
                            <p className="font-medium">{plan.name}</p>
                            {plan.is_popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">{plan.price > 0 ? formatCurrency(plan.price) : 'Free'}</p>
                        <p className="text-xs text-muted-foreground">/{plan.interval || 'month'}</p>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <p>{plan.limits?.stores === -1 ? '∞' : plan.limits?.stores} Stores</p>
                          <p>{plan.limits?.products === -1 ? '∞' : plan.limits?.products} Products</p>
                          <p>{plan.limits?.users === -1 ? '∞' : plan.limits?.users} Users</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{plan.subscriber_count || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.is_active !== false ? 'default' : 'destructive'}>
                          {plan.is_active !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditPlan(plan)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Plan
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditPlan(plan)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {plan.id !== 'free' && (
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDeletePlan(plan.id, plan.name)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Plan
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Modules Tab */}
        <TabsContent value="modules" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Module Management</h3>
              <p className="text-sm text-muted-foreground">Control which modules each Admin can access based on their subscription plan</p>
            </div>
            <Button variant="outline" onClick={() => { fetchAllModules(); fetchModuleStats(); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Module Stats Overview */}
          {moduleStats && (
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold">{moduleStats.total_admins}</p>
                  <p className="text-sm text-muted-foreground">Total Admins</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{moduleStats.plan_distribution?.free || 0}</p>
                  <p className="text-sm text-muted-foreground">Free Plan</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{moduleStats.plan_distribution?.basic || 0}</p>
                  <p className="text-sm text-muted-foreground">Basic Plan</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-purple-600">{(moduleStats.plan_distribution?.pro || 0) + (moduleStats.plan_distribution?.enterprise || 0)}</p>
                  <p className="text-sm text-muted-foreground">Pro/Enterprise</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Module Categories Overview */}
          {allModules && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Available Modules by Category</CardTitle>
                <CardDescription>All modules available in the system organized by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {Object.entries(allModules.modules || {}).map(([catKey, category]) => (
                    <div key={catKey} className="p-3 rounded-lg border bg-accent/20">
                      <h4 className="font-semibold mb-2">{category.name}</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        {Object.keys(category.modules).length} modules
                      </p>
                      <div className="space-y-1">
                        {Object.values(category.modules).slice(0, 3).map((mod, i) => (
                          <p key={i} className="text-xs truncate">{mod.name}</p>
                        ))}
                        {Object.keys(category.modules).length > 3 && (
                          <p className="text-xs text-muted-foreground">+{Object.keys(category.modules).length - 3} more</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin Module Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manage Admin Module Access</CardTitle>
              <CardDescription>Click on an Admin to configure their module permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins?.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback>{admin.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{admin.name}</p>
                            <p className="text-xs text-muted-foreground">{admin.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{admin.business_name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          admin.plan === 'enterprise' ? 'default' :
                          admin.plan === 'pro' ? 'secondary' :
                          admin.plan === 'basic' ? 'outline' : 'outline'
                        } className="capitalize">
                          {admin.plan || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={admin.is_active ? 'default' : 'destructive'}>
                          {admin.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          onClick={async () => {
                            setShowModuleModal(admin);
                            await fetchAdminModules(admin.id);
                          }}
                          data-testid={`manage-modules-${admin.id}`}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Manage Modules
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Used Modules */}
          {moduleStats?.top_modules && Object.keys(moduleStats.top_modules).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most Used Modules</CardTitle>
                <CardDescription>Modules with highest activation across all admins</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Object.entries(moduleStats.top_modules).slice(0, 10).map(([module, count]) => (
                    <div key={module} className="p-3 rounded-lg border text-center">
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize">{module.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Market Analytics</h3>
            <Select value={analyticsPeriod} onValueChange={setAnalyticsPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Last 24 Hours</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {marketAnalytics ? (
            <>
              {/* Analytics Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrency(marketAnalytics.summary?.total_sales || 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Sales ({analyticsPeriod})</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {formatNumber(marketAnalytics.summary?.total_orders || 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-purple-600">
                      {marketAnalytics.summary?.new_admins || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">New Admins</p>
                  </CardContent>
                </Card>
              </div>

              {/* Sales Trend */}
              {marketAnalytics.daily_trend && marketAnalytics.daily_trend.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={marketAnalytics.daily_trend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="_id" fontSize={12} />
                          <YAxis tickFormatter={(v) => formatNumber(v)} />
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                          <Area type="monotone" dataKey="total" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} name="Revenue" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Tenants & Categories */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Performing Businesses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {marketAnalytics.top_tenants?.map((tenant, idx) => (
                        <div key={tenant._id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                            <span className="font-medium">{tenant.admin?.business_name || tenant._id}</span>
                          </div>
                          <span className="font-semibold text-green-600">{formatCurrency(tenant.total_sales)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Sales by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {marketAnalytics.categories?.map((cat, idx) => (
                        <div key={cat._id || idx} className="flex items-center justify-between">
                          <span className="font-medium">{cat._id || 'Uncategorized'}</span>
                          <span className="font-semibold">{formatCurrency(cat.total_sales)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
        </TabsContent>

        {/* Upgrades Tab - Admins Needing Upgrade */}
        <TabsContent value="upgrades" className="space-y-4">
          {/* Summary Cards */}
          {adminsNeedingUpgrade && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-200">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">{adminsNeedingUpgrade.summary?.critical || 0}</p>
                  <p className="text-sm text-red-700">Critical (Exceeded)</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-200">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-amber-600">{adminsNeedingUpgrade.summary?.warning || 0}</p>
                  <p className="text-sm text-amber-700">Warning (80%+)</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{adminsNeedingUpgrade.summary?.total_needing_upgrade || 0}</p>
                  <p className="text-sm text-blue-700">Total Needing Upgrade</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-200">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(adminsNeedingUpgrade.summary?.potential_monthly_revenue || 0)}</p>
                  <p className="text-sm text-green-700">Potential Revenue/Month</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Admins List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Admins Needing Upgrade
              </CardTitle>
              <CardDescription>
                Admins who have exceeded or are approaching their plan limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              {adminsNeedingUpgrade?.admins?.length > 0 ? (
                <div className="space-y-4">
                  {adminsNeedingUpgrade.admins.map((admin) => {
                    const CurrentIcon = PLAN_ICONS[admin.current_plan] || Building2;
                    const RecommendedIcon = PLAN_ICONS[admin.recommended_plan] || Zap;
                    
                    return (
                      <Card key={admin.admin_id} className={`overflow-hidden ${admin.urgency === 'critical' ? 'border-red-300 bg-red-50/50 dark:bg-red-900/10' : 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <Avatar className="w-12 h-12">
                                <AvatarFallback className={admin.urgency === 'critical' ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700'}>
                                  {admin.admin_name?.charAt(0) || 'A'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{admin.admin_name}</h3>
                                  <Badge variant={admin.urgency === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                                    {admin.urgency === 'critical' ? 'CRITICAL' : 'WARNING'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{admin.business_name}</p>
                                <p className="text-xs text-muted-foreground">{admin.admin_email}</p>
                                
                                {/* Usage Alerts */}
                                <div className="mt-3 space-y-2">
                                  {admin.usage_alerts.map((alert, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className={alert.status === 'exceeded' ? 'text-red-600 font-medium' : 'text-amber-600'}>
                                            {alert.metric}
                                          </span>
                                          <span className={alert.status === 'exceeded' ? 'text-red-600' : 'text-amber-600'}>
                                            {alert.current} / {alert.limit}
                                          </span>
                                        </div>
                                        <Progress 
                                          value={Math.min(alert.percentage, 100)} 
                                          className={`h-1.5 ${alert.status === 'exceeded' ? 'bg-red-100' : 'bg-amber-100'}`}
                                        />
                                      </div>
                                      {alert.status === 'exceeded' ? (
                                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                      ) : (
                                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            {/* Upgrade Recommendation */}
                            <div className="text-right">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <CurrentIcon className="w-4 h-4" />
                                  {admin.current_plan_name}
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-green-500" />
                                <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                                  <RecommendedIcon className="w-4 h-4" />
                                  {admin.recommended_plan_name}
                                </div>
                              </div>
                              {admin.recommended_plan_price && (
                                <p className="text-xs text-muted-foreground mb-2">
                                  +{formatCurrency(admin.recommended_plan_price - (admin.current_plan === 'free' ? 0 : 999))}/month
                                </p>
                              )}
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleImpersonate({ id: admin.admin_id, name: admin.admin_name })}
                                >
                                  <LogIn className="w-3 h-3 mr-1" />
                                  Login
                                </Button>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => setShowUpgradeModal(admin)}
                                >
                                  <Crown className="w-3 h-3 mr-1" />
                                  Upgrade
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
                  <h3 className="text-lg font-medium text-green-700">All Admins Within Limits</h3>
                  <p className="text-muted-foreground">No admins are currently exceeding or approaching their plan limits</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Super Admin Audit Log</CardTitle>
              <CardDescription>Track all super admin actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        log.action.includes('created') ? 'bg-green-100 text-green-600' :
                        log.action.includes('deactivated') ? 'bg-red-100 text-red-600' :
                        log.action.includes('impersonated') ? 'bg-blue-100 text-blue-600' :
                        log.action.includes('plan') ? 'bg-purple-100 text-purple-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {log.action.includes('created') && <Plus className="w-4 h-4" />}
                        {log.action.includes('deactivated') && <UserX className="w-4 h-4" />}
                        {log.action.includes('activated') && <UserCheck className="w-4 h-4" />}
                        {log.action.includes('impersonated') && <LogIn className="w-4 h-4" />}
                        {log.action.includes('updated') && <Edit className="w-4 h-4" />}
                        {log.action.includes('plan') && <Crown className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{log.action.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.admin_email && `Admin: ${log.admin_email}`}
                          {log.new_plan && ` • New Plan: ${log.new_plan}`}
                          {log.performed_by_name && ` • By: ${log.performed_by_name}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No audit logs yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Monitoring Tab */}
        <TabsContent value="errors" className="space-y-4">
          <ErrorMonitoringDashboard />
        </TabsContent>

        {/* AI Assistant Tab */}
        <TabsContent value="ai-assistant" className="space-y-4">
          <EmbeddedAIAssistant />
        </TabsContent>

        {/* AI Dev Studio Tab */}
        <TabsContent value="ai-dev" className="space-y-4">
          <AIDevStudio />
        </TabsContent>
      </Tabs>

      {/* Create Admin Modal */}
      <Dialog open={showCreateAdmin} onOpenChange={setShowCreateAdmin}>
        <DialogContent className="max-w-lg" data-testid="create-admin-modal">
          <DialogHeader>
            <DialogTitle>Create New Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  data-testid="admin-name-input"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  placeholder="Admin Name"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  data-testid="admin-email-input"
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  placeholder="admin@example.com"
                />
              </div>
            </div>
            <div>
              <Label>Password *</Label>
              <div className="relative">
                <Input
                  data-testid="admin-password-input"
                  type={showAdminPassword ? "text" : "password"}
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  placeholder="Strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Business Name *</Label>
              <Input
                data-testid="admin-business-name-input"
                value={adminForm.business_name}
                onChange={(e) => setAdminForm({ ...adminForm, business_name: e.target.value })}
                placeholder="Company Name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Business Type</Label>
                <Select value={adminForm.business_type} onValueChange={(v) => setAdminForm({ ...adminForm, business_type: v })}>
                  <SelectTrigger data-testid="admin-business-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plan</Label>
                <Select value={adminForm.plan} onValueChange={(v) => setAdminForm({ ...adminForm, plan: v })}>
                  <SelectTrigger data-testid="admin-plan-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                data-testid="admin-phone-input"
                value={adminForm.phone}
                onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                placeholder="+91 9876543210"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                data-testid="admin-address-input"
                value={adminForm.address}
                onChange={(e) => setAdminForm({ ...adminForm, address: e.target.value })}
                placeholder="Business Address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAdmin(false)} data-testid="cancel-create-admin-btn">Cancel</Button>
            <Button onClick={handleCreateAdmin} disabled={creating} data-testid="submit-create-admin-btn">
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Details Modal */}
      <Dialog open={!!showAdminDetails} onOpenChange={() => setShowAdminDetails(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Admin Dashboard View
            </DialogTitle>
          </DialogHeader>
          {showAdminDetails && (
            <div className="space-y-6">
              {/* Admin Info Header */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                <Avatar className="w-16 h-16 border-2 border-white shadow-lg">
                  <AvatarFallback className="text-2xl bg-blue-600 text-white">{showAdminDetails.admin?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{showAdminDetails.admin?.name}</h3>
                  <p className="text-muted-foreground">{showAdminDetails.admin?.email}</p>
                  <p className="text-sm text-blue-600 font-medium">{showAdminDetails.admin?.business_name || 'Retail Business'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={showAdminDetails.admin?.is_active ? 'default' : 'destructive'} className="text-sm">
                    {showAdminDetails.admin?.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Plan: {showAdminDetails.admin?.subscription_plan || 'Free'}
                    </Badge>
                    <DropdownMenu onOpenChange={(open) => { if (open && subscriptionPlans.length === 0) fetchSubscriptionPlans(); }}>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          data-testid="upgrade-plan-btn"
                          variant="outline" 
                          size="sm" 
                          className="h-6 px-2 text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:from-amber-600 hover:to-orange-600"
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          Upgrade
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Select New Plan
                        </div>
                        <DropdownMenuSeparator />
                        {subscriptionPlans.length === 0 ? (
                          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                            Loading plans...
                          </div>
                        ) : (
                          subscriptionPlans.map((plan) => {
                            const isCurrentPlan = (showAdminDetails.admin?.subscription_plan || 'free').toLowerCase() === plan.id?.toLowerCase();
                            const PlanIcon = PLAN_ICONS[plan.id?.toLowerCase()] || Building2;
                            return (
                              <DropdownMenuItem
                                key={plan.id}
                                disabled={isCurrentPlan || changingPlan}
                                onClick={() => handleChangePlan(showAdminDetails.admin?.id, plan.id)}
                                className={`cursor-pointer ${isCurrentPlan ? 'bg-muted' : ''}`}
                              >
                                <PlanIcon className="w-4 h-4 mr-2" />
                                <div className="flex-1">
                                  <span className="font-medium">{plan.name}</span>
                                  {isCurrentPlan && <span className="text-xs text-muted-foreground ml-1">(Current)</span>}
                                </div>
                                {plan.price > 0 && (
                                  <span className="text-xs text-muted-foreground">{formatCurrency(plan.price)}</span>
                                )}
                              </DropdownMenuItem>
                            );
                          })
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Dashboard Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardContent className="p-4 text-center">
                    <Users className="w-6 h-6 mx-auto mb-1 opacity-80" />
                    <p className="text-2xl font-bold">{showAdminDetails.stats?.users || 0}</p>
                    <p className="text-xs opacity-80">Users</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                  <CardContent className="p-4 text-center">
                    <Store className="w-6 h-6 mx-auto mb-1 opacity-80" />
                    <p className="text-2xl font-bold">{showAdminDetails.stats?.stores || 0}</p>
                    <p className="text-xs opacity-80">Stores</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                  <CardContent className="p-4 text-center">
                    <Package className="w-6 h-6 mx-auto mb-1 opacity-80" />
                    <p className="text-2xl font-bold">{showAdminDetails.stats?.items || 0}</p>
                    <p className="text-xs opacity-80">Items</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                  <CardContent className="p-4 text-center">
                    <Users className="w-6 h-6 mx-auto mb-1 opacity-80" />
                    <p className="text-2xl font-bold">{showAdminDetails.stats?.customers || 0}</p>
                    <p className="text-xs opacity-80">Customers</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white">
                  <CardContent className="p-4 text-center">
                    <ShoppingCart className="w-6 h-6 mx-auto mb-1 opacity-80" />
                    <p className="text-2xl font-bold">{showAdminDetails.stats?.sales || 0}</p>
                    <p className="text-xs opacity-80">Sales</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <CardContent className="p-4 text-center">
                    <CurrencyIcon className="w-6 h-6 mx-auto mb-1 opacity-80" />
                    <p className="text-xl font-bold">{formatCurrency(showAdminDetails.stats?.total_revenue || 0)}</p>
                    <p className="text-xs opacity-80">Revenue</p>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{showAdminDetails.stats?.invoices || 0}</p>
                      <p className="text-xs text-muted-foreground">Invoices</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{showAdminDetails.stats?.employees || 0}</p>
                      <p className="text-xs text-muted-foreground">Employees</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{showAdminDetails.admin?.created_at ? new Date(showAdminDetails.admin.created_at).toLocaleDateString() : 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">Member Since</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Users Management Section */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    User Management ({showAdminDetails.users?.length || 0} users)
                  </h4>
                  <Button size="sm" onClick={() => setShowCreateUserModal(true)} data-testid="add-user-btn">
                    <Plus className="w-4 h-4 mr-1" />
                    Add User
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {showAdminDetails.users?.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback>{u.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                          {u.role}
                        </Badge>
                        <Badge variant={u.is_active !== false ? 'outline' : 'destructive'} className="text-xs">
                          {u.is_active !== false ? 'Active' : 'Inactive'}
                        </Badge>
                        {u.role !== 'admin' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setShowEditUserModal({ ...u })}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShowResetPasswordModal(u)}>
                                <Key className="w-4 h-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                disabled={deletingUserId === u.id}
                              >
                                {deletingUserId === u.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4 mr-2" />
                                )}
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!showAdminDetails.users || showAdminDetails.users.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">No users found</p>
                  )}
                </div>
              </div>

              {/* Stores List */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Store className="w-5 h-5" />
                  Stores ({showAdminDetails.stores?.length || 0})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                  {showAdminDetails.stores?.map((store) => (
                    <div key={store.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                      <div>
                        <p className="font-medium text-sm">{store.name}</p>
                        <p className="text-xs text-muted-foreground">{store.address || 'No address'}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{store.code}</Badge>
                    </div>
                  ))}
                  {(!showAdminDetails.stores || showAdminDetails.stores.length === 0) && (
                    <p className="col-span-3 text-center text-muted-foreground py-2">No stores found</p>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => { setShowAdminDetails(null); handleImpersonate(showAdminDetails.admin); }}>
                  <LogIn className="w-4 h-4 mr-2" />
                  Login as Admin (God Mode)
                </Button>
                <Button 
                  variant={showAdminDetails.admin?.is_active ? 'destructive' : 'default'}
                  onClick={() => { handleToggleStatus(showAdminDetails.admin, !showAdminDetails.admin?.is_active); setShowAdminDetails(null); }}
                >
                  {showAdminDetails.admin?.is_active ? 'Deactivate Admin' : 'Activate Admin'}
                </Button>
                <Button variant="outline" onClick={() => setShowAdminDetails(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create User Modal */}
      <Dialog open={showCreateUserModal} onOpenChange={setShowCreateUserModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user for {showAdminDetails?.admin?.business_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                data-testid="new-user-name"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="User Name"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                data-testid="new-user-email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label>Password *</Label>
              <div className="relative">
                <Input
                  data-testid="new-user-password"
                  type={showUserPassword ? "text" : "password"}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Password (min 6 chars)"
                />
                <button
                  type="button"
                  onClick={() => setShowUserPassword(!showUserPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v })}>
                <SelectTrigger data-testid="new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUserModal(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={creatingUser} data-testid="submit-create-user">
              {creatingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!showEditUserModal} onOpenChange={() => setShowEditUserModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details for {showEditUserModal?.name}
            </DialogDescription>
          </DialogHeader>
          {showEditUserModal && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={showEditUserModal.name}
                  onChange={(e) => setShowEditUserModal({ ...showEditUserModal, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={showEditUserModal.email} disabled className="bg-accent/50" />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={showEditUserModal.role} onValueChange={(v) => setShowEditUserModal({ ...showEditUserModal, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Status</Label>
                <Select 
                  value={showEditUserModal.is_active !== false ? 'active' : 'inactive'} 
                  onValueChange={(v) => setShowEditUserModal({ ...showEditUserModal, is_active: v === 'active' })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditUserModal(null)}>Cancel</Button>
            <Button onClick={handleUpdateUser} disabled={updatingUser}>
              {updatingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={!!showResetPasswordModal} onOpenChange={() => setShowResetPasswordModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for {showResetPasswordModal?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showResetNewPassword ? "text" : "password"}
                  value={resetPasswordForm.new_password}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, new_password: e.target.value })}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showResetNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showResetConfirmPassword ? "text" : "password"}
                  value={resetPasswordForm.confirm_password}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showResetConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetPasswordModal(null); setResetPasswordForm({ new_password: '', confirm_password: '' }); }}>
              Cancel
            </Button>
            <Button onClick={handleResetUserPassword} disabled={updatingUser}>
              {updatingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Module Management Modal */}
      <Dialog open={!!showModuleModal} onOpenChange={() => { setShowModuleModal(null); setSelectedAdminModules(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Module Access Management
            </DialogTitle>
            {showModuleModal && (
              <DialogDescription>
                Configure module access for <strong>{showModuleModal.name}</strong> ({showModuleModal.business_name})
                <br />
                <Badge className="mt-1 capitalize">{selectedAdminModules?.plan || showModuleModal.plan || 'free'} Plan</Badge>
              </DialogDescription>
            )}
          </DialogHeader>
          
          {selectedAdminModules ? (
            <div className="space-y-6">
              {/* Plan Info */}
              <div className="p-4 rounded-lg bg-accent/50 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Plan: <strong className="capitalize">{selectedAdminModules.plan}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedAdminModules.plan_limits?.description}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleResetModules} disabled={savingModules}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset to Defaults
                </Button>
              </div>

              {/* Module Categories */}
              <div className="space-y-4">
                {Object.entries(selectedAdminModules.modules || {}).map(([catKey, category]) => (
                  <Card key={catKey}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {category.name}
                        <Badge variant="secondary" className="text-xs">
                          {Object.values(category.modules).filter(m => m.enabled && m.available).length} / {Object.values(category.modules).filter(m => m.available).length} enabled
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {Object.entries(category.modules).map(([moduleKey, module]) => (
                          <div
                            key={moduleKey}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              !module.available 
                                ? 'bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed' 
                                : module.enabled 
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
                                  : 'hover:bg-accent/50'
                            }`}
                            onClick={() => module.available && toggleModule(catKey, moduleKey)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{module.name}</span>
                              {module.available ? (
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                  module.enabled ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
                                }`}>
                                  {module.enabled && <Check className="w-3 h-3" />}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs">Upgrade</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{module.description}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowModuleModal(null); setSelectedAdminModules(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveModules} disabled={savingModules || !selectedAdminModules}>
              {savingModules && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Module Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Create/Edit Modal */}
      <Dialog open={!!showPlanModal} onOpenChange={() => { setShowPlanModal(null); resetPlanForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {showPlanModal === 'create' ? 'Create New Plan' : `Edit Plan: ${planForm.name}`}
            </DialogTitle>
            <DialogDescription>
              {showPlanModal === 'create' 
                ? 'Create a new subscription plan for your platform'
                : 'Update the plan details and features'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Plan ID *</Label>
                <Input
                  data-testid="plan-id-input"
                  value={planForm.id}
                  onChange={(e) => setPlanForm({ ...planForm, id: e.target.value })}
                  placeholder="e.g., premium"
                  disabled={showPlanModal !== 'create'}
                />
                <p className="text-xs text-muted-foreground mt-1">Unique identifier (lowercase, no spaces)</p>
              </div>
              <div>
                <Label>Plan Name *</Label>
                <Input
                  data-testid="plan-name-input"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="e.g., Premium"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Price</Label>
                <Input
                  type="number"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={planForm.currency} onValueChange={(v) => setPlanForm({ ...planForm, currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inr">INR (₹)</SelectItem>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="eur">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Billing Interval</Label>
                <Select value={planForm.interval} onValueChange={(v) => setPlanForm({ ...planForm, interval: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Limits */}
            <div>
              <Label className="mb-2 block">Plan Limits</Label>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">Stores</Label>
                  <Input
                    type="number"
                    value={planForm.limits.stores}
                    onChange={(e) => setPlanForm({ ...planForm, limits: { ...planForm.limits, stores: parseInt(e.target.value) || 0 } })}
                    placeholder="-1 for unlimited"
                  />
                </div>
                <div>
                  <Label className="text-xs">Products</Label>
                  <Input
                    type="number"
                    value={planForm.limits.products}
                    onChange={(e) => setPlanForm({ ...planForm, limits: { ...planForm.limits, products: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Users</Label>
                  <Input
                    type="number"
                    value={planForm.limits.users}
                    onChange={(e) => setPlanForm({ ...planForm, limits: { ...planForm.limits, users: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Sales/Month</Label>
                  <Input
                    type="number"
                    value={planForm.limits.sales_per_month}
                    onChange={(e) => setPlanForm({ ...planForm, limits: { ...planForm.limits, sales_per_month: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Customers</Label>
                  <Input
                    type="number"
                    value={planForm.limits.customers}
                    onChange={(e) => setPlanForm({ ...planForm, limits: { ...planForm.limits, customers: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Use -1 for unlimited</p>
            </div>

            {/* Features */}
            <div>
              <Label className="mb-2 block">Features</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="Add a feature (e.g., 'Priority Support')"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                />
                <Button type="button" onClick={addFeature} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {planForm.features.map((feature, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1">
                    {feature}
                    <button onClick={() => removeFeature(index)} className="ml-2 hover:text-red-500">
                      ×
                    </button>
                  </Badge>
                ))}
                {planForm.features.length === 0 && (
                  <p className="text-sm text-muted-foreground">No features added yet</p>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Trial Days</Label>
                <Input
                  type="number"
                  value={planForm.trial_days}
                  onChange={(e) => setPlanForm({ ...planForm, trial_days: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={planForm.is_active}
                  onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="is_popular"
                  checked={planForm.is_popular}
                  onChange={(e) => setPlanForm({ ...planForm, is_popular: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_popular">Mark as Popular</Label>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>Description (Optional)</Label>
              <Input
                value={planForm.description || ''}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder="Brief description of this plan"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPlanModal(null); resetPlanForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={showPlanModal === 'create' ? handleCreatePlan : handleUpdatePlan} 
              disabled={savingPlan}
              data-testid="save-plan-btn"
            >
              {savingPlan && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {showPlanModal === 'create' ? 'Create Plan' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Admin Plan Modal */}
      <Dialog open={!!showUpgradeModal} onOpenChange={() => setShowUpgradeModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Upgrade Admin Plan
            </DialogTitle>
            <DialogDescription>
              Manually upgrade this admin to a higher plan
            </DialogDescription>
          </DialogHeader>
          {showUpgradeModal && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-accent/50">
                <h4 className="font-medium">{showUpgradeModal.admin_name}</h4>
                <p className="text-sm text-muted-foreground">{showUpgradeModal.business_name}</p>
                <p className="text-xs text-muted-foreground">{showUpgradeModal.admin_email}</p>
              </div>
              
              <div className="flex items-center justify-center gap-4 py-4">
                <div className="text-center">
                  <Badge variant="secondary" className="mb-1">{showUpgradeModal.current_plan_name}</Badge>
                  <p className="text-xs text-muted-foreground">Current Plan</p>
                </div>
                <ArrowUpRight className="w-6 h-6 text-green-500" />
                <div className="text-center">
                  <Badge className="bg-green-100 text-green-700 mb-1">{showUpgradeModal.recommended_plan_name}</Badge>
                  <p className="text-xs text-muted-foreground">Recommended</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Select New Plan</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['basic', 'pro', 'enterprise'].map(planId => (
                    <Button
                      key={planId}
                      variant={planId === showUpgradeModal.recommended_plan ? 'default' : 'outline'}
                      className={`justify-start ${planId === showUpgradeModal.recommended_plan ? 'ring-2 ring-green-500' : ''}`}
                      disabled={planId === showUpgradeModal.current_plan || changingPlan}
                      onClick={() => handleChangePlan(showUpgradeModal.admin_id, planId)}
                    >
                      {(() => {
                        const Icon = PLAN_ICONS[planId];
                        return <Icon className="w-4 h-4 mr-2" />;
                      })()}
                      {planId.charAt(0).toUpperCase() + planId.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                This will immediately upgrade the admin&apos;s account without charging them.
                Use this for promotional upgrades or support cases.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeModal(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-500" />
              Super Admin Profile
            </DialogTitle>
            <DialogDescription>
              Update your login credentials
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current Info Display */}
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Current Email: <strong>{user?.email}</strong>
              </p>
            </div>
            
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="Your name"
              />
            </div>
            
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email (Login ID)</Label>
              <Input
                id="profile-email"
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                placeholder="your@email.com"
              />
            </div>
            
            <hr className="my-4" />
            
            <p className="text-sm font-medium">Change Password</p>
            
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showProfileCurrentPassword ? "text" : "password"}
                  value={profileForm.current_password}
                  onChange={(e) => setProfileForm({ ...profileForm, current_password: e.target.value })}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowProfileCurrentPassword(!showProfileCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showProfileCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showProfileNewPassword ? "text" : "password"}
                  value={profileForm.new_password}
                  onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })}
                  placeholder="Enter new password (min 8 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowProfileNewPassword(!showProfileNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showProfileNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showProfileConfirmPassword ? "text" : "password"}
                  value={profileForm.confirm_password}
                  onChange={(e) => setProfileForm({ ...profileForm, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowProfileConfirmPassword(!showProfileConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showProfileConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Note: If you change your email or password, you will be logged out and need to login again with your new credentials.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProfile} disabled={updatingProfile}>
              {updatingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Modal */}
      <Dialog open={showBackupCodesModal} onOpenChange={setShowBackupCodesModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" />
              Backup Recovery Codes
            </DialogTitle>
            <DialogDescription>
              Use these codes to recover access if you forget your password
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Status */}
            {backupCodesStatus && (
              <div className="p-3 rounded-lg bg-accent/50">
                <div className="flex justify-between text-sm">
                  <span>Total Codes:</span>
                  <strong>{backupCodesStatus.total_codes}</strong>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Unused:</span>
                  <strong className="text-green-600">{backupCodesStatus.unused_codes}</strong>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Used:</span>
                  <strong className="text-red-600">{backupCodesStatus.used_codes}</strong>
                </div>
              </div>
            )}
            
            {/* Generated Codes Display */}
            {backupCodes.length > 0 && (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-300">
                  <p className="text-sm text-amber-800 font-medium mb-2">
                    ⚠️ Save these codes NOW! They won&apos;t be shown again.
                  </p>
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {backupCodes.map((code, idx) => (
                      <div key={idx} className="p-2 bg-white rounded border text-center">
                        {code}
                      </div>
                    ))}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3"
                    onClick={() => {
                      navigator.clipboard.writeText(backupCodes.join('\n'));
                      toast.success('Codes copied to clipboard');
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy All Codes
                  </Button>
                </div>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Each code can only be used once. Store them in a secure place like a password manager.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBackupCodesModal(false); setBackupCodes([]); }}>
              Close
            </Button>
            <Button onClick={generateBackupCodes} disabled={generatingCodes} className="bg-amber-600 hover:bg-amber-700">
              {generatingCodes ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Generate New Codes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* God Mode Modal */}
      <Dialog open={showGodModeModal} onOpenChange={setShowGodModeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Skull className="w-5 h-5" />
              God Mode - Emergency Actions
            </DialogTitle>
            <DialogDescription>
              ⚠️ These actions are logged and should only be used in emergencies
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-800">
                All actions are permanently logged to the audit trail.
              </p>
            </div>
            
            {/* Action Selection */}
            <div className="space-y-2">
              <Label>Select Action</Label>
              <Select value={godModeAction} onValueChange={setGodModeAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an emergency action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reset_password">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Reset User Password
                    </div>
                  </SelectItem>
                  <SelectItem value="force_logout">
                    <div className="flex items-center gap-2">
                      <Power className="w-4 h-4" />
                      Force Logout Sessions
                    </div>
                  </SelectItem>
                  <SelectItem value="freeze_tenant">
                    <div className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      Freeze Tenant
                    </div>
                  </SelectItem>
                  <SelectItem value="unfreeze_tenant">
                    <div className="flex items-center gap-2">
                      <Unlock className="w-4 h-4 text-green-500" />
                      Unfreeze Tenant
                    </div>
                  </SelectItem>
                  <SelectItem value="impersonate">
                    <div className="flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-purple-500" />
                      Impersonate User
                    </div>
                  </SelectItem>
                  <SelectItem value="change_role">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      Change User Role
                    </div>
                  </SelectItem>
                  <SelectItem value="generate_backup_codes">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-amber-500" />
                      Generate Backup Codes
                    </div>
                  </SelectItem>
                  <SelectItem value="delete_tenant_data">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-red-600" />
                      Delete Tenant Data (DANGER!)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Target Input */}
            {godModeAction && !['force_logout', 'system_health'].includes(godModeAction) && (
              <div className="space-y-2">
                <Label>
                  {['reset_password', 'impersonate', 'change_role', 'generate_backup_codes'].includes(godModeAction) ? 'User ID' : 'Tenant ID'}
                </Label>
                <Input
                  value={godModeTarget}
                  onChange={(e) => setGodModeTarget(e.target.value)}
                  placeholder={['reset_password', 'impersonate', 'change_role', 'generate_backup_codes'].includes(godModeAction) ? 'Enter user ID' : 'Enter tenant ID'}
                />
              </div>
            )}
            
            {/* Role selector for change_role */}
            {godModeAction === 'change_role' && (
              <div className="space-y-2">
                <Label>New Role</Label>
                <Select value={godModeNewRole} onValueChange={setGodModeNewRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="viewer">Viewer (Read-Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Password for reset */}
            {godModeAction === 'reset_password' && (
              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showGodModePassword ? "text" : "password"}
                    value={godModePassword}
                    onChange={(e) => setGodModePassword(e.target.value)}
                    placeholder="Enter new password (min 8 chars)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGodModePassword(!showGodModePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showGodModePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            
            {godModeAction === 'force_logout' && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800">
                  Leave target empty to logout ALL users (except Super Admin)
                </p>
                <Input
                  className="mt-2"
                  value={godModeTarget}
                  onChange={(e) => setGodModeTarget(e.target.value)}
                  placeholder="Optional: User ID or leave empty for all"
                />
              </div>
            )}
            
            {/* Delete confirmation */}
            {godModeAction === 'delete_tenant_data' && (
              <div className="p-3 rounded-lg bg-red-100 border border-red-300">
                <p className="text-sm text-red-800 font-medium mb-2">⚠️ DANGER ZONE</p>
                <p className="text-xs text-red-700 mb-3">This will permanently delete ALL data for the tenant including users, customers, sales, inventory, and settings. This action CANNOT be undone!</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={godModeConfirmDelete}
                    onChange={(e) => setGodModeConfirmDelete(e.target.checked)}
                    className="w-4 h-4 text-red-600"
                  />
                  <span className="text-sm text-red-800 font-medium">I understand this is permanent and want to proceed</span>
                </label>
              </div>
            )}
            
            {/* Generated backup codes display */}
            {generatedBackupCodes.length > 0 && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-300">
                <p className="text-sm text-green-800 font-medium mb-3">✅ Backup Codes Generated</p>
                <p className="text-xs text-green-700 mb-3">Share these codes securely with the user. They won&apos;t be shown again!</p>
                <div className="grid grid-cols-2 gap-2">
                  {generatedBackupCodes.map((code, idx) => (
                    <div key={idx} className="font-mono text-sm bg-white px-3 py-2 rounded border text-center">
                      {code}
                    </div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  className="mt-3 w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedBackupCodes.join('\n'));
                    toast.success('Codes copied to clipboard');
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" /> Copy All Codes
                </Button>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowGodModeModal(false); resetGodModeForm(); }}>
              {generatedBackupCodes.length > 0 ? 'Close' : 'Cancel'}
            </Button>
            {generatedBackupCodes.length === 0 && (
              <Button 
                onClick={executeGodModeAction} 
                disabled={executingGodMode || !godModeAction}
                className={godModeAction === 'delete_tenant_data' ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'}
              >
                {executingGodMode ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Skull className="w-4 h-4 mr-2" />
                    {godModeAction === 'delete_tenant_data' ? 'DELETE ALL DATA' : 'Execute Action'}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
