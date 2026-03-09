import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  Package, Plus, Search, Filter, MoreVertical, CheckCircle, XCircle,
  Clock, Truck, FileText, Trash2, RefreshCw, Settings, AlertTriangle,
  ShoppingCart, Building2, Calendar, ChevronDown, Eye, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const PurchaseOrdersPage = () => {
  const { api } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [autoReorderSettings, setAutoReorderSettings] = useState({
    enabled: false,
    default_reorder_multiplier: 2,
    auto_approve: false,
    notify_on_creation: true
  });
  
  // View/Edit Order
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  
  // Create Order
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [newOrder, setNewOrder] = useState({
    supplier_id: '',
    store_id: '',
    items: [],
    notes: ''
  });
  
  // Convert to Invoice
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertData, setConvertData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    payment_status: 'pending'
  });

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      let url = '/api/purchase-orders';
      const params = [];
      if (statusFilter !== 'all') params.push(`status=${statusFilter}`);
      if (typeFilter === 'auto') params.push('is_auto=true');
      else if (typeFilter === 'manual') params.push('is_auto=false');
      if (params.length > 0) url += '?' + params.join('&');
      
      const data = await api(url);
      setOrders(data || []);
    } catch (err) {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter, typeFilter]);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api('/api/settings/auto-reorder');
      setAutoReorderSettings(data);
    } catch (err) {
      console.error('Failed to load auto-reorder settings');
    }
  }, [api]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const data = await api('/api/suppliers');
      setSuppliers(data || []);
    } catch (err) {
      console.error('Failed to load suppliers');
    }
  }, [api]);

  const fetchStores = useCallback(async () => {
    try {
      const data = await api('/api/stores');
      setStores(data || []);
    } catch (err) {
      console.error('Failed to load stores');
    }
  }, [api]);

  const fetchItems = useCallback(async () => {
    try {
      const data = await api('/api/items');
      setItems(data || []);
    } catch (err) {
      console.error('Failed to load items');
    }
  }, [api]);

  useEffect(() => {
    fetchOrders();
    fetchSettings();
    fetchSuppliers();
    fetchStores();
    fetchItems();
  }, [fetchOrders, fetchSettings, fetchSuppliers, fetchStores, fetchItems]);

  const updateSettings = async () => {
    try {
      const params = new URLSearchParams({
        enabled: autoReorderSettings.enabled,
        default_reorder_multiplier: autoReorderSettings.default_reorder_multiplier,
        auto_approve: autoReorderSettings.auto_approve,
        notify_on_creation: autoReorderSettings.notify_on_creation
      });
      await api(`/api/settings/auto-reorder?${params}`, { method: 'PUT' });
      toast.success('Auto-reorder settings updated');
      setShowSettings(false);
    } catch (err) {
      toast.error('Failed to update settings');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await api(`/api/purchase-orders/${orderId}/status?status=${status}`, { method: 'PUT' });
      toast.success(`Order ${status}`);
      fetchOrders();
      setShowViewModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this purchase order?')) return;
    try {
      await api(`/api/purchase-orders/${orderId}`, { method: 'DELETE' });
      toast.success('Purchase order deleted');
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to delete order');
    }
  };

  const convertToInvoice = async () => {
    if (!selectedOrder) return;
    try {
      const params = new URLSearchParams({
        invoice_number: convertData.invoice_number,
        invoice_date: convertData.invoice_date,
        payment_status: convertData.payment_status
      });
      await api(`/api/purchase-orders/${selectedOrder.id}/convert-to-invoice?${params}`, { method: 'POST' });
      toast.success('Purchase order converted to invoice');
      setShowConvertModal(false);
      setShowViewModal(false);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to convert to invoice');
    }
  };

  const createOrder = async () => {
    if (!newOrder.supplier_id) {
      toast.error('Please select a supplier');
      return;
    }
    if (newOrder.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    try {
      await api('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(newOrder)
      });
      toast.success('Purchase order created');
      setShowCreateModal(false);
      setNewOrder({ supplier_id: '', store_id: '', items: [], notes: '' });
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to create order');
    }
  };

  const addItemToOrder = (item) => {
    const variant = item.variants?.[0];
    setNewOrder(prev => ({
      ...prev,
      items: [...prev.items, {
        item_id: item.id,
        variant_id: variant?.id || '',
        name: item.name,
        sku: item.sku || '',
        quantity: 1,
        rate: item.cost_price || 0,
        amount: item.cost_price || 0
      }]
    }));
  };

  const updateOrderItem = (index, field, value) => {
    setNewOrder(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === 'quantity' || field === 'rate') {
        items[index].amount = items[index].quantity * items[index].rate;
      }
      return { ...prev, items };
    });
  };

  const removeOrderItem = (index) => {
    setNewOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700 border-gray-200',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      approved: 'bg-blue-100 text-blue-700 border-blue-200',
      received: 'bg-green-100 text-green-700 border-green-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200'
    };
    return (
      <Badge variant="outline" className={styles[status] || styles.draft}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </Badge>
    );
  };

  const filteredOrders = orders.filter(order => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        order.po_number?.toLowerCase().includes(search) ||
        order.supplier_name?.toLowerCase().includes(search) ||
        order.items?.some(i => i.name?.toLowerCase().includes(search))
      );
    }
    return true;
  });

  const stats = {
    total: orders.length,
    draft: orders.filter(o => o.status === 'draft').length,
    pending: orders.filter(o => o.status === 'pending').length,
    approved: orders.filter(o => o.status === 'approved').length,
    auto: orders.filter(o => o.is_auto_generated).length
  };

  return (
    <div className="space-y-6" data-testid="purchase-orders-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-blue-600" />
            Purchase Orders
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage purchase orders and auto-reorder settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowSettings(true)}
            className="gap-2"
            data-testid="auto-reorder-settings-btn"
          >
            <Settings className="w-4 h-4" />
            Auto-Reorder
            {autoReorderSettings.enabled && (
              <Badge className="bg-green-500 text-white ml-1">ON</Badge>
            )}
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            data-testid="create-po-btn"
          >
            <Plus className="w-4 h-4" />
            New Order
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Orders</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.draft}</p>
              <p className="text-xs text-gray-500">Drafts</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.approved}</p>
              <p className="text-xs text-gray-500">Approved</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.auto}</p>
              <p className="text-xs text-gray-500">Auto-Generated</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="search-orders"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="type-filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="auto">Auto-Generated</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchOrders} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No purchase orders found</p>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(true)}
              className="mt-4 gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Order
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => { setSelectedOrder(order); setShowViewModal(true); }}
                    data-testid={`order-row-${order.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600">{order.po_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{order.supplier_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 dark:text-gray-300">
                        {order.items?.length || 0} item(s)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ₹{(order.total_amount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {order.is_auto_generated ? (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 gap-1">
                          <Zap className="w-3 h-3" />
                          Auto
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">Manual</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedOrder(order); setShowViewModal(true); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {order.status === 'draft' && (
                            <DropdownMenuItem onClick={() => updateOrderStatus(order.id, 'pending')}>
                              <Clock className="w-4 h-4 mr-2" />
                              Mark Pending
                            </DropdownMenuItem>
                          )}
                          {(order.status === 'draft' || order.status === 'pending') && (
                            <DropdownMenuItem onClick={() => updateOrderStatus(order.id, 'approved')}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approve
                            </DropdownMenuItem>
                          )}
                          {(order.status === 'approved' || order.status === 'pending') && !order.converted_to_invoice && (
                            <DropdownMenuItem onClick={() => { setSelectedOrder(order); setShowConvertModal(true); }}>
                              <FileText className="w-4 h-4 mr-2" />
                              Convert to Invoice
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {(order.status === 'draft' || order.status === 'cancelled') && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => deleteOrder(order.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                          {order.status !== 'cancelled' && order.status !== 'received' && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Auto-Reorder Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600" />
              Auto-Reorder Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Enable Auto-Reorder</p>
                <p className="text-sm text-gray-500">Automatically create purchase orders when stock is low</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReorderSettings.enabled}
                  onChange={(e) => setAutoReorderSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="sr-only peer"
                  data-testid="auto-reorder-toggle"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Default Reorder Multiplier
              </label>
              <p className="text-xs text-gray-500">Reorder quantity = Min Stock × Multiplier</p>
              <Select
                value={String(autoReorderSettings.default_reorder_multiplier)}
                onValueChange={(v) => setAutoReorderSettings(prev => ({ ...prev, default_reorder_multiplier: parseFloat(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1x Min Stock</SelectItem>
                  <SelectItem value="1.5">1.5x Min Stock</SelectItem>
                  <SelectItem value="2">2x Min Stock</SelectItem>
                  <SelectItem value="3">3x Min Stock</SelectItem>
                  <SelectItem value="5">5x Min Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">Notify on Creation</p>
                <p className="text-xs text-gray-500">Send notification when auto PO is created</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReorderSettings.notify_on_creation}
                  onChange={(e) => setAutoReorderSettings(prev => ({ ...prev, notify_on_creation: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={updateSettings} className="bg-blue-600 hover:bg-blue-700">
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              {selectedOrder?.po_number}
              {selectedOrder?.is_auto_generated && (
                <Badge className="bg-purple-100 text-purple-700 gap-1 ml-2">
                  <Zap className="w-3 h-3" />
                  Auto-Generated
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6 py-4">
              {/* Auto-generated info */}
              {selectedOrder.is_auto_generated && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-purple-800 dark:text-purple-200">Auto-Generated Order</p>
                      <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                        {selectedOrder.notes}
                      </p>
                      <p className="text-xs text-purple-500 mt-2">
                        Stock at creation: {selectedOrder.current_stock_at_creation} | Min stock: {selectedOrder.min_stock_alert}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Supplier</p>
                  <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    {selectedOrder.supplier_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created Date</p>
                  <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-bold text-xl text-gray-900 dark:text-white">
                    ₹{(selectedOrder.total_amount || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Order Items</p>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Item</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Qty</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Rate</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedOrder.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                            {item.sku && <p className="text-xs text-gray-500">{item.sku}</p>}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                          <td className="px-4 py-3 text-right">₹{(item.rate || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-semibold">₹{(item.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <td colSpan="3" className="px-4 py-3 text-right font-semibold">Total:</td>
                        <td className="px-4 py-3 text-right font-bold text-lg">
                          ₹{(selectedOrder.total_amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Converted to Invoice Info */}
              {selectedOrder.converted_to_invoice && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                  <p className="text-green-800 dark:text-green-200 font-medium flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Converted to Invoice: {selectedOrder.invoice_number}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedOrder?.status === 'draft' && (
              <Button
                variant="outline"
                onClick={() => updateOrderStatus(selectedOrder.id, 'pending')}
                className="gap-2"
              >
                <Clock className="w-4 h-4" />
                Mark Pending
              </Button>
            )}
            {(selectedOrder?.status === 'draft' || selectedOrder?.status === 'pending') && (
              <Button
                onClick={() => updateOrderStatus(selectedOrder.id, 'approved')}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </Button>
            )}
            {(selectedOrder?.status === 'approved' || selectedOrder?.status === 'pending') && !selectedOrder?.converted_to_invoice && (
              <Button
                onClick={() => setShowConvertModal(true)}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <FileText className="w-4 h-4" />
                Convert to Invoice
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Invoice Modal */}
      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Convert to Purchase Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Invoice Number (Optional)
              </label>
              <Input
                placeholder="Auto-generate if empty"
                value={convertData.invoice_number}
                onChange={(e) => setConvertData(prev => ({ ...prev, invoice_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Invoice Date
              </label>
              <Input
                type="date"
                value={convertData.invoice_date}
                onChange={(e) => setConvertData(prev => ({ ...prev, invoice_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Payment Status
              </label>
              <Select
                value={convertData.payment_status}
                onValueChange={(v) => setConvertData(prev => ({ ...prev, payment_status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertModal(false)}>Cancel</Button>
            <Button onClick={convertToInvoice} className="bg-blue-600 hover:bg-blue-700">
              Convert & Add Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Order Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Create Purchase Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Supplier *
                </label>
                <Select
                  value={newOrder.supplier_id}
                  onValueChange={(v) => setNewOrder(prev => ({ ...prev, supplier_id: v }))}
                >
                  <SelectTrigger data-testid="select-supplier">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Delivery Store
                </label>
                <Select
                  value={newOrder.store_id}
                  onValueChange={(v) => setNewOrder(prev => ({ ...prev, store_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Add Items */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Add Items
              </label>
              <Select onValueChange={(v) => {
                const item = items.find(i => i.id === v);
                if (item) addItemToOrder(item);
              }}>
                <SelectTrigger data-testid="select-item">
                  <SelectValue placeholder="Select item to add" />
                </SelectTrigger>
                <SelectContent>
                  {items.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} {i.sku ? `(${i.sku})` : ''} - ₹{i.cost_price || 0}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items Table */}
            {newOrder.items.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Item</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 w-24">Qty</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 w-28">Rate</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 w-28">Amount</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {newOrder.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateOrderItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="text-center w-20"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min="0"
                            value={item.rate}
                            onChange={(e) => updateOrderItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                            className="text-right w-24"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          ₹{item.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOrderItem(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-right font-semibold">Total:</td>
                      <td className="px-4 py-3 text-right font-bold text-lg">
                        ₹{newOrder.items.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes
              </label>
              <Input
                placeholder="Add notes..."
                value={newOrder.notes}
                onChange={(e) => setNewOrder(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              onClick={createOrder}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!newOrder.supplier_id || newOrder.items.length === 0}
              data-testid="create-order-submit"
            >
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrdersPage;
