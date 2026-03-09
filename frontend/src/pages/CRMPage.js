import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { usePermissions } from '../contexts/PermissionContext';
import { ReadOnlyBanner, ActionGuard } from '../components/RBACComponents';
import { toast } from 'sonner';
import { 
  Heart, Users, UserPlus, Search, Filter, Mail, Phone, MapPin,
  Calendar, DollarSign, ShoppingCart, Star, Tag, MessageSquare,
  Plus, Edit, Trash2, RefreshCw, ChevronDown, ChevronUp, Eye,
  Gift, Award, TrendingUp, Clock, CheckCircle, AlertCircle, Send, MoreVertical,
  MessageCircle, Settings, Zap, History, Bell, CheckCheck, X, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';

import { useCurrency } from '../contexts/CurrencyContext';
// Customer segments
const CUSTOMER_SEGMENTS = {
  vip: { label: 'VIP', color: 'bg-amber-500', minSpend: 50000 },
  loyal: { label: 'Loyal', color: 'bg-purple-500', minSpend: 20000 },
  regular: { label: 'Regular', color: 'bg-blue-500', minSpend: 5000 },
  new: { label: 'New', color: 'bg-green-500', minSpend: 0 },
  inactive: { label: 'Inactive', color: 'bg-gray-500', minSpend: -1 },
};

// Message template types
const MESSAGE_TEMPLATES = {
  payment_reminder: { label: 'Payment Reminder', icon: DollarSign, color: 'text-red-500' },
  order_update: { label: 'Order Update', icon: ShoppingCart, color: 'text-blue-500' },
  promotional: { label: 'Promotional', icon: Gift, color: 'text-purple-500' },
  custom: { label: 'Custom Message', icon: MessageSquare, color: 'text-green-500' },
};

export default function CRMPage() {
  const { currencySymbol } = useCurrency();
  const { api, user } = useAuth();
  const { isReadOnly, canPerformAction } = usePermissions();
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  // FIX: avoid `useState(null)` to prevent mount/unmount flashes in modals/conditional UI.
  // Use a stable default object and track validity via an explicit boolean.
  const EMPTY_CUSTOMER = { id: null };
  const [selectedCustomer, setSelectedCustomer] = useState(EMPTY_CUSTOMER);
  const hasSelectedCustomer = selectedCustomer?.id != null;

  const [saving, setSaving] = useState(false);

  // WhatsApp states
  // FIX: keep a stable object shape instead of null to avoid conditional rendering flashes.
  const EMPTY_WHATSAPP_CONFIG = { api_endpoint: '', default_campaign_name: '', is_enabled: false };
  const [whatsappConfig, setWhatsappConfig] = useState(EMPTY_WHATSAPP_CONFIG);
  const hasWhatsappConfig = Boolean(whatsappConfig && whatsappConfig.api_endpoint);

  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [whatsappStats, setWhatsappStats] = useState({ total: 0, sent: 0, delivered: 0, failed: 0, today: 0 });
  const [messageHistory, setMessageHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    tags: [],
    notes: '',
    birthday: '',
    // Vehicle details (optional)
    vehicle_number: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: '',
    // Insurance details (optional)
    insurance_company: '',
    insurance_policy_number: '',
    insurance_expiry: '',
    registration_expiry: '',
  });

  const [noteForm, setNoteForm] = useState({
    note: '',
    type: 'general',
  });

  const [messageForm, setMessageForm] = useState({
    template_type: 'custom',
    campaign_name: '',
    template_name: '',
    message_content: '',
  });

  const [configForm, setConfigForm] = useState({
    api_endpoint: 'https://backend.aisensy.com/campaign/t1/api/v2',
    api_key: '',
    default_campaign_name: '',
    is_enabled: true,
  });

  useEffect(() => {
    fetchData();
    fetchWhatsAppData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customersData, sales] = await Promise.all([
        api('/api/customers').catch(() => []),
        api('/api/sales').catch(() => []),
      ]);

      // Enhance customers with sales analytics
      const enhancedCustomers = customersData.map(customer => {
        const customerSales = sales.filter(s => s.customer_id === customer.id);
        const totalSpend = customerSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
        const orderCount = customerSales.length;
        const lastOrder = customerSales.sort((a, b) => 
          new Date(b.sale_date || b.created_at) - new Date(a.sale_date || a.created_at)
        )[0];
        const avgOrderValue = orderCount > 0 ? totalSpend / orderCount : 0;

        // Determine segment
        let segment = 'new';
        const daysSinceLastOrder = lastOrder 
          ? Math.floor((new Date() - new Date(lastOrder.sale_date || lastOrder.created_at)) / (1000 * 60 * 60 * 24))
          : 999;

        if (daysSinceLastOrder > 90) segment = 'inactive';
        else if (totalSpend >= 50000) segment = 'vip';
        else if (totalSpend >= 20000) segment = 'loyal';
        else if (totalSpend >= 5000) segment = 'regular';

        return {
          ...customer,
          totalSpend,
          orderCount,
          avgOrderValue,
          lastOrderDate: lastOrder?.sale_date || lastOrder?.created_at,
          daysSinceLastOrder,
          segment,
          loyaltyPoints: customer.loyalty_points || 0,
        };
      });

      setCustomers(enhancedCustomers);
      setSalesData(sales);
    } catch (err) {
      toast.error('Failed to load CRM data');
    } finally {
      setLoading(false);
    }
  };

  const fetchWhatsAppData = async () => {
    try {
      const [config, stats, historyData, templatesData, triggersData] = await Promise.all([
        api('/api/whatsapp/config').catch(() => null),
        api('/api/whatsapp/stats').catch(() => ({ total: 0, sent: 0, delivered: 0, failed: 0, today: 0 })),
        api('/api/whatsapp/messages?limit=20').catch(() => []),
        api('/api/whatsapp/templates').catch(() => []),
        api('/api/whatsapp/triggers').catch(() => []),
      ]);

      setWhatsappConfig(config);
      setWhatsappStats(stats);
      setMessageHistory(historyData);
      setTemplates(templatesData);
      setTriggers(triggersData);

      if (config) {
        setConfigForm({
          api_endpoint: config.api_endpoint || 'https://backend.aisensy.com/campaign/t1/api/v2',
          api_key: '',
          default_campaign_name: config.default_campaign_name || '',
          is_enabled: config.is_enabled !== false,
        });
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp data', err);
    }
  };

  const openCreateCustomer = () => {
    setCustomerForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      tags: [],
      notes: '',
      birthday: '',
    });
    setSelectedCustomer(null);
    setShowCustomerModal(true);
  };

  const openEditCustomer = (customer) => {
    setCustomerForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      tags: customer.tags || [],
      notes: customer.notes || '',
      birthday: customer.birthday || '',
      // Vehicle details
      vehicle_number: customer.vehicle_number || '',
      vehicle_make: customer.vehicle_make || '',
      vehicle_model: customer.vehicle_model || '',
      vehicle_year: customer.vehicle_year || '',
      // Insurance details
      insurance_company: customer.insurance_company || '',
      insurance_policy_number: customer.insurance_policy_number || '',
      insurance_expiry: customer.insurance_expiry || '',
      registration_expiry: customer.registration_expiry || '',
    });
    setSelectedCustomer(customer);
    setShowCustomerModal(true);
  };

  const openViewCustomer = (customer) => {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  };

  const handleDeleteCustomer = async (customer) => {
    if (!window.confirm(`Are you sure you want to delete customer "${customer.name}"? This action cannot be undone.`)) return;
    try {
      await api(`/api/customers/${customer.id}`, { method: 'DELETE' });
      toast.success('Customer deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete customer');
    }
  };

  const saveCustomer = async () => {
    if (!customerForm.name) {
      toast.error('Customer name is required');
      return;
    }

    setSaving(true);
    try {
      if (selectedCustomer) {
        await api(`/api/customers/${selectedCustomer.id}`, {
          method: 'PUT',
          body: JSON.stringify(customerForm),
        });
        toast.success('Customer updated');
      } else {
        await api('/api/customers', {
          method: 'POST',
          body: JSON.stringify(customerForm),
        });
        toast.success('Customer created');
      }
      setShowCustomerModal(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!selectedCustomer || !noteForm.note) return;

    setSaving(true);
    try {
      const existingNotes = selectedCustomer.crm_notes || [];
      const newNote = {
        id: Date.now().toString(),
        note: noteForm.note,
        type: noteForm.type,
        created_at: new Date().toISOString(),
      };

      await api(`/api/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          crm_notes: [...existingNotes, newNote],
        }),
      });

      toast.success('Note added');
      setShowNoteModal(false);
      setNoteForm({ note: '', type: 'general' });
      fetchData();
    } catch (err) {
      toast.error('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  // WhatsApp functions
  const openWhatsAppModal = (customer) => {
    setSelectedCustomer(customer);
    setMessageForm({
      template_type: 'custom',
      campaign_name: whatsappConfig?.default_campaign_name || 'crm_campaign',
      template_name: 'custom_template',
      message_content: '',
    });
    setShowWhatsAppModal(true);
  };

  const sendWhatsAppMessage = async () => {
    if (!selectedCustomer?.phone) {
      toast.error('Customer has no phone number');
      return;
    }

    if (!whatsappConfig?.is_configured) {
      toast.error('WhatsApp is not configured. Please add your AI Sensy API key in settings.');
      return;
    }

    setSendingMessage(true);
    try {
      const result = await api('/api/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          phone_number: selectedCustomer.phone,
          customer_name: selectedCustomer.name,
          campaign_name: messageForm.campaign_name,
          template_name: messageForm.template_name,
          template_params: [],
          tags: [messageForm.template_type],
          attributes: {}
        }),
      });

      toast.success('WhatsApp message sent successfully!');
      setShowWhatsAppModal(false);
      fetchWhatsAppData();
    } catch (err) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const sendBulkMessages = async () => {
    if (selectedCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    if (!whatsappConfig?.is_configured) {
      toast.error('WhatsApp is not configured. Please add your AI Sensy API key in settings.');
      return;
    }

    setSendingMessage(true);
    try {
      const result = await api('/api/whatsapp/send-bulk', {
        method: 'POST',
        body: JSON.stringify({
          customer_ids: selectedCustomers,
          campaign_name: messageForm.campaign_name,
          template_name: messageForm.template_name,
          template_type: messageForm.template_type,
          message_content: messageForm.message_content,
        }),
      });

      toast.success(`Sent ${result.successful} messages, ${result.failed} failed`);
      setShowBulkModal(false);
      setSelectedCustomers([]);
      fetchWhatsAppData();
    } catch (err) {
      toast.error(err.message || 'Failed to send bulk messages');
    } finally {
      setSendingMessage(false);
    }
  };

  const saveWhatsAppConfig = async () => {
    if (!configForm.api_key && !whatsappConfig?.is_configured) {
      toast.error('API key is required');
      return;
    }

    setSaving(true);
    try {
      await api('/api/whatsapp/config', {
        method: 'PUT',
        body: JSON.stringify(configForm),
      });

      toast.success('WhatsApp configuration saved');
      setShowConfigModal(false);
      fetchWhatsAppData();
    } catch (err) {
      toast.error(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setSaving(true);
    try {
      const result = await api('/api/whatsapp/test-connection', { method: 'POST' });
      if (result.success) {
        toast.success(result.message || 'Connection successful!');
      } else {
        toast.error(result.error || 'Connection failed');
      }
    } catch (err) {
      toast.error(err.message || 'Connection test failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleCustomerSelection = (customerId) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const selectAllCustomers = () => {
    const eligibleCustomers = filteredCustomers.filter(c => c.phone);
    if (selectedCustomers.length === eligibleCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(eligibleCustomers.map(c => c.id));
    }
  };

  // Filter customers
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm);
    const matchesSegment = segmentFilter === 'all' || c.segment === segmentFilter;
    return matchesSearch && matchesSegment;
  });

  // Calculate stats
  const stats = {
    total: customers.length,
    vip: customers.filter(c => c.segment === 'vip').length,
    loyal: customers.filter(c => c.segment === 'loyal').length,
    inactive: customers.filter(c => c.segment === 'inactive').length,
    totalRevenue: customers.reduce((sum, c) => sum + c.totalSpend, 0),
    avgLifetimeValue: customers.length > 0 
      ? customers.reduce((sum, c) => sum + c.totalSpend, 0) / customers.length 
      : 0,
    withPhone: customers.filter(c => c.phone).length,
  };

  const formatCurrency = (amount) => `${currencySymbol}${(amount || 0).toLocaleString('en-IN')}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="crm-page">
      {/* Read-Only Banner for Viewers */}
      <ReadOnlyBanner module="CRM" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="w-6 h-6 text-primary" />
            Customer Relationship Management
          </h1>
          <p className="text-muted-foreground">Manage customer relationships and WhatsApp communication</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          {canPerformAction('crm', 'edit') && (
            <Button variant="outline" onClick={() => setShowConfigModal(true)} data-testid="whatsapp-settings-btn">
              <Settings className="w-4 h-4 mr-2" /> WhatsApp Settings
            </Button>
          )}
          {canPerformAction('customers', 'create') && (
            <Button onClick={openCreateCustomer} className="bg-primary">
              <UserPlus className="w-4 h-4 mr-2" /> Add Customer
            </Button>
          )}
        </div>
      </div>

      {/* WhatsApp Status Banner */}
      {!whatsappConfig?.is_configured && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">WhatsApp Not Configured</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">Add your AI Sensy API key to enable WhatsApp messaging</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setShowConfigModal(true)} className="border-amber-500 text-amber-700">
                Configure Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Customers
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="w-4 h-4" /> Automation
          </TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50">
              <CardContent className="pt-4 pb-4">
                <Users className="w-6 h-6 text-blue-600 mb-2" />
                <p className="text-xs text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
              <CardContent className="pt-4 pb-4">
                <Award className="w-6 h-6 text-amber-600 mb-2" />
                <p className="text-xs text-muted-foreground">VIP Customers</p>
                <p className="text-2xl font-bold text-amber-600">{stats.vip}</p>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
              <CardContent className="pt-4 pb-4">
                <Star className="w-6 h-6 text-purple-600 mb-2" />
                <p className="text-xs text-muted-foreground">Loyal Customers</p>
                <p className="text-2xl font-bold text-purple-600">{stats.loyal}</p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50">
              <CardContent className="pt-4 pb-4">
                <Clock className="w-6 h-6 text-gray-600 mb-2" />
                <p className="text-xs text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
              <CardContent className="pt-4 pb-4">
                <DollarSign className="w-6 h-6 text-emerald-600 mb-2" />
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.totalRevenue)}</p>
              </CardContent>
            </Card>

            <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
              <CardContent className="pt-4 pb-4">
                <TrendingUp className="w-6 h-6 text-rose-600 mb-2" />
                <p className="text-xs text-muted-foreground">Avg Lifetime Value</p>
                <p className="text-lg font-bold text-rose-600">{formatCurrency(stats.avgLifetimeValue)}</p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardContent className="pt-4 pb-4">
                <Phone className="w-6 h-6 text-green-600 mb-2" />
                <p className="text-xs text-muted-foreground">With Phone</p>
                <p className="text-2xl font-bold text-green-600">{stats.withPhone}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Bulk Actions */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-44">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Segments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Segments</SelectItem>
                  {Object.entries(CUSTOMER_SEGMENTS).map(([key, seg]) => (
                    <SelectItem key={key} value={key}>{seg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCustomers.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedCustomers.length} selected</Badge>
                <Button 
                  onClick={() => {
                    setMessageForm({
                      template_type: 'custom',
                      campaign_name: whatsappConfig?.default_campaign_name || 'crm_campaign',
                      template_name: 'custom_template',
                      message_content: '',
                    });
                    setShowBulkModal(true);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="bulk-whatsapp-btn"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Send WhatsApp ({selectedCustomers.length})
                </Button>
                <Button variant="outline" onClick={() => setSelectedCustomers([])}>
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Customer List */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-10 p-4">
                        <Checkbox
                          checked={selectedCustomers.length > 0 && selectedCustomers.length === filteredCustomers.filter(c => c.phone).length}
                          onCheckedChange={selectAllCustomers}
                        />
                      </th>
                      <th className="text-left p-4 font-medium">Customer</th>
                      <th className="text-left p-4 font-medium">Contact</th>
                      <th className="text-left p-4 font-medium">Segment</th>
                      <th className="text-right p-4 font-medium">Total Spend</th>
                      <th className="text-center p-4 font-medium">Orders</th>
                      <th className="text-left p-4 font-medium">Last Order</th>
                      <th className="text-center p-4 font-medium">Points</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No customers found</p>
                          <Button variant="link" onClick={openCreateCustomer}>
                            Add your first customer
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((customer) => {
                        const segment = CUSTOMER_SEGMENTS[customer.segment] || CUSTOMER_SEGMENTS.new;
                        
                        return (
                          <tr key={customer.id} className="border-t hover:bg-muted/30 transition-colors">
                            <td className="p-4">
                              {customer.phone && (
                                <Checkbox
                                  checked={selectedCustomers.includes(customer.id)}
                                  onCheckedChange={() => toggleCustomerSelection(customer.id)}
                                />
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${segment.color}`}>
                                  {customer.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                  <p className="font-medium">{customer.name}</p>
                                  {customer.tags?.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                      {customer.tags.slice(0, 2).map((tag, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {customer.email && (
                                <p className="text-sm flex items-center gap-1">
                                  <Mail className="w-3 h-3" /> {customer.email}
                                </p>
                              )}
                              {customer.phone && (
                                <p className="text-sm flex items-center gap-1 text-muted-foreground">
                                  <Phone className="w-3 h-3" /> {customer.phone}
                                </p>
                              )}
                            </td>
                            <td className="p-4">
                              <Badge className={`${segment.color} text-white`}>
                                {segment.label}
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-semibold text-emerald-600">
                              {formatCurrency(customer.totalSpend)}
                            </td>
                            <td className="p-4 text-center">
                              <span className="font-medium">{customer.orderCount}</span>
                            </td>
                            <td className="p-4">
                              {customer.lastOrderDate ? (
                                <div>
                                  <p className="text-sm">{customer.lastOrderDate?.split('T')[0]}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {customer.daysSinceLastOrder} days ago
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No orders</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <Gift className="w-3 h-3 mr-1" />
                                {customer.loyaltyPoints}
                              </Badge>
                            </td>
                            <td className="p-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`crm-actions-${customer.id}`}>
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl w-52">
                                  <DropdownMenuItem onClick={() => openViewCustomer(customer)} className="rounded-lg">
                                    <Eye className="w-4 h-4 mr-2" /> View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditCustomer(customer)} className="rounded-lg">
                                    <Edit className="w-4 h-4 mr-2" /> Edit Customer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedCustomer(customer); setShowNoteModal(true); }} className="rounded-lg">
                                    <MessageSquare className="w-4 h-4 mr-2" /> Add Note
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {customer.phone && (
                                    <DropdownMenuItem 
                                      onClick={() => openWhatsAppModal(customer)} 
                                      className="rounded-lg text-green-600"
                                      data-testid={`send-whatsapp-${customer.id}`}
                                    >
                                      <MessageCircle className="w-4 h-4 mr-2" /> Send WhatsApp
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteCustomer(customer)} className="rounded-lg text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Customer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-6">
          {/* WhatsApp Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardContent className="pt-4 pb-4">
                <MessageCircle className="w-6 h-6 text-green-600 mb-2" />
                <p className="text-xs text-muted-foreground">Total Messages</p>
                <p className="text-2xl font-bold text-green-600">{whatsappStats.total}</p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50">
              <CardContent className="pt-4 pb-4">
                <Send className="w-6 h-6 text-blue-600 mb-2" />
                <p className="text-xs text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold text-blue-600">{whatsappStats.sent}</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
              <CardContent className="pt-4 pb-4">
                <CheckCheck className="w-6 h-6 text-emerald-600 mb-2" />
                <p className="text-xs text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold text-emerald-600">{whatsappStats.delivered}</p>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
              <CardContent className="pt-4 pb-4">
                <X className="w-6 h-6 text-red-600 mb-2" />
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{whatsappStats.failed}</p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
              <CardContent className="pt-4 pb-4">
                <Calendar className="w-6 h-6 text-amber-600 mb-2" />
                <p className="text-xs text-muted-foreground">Today</p>
                <p className="text-2xl font-bold text-amber-600">{whatsappStats.today}</p>
              </CardContent>
            </Card>
          </div>

          {/* Message History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Messages
              </CardTitle>
              <CardDescription>Last 20 WhatsApp messages sent from CRM</CardDescription>
            </CardHeader>
            <CardContent>
              {messageHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No messages sent yet</p>
                  <p className="text-sm">Send your first WhatsApp message to a customer</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messageHistory.map((msg, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          msg.status === 'sent' ? 'bg-blue-100 text-blue-600' :
                          msg.status === 'delivered' ? 'bg-green-100 text-green-600' :
                          msg.status === 'failed' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{msg.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{msg.phone_number}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          msg.status === 'sent' ? 'default' :
                          msg.status === 'delivered' ? 'success' :
                          msg.status === 'failed' ? 'destructive' :
                          'secondary'
                        }>
                          {msg.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(msg.sent_at || msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Automated Triggers
                  </CardTitle>
                  <CardDescription>Set up automatic WhatsApp messages based on triggers</CardDescription>
                </div>
                <Button disabled className="opacity-50">
                  <Plus className="w-4 h-4 mr-2" /> Add Trigger (Coming Soon)
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { type: 'payment_due', name: 'Payment Reminder', description: 'Send reminder when payment is due', icon: DollarSign, color: 'bg-red-100 text-red-600' },
                  { type: 'order_update', name: 'Order Status Update', description: 'Notify on order status changes', icon: ShoppingCart, color: 'bg-blue-100 text-blue-600' },
                  { type: 'birthday', name: 'Birthday Wishes', description: 'Send wishes on customer birthday', icon: Gift, color: 'bg-purple-100 text-purple-600' },
                  { type: 'follow_up', name: 'Follow-up Message', description: 'Follow up after purchase', icon: Clock, color: 'bg-amber-100 text-amber-600' },
                ].map((trigger) => (
                  <Card key={trigger.type} className="border-dashed">
                    <CardContent className="pt-6">
                      <div className={`w-12 h-12 rounded-lg ${trigger.color} flex items-center justify-center mb-4`}>
                        <trigger.icon className="w-6 h-6" />
                      </div>
                      <h4 className="font-semibold">{trigger.name}</h4>
                      <p className="text-sm text-muted-foreground mb-4">{trigger.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Not Active</Badge>
                        <Button variant="ghost" size="sm" disabled>
                          Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Automated triggers require pre-approved WhatsApp templates in your AI Sensy account
              </p>
            </CardContent>
          </Card>

          {/* Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Message Templates
              </CardTitle>
              <CardDescription>Pre-approved templates from your AI Sensy account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {templates.map((template, idx) => {
                  const templateInfo = MESSAGE_TEMPLATES[template.template_type] || MESSAGE_TEMPLATES.custom;
                  const Icon = templateInfo.icon;
                  return (
                    <Card key={idx} className="bg-muted/30">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className={`w-5 h-5 ${templateInfo.color}`} />
                          <span className="font-medium">{template.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                        <Badge variant="outline" className="mt-2">{template.template_name}</Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Customer Modal */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              {selectedCustomer ? 'Edit Customer' : 'Add Customer'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Customer name"
                value={customerForm.name}
                onChange={(e) => setCustomerForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="Email address"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm(p => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone (for WhatsApp)</Label>
                <Input
                  placeholder="+91XXXXXXXXXX"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                placeholder="Customer address"
                value={customerForm.address}
                onChange={(e) => setCustomerForm(p => ({ ...p, address: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Birthday</Label>
              <Input
                type="date"
                value={customerForm.birthday}
                onChange={(e) => setCustomerForm(p => ({ ...p, birthday: e.target.value }))}
              />
            </div>

            {/* Vehicle Details - Optional */}
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Vehicle Details (Optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle Number</Label>
                  <Input
                    placeholder="e.g., MH12AB1234"
                    value={customerForm.vehicle_number}
                    onChange={(e) => setCustomerForm(p => ({ ...p, vehicle_number: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Make</Label>
                  <Input
                    placeholder="e.g., Maruti, Honda"
                    value={customerForm.vehicle_make}
                    onChange={(e) => setCustomerForm(p => ({ ...p, vehicle_make: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    placeholder="e.g., Swift, City"
                    value={customerForm.vehicle_model}
                    onChange={(e) => setCustomerForm(p => ({ ...p, vehicle_model: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input
                    placeholder="e.g., 2022"
                    value={customerForm.vehicle_year}
                    onChange={(e) => setCustomerForm(p => ({ ...p, vehicle_year: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Insurance Details - Optional */}
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Insurance Details (Optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insurance Company</Label>
                  <Input
                    placeholder="e.g., ICICI Lombard"
                    value={customerForm.insurance_company}
                    onChange={(e) => setCustomerForm(p => ({ ...p, insurance_company: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Policy Number</Label>
                  <Input
                    placeholder="Policy number"
                    value={customerForm.insurance_policy_number}
                    onChange={(e) => setCustomerForm(p => ({ ...p, insurance_policy_number: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Insurance Expiry</Label>
                  <Input
                    type="date"
                    value={customerForm.insurance_expiry}
                    onChange={(e) => setCustomerForm(p => ({ ...p, insurance_expiry: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Registration Expiry</Label>
                  <Input
                    type="date"
                    value={customerForm.registration_expiry}
                    onChange={(e) => setCustomerForm(p => ({ ...p, registration_expiry: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Internal notes about this customer..."
                value={customerForm.notes}
                onChange={(e) => setCustomerForm(p => ({ ...p, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomerModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveCustomer} disabled={saving} className="bg-primary">
              {saving ? 'Saving...' : selectedCustomer ? 'Update' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Modal */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Add CRM Note
            </DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedCustomer.name}</p>
                <p className="text-sm text-muted-foreground">{selectedCustomer.email}</p>
              </div>

              <div className="space-y-2">
                <Label>Note Type</Label>
                <Select value={noteForm.type} onValueChange={(v) => setNoteForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="complaint">Complaint</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Note *</Label>
                <Textarea
                  placeholder="Enter your note..."
                  value={noteForm.note}
                  onChange={(e) => setNoteForm(p => ({ ...p, note: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteModal(false)}>
              Cancel
            </Button>
            <Button onClick={addNote} disabled={saving || !noteForm.note} className="bg-primary">
              {saving ? 'Adding...' : 'Add Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Customer Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Customer Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold ${CUSTOMER_SEGMENTS[selectedCustomer.segment]?.color || 'bg-gray-500'}`}>
                  {selectedCustomer.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedCustomer.name}</h3>
                  <Badge className={`${CUSTOMER_SEGMENTS[selectedCustomer.segment]?.color || 'bg-gray-500'} text-white mt-1`}>
                    {CUSTOMER_SEGMENTS[selectedCustomer.segment]?.label || 'Unknown'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p>
                  <p className="font-medium">{selectedCustomer.email || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</p>
                  <p className="font-medium">{selectedCustomer.phone || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 bg-accent rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total Spend</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedCustomer.totalSpend)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Orders</p>
                  <p className="text-xl font-bold">{selectedCustomer.orderCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Avg. Order</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedCustomer.avgOrderValue)}</p>
                </div>
              </div>

              {/* Vehicle Details */}
              {(selectedCustomer.vehicle_number || selectedCustomer.vehicle_make) && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Vehicle Details</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedCustomer.vehicle_number && (
                      <div>
                        <p className="text-xs text-muted-foreground">Vehicle Number</p>
                        <p className="font-medium">{selectedCustomer.vehicle_number}</p>
                      </div>
                    )}
                    {selectedCustomer.vehicle_make && (
                      <div>
                        <p className="text-xs text-muted-foreground">Make/Model</p>
                        <p className="font-medium">{selectedCustomer.vehicle_make} {selectedCustomer.vehicle_model} {selectedCustomer.vehicle_year && `(${selectedCustomer.vehicle_year})`}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Insurance Details */}
              {(selectedCustomer.insurance_company || selectedCustomer.insurance_expiry) && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Insurance Details</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedCustomer.insurance_company && (
                      <div>
                        <p className="text-xs text-muted-foreground">Company</p>
                        <p className="font-medium">{selectedCustomer.insurance_company}</p>
                      </div>
                    )}
                    {selectedCustomer.insurance_policy_number && (
                      <div>
                        <p className="text-xs text-muted-foreground">Policy Number</p>
                        <p className="font-medium">{selectedCustomer.insurance_policy_number}</p>
                      </div>
                    )}
                    {selectedCustomer.insurance_expiry && (
                      <div>
                        <p className="text-xs text-muted-foreground">Insurance Expiry</p>
                        <p className={`font-medium ${new Date(selectedCustomer.insurance_expiry) < new Date() ? 'text-red-600' : ''}`}>
                          {new Date(selectedCustomer.insurance_expiry).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {selectedCustomer.registration_expiry && (
                      <div>
                        <p className="text-xs text-muted-foreground">Registration Expiry</p>
                        <p className={`font-medium ${new Date(selectedCustomer.registration_expiry) < new Date() ? 'text-red-600' : ''}`}>
                          {new Date(selectedCustomer.registration_expiry).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
            {selectedCustomer?.phone && (
              <Button onClick={() => { setShowViewModal(false); openWhatsAppModal(selectedCustomer); }} className="bg-green-600 hover:bg-green-700">
                <MessageCircle className="w-4 h-4 mr-2" /> Send WhatsApp
              </Button>
            )}
            <Button onClick={() => { setShowViewModal(false); openEditCustomer(selectedCustomer); }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send WhatsApp Modal */}
      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Send WhatsApp Message
            </DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                    {selectedCustomer.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{selectedCustomer.name}</p>
                    <p className="text-sm text-green-700 dark:text-green-300">{selectedCustomer.phone}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Message Type</Label>
                <Select 
                  value={messageForm.template_type} 
                  onValueChange={(v) => setMessageForm(p => ({ ...p, template_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MESSAGE_TEMPLATES).map(([key, tmpl]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <tmpl.icon className={`w-4 h-4 ${tmpl.color}`} />
                          {tmpl.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input
                  placeholder="e.g., crm_campaign"
                  value={messageForm.campaign_name}
                  onChange={(e) => setMessageForm(p => ({ ...p, campaign_name: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Must match your AI Sensy campaign name</p>
              </div>

              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  placeholder="e.g., payment_reminder_template"
                  value={messageForm.template_name}
                  onChange={(e) => setMessageForm(p => ({ ...p, template_name: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Must match your pre-approved template in AI Sensy</p>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Note:</strong> Message templates must be pre-approved by WhatsApp through your AI Sensy account before they can be sent.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsAppModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={sendWhatsAppMessage} 
              disabled={sendingMessage || !messageForm.campaign_name || !messageForm.template_name}
              className="bg-green-600 hover:bg-green-700"
            >
              {sendingMessage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk WhatsApp Modal */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Bulk WhatsApp Message
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
              <p className="font-medium text-green-700 dark:text-green-300">
                {selectedCustomers.length} customers selected
              </p>
              <p className="text-sm text-green-600">Messages will be sent to all selected customers with valid phone numbers</p>
            </div>

            <div className="space-y-2">
              <Label>Message Type</Label>
              <Select 
                value={messageForm.template_type} 
                onValueChange={(v) => setMessageForm(p => ({ ...p, template_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MESSAGE_TEMPLATES).map(([key, tmpl]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <tmpl.icon className={`w-4 h-4 ${tmpl.color}`} />
                        {tmpl.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Campaign Name *</Label>
              <Input
                placeholder="e.g., bulk_promo_campaign"
                value={messageForm.campaign_name}
                onChange={(e) => setMessageForm(p => ({ ...p, campaign_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g., promotional_offer_template"
                value={messageForm.template_name}
                onChange={(e) => setMessageForm(p => ({ ...p, template_name: e.target.value }))}
              />
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Rate Limit:</strong> Messages are sent with a small delay between each to avoid rate limiting.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={sendBulkMessages} 
              disabled={sendingMessage || !messageForm.campaign_name || !messageForm.template_name}
              className="bg-green-600 hover:bg-green-700"
            >
              {sendingMessage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to {selectedCustomers.length} Customers
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Config Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              WhatsApp Configuration
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-300">AI Sensy Integration</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400">
                Connect your AI Sensy account to send WhatsApp messages directly from CRM.
                <a href="https://aisensy.com" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                  Get API Key →
                </a>
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Enable WhatsApp Messaging</p>
                <p className="text-sm text-muted-foreground">Toggle WhatsApp features on/off</p>
              </div>
              <Switch
                checked={configForm.is_enabled}
                onCheckedChange={(checked) => setConfigForm(p => ({ ...p, is_enabled: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label>API Endpoint</Label>
              <Input
                placeholder="https://backend.aisensy.com/campaign/t1/api/v2"
                value={configForm.api_endpoint}
                onChange={(e) => setConfigForm(p => ({ ...p, api_endpoint: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>API Key *</Label>
              <Input
                type="password"
                placeholder={whatsappConfig?.is_configured ? "••••••••••••" : "Enter your AI Sensy API key"}
                value={configForm.api_key}
                onChange={(e) => setConfigForm(p => ({ ...p, api_key: e.target.value }))}
              />
              {whatsappConfig?.is_configured && (
                <p className="text-xs text-muted-foreground">Leave empty to keep existing key</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Default Campaign Name</Label>
              <Input
                placeholder="crm_campaign"
                value={configForm.default_campaign_name}
                onChange={(e) => setConfigForm(p => ({ ...p, default_campaign_name: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">This will be used as default for all messages</p>
            </div>

            {whatsappConfig?.is_configured && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">WhatsApp is configured</span>
                </div>
                <p className="text-sm text-emerald-600 mt-1">
                  API Key: {whatsappConfig.api_key_masked}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={testConnection} disabled={saving}>
              Test Connection
            </Button>
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveWhatsAppConfig} disabled={saving} className="bg-primary">
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
