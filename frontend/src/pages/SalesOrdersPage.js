import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import {
  ShoppingBag, Plus, Search, Eye, Edit, Trash2, Truck, Check, X,
  ArrowRight, Clock, Calendar, User, Package, FileText, CreditCard, UserPlus,
  CheckCircle, XCircle, Save, MapPin, Phone, Mail
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  ready: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  invoiced: 'bg-emerald-100 text-emerald-700'
};

const PAYMENT_STATUS_COLORS = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700'
};

export default function SalesOrdersPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  // View order state - null means modal is closed, object means modal is open with data
  const [viewOrder, setViewOrder] = useState(null);
  
  // Quick Add Customer state
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', gst_number: '', customer_type: 'retail' });
  
  // Edit Order state - null means modal is closed, object means modal is open with data
  const [editOrder, setEditOrder] = useState(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    shipping_address: '',
    notes: '',
    delivery_date: ''
  });
  
  // Approval/Rejection state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [orderToReject, setOrderToReject] = useState({});
  const [hasOrderToReject, setHasOrderToReject] = useState(false);
  
  const [form, setForm] = useState({
    customer_id: '', customer_name: 'Walk-in Customer', customer_phone: '',
    items: [], subtotal: 0, discount_amount: 0, tax_amount: 0, total_amount: 0,
    payment_terms: 'immediate', delivery_date: '', shipping_address: '', notes: '', store_id: ''
  });

  const fetchData = async () => {
    try {
      const [ordersData, customersData, itemsData] = await Promise.all([
        api(`/api/sales-orders?status=${statusFilter}`),
        api('/api/customers'),
        api('/api/items')
      ]);
      setOrders(ordersData);
      setCustomers(customersData);
      setItems(itemsData);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const calculateTotals = (cartItems) => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxAmount = subtotal * 0.18;
    return { subtotal, discount_amount: 0, tax_amount: taxAmount, total_amount: subtotal + taxAmount };
  };

  const addItemToOrder = (item) => {
    const existingIndex = form.items.findIndex(i => i.item_id === item.id);
    let newItems;
    if (existingIndex >= 0) {
      newItems = form.items.map((i, idx) => idx === existingIndex ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      newItems = [...form.items, {
        item_id: item.id, item_name: item.name, quantity: 1, rate: item.selling_price,
        hsn_code: item.hsn_code || '', gst_rate: item.gst_rate || 18
      }];
    }
    setForm({ ...form, items: newItems, ...calculateTotals(newItems) });
  };

  const updateItemQuantity = (index, delta) => {
    const newItems = form.items.map((item, idx) => {
      if (idx === index) {
        const newQty = Math.max(0, item.quantity + delta);
        return newQty === 0 ? null : { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean);
    setForm({ ...form, items: newItems, ...calculateTotals(newItems) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    try {
      await api('/api/sales-orders', { method: 'POST', body: JSON.stringify(form) });
      toast.success('Sales Order created');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api(`/api/sales-orders/${id}/status?status=${status}`, { method: 'PUT' });
      toast.success(`Order ${status}`);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      await api(`/api/sales-orders/${id}`, { method: 'DELETE' });
      toast.success('Order deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleConvertToInvoice = async (id) => {
    try {
      await api(`/api/sales-orders/${id}/convert-to-invoice`, { method: 'POST' });
      toast.success('Order converted to Invoice');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const resetForm = () => {
    setForm({
      customer_id: '', customer_name: 'Walk-in Customer', customer_phone: '',
      items: [], subtotal: 0, discount_amount: 0, tax_amount: 0, total_amount: 0,
      payment_terms: 'immediate', delivery_date: '', shipping_address: '', notes: '', store_id: ''
    });
  };

  // Quick Add Customer Handler
  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error('Name and phone are required');
      return;
    }
    try {
      const result = await api('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          ...newCustomer
        })
      });
      setCustomers([...customers, result]);
      setForm({
        ...form,
        customer_id: result.id,
        customer_name: result.name,
        customer_phone: result.phone || ''
      });
      setShowAddCustomer(false);
      setNewCustomer({ name: '', phone: '', email: '', gst_number: '', customer_type: 'retail' });
      toast.success('Customer added successfully');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Open Edit Order Modal
  const openEditOrder = (order) => {
    setEditForm({
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      customer_email: order.customer_email || '',
      shipping_address: order.shipping_address || '',
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
      await api(`/api/sales-orders/${editOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      toast.success('Order updated successfully');
      setEditOrder(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to update order');
    }
  };

  // Handle Approve Order
  const handleApproveOrder = async (order) => {
    try {
      await api(`/api/sales-orders/${order.id}/status?status=confirmed`, { method: 'PUT' });
      toast.success('Order approved successfully');
      setViewOrder(null);
      fetchData();
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
      await api(`/api/sales-orders/${orderToReject.id}/status?status=cancelled&reason=${encodeURIComponent(rejectReason)}`, { method: 'PUT' });
      toast.success('Order rejected');
      setShowRejectModal(false);
      setOrderToReject(null);
      setRejectReason('');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to reject order');
    }
  };

  const filteredOrders = orders.filter(o =>
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="sales-orders-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="invoiced">Invoiced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }} data-testid="new-order-btn">
          <Plus className="w-4 h-4 mr-2" /> New Order
        </Button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filteredOrders.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No sales orders found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-lg">{order.order_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                        {order.status?.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[order.payment_status] || PAYMENT_STATUS_COLORS.unpaid}`}>
                        {order.payment_status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="w-4 h-4" /> {order.customer_name}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(order.created_at).toLocaleDateString()}</span>
                      {order.quotation_number && <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> {order.quotation_number}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{currencySymbol}{order.total_amount?.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{order.items?.length || 0} items</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  <Button size="sm" variant="outline" onClick={() => setViewOrder(order)}><Eye className="w-4 h-4 mr-1" /> View</Button>
                  {order.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(order.id, 'confirmed')}><Check className="w-4 h-4 mr-1" /> Confirm</Button>
                  )}
                  {order.status === 'confirmed' && (
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(order.id, 'processing')}><Package className="w-4 h-4 mr-1" /> Process</Button>
                  )}
                  {order.status === 'processing' && (
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(order.id, 'ready')}><Check className="w-4 h-4 mr-1" /> Ready</Button>
                  )}
                  {order.status === 'ready' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(order.id, 'delivered')}><Truck className="w-4 h-4 mr-1" /> Deliver</Button>
                      <Button size="sm" onClick={() => handleConvertToInvoice(order.id)}><CreditCard className="w-4 h-4 mr-1" /> Create Invoice</Button>
                    </>
                  )}
                  {['pending', 'confirmed'].includes(order.status) && (
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusChange(order.id, 'cancelled')}><X className="w-4 h-4 mr-1" /> Cancel</Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-red-100" onClick={() => handleDeleteOrder(order.id)} title="Delete Order">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Order Modal */}
      <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Order Details - {viewOrder?.order_number}</span>
              <div className="flex gap-2">
                <Badge variant={viewOrder?.status === 'pending' ? 'secondary' : viewOrder?.status === 'confirmed' ? 'default' : 'outline'} className={STATUS_COLORS[viewOrder?.status]}>
                  {viewOrder?.status?.toUpperCase()}
                </Badge>
                <Badge variant={viewOrder?.payment_status === 'paid' ? 'default' : 'secondary'} className={PAYMENT_STATUS_COLORS[viewOrder?.payment_status]}>
                  {viewOrder?.payment_status?.toUpperCase()}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewOrder && (
            <div className="space-y-4">
              {/* Delivery Information Section */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Delivery Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Customer Name:</span>
                    <p className="font-medium">{viewOrder.customer_name || 'Walk-in Customer'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <p className="font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {viewOrder.customer_phone || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {viewOrder.customer_email || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Order Date:</span>
                    <p className="font-medium">{new Date(viewOrder.created_at).toLocaleString()}</p>
                  </div>
                  {viewOrder.delivery_date && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Delivery Date:</span>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(viewOrder.delivery_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {viewOrder.shipping_address && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Shipping Address:</span>
                      <p className="font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {viewOrder.shipping_address}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items Section */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Order Items
                </h4>
                {viewOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-2 border-b last:border-0">
                    <div>
                      <span className="font-medium">{item.item_name}</span>
                      <span className="text-muted-foreground ml-2">× {item.quantity}</span>
                    </div>
                    <span className="font-medium">{currencySymbol}{(item.quantity * item.rate).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="bg-accent/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal:</span><span>{currencySymbol}{viewOrder.subtotal?.toLocaleString()}</span></div>
                {viewOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600"><span>Discount:</span><span>-{currencySymbol}{viewOrder.discount_amount?.toLocaleString()}</span></div>
                )}
                <div className="flex justify-between"><span>Tax (GST):</span><span>{currencySymbol}{viewOrder.tax_amount?.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{currencySymbol}{viewOrder.total_amount?.toLocaleString()}</span></div>
              </div>

              {/* Notes */}
              {viewOrder.notes && (
                <div className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-950/30">
                  <p className="text-sm"><span className="font-medium">Notes:</span> {viewOrder.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
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
                    variant="default" 
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

      {/* Create Order Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Sales Order</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <div className="flex gap-2">
                  <Select value={form.customer_id || 'walkin'} onValueChange={(v) => {
                    const customer = customers.find(c => c.id === v);
                    setForm({ ...form, customer_id: v === 'walkin' ? '' : v, customer_name: customer?.name || 'Walk-in Customer', customer_phone: customer?.phone || '' });
                  }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walkin">Walk-in Customer</SelectItem>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowAddCustomer(true)}
                    className="flex-shrink-0 border-primary text-primary hover:bg-primary hover:text-white"
                    title="Add New Customer"
                    data-testid="quick-add-customer-btn"
                  >
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Delivery Date</Label>
                <Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select value={form.payment_terms} onValueChange={(v) => setForm({ ...form, payment_terms: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="net15">Net 15</SelectItem>
                    <SelectItem value="net30">Net 30</SelectItem>
                    <SelectItem value="cod">Cash on Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <Label className="mb-2 block">Add Items</Label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {items.map(item => (
                    <button key={item.id} type="button" onClick={() => addItemToOrder(item)} className="w-full flex justify-between p-2 rounded hover:bg-accent text-left">
                      <span className="text-sm">{item.name}</span>
                      <span className="text-sm">{currencySymbol}{item.selling_price?.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <Label className="mb-2 block">Order Items ({form.items.length})</Label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-accent/50 rounded">
                      <div><p className="text-sm font-medium">{item.item_name}</p><p className="text-xs text-muted-foreground">{currencySymbol}{item.rate} × {item.quantity}</p></div>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateItemQuantity(idx, -1)}>-</Button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateItemQuantity(idx, 1)}>+</Button>
                      </div>
                    </div>
                  ))}
                  {form.items.length === 0 && <p className="text-center text-muted-foreground py-4">No items added</p>}
                </div>
              </div>
            </div>

            <div className="bg-accent/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between"><span>Subtotal:</span><span>{currencySymbol}{form.subtotal?.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>CGST ({(form.gst_rate || 5) / 2}%):</span><span>{currencySymbol}{(form.tax_amount / 2)?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>SGST ({(form.gst_rate || 5) / 2}%):</span><span>{currencySymbol}{(form.tax_amount / 2)?.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{currencySymbol}{form.total_amount?.toLocaleString()}</span></div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">Create Order</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Add Customer Modal */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add New Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Enter customer name"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomer()}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="Enter phone number"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomer()}
              />
            </div>
            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="Enter email"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomer()}
              />
            </div>
            <div className="space-y-2">
              <Label>Customer Type *</Label>
              <Select 
                value={newCustomer.customer_type} 
                onValueChange={(v) => setNewCustomer({ ...newCustomer, customer_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>GST Number (Optional)</Label>
              <Input
                value={newCustomer.gst_number}
                onChange={(e) => setNewCustomer({ ...newCustomer, gst_number: e.target.value })}
                placeholder="Enter GSTIN"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
              <Button onClick={handleAddCustomer} disabled={!newCustomer.name || !newCustomer.phone}>
                <Plus className="w-4 h-4 mr-2" /> Add Customer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Order Modal */}
      <Dialog open={!!editOrder} onOpenChange={() => setEditOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              Edit Order - {editOrder?.order_number}
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
              Reject Order - {orderToReject?.order_number}
            </DialogTitle>
            <DialogDescription>
              This action will cancel the order. Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Customer:</span> {orderToReject?.customer_name}
              </p>
              <p className="text-sm">
                <span className="font-medium">Total:</span> {currencySymbol}{orderToReject?.total_amount?.toLocaleString()}
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
