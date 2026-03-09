import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import {
  Package, Search, Eye, Clock, CheckCircle, XCircle, Truck,
  CreditCard, Calendar, ChevronRight, ShoppingBag, RefreshCw,
  MapPin, Phone, Mail, Receipt, Edit, Save
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700', icon: Package },
  shipped: { label: 'Shipped', color: 'bg-cyan-100 text-cyan-700', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700', icon: CreditCard }
};

const PAYMENT_STATUS_CONFIG = {
  pending: { label: 'Payment Pending', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700' }
};

export default function OrderHistoryPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fix(state_flash): avoid initializing object state with `null`.
  // Some conditional renders/modals briefly mount/unmount on the first paint when state flips
  // from `null` -> object, which can cause a visible flash. We instead control visibility
  // with explicit booleans, and keep the selected order as `undefined` until it's set.
  const [isViewOrderOpen, setIsViewOrderOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState();
  
  // Edit Order state
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);
  const [editOrder, setEditOrder] = useState();
  const [editForm, setEditForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    shipping_address: '',
    notes: '',
    delivery_date: ''
  });
  
  // Rejection state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [orderToReject, setOrderToReject] = useState();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await api('/api/orders/online');
      setOrders(data || []);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Order Modal
  const openEditOrder = (order) => {
    setEditForm({
      customer_name: order.customer?.name || '',
      customer_phone: order.customer?.phone || '',
      customer_email: order.customer?.email || '',
      shipping_address: order.customer?.address || order.shipping_address || '',
      notes: order.notes || '',
      delivery_date: order.delivery_date ? order.delivery_date.split('T')[0] : ''
    });
    setEditOrder(order);
    setViewOrder(null);
  };

  // Handle Edit Order Submit
  const handleEditOrder = async () => {
    if (!editOrder) return;
    try {
      await api(`/api/orders/online/${editOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          customer: {
            name: editForm.customer_name,
            phone: editForm.customer_phone,
            email: editForm.customer_email,
            address: editForm.shipping_address
          },
          notes: editForm.notes,
          delivery_date: editForm.delivery_date
        })
      });
      toast.success('Order updated successfully');
      setEditOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to update order');
    }
  };

  // Handle Approve Order
  const handleApproveOrder = async (order) => {
    try {
      await api(`/api/orders/online/${order.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'confirmed' })
      });
      toast.success('Order approved successfully');
      setViewOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to approve order');
    }
  };

  // Open Reject Modal
  const openRejectModal = (order) => {
    setOrderToReject(order);
    setRejectReason('');
    setShowRejectModal(true);
    setViewOrder(null);
  };

  // Handle Reject Order
  const handleRejectOrder = async () => {
    if (!orderToReject) return;
    try {
      await api(`/api/orders/online/${orderToReject.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ 
          status: 'cancelled',
          cancel_reason: rejectReason
        })
      });
      toast.success('Order rejected');
      setShowRejectModal(false);
      setOrderToReject(null);
      setRejectReason('');
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to reject order');
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = search === '' || 
      order.order_id?.toLowerCase().includes(search.toLowerCase()) ||
      order.customer?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const getPaymentStatusConfig = (status) => PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pending;

  // Stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const completedOrders = orders.filter(o => o.status === 'delivered').length;
  const totalSpent = orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div className="space-y-6" data-testid="order-history-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Order History</h1>
          <p className="text-muted-foreground">Track and manage your orders</p>
        </div>
        <Button onClick={fetchOrders} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Orders</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalOrders}</p>
              </div>
              <ShoppingBag className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{pendingOrders}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Completed</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{completedOrders}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Total Spent</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{currencySymbol}{totalSpent.toLocaleString()}</p>
              </div>
              <CreditCard className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by order ID or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="order-search"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'confirmed', 'processing', 'delivered', 'cancelled'].map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status === 'all' ? 'All' : status}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
            <p className="text-muted-foreground mb-4">
              {search || statusFilter !== 'all' 
                ? 'No orders match your filters'
                : 'Your order history will appear here'
              }
            </p>
            {(search || statusFilter !== 'all') && (
              <Button variant="outline" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            const paymentConfig = getPaymentStatusConfig(order.payment_status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <Card 
                key={order.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setViewOrder(order)}
                data-testid={`order-card-${order.id}`}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Order Info */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg">{order.order_id}</h3>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          <Badge className={paymentConfig.color}>
                            {paymentConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(order.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {order.items?.length || 0} items
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Amount & Action */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold">{currencySymbol}{(order.total || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Amount</p>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <ChevronRight className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Items Preview */}
                  {order.items && order.items.length > 0 && (
                    <div className="mt-4 pt-4 border-t flex items-center gap-2 overflow-x-auto">
                      {order.items.slice(0, 4).map((item, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center gap-2 px-3 py-1.5 bg-accent rounded-lg shrink-0"
                        >
                          {item.image ? (
                            <img loading="lazy" src={item.image} alt={item.name} className="w-6 h-6 rounded object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium truncate max-w-[120px]">{item.name}</span>
                          <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                        </div>
                      ))}
                      {order.items.length > 4 && (
                        <span className="text-sm text-muted-foreground shrink-0">
                          +{order.items.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Details Modal */}
      <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Order Details
            </DialogTitle>
          </DialogHeader>
          
          {viewOrder && (
            <div className="space-y-6">
              {/* Order Header */}
              <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
                <div>
                  <h3 className="text-xl font-bold">{viewOrder.order_id}</h3>
                  <p className="text-sm text-muted-foreground">{formatDate(viewOrder.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={getStatusConfig(viewOrder.status).color}>
                    {getStatusConfig(viewOrder.status).label}
                  </Badge>
                  <Badge className={getPaymentStatusConfig(viewOrder.payment_status).color}>
                    {getPaymentStatusConfig(viewOrder.payment_status).label}
                  </Badge>
                </div>
              </div>

              {/* Customer Info */}
              {viewOrder.customer && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Delivery Information
                  </h4>
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <p className="font-medium">{viewOrder.customer.name || 'Customer'}</p>
                      {viewOrder.customer.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Phone className="w-3 h-3" /> {viewOrder.customer.phone}
                        </p>
                      )}
                      {viewOrder.customer.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Mail className="w-3 h-3" /> {viewOrder.customer.email}
                        </p>
                      )}
                      {viewOrder.customer.address && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <MapPin className="w-3 h-3" /> {viewOrder.customer.address}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Order Items */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4" /> Order Items
                </h4>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {viewOrder.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4">
                          {item.image ? (
                            <img loading="lazy" src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-accent flex items-center justify-center">
                              <Package className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.name}</p>
                            {item.brand && <p className="text-sm text-muted-foreground">{item.brand}</p>}
                            {(item.size || item.color) && (
                              <p className="text-xs text-muted-foreground">
                                {item.size && `Size: ${item.size}`}
                                {item.size && item.color && ' • '}
                                {item.color && `Color: ${item.color}`}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{currencySymbol}{(item.price * item.quantity).toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">
                              {currencySymbol}{item.price?.toLocaleString()} × {item.quantity}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Order Summary */}
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{currencySymbol}{(viewOrder.subtotal || viewOrder.total || 0).toLocaleString()}</span>
                  </div>
                  {viewOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-{currencySymbol}{viewOrder.discount_amount.toLocaleString()}</span>
                    </div>
                  )}
                  {viewOrder.tax_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{currencySymbol}{viewOrder.tax_amount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>{currencySymbol}{(viewOrder.total || 0).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setViewOrder(null)} className="mr-auto">
                  Close
                </Button>
                
                {/* Edit Button - Available for pending and confirmed orders */}
                {['pending', 'confirmed'].includes(viewOrder.status) && (
                  <Button variant="outline" onClick={() => openEditOrder(viewOrder)} data-testid="edit-order-btn">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}

                {/* Approve Button - For pending orders */}
                {viewOrder.status === 'pending' && (
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApproveOrder(viewOrder)}
                    data-testid="approve-order-btn"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                )}

                {/* Reject Button - For pending and confirmed orders */}
                {['pending', 'confirmed'].includes(viewOrder.status) && (
                  <Button 
                    variant="destructive"
                    onClick={() => openRejectModal(viewOrder)}
                    data-testid="reject-order-btn"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Modal */}
      <Dialog open={!!editOrder} onOpenChange={() => setEditOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              Edit Order - {editOrder?.order_id}
            </DialogTitle>
            <DialogDescription>
              Update customer and delivery details for this order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={editForm.customer_name}
                onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                placeholder="Customer name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={editForm.customer_phone}
                  onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.customer_email}
                  onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                  placeholder="Email address"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Input
                type="date"
                value={editForm.delivery_date}
                onChange={(e) => setEditForm({ ...editForm, delivery_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Shipping Address</Label>
              <Textarea
                value={editForm.shipping_address}
                onChange={(e) => setEditForm({ ...editForm, shipping_address: e.target.value })}
                placeholder="Enter complete shipping address"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Order notes or special instructions"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditOrder(null)}>Cancel</Button>
            <Button onClick={handleEditOrder} data-testid="save-order-btn">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Order Modal */}
      <Dialog open={showRejectModal} onOpenChange={() => setShowRejectModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Reject Order - {orderToReject?.order_id}
            </DialogTitle>
            <DialogDescription>
              This action will cancel the order. Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Customer:</span> {orderToReject?.customer?.name || 'Customer'}
              </p>
              <p className="text-sm">
                <span className="font-medium">Total:</span> {currencySymbol}{orderToReject?.total?.toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reason for Rejection *</Label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  <SelectItem value="invalid_address">Invalid Delivery Address</SelectItem>
                  <SelectItem value="payment_issue">Payment Issue</SelectItem>
                  <SelectItem value="customer_request">Customer Requested Cancellation</SelectItem>
                  <SelectItem value="duplicate_order">Duplicate Order</SelectItem>
                  <SelectItem value="pricing_error">Pricing Error</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectOrder}
              disabled={!rejectReason}
              data-testid="confirm-reject-btn"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
