import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import {
  FileText, Plus, Search, Eye, Edit, Trash2, Send, Check, X,
  ArrowRight, Clock, Calendar, User, Phone, Mail, ChevronRight, UserPlus
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-purple-100 text-purple-700'
};

export default function QuotationsPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  // FIX: Use a stable sentinel for "no quotation selected" to avoid UI flashing.
  // Some render paths may treat `undefined`/`null` differently; we always use `null`
  // (and we also reset back to `null` in `resetForm()`), keeping checks consistent.
  const [editQuotation, setEditQuotation] = useState(null);

  // Quick Add Customer state
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  
  const [form, setForm] = useState({
    customer_id: '', customer_name: 'Walk-in Customer', customer_phone: '', customer_email: '',
    items: [], subtotal: 0, discount_amount: 0, discount_percent: 0, tax_amount: 0, total_amount: 0,
    notes: '', valid_until: '', store_id: ''
  });

  const fetchData = async () => {
    try {
      const [quotationsData, customersData, itemsData] = await Promise.all([
        api(`/api/quotations?status=${statusFilter}`),
        api('/api/customers'),
        api('/api/items')
      ]);
      setQuotations(quotationsData);
      setCustomers(customersData);
      setItems(itemsData);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const calculateTotals = (cartItems, discountPercent = 0) => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const discountAmount = subtotal * (discountPercent / 100);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * 0.18; // 18% GST
    const total = taxableAmount + taxAmount;
    return { subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total_amount: total };
  };

  const addItemToQuotation = (item) => {
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
    const totals = calculateTotals(newItems, form.discount_percent);
    setForm({ ...form, items: newItems, ...totals });
  };

  const updateItemQuantity = (index, delta) => {
    const newItems = form.items.map((item, idx) => {
      if (idx === index) {
        const newQty = Math.max(0, item.quantity + delta);
        return newQty === 0 ? null : { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean);
    const totals = calculateTotals(newItems, form.discount_percent);
    setForm({ ...form, items: newItems, ...totals });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    try {
      if (editQuotation) {
        await api(`/api/quotations/${editQuotation.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast.success('Quotation updated');
      } else {
        await api('/api/quotations', { method: 'POST', body: JSON.stringify(form) });
        toast.success('Quotation created');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api(`/api/quotations/${id}/status?status=${status}`, { method: 'PUT' });
      toast.success(`Quotation ${status}`);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleConvertToOrder = async (id) => {
    try {
      await api(`/api/quotations/${id}/convert-to-order`, { method: 'POST' });
      toast.success('Quotation converted to Sales Order');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
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
          ...newCustomer,
          customer_type: 'retail'
        })
      });
      setCustomers([...customers, result]);
      setForm({
        ...form,
        customer_id: result.id,
        customer_name: result.name,
        customer_phone: result.phone || '',
        customer_email: result.email || ''
      });
      setShowAddCustomer(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      toast.success('Customer added successfully');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEdit = (quotation) => {
    setEditQuotation(quotation);
    setForm({
      customer_id: quotation.customer_id || '', customer_name: quotation.customer_name,
      customer_phone: quotation.customer_phone || '', customer_email: quotation.customer_email || '',
      items: quotation.items || [], subtotal: quotation.subtotal, discount_amount: quotation.discount_amount,
      discount_percent: quotation.discount_percent || 0, tax_amount: quotation.tax_amount,
      total_amount: quotation.total_amount, notes: quotation.notes || '', valid_until: quotation.valid_until || '',
      store_id: quotation.store_id || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditQuotation(null);
    setForm({
      customer_id: '', customer_name: 'Walk-in Customer', customer_phone: '', customer_email: '',
      items: [], subtotal: 0, discount_amount: 0, discount_percent: 0, tax_amount: 0, total_amount: 0,
      notes: '', valid_until: '', store_id: ''
    });
  };

  const filteredQuotations = quotations.filter(q =>
    q.quotation_number?.toLowerCase().includes(search.toLowerCase()) ||
    q.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="quotations-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search quotations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }} data-testid="new-quotation-btn">
          <Plus className="w-4 h-4 mr-2" /> New Quotation
        </Button>
      </div>

      {/* Quotations List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filteredQuotations.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No quotations found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredQuotations.map((q) => (
            <Card key={q.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-lg">{q.quotation_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[q.status] || STATUS_COLORS.draft}`}>
                        {q.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="w-4 h-4" /> {q.customer_name}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(q.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{currencySymbol}{q.total_amount?.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{q.items?.length || 0} items</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button size="sm" variant="outline" onClick={() => openEdit(q)}><Edit className="w-4 h-4 mr-1" /> Edit</Button>
                  {q.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(q.id, 'sent')}><Send className="w-4 h-4 mr-1" /> Send</Button>
                  )}
                  {q.status === 'sent' && (
                    <>
                      <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleStatusChange(q.id, 'accepted')}><Check className="w-4 h-4 mr-1" /> Accept</Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusChange(q.id, 'rejected')}><X className="w-4 h-4 mr-1" /> Reject</Button>
                    </>
                  )}
                  {q.status === 'accepted' && (
                    <Button size="sm" onClick={() => handleConvertToOrder(q.id)}><ArrowRight className="w-4 h-4 mr-1" /> Convert to Order</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editQuotation ? 'Edit Quotation' : 'New Quotation'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Customer Selection */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <div className="flex gap-2">
                  <Select value={form.customer_id || 'walkin'} onValueChange={(v) => {
                    const customer = customers.find(c => c.id === v);
                    setForm({
                      ...form, customer_id: v === 'walkin' ? '' : v,
                      customer_name: customer?.name || 'Walk-in Customer',
                      customer_phone: customer?.phone || '', customer_email: customer?.email || ''
                    });
                  }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walkin">Walk-in Customer</SelectItem>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.phone}</SelectItem>)}
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
                <Label>Phone</Label>
                <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>

            {/* Items Selection */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <Label className="mb-2 block">Add Items</Label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {items.map(item => (
                    <button key={item.id} type="button" onClick={() => addItemToQuotation(item)}
                      className="w-full flex items-center justify-between p-2 rounded hover:bg-accent text-left">
                      <span className="font-medium text-sm">{item.name}</span>
                      <span className="text-sm">{currencySymbol}{item.selling_price?.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <Label className="mb-2 block">Quotation Items ({form.items.length})</Label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-accent/50 rounded">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">{currencySymbol}{item.rate} × {item.quantity}</p>
                      </div>
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

            {/* Totals */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount %</Label>
                <Input type="number" min="0" max="100" value={form.discount_percent}
                  onChange={(e) => {
                    const percent = parseFloat(e.target.value) || 0;
                    const totals = calculateTotals(form.items, percent);
                    setForm({ ...form, discount_percent: percent, ...totals });
                  }} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any notes..." />
              </div>
            </div>

            <div className="bg-accent/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between"><span>Subtotal:</span><span>{currencySymbol}{form.subtotal?.toLocaleString()}</span></div>
              {form.discount_amount > 0 && <div className="flex justify-between text-green-600"><span>Discount:</span><span>-{currencySymbol}{form.discount_amount?.toLocaleString()}</span></div>}
              <div className="flex justify-between"><span>CGST ({(form.gst_rate || 5) / 2}%):</span><span>{currencySymbol}{(form.tax_amount / 2)?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>SGST ({(form.gst_rate || 5) / 2}%):</span><span>{currencySymbol}{(form.tax_amount / 2)?.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{currencySymbol}{form.total_amount?.toLocaleString()}</span></div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">{editQuotation ? 'Update' : 'Create'} Quotation</Button>
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
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
              <Button onClick={handleAddCustomer} disabled={!newCustomer.name || !newCustomer.phone}>
                <Plus className="w-4 h-4 mr-2" /> Add Customer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
