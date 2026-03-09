import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import {
  Store, Settings, Package, ShoppingCart, Truck, CreditCard, TrendingUp,
  RefreshCw, Eye, Edit2, Check, X, Clock, MapPin, Mail, Phone,
  DollarSign, Users, BarChart3, Globe, Link2, Copy, ExternalLink,
  Building2, UserPlus, Trash2, AlertTriangle, ArrowUpDown, FileText,
  Sparkles, Search, Plus, BookOpen, Wand2, Target, CalendarClock, Calendar,
  Server, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';

const ORDER_STATUSES = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700' },
  shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700' },
};

export default function EcommercePage() {
  const { api, user } = useAuth();
  const { currencySymbol } = useCurrency();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeout, setTimeout] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Dashboard data
  // Fix: avoid null initial state that can cause a brief "empty" render before data arrives (visual flash)
  const [dashboard, setDashboard] = useState({});
  
  // Orders
  const [orders, setOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({});
  // Fix: avoid null initial state; consumers can still safely use optional chaining (selectedOrder?.id)
  const [selectedOrder, setSelectedOrder] = useState({});
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');
  
  // Settings
  const [settings, setSettings] = useState({
    enabled: false,
    store_description: '',
    banner_image: '',
    theme_color: '#3B82F6',
    accepts_cod: true,
    min_order_amount: 0,
    delivery_charge: 50,
    free_delivery_above: 500,
    shipping_policy: '',
    return_policy: ''
  });
  const [showSettings, setShowSettings] = useState(false);
  
  // Business Customers (B2B)
  const [businessCustomers, setBusinessCustomers] = useState([]);
  const [businessCustomerStats, setBusinessCustomerStats] = useState({});
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newBusinessCustomer, setNewBusinessCustomer] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    gst_number: '',
    pan_number: '',
    business_type: 'retailer',
    billing_address: '',
    shipping_address: '',
    credit_limit: 0,
    payment_terms: 30
  });
  
  // Inventory Sync
  const [inventorySync, setInventorySync] = useState({});
  
  // Blog state
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogStats, setBlogStats] = useState({});
  const [blogSeoDashboard, setBlogSeoDashboard] = useState({});
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    excerpt: '',
    category: 'general',
    tags: '',
    meta_title: '',
    meta_description: '',
    status: 'draft',
    scheduled_at: ''
  });
  const [aiTopic, setAiTopic] = useState('');
  const [aiKeywords, setAiKeywords] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [aiLength, setAiLength] = useState('medium');
  
  // Custom Store Slug
  const [customSlug, setCustomSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState(null); // null, true, false
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [showDnsInstructions, setShowDnsInstructions] = useState(false);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashboardData, ordersData, settingsData, customersData, inventorySyncData, blogData, seoData] = await Promise.all([
        api('/api/ecommerce/dashboard'),
        api('/api/ecommerce/orders?limit=100'),
        api('/api/ecommerce/settings'),
        api('/api/ecommerce/business-customers'),
        api('/api/ecommerce/inventory-sync-status'),
        api('/api/ecommerce/blog/posts?limit=50').catch(() => ({ posts: [], stats: {} })),
        api('/api/ecommerce/blog/seo-dashboard').catch(() => ({ stats: {}, top_posts: [], needs_optimization: [] }))
      ]);
      
      setDashboard(dashboardData);
      setOrders(ordersData.orders || []);
      setOrderStats(ordersData.stats || {});
      setSettings(settingsData);
      setBusinessCustomers(customersData.customers || []);
      setBusinessCustomerStats(customersData.stats || {});
      setInventorySync(inventorySyncData);
      setBlogPosts(blogData.posts || []);
      setBlogStats(blogData.stats || {});
      setBlogSeoDashboard(seoData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load e-commerce data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update order status
  const updateOrderStatus = async (orderId, newStatus, trackingNumber = null) => {
    try {
      let url = `/api/ecommerce/orders/${orderId}/status?status=${newStatus}`;
      if (trackingNumber) url += `&tracking_number=${encodeURIComponent(trackingNumber)}`;
      
      await api(url, { method: 'PUT' });
      toast.success(`Order status updated to ${newStatus}`);
      fetchData();
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (err) {
      toast.error('Failed to update order status');
    }
  };

  // Save settings
  const saveSettings = async () => {
    try {
      await api('/api/ecommerce/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      toast.success('E-commerce settings saved');
      setShowSettings(false);
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };
  
  // Create business customer
  const createBusinessCustomer = async () => {
    try {
      if (!newBusinessCustomer.business_name || !newBusinessCustomer.email || !newBusinessCustomer.phone) {
        toast.error('Please fill in required fields');
        return;
      }
      
      await api('/api/ecommerce/business-customers', {
        method: 'POST',
        body: JSON.stringify(newBusinessCustomer)
      });
      
      toast.success('Business customer created');
      setShowAddCustomer(false);
      setNewBusinessCustomer({
        business_name: '',
        contact_name: '',
        email: '',
        phone: '',
        gst_number: '',
        pan_number: '',
        business_type: 'retailer',
        billing_address: '',
        shipping_address: '',
        credit_limit: 0,
        payment_terms: 30
      });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to create business customer');
    }
  };
  
  // Delete business customer
  const deleteBusinessCustomer = async (customerId) => {
    if (!confirm('Are you sure you want to deactivate this business customer?')) return;
    
    try {
      await api(`/api/ecommerce/business-customers/${customerId}`, { method: 'DELETE' });
      toast.success('Business customer deactivated');
      fetchData();
    } catch (err) {
      toast.error('Failed to deactivate customer');
    }
  };

  // Format currency
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price || 0);
  };

  // Get store URL (subdomain style)
  const getStoreUrl = () => {
    if (settings.store_url) {
      return `https://${settings.store_url}`;
    }
    const baseUrl = process.env.REACT_APP_BACKEND_URL?.replace('/api', '') || window.location.origin;
    return `${baseUrl}/store/${settings.store_slug || user?.tenant_id || 'store'}`;
  };

  // Copy store URL
  const copyStoreUrl = () => {
    navigator.clipboard.writeText(getStoreUrl());
    toast.success('Store URL copied to clipboard');
  };
  
  // Check slug availability with debounce
  const checkSlugAvailability = async (slug) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      setSlugError(slug ? 'Slug must be at least 3 characters' : '');
      return;
    }
    
    setSlugChecking(true);
    setSlugError('');
    
    try {
      const result = await api(`/api/ecommerce/check-slug/${encodeURIComponent(slug)}`);
      setSlugAvailable(result.available);
      if (!result.available) {
        setSlugError(result.reason);
      }
    } catch (err) {
      setSlugAvailable(false);
      setSlugError('Failed to check availability');
    } finally {
      setSlugChecking(false);
    }
  };
  
  // Debounced slug check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customSlug && customSlug !== settings.store_slug) {
        checkSlugAvailability(customSlug);
      } else {
        setSlugAvailable(null);
        setSlugError('');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [customSlug, settings.store_slug]);
  
  // Save custom slug
  const saveCustomSlug = async () => {
    if (!customSlug || !slugAvailable) {
      toast.error('Please enter a valid and available slug');
      return;
    }
    
    setSlugSaving(true);
    try {
      const result = await api('/api/ecommerce/store-slug', {
        method: 'PUT',
        body: JSON.stringify({ slug: customSlug })
      });
      
      toast.success('Store slug updated successfully!');
      setSettings(prev => ({
        ...prev,
        store_slug: result.slug,
        store_url: result.store_url
      }));
      setShowDnsInstructions(true);
      setSlugAvailable(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update store slug');
    } finally {
      setSlugSaving(false);
    }
  };
  
  // Create blog post
  const createBlogPost = async () => {
    try {
      if (!newPost.title) {
        toast.error('Title is required');
        return;
      }
      
      // Validate scheduled_at if status is scheduled
      if (newPost.status === 'scheduled' && !newPost.scheduled_at) {
        toast.error('Please select a scheduled date and time');
        return;
      }
      
      // Convert local datetime to ISO string for scheduled posts
      let scheduledAt = null;
      if (newPost.status === 'scheduled' && newPost.scheduled_at) {
        scheduledAt = new Date(newPost.scheduled_at).toISOString();
      }
      
      await api('/api/ecommerce/blog/posts', {
        method: 'POST',
        body: JSON.stringify({
          ...newPost,
          tags: newPost.tags.split(',').map(t => t.trim()).filter(Boolean),
          scheduled_at: scheduledAt
        })
      });
      
      const successMessage = newPost.status === 'scheduled' 
        ? `Blog post scheduled for ${new Date(newPost.scheduled_at).toLocaleString()}`
        : 'Blog post created';
      toast.success(successMessage);
      setShowCreatePost(false);
      setNewPost({
        title: '',
        content: '',
        excerpt: '',
        category: 'general',
        tags: '',
        meta_title: '',
        meta_description: '',
        status: 'draft',
        scheduled_at: ''
      });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to create post');
    }
  };
  
  // AI Generate blog post
  const aiGeneratePost = async () => {
    try {
      if (!aiTopic) {
        toast.error('Topic is required');
        return;
      }
      
      setAiGenerating(true);
      
      const result = await api('/api/ecommerce/blog/ai-generate', {
        method: 'POST',
        body: JSON.stringify({
          topic: aiTopic,
          keywords: aiKeywords.split(',').map(k => k.trim()).filter(Boolean),
          tone: aiTone,
          length: aiLength,
          include_product_links: true
        })
      });
      
      toast.success('AI blog post generated! Check your drafts.');
      setShowAIGenerate(false);
      setAiTopic('');
      setAiKeywords('');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to generate post');
    } finally {
      setAiGenerating(false);
    }
  };
  
  // Delete blog post
  const deleteBlogPost = async (postId) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return;
    
    try {
      await api(`/api/ecommerce/blog/posts/${postId}`, { method: 'DELETE' });
      toast.success('Blog post deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete post');
    }
  };
  
  // Publish/unpublish post
  const togglePostStatus = async (post) => {
    try {
      const newStatus = post.status === 'published' ? 'draft' : 'published';
      await api(`/api/ecommerce/blog/posts/${post.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      toast.success(`Post ${newStatus === 'published' ? 'published' : 'unpublished'}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update post status');
    }
  };
  
  // Optimize post SEO
  const optimizePostSeo = async (postId) => {
    try {
      toast.info('Analyzing SEO...');
      const result = await api(`/api/ecommerce/blog/ai-seo-optimize/${postId}`, { method: 'POST' });
      toast.success('SEO analysis complete!');
      fetchData();
    } catch (err) {
      toast.error('Failed to optimize SEO');
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (orderFilter === 'all') return true;
    return order.status === orderFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ecommerce-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Store className="w-7 h-7 text-blue-600" />
            E-Commerce
          </h1>
          <p className="text-gray-500 mt-1">Manage your online store and orders</p>
          {settings.enabled && settings.store_url && (
            <div className="mt-2 flex items-center gap-2">
              <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1">
                <Globe className="w-3 h-3 mr-1" />
                {settings.store_name || 'Your Store'}
              </Badge>
              <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
                {settings.store_url}
              </code>
              <Button size="sm" variant="ghost" onClick={copyStoreUrl} className="h-6 px-2">
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {settings.enabled && (
            <Button variant="outline" onClick={copyStoreUrl} data-testid="copy-store-url">
              <Link2 className="w-4 h-4 mr-2" />
              Copy Store URL
            </Button>
          )}
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowSettings(true)} data-testid="ecommerce-settings-btn">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Store Status Banner */}
      {!settings.enabled && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Store className="w-8 h-8 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Your online store is not enabled</p>
                <p className="text-sm text-amber-600">Enable e-commerce in settings to start selling online</p>
              </div>
            </div>
            <Button onClick={() => setShowSettings(true)} className="bg-amber-600 hover:bg-amber-700">
              Enable Store
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 dark:bg-gray-800 p-1">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingCart className="w-4 h-4" />
            Orders
            {orderStats.pending > 0 && (
              <Badge className="bg-red-500 ml-1">{orderStats.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="business-customers" className="gap-2" data-testid="b2b-tab">
            <Building2 className="w-4 h-4" />
            B2B Customers
            {businessCustomerStats.pending > 0 && (
              <Badge className="bg-yellow-500 ml-1">{businessCustomerStats.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2" data-testid="inventory-sync-tab">
            <ArrowUpDown className="w-4 h-4" />
            Inventory Sync
            {inventorySync.out_of_stock_count > 0 && (
              <Badge className="bg-red-500 ml-1">{inventorySync.out_of_stock_count}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="blog" className="gap-2" data-testid="blog-tab">
            <BookOpen className="w-4 h-4" />
            SEO Blog
            {blogStats.drafts > 0 && (
              <Badge className="bg-purple-500 ml-1">{blogStats.drafts}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Monthly Revenue</p>
                    <p className="text-2xl font-bold">{formatPrice(dashboard?.monthly_revenue)}</p>
                  </div>
                  <DollarSign className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Monthly Orders</p>
                    <p className="text-2xl font-bold">{dashboard?.monthly_orders || 0}</p>
                  </div>
                  <ShoppingCart className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Avg Order Value</p>
                    <p className="text-2xl font-bold">{formatPrice(dashboard?.avg_order_value)}</p>
                  </div>
                  <TrendingUp className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 text-sm">Pending Orders</p>
                    <p className="text-2xl font-bold">{dashboard?.pending_orders || 0}</p>
                  </div>
                  <Clock className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Orders & Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  Recent Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard?.recent_orders?.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.recent_orders.slice(0, 5).map(order => (
                      <div 
                        key={order.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => { setSelectedOrder(order); setShowOrderDetail(true); }}
                      >
                        <div>
                          <p className="font-medium text-sm">{order.id}</p>
                          <p className="text-xs text-gray-500">{order.customer_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatPrice(order.total_amount)}</p>
                          <Badge className={ORDER_STATUSES[order.status]?.color}>
                            {ORDER_STATUSES[order.status]?.label}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No orders yet</p>
                )}
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  Top Selling Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard?.top_products?.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.top_products.map((product, index) => (
                      <div key={product._id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.total_sold} sold</p>
                        </div>
                        <p className="font-semibold text-green-600">{formatPrice(product.revenue)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No sales data yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4">
          {/* Order Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              variant={orderFilter === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setOrderFilter('all')}
            >
              All ({orderStats.total_orders || 0})
            </Button>
            {Object.entries(ORDER_STATUSES).map(([status, info]) => (
              <Button
                key={status}
                variant={orderFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOrderFilter(status)}
              >
                {info.label} ({orderStats[status] || 0})
              </Button>
            ))}
          </div>

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium text-gray-500">Order ID</th>
                      <th className="text-left p-4 font-medium text-gray-500">Customer</th>
                      <th className="text-left p-4 font-medium text-gray-500">Items</th>
                      <th className="text-left p-4 font-medium text-gray-500">Status</th>
                      <th className="text-left p-4 font-medium text-gray-500">Payment</th>
                      <th className="text-right p-4 font-medium text-gray-500">Amount</th>
                      <th className="text-center p-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => (
                      <tr key={order.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="p-4">
                          <span className="font-mono text-sm font-medium">{order.id}</span>
                          <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-sm">{order.customer_name}</p>
                          <p className="text-xs text-gray-500">{order.customer_email}</p>
                        </td>
                        <td className="p-4">
                          <span className="text-sm">{order.items?.length || 0} items</span>
                        </td>
                        <td className="p-4">
                          <Badge className={ORDER_STATUSES[order.status]?.color}>
                            {ORDER_STATUSES[order.status]?.label}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded ${
                            order.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                            order.payment_status === 'cod_pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {order.payment_status === 'paid' ? 'Paid' :
                             order.payment_status === 'cod_pending' ? 'COD' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-semibold">{formatPrice(order.total_amount)}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => { setSelectedOrder(order); setShowOrderDetail(true); }}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {order.status === 'pending' && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => updateOrderStatus(order.id, 'confirmed')}
                                title="Confirm Order"
                                className="text-green-600"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            {order.status === 'confirmed' && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => updateOrderStatus(order.id, 'shipped')}
                                title="Mark Shipped"
                                className="text-blue-600"
                              >
                                <Truck className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-500">
                          <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No orders found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Business Customers Tab (B2B) */}
        <TabsContent value="business-customers" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Business Customers (B2B)
              </CardTitle>
              <Button onClick={() => setShowAddCustomer(true)} className="gap-2" data-testid="add-b2b-customer-btn">
                <UserPlus className="w-4 h-4" />
                Add Business Customer
              </Button>
            </CardHeader>
            <CardContent>
              {/* B2B Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <p className="text-sm text-indigo-600">Total Customers</p>
                  <p className="text-2xl font-bold">{businessCustomerStats.total || 0}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-600">Active</p>
                  <p className="text-2xl font-bold">{businessCustomerStats.active || 0}</p>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-600">Pending Approval</p>
                  <p className="text-2xl font-bold">{businessCustomerStats.pending || 0}</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-purple-600">Credit Utilized</p>
                  <p className="text-2xl font-bold">{formatPrice(businessCustomerStats.total_credit_utilized || 0)}</p>
                </div>
              </div>
              
              {/* Customers Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium">Business</th>
                      <th className="text-left p-3 text-sm font-medium">Contact</th>
                      <th className="text-left p-3 text-sm font-medium">Type</th>
                      <th className="text-left p-3 text-sm font-medium">Credit</th>
                      <th className="text-left p-3 text-sm font-medium">Status</th>
                      <th className="text-center p-3 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {businessCustomers.map(customer => (
                      <tr key={customer.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-3">
                          <p className="font-medium">{customer.business_name}</p>
                          <p className="text-xs text-gray-500">{customer.code}</p>
                          {customer.gst_number && (
                            <p className="text-xs text-gray-400">GST: {customer.gst_number}</p>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="text-sm">{customer.contact_name}</p>
                          <p className="text-xs text-gray-500">{customer.email}</p>
                          <p className="text-xs text-gray-500">{customer.phone}</p>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">{customer.business_type}</Badge>
                        </td>
                        <td className="p-3">
                          <p className="text-sm font-medium">{formatPrice(customer.credit_utilized || 0)} / {formatPrice(customer.credit_limit || 0)}</p>
                          <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                            <div 
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.min(100, ((customer.credit_utilized || 0) / (customer.credit_limit || 1)) * 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge className={customer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                            {customer.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteBusinessCustomer(customer.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {businessCustomers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No business customers yet</p>
                          <Button variant="link" onClick={() => setShowAddCustomer(true)}>Add your first B2B customer</Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Inventory Sync Tab */}
        <TabsContent value="inventory" className="mt-4">
          <div className="space-y-4">
            {/* Sync Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5 text-blue-600" />
                  POS ↔ E-commerce Inventory Sync
                  <Badge className="bg-green-100 text-green-700 ml-2">
                    {inventorySync.sync_status || 'Active'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                    <Package className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                    <p className="text-2xl font-bold">{inventorySync.total_ecommerce_items || 0}</p>
                    <p className="text-sm text-blue-600">Products Online</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                    <AlertTriangle className="w-8 h-8 mx-auto text-red-600 mb-2" />
                    <p className="text-2xl font-bold">{inventorySync.out_of_stock_count || 0}</p>
                    <p className="text-sm text-red-600">Out of Stock</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <Check className="w-8 h-8 mx-auto text-green-600 mb-2" />
                    <p className="text-2xl font-bold">{(inventorySync.total_ecommerce_items || 0) - (inventorySync.out_of_stock_count || 0)}</p>
                    <p className="text-sm text-green-600">In Stock</p>
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="text-sm text-gray-600">
                    <strong>How it works:</strong> When customers place orders online, inventory is automatically reduced in real-time. 
                    Stock levels sync between your POS and online store instantly.
                  </p>
                </div>
                
                <p className="text-xs text-gray-500">Last sync: {inventorySync.last_sync ? new Date(inventorySync.last_sync).toLocaleString() : 'N/A'}</p>
              </CardContent>
            </Card>
            
            {/* Low Stock Alerts */}
            {inventorySync.low_stock_items?.length > 0 && (
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="w-5 h-5" />
                    Low Stock Alerts ({inventorySync.low_stock_items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {inventorySync.low_stock_items.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-gray-500">Min: {item.min_stock_alert || 5} units</p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700">
                          {item.current_stock} left
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Recent Inventory Changes */}
            {inventorySync.recent_inventory_changes?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    Recent E-commerce Orders (Inventory Impact)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {inventorySync.recent_inventory_changes.map(order => (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{order.id}</p>
                          <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{order.items?.length || 0} items</p>
                          <Badge className={ORDER_STATUSES[order.status]?.color}>
                            {ORDER_STATUSES[order.status]?.label}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        {/* SEO Blog Tab */}
        <TabsContent value="blog" className="mt-4" data-testid="blog-content">
          {/* SEO Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Published Posts</p>
                    <p className="text-2xl font-bold">{blogStats.published || 0}</p>
                  </div>
                  <BookOpen className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 text-sm">Drafts</p>
                    <p className="text-2xl font-bold">{blogStats.drafts || 0}</p>
                  </div>
                  <FileText className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-blue-500 to-sky-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Scheduled</p>
                    <p className="text-2xl font-bold">{blogStats.scheduled || 0}</p>
                  </div>
                  <CalendarClock className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-cyan-500 to-teal-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-cyan-100 text-sm">AI Generated</p>
                    <p className="text-2xl font-bold">{blogStats.ai_generated || 0}</p>
                  </div>
                  <Sparkles className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Avg SEO Score</p>
                    <p className="text-2xl font-bold">{blogSeoDashboard?.stats?.avg_seo_score || 0}%</p>
                  </div>
                  <Target className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <Button 
              className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
              onClick={() => setShowAIGenerate(true)}
              data-testid="ai-generate-btn"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Generate Post
            </Button>
            <Button variant="outline" onClick={() => setShowCreatePost(true)} data-testid="create-post-btn">
              <Plus className="w-4 h-4 mr-2" />
              Write Post
            </Button>
          </div>
          
          {/* Blog Posts List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  Blog Posts
                </span>
                <Badge variant="outline">{blogPosts.length} posts</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blogPosts.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-purple-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Blog Posts Yet</h3>
                  <p className="text-gray-500 mb-4">Start creating SEO-optimized content to boost your store's visibility</p>
                  <Button onClick={() => setShowAIGenerate(true)} className="bg-gradient-to-r from-purple-500 to-indigo-500">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate with AI
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {blogPosts.map(post => (
                    <div key={post.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">{post.title}</h3>
                          {post.ai_generated && (
                            <Badge className="bg-purple-100 text-purple-700 text-xs">AI</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                          <Badge className={
                            post.status === 'published' 
                              ? 'bg-green-100 text-green-700' 
                              : post.status === 'scheduled' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-gray-100 text-gray-600'
                          }>
                            {post.status === 'scheduled' && <CalendarClock className="w-3 h-3 mr-1 inline" />}
                            {post.status}
                          </Badge>
                          {post.status === 'scheduled' && post.scheduled_at && (
                            <span className="text-blue-600 font-medium">
                              {new Date(post.scheduled_at).toLocaleString()}
                            </span>
                          )}
                          <span>{post.category}</span>
                          <span>•</span>
                          <span>{new Date(post.created_at).toLocaleDateString()}</span>
                          {post.seo_score > 0 && (
                            <>
                              <span>•</span>
                              <span className={post.seo_score >= 80 ? 'text-green-600' : post.seo_score >= 50 ? 'text-amber-600' : 'text-red-600'}>
                                SEO: {post.seo_score}%
                              </span>
                            </>
                          )}
                          {post.views > 0 && (
                            <>
                              <span>•</span>
                              <span><Eye className="w-3 h-3 inline mr-1" />{post.views} views</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => optimizePostSeo(post.id)}
                          title="Optimize SEO"
                        >
                          <Wand2 className="w-4 h-4 text-purple-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant={post.status === 'published' ? 'outline' : 'default'}
                          onClick={() => togglePostStatus(post)}
                          className={post.status !== 'published' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                          disabled={post.status === 'scheduled'}
                          title={post.status === 'scheduled' ? 'Scheduled posts will be published automatically' : ''}
                        >
                          {post.status === 'published' ? 'Unpublish' : post.status === 'scheduled' ? 'Scheduled' : 'Publish'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteBlogPost(post.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Posts Needing SEO Optimization */}
          {blogSeoDashboard?.needs_optimization?.length > 0 && (
            <Card className="mt-4 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                  Posts Needing SEO Optimization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {blogSeoDashboard.needs_optimization.map(post => (
                    <div key={post.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded">
                      <div>
                        <p className="font-medium">{post.title}</p>
                        <p className="text-sm text-amber-600">SEO Score: {post.seo_score || 0}%</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => optimizePostSeo(post.id)}>
                        <Wand2 className="w-4 h-4 mr-1" />
                        Optimize
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Order Detail Modal */}
      <Dialog open={showOrderDetail} onOpenChange={setShowOrderDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order {selectedOrder?.id}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              {/* Status & Actions */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge className={ORDER_STATUSES[selectedOrder.status]?.color + ' text-base px-3 py-1'}>
                    {ORDER_STATUSES[selectedOrder.status]?.label}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Select 
                    value={selectedOrder.status} 
                    onValueChange={(status) => updateOrderStatus(selectedOrder.id, status)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ORDER_STATUSES).map(([status, info]) => (
                        <SelectItem key={status} value={status}>{info.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <h3 className="font-semibold mb-3">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Name</p>
                    <p className="font-medium">{selectedOrder.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium">{selectedOrder.customer_email}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="font-medium">{selectedOrder.customer_phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Payment Method</p>
                    <p className="font-medium capitalize">{selectedOrder.payment_method}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Shipping Address</p>
                    <p className="font-medium">{selectedOrder.shipping_address}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-semibold mb-3">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      {item.image ? (
                        <img loading="lazy" src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.variant_name && <p className="text-xs text-gray-500">{item.variant_name}</p>}
                      </div>
                      <p className="text-sm">{item.quantity} × {formatPrice(item.price)}</p>
                      <p className="font-semibold">{formatPrice(item.total)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="border-t pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span>{selectedOrder.delivery_charge > 0 ? formatPrice(selectedOrder.delivery_charge) : 'FREE'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatPrice(selectedOrder.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-green-600">{formatPrice(selectedOrder.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              E-Commerce Settings
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Enable Store */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium">Enable Online Store</p>
                <p className="text-sm text-gray-500">Allow customers to shop online</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                data-testid="enable-store-switch"
              />
            </div>

            {settings.enabled && (
              <>
                {/* Store URL */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-600 mb-2">Your Store URL</p>
                  <div className="flex items-center gap-2">
                    <Input value={getStoreUrl()} readOnly className="text-sm font-mono" />
                    <Button variant="outline" size="icon" onClick={copyStoreUrl}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <a href={getStoreUrl()} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="icon">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </div>
                
                {/* Custom Store Slug */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-5 h-5 text-purple-600" />
                    <p className="font-medium text-purple-800 dark:text-purple-300">Custom Store Subdomain</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm text-gray-600">Choose your custom store URL</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="relative flex-1">
                          <Input
                            value={customSlug}
                            onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            placeholder={settings.store_slug || 'your-store-name'}
                            className="pr-10 font-mono"
                            data-testid="custom-slug-input"
                          />
                          {slugChecking && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                          )}
                          {!slugChecking && slugAvailable === true && (
                            <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                          )}
                          {!slugChecking && slugAvailable === false && (
                            <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <span className="text-sm text-gray-500 whitespace-nowrap">.bijnisbooks.com</span>
                      </div>
                      {slugError && (
                        <p className="text-xs text-red-500 mt-1">{slugError}</p>
                      )}
                      {slugAvailable === true && (
                        <p className="text-xs text-green-600 mt-1">✓ This slug is available!</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={saveCustomSlug}
                        disabled={!slugAvailable || slugSaving}
                        className="bg-purple-600 hover:bg-purple-700"
                        data-testid="save-slug-btn"
                      >
                        {slugSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Save Slug
                          </>
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowDnsInstructions(true)}
                        className="text-purple-600 border-purple-300"
                      >
                        <Server className="w-4 h-4 mr-1" />
                        DNS Setup
                      </Button>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only.
                    </p>
                  </div>
                </div>

                {/* Theme Color */}
                <div>
                  <Label>Theme Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="color"
                      value={settings.theme_color}
                      onChange={(e) => setSettings({ ...settings, theme_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={settings.theme_color}
                      onChange={(e) => setSettings({ ...settings, theme_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Store Description */}
                <div>
                  <Label>Store Description</Label>
                  <Input
                    value={settings.store_description}
                    onChange={(e) => setSettings({ ...settings, store_description: e.target.value })}
                    placeholder="Brief description of your store"
                  />
                </div>

                {/* Delivery Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Delivery Charge ({currencySymbol})</Label>
                    <Input
                      type="number"
                      value={settings.delivery_charge}
                      onChange={(e) => setSettings({ ...settings, delivery_charge: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Free Delivery Above ({currencySymbol})</Label>
                    <Input
                      type="number"
                      value={settings.free_delivery_above}
                      onChange={(e) => setSettings({ ...settings, free_delivery_above: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Min Order */}
                <div>
                  <Label>Minimum Order Amount ({currencySymbol})</Label>
                  <Input
                    type="number"
                    value={settings.min_order_amount}
                    onChange={(e) => setSettings({ ...settings, min_order_amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                {/* COD */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Accept Cash on Delivery</p>
                    <p className="text-sm text-gray-500">Allow customers to pay on delivery</p>
                  </div>
                  <Switch
                    checked={settings.accepts_cod}
                    onCheckedChange={(checked) => setSettings({ ...settings, accepts_cod: checked })}
                  />
                </div>
              </>
            )}

            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              onClick={saveSettings}
              data-testid="save-ecommerce-settings"
            >
              Save Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add Business Customer Modal */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Add Business Customer
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Business Name */}
            <div>
              <Label>Business Name *</Label>
              <Input
                value={newBusinessCustomer.business_name}
                onChange={(e) => setNewBusinessCustomer({...newBusinessCustomer, business_name: e.target.value})}
                placeholder="Company name"
                data-testid="b2b-business-name"
              />
            </div>
            
            {/* Contact Name */}
            <div>
              <Label>Contact Person *</Label>
              <Input
                value={newBusinessCustomer.contact_name}
                onChange={(e) => setNewBusinessCustomer({...newBusinessCustomer, contact_name: e.target.value})}
                placeholder="Contact person name"
              />
            </div>
            
            {/* Email & Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={newBusinessCustomer.email}
                  onChange={(e) => setNewBusinessCustomer({...newBusinessCustomer, email: e.target.value})}
                  placeholder="business@example.com"
                  data-testid="b2b-email"
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={newBusinessCustomer.phone}
                  onChange={(e) => setNewBusinessCustomer({...newBusinessCustomer, phone: e.target.value})}
                  placeholder="+91 XXXXX XXXXX"
                  data-testid="b2b-phone"
                />
              </div>
            </div>
            
            {/* GST & PAN */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>GST Number</Label>
                <Input
                  value={newBusinessCustomer.gst_number}
                  onChange={(e) => setNewBusinessCustomer({...newBusinessCustomer, gst_number: e.target.value})}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div>
                <Label>PAN Number</Label>
                <Input
                  value={newBusinessCustomer.pan_number}
                  onChange={(e) => setNewBusinessCustomer({...newBusinessCustomer, pan_number: e.target.value})}
                  placeholder="AAAAA0000A"
                />
              </div>
            </div>
            
            {/* Business Type */}
            <div>
              <Label>Business Type</Label>
              <Select 
                value={newBusinessCustomer.business_type} 
                onValueChange={(val) => setNewBusinessCustomer({...newBusinessCustomer, business_type: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retailer">Retailer</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="distributor">Distributor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Credit & Payment Terms */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Credit Limit ({currencySymbol})</Label>
                <Input
                  type="number"
                  value={newBusinessCustomer.credit_limit}
                  onChange={(e) => setNewBusinessCustomer({...newBusinessCustomer, credit_limit: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Payment Terms (Days)</Label>
                <Input
                  type="number"
                  value={newBusinessCustomer.payment_terms}
                  onChange={(e) => setNewBusinessCustomer({...newBusinessCustomer, payment_terms: parseInt(e.target.value) || 30})}
                  placeholder="30"
                />
              </div>
            </div>
            
            {/* Addresses */}
            <div>
              <Label>Billing Address</Label>
              <Textarea
                value={newBusinessCustomer.billing_address}
                onChange={(e) => setNewBusinessCustomer({...newBusinessCustomer, billing_address: e.target.value})}
                placeholder="Full billing address"
                rows={2}
              />
            </div>
            <div>
              <Label>Shipping Address</Label>
              <Textarea
                value={newBusinessCustomer.shipping_address}
                onChange={(e) => setNewBusinessCustomer({...newBusinessCustomer, shipping_address: e.target.value})}
                placeholder="Full shipping address (leave blank if same as billing)"
                rows={2}
              />
            </div>
            
            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-700" 
              onClick={createBusinessCustomer}
              data-testid="save-b2b-customer"
            >
              Add Business Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* AI Generate Blog Post Modal */}
      <Dialog open={showAIGenerate} onOpenChange={setShowAIGenerate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Generate Blog Post
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Topic *</Label>
              <Input
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="e.g., Benefits of organic cotton fabrics"
                data-testid="ai-topic-input"
              />
              <p className="text-xs text-gray-500 mt-1">What should the blog post be about?</p>
            </div>
            
            <div>
              <Label>Target Keywords (comma separated)</Label>
              <Input
                value={aiKeywords}
                onChange={(e) => setAiKeywords(e.target.value)}
                placeholder="e.g., organic cotton, sustainable fashion, eco-friendly"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tone</Label>
                <Select value={aiTone} onValueChange={setAiTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Length</Label>
                <Select value={aiLength} onValueChange={setAiLength}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (300-500 words)</SelectItem>
                    <SelectItem value="medium">Medium (600-900 words)</SelectItem>
                    <SelectItem value="long">Long (1000-1500 words)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                <Sparkles className="w-4 h-4 inline mr-1" />
                AI will generate an SEO-optimized blog post with proper headings, meta tags, and may include links to your products.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIGenerate(false)}>Cancel</Button>
            <Button 
              onClick={aiGeneratePost}
              disabled={aiGenerating || !aiTopic}
              className="bg-gradient-to-r from-purple-500 to-indigo-500"
              data-testid="generate-ai-post-btn"
            >
              {aiGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Post
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Blog Post Modal */}
      <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Create Blog Post
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={newPost.title}
                onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                placeholder="Enter blog post title"
                data-testid="post-title-input"
              />
            </div>
            
            <div>
              <Label>Content</Label>
              <Textarea
                value={newPost.content}
                onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                placeholder="Write your blog post content here... (HTML supported)"
                rows={8}
              />
            </div>
            
            <div>
              <Label>Excerpt</Label>
              <Textarea
                value={newPost.excerpt}
                onChange={(e) => setNewPost({...newPost, excerpt: e.target.value})}
                placeholder="Brief summary of the post"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={newPost.category} onValueChange={(v) => setNewPost({...newPost, category: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="product-updates">Product Updates</SelectItem>
                    <SelectItem value="tips-guides">Tips & Guides</SelectItem>
                    <SelectItem value="industry-news">Industry News</SelectItem>
                    <SelectItem value="promotions">Promotions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Status</Label>
                <Select value={newPost.status} onValueChange={(v) => setNewPost({...newPost, status: v, scheduled_at: v !== 'scheduled' ? '' : newPost.scheduled_at})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="scheduled">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        Scheduled
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Scheduled Date/Time Picker */}
            {newPost.status === 'scheduled' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Label className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                  <CalendarClock className="w-4 h-4" />
                  Schedule Publication Date & Time *
                </Label>
                <Input
                  type="datetime-local"
                  value={newPost.scheduled_at}
                  onChange={(e) => setNewPost({...newPost, scheduled_at: e.target.value})}
                  min={new Date().toISOString().slice(0, 16)}
                  className="bg-white dark:bg-gray-800"
                  data-testid="schedule-datetime-input"
                />
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  The post will be automatically published at this time.
                </p>
              </div>
            )}
            
            <div>
              <Label>Tags (comma separated)</Label>
              <Input
                value={newPost.tags}
                onChange={(e) => setNewPost({...newPost, tags: e.target.value})}
                placeholder="e.g., fashion, trends, tips"
              />
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-green-600" />
                SEO Settings
              </h4>
              <div className="space-y-3">
                <div>
                  <Label>Meta Title (60 chars max)</Label>
                  <Input
                    value={newPost.meta_title}
                    onChange={(e) => setNewPost({...newPost, meta_title: e.target.value})}
                    placeholder="SEO title for search engines"
                    maxLength={60}
                  />
                </div>
                <div>
                  <Label>Meta Description (155 chars max)</Label>
                  <Textarea
                    value={newPost.meta_description}
                    onChange={(e) => setNewPost({...newPost, meta_description: e.target.value})}
                    placeholder="SEO description for search results"
                    rows={2}
                    maxLength={155}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePost(false)}>Cancel</Button>
            <Button 
              onClick={createBlogPost}
              disabled={!newPost.title || (newPost.status === 'scheduled' && !newPost.scheduled_at)}
              className={newPost.status === 'scheduled' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
              data-testid="save-post-btn"
            >
              {newPost.status === 'scheduled' ? (
                <>
                  <CalendarClock className="w-4 h-4 mr-2" />
                  Schedule Post
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Create Post
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* DNS Instructions Dialog */}
      <Dialog open={showDnsInstructions} onOpenChange={setShowDnsInstructions}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-600" />
              Connect Your Subdomain
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current Status */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-800 dark:text-green-300">Your Store is Ready!</p>
              </div>
              <p className="text-sm text-green-700 dark:text-green-400">
                Your store is available at: <code className="bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded font-mono">{settings.store_url || `${settings.store_slug}.bijnisbooks.com`}</code>
              </p>
            </div>
            
            {/* DNS Instructions */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">For Custom Domain (Optional)</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                If you have your own domain and want to connect it to your store, add the following DNS record:
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs uppercase mb-1">Type</p>
                    <code className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">CNAME</code>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase mb-1">Host / Name</p>
                    <code className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">shop</code>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase mb-1">Value / Points to</p>
                    <code className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-xs">stores.bijnisbooks.com</code>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500">TTL: 3600 (or Auto)</p>
                </div>
              </div>
              
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Example:</strong> If your domain is <code>example.com</code>, adding the above record will make your store accessible at <code>shop.example.com</code>
                </p>
              </div>
              
              {/* Step by Step */}
              <div className="space-y-2">
                <h5 className="font-medium text-sm">Steps to connect your domain:</h5>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                  <li>Log in to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)</li>
                  <li>Navigate to DNS settings</li>
                  <li>Add a new CNAME record with the values above</li>
                  <li>Wait for DNS propagation (up to 48 hours)</li>
                  <li>Contact support to link your custom domain</li>
                </ol>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDnsInstructions(false)}>
                Close
              </Button>
              <Button 
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  navigator.clipboard.writeText('CNAME shop stores.bijnisbooks.com');
                  toast.success('DNS record copied to clipboard');
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy DNS Record
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
