import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  Plus, Search, RotateCcw, ArrowLeftRight, Package, Receipt, 
  User, Calendar, Check, X, Download, Eye, Printer, Tag, Edit, Trash2, MoreVertical
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../components/ui/dropdown-menu';

export default function SalesReturnsPage() {
  const { api } = useAuth();
  const { formatWithConversion } = useCurrency();
  const [returns, setReturns] = useState([]);
  const [form, setForm] = useState(false);
  const [exchanges, setExchanges] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('return'); // 'return' or 'exchange'
  const [search, setSearch] = useState('');
  
  // Form state
  // NOTE: Avoid `null` initial state for objects that drive conditional UI.
  // Toggling between `null` and an object can cause a brief unmount/remount flash.
  // Use a stable "empty" object shape instead.
  const EMPTY_INVOICE = {};
  const EMPTY_VIEW_ITEM = {};

  const [selectedInvoice, setSelectedInvoice] = useState(EMPTY_INVOICE);
  const [selectedItems, setSelectedItems] = useState([]);
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [exchangeItems, setExchangeItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewItem, setViewItem] = useState(EMPTY_VIEW_ITEM);
  const [showViewModal, setShowViewModal] = useState(false);

  // Return reasons
  const RETURN_REASONS = [
    'Defective/Damaged Product',
    'Wrong Item Delivered',
    'Size/Fit Issue',
    'Color Mismatch',
    'Quality Not As Expected',
    'Changed Mind',
    'Late Delivery',
    'Other'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [returnsData, salesData, itemsData] = await Promise.all([
        api('/api/sales-returns'),
        api('/api/sales'),  // Use sales instead of invoices - they have the items
        api('/api/items'),
      ]);
      setReturns(returnsData.filter(r => r.type === 'return') || []);
      setExchanges(returnsData.filter(r => r.type === 'exchange') || []);
      setInvoices(salesData || []);  // Sales are used as invoices for returns
      setItems(itemsData || []);
    } catch (err) {
      // Initialize with empty arrays if endpoints don't exist
      setReturns([]);
      setExchanges([]);
      setInvoices([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Search invoices
  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Open return/exchange modal
  const openModal = (type) => {
    setModalType(type);
    setShowModal(true);
    resetForm();
  };

  const resetForm = () => {
    setSelectedInvoice(null);
    setSelectedItems([]);
    setReason('');
    setRefundMethod('cash');
    setExchangeItems([]);
    setNotes('');
    setSearch('');
  };

  // Select invoice
  const selectInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setSelectedItems([]);
  };

  // Toggle item selection
  const toggleItemSelection = (item) => {
    const existing = selectedItems.find(i => i.item_id === item.item_id);
    if (existing) {
      setSelectedItems(prev => prev.filter(i => i.item_id !== item.item_id));
    } else {
      setSelectedItems(prev => [...prev, { ...item, return_qty: 1 }]);
    }
  };

  // Update return quantity
  const updateReturnQty = (itemId, qty) => {
    setSelectedItems(prev => prev.map(i => 
      i.item_id === itemId 
        ? { ...i, return_qty: Math.max(1, Math.min(qty, i.quantity)) }
        : i
    ));
  };

  // Add exchange item
  const addExchangeItem = (item) => {
    // Get price from variant if item selling_price is 0
    const price = item.selling_price || item.variants?.[0]?.selling_price || 0;
    const variantId = item.variants?.[0]?.id || item.id;
    
    const existing = exchangeItems.find(i => i.id === item.id);
    if (existing) {
      setExchangeItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, qty: i.qty + 1 } : i
      ));
    } else {
      setExchangeItems(prev => [...prev, { ...item, qty: 1, selling_price: price, variant_id: variantId }]);
    }
  };

  // Remove exchange item
  const removeExchangeItem = (itemId) => {
    setExchangeItems(prev => prev.filter(i => i.id !== itemId));
  };

  // Calculate totals
  const returnTotal = selectedItems.reduce((sum, i) => sum + (i.rate * i.return_qty), 0);
  const exchangeTotal = exchangeItems.reduce((sum, i) => sum + (i.selling_price * i.qty), 0);
  const difference = exchangeTotal - returnTotal;

  // Submit return/exchange
  const submitReturnExchange = async () => {
    if (!selectedInvoice) {
      toast.error('Please select an invoice');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Please select items to return');
      return;
    }
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }
    if (modalType === 'exchange' && exchangeItems.length === 0) {
      toast.error('Please select exchange items');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/sales-returns', {
        method: 'POST',
        body: JSON.stringify({
          type: modalType,
          invoice_id: selectedInvoice.id,
          invoice_number: selectedInvoice.invoice_number,
          customer_id: selectedInvoice.customer_id,
          customer_name: selectedInvoice.customer_name,
          return_items: selectedItems.map(i => ({
            item_id: i.item_id,
            variant_id: i.variant_id,  // Include variant_id for inventory updates
            item_name: i.item_name,
            size: i.size,
            color: i.color,
            quantity: i.return_qty,
            rate: i.rate,
            amount: i.rate * i.return_qty
          })),
          exchange_items: modalType === 'exchange' ? exchangeItems.map(i => ({
            item_id: i.id,
            variant_id: i.variant_id || i.id,  // Include variant_id
            item_name: i.name,
            quantity: i.qty,
            rate: i.selling_price,
            amount: i.selling_price * i.qty
          })) : [],
          return_amount: returnTotal,
          exchange_amount: exchangeTotal,
          difference_amount: difference,
          refund_method: refundMethod,
          reason: reason,
          notes: notes
        })
      });
      toast.success(`${modalType === 'return' ? 'Return' : 'Exchange'} processed successfully`);
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to process');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve/Reject return
  const updateStatus = async (id, status) => {
    try {
      await api(`/api/sales-returns/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      toast.success(`Status updated to ${status}`);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Delete return/exchange
  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete ${item.type === 'return' ? 'return' : 'exchange'} #${item.return_number}?`)) return;
    try {
      await api(`/api/sales-returns/${item.id}`, { method: 'DELETE' });
      toast.success('Record deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  // View details
  const openViewModal = (item) => {
    setViewItem(item);
    setShowViewModal(true);
  };

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  // Render table
  const renderTable = (data, type) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{type === 'return' ? 'Return' : 'Exchange'} #</TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead className="text-right">Items</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
              No {type}s found
            </TableCell>
          </TableRow>
        ) : (
          data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono-data font-medium">{item.return_number}</TableCell>
              <TableCell className="font-mono-data">{item.invoice_number}</TableCell>
              <TableCell>{item.customer_name}</TableCell>
              <TableCell className="text-right">{item.return_items?.length || 0}</TableCell>
              <TableCell className="text-right font-mono-data">
                {formatWithConversion(item.return_amount)}
              </TableCell>
              <TableCell className="max-w-[150px] truncate" title={item.reason}>
                {item.reason}
              </TableCell>
              <TableCell>
                <Badge className={statusColors[item.status] || ''}>
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`return-actions-${item.id}`}>
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl w-48">
                    <DropdownMenuItem onClick={() => openViewModal(item)} className="rounded-lg">
                      <Eye className="w-4 h-4 mr-2" /> View Details
                    </DropdownMenuItem>
                    {item.status === 'pending' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => updateStatus(item.id, 'approved')} className="rounded-lg text-green-600">
                          <Check className="w-4 h-4 mr-2" /> Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(item.id, 'rejected')} className="rounded-lg text-red-600">
                          <X className="w-4 h-4 mr-2" /> Reject
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleDelete(item)} className="rounded-lg text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6" data-testid="sales-returns-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Sales Returns & Exchanges</h2>
          <p className="text-sm text-muted-foreground">Process returns, exchanges, and refunds</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openModal('return')} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
            <RotateCcw className="w-4 h-4 mr-2" /> New Return
          </Button>
          <Button onClick={() => openModal('exchange')} className="bg-blue-600 hover:bg-blue-700">
            <ArrowLeftRight className="w-4 h-4 mr-2" /> New Exchange
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <RotateCcw className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{returns.length}</p>
                <p className="text-xs text-muted-foreground">Total Returns</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{exchanges.length}</p>
                <p className="text-xs text-muted-foreground">Total Exchanges</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {returns.filter(r => r.status === 'pending').length + exchanges.filter(e => e.status === 'pending').length}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatWithConversion(
                    [...returns, ...exchanges]
                      .filter(r => r.status === 'approved' || r.status === 'completed')
                      .reduce((sum, r) => sum + (r.return_amount || 0), 0)
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Processed Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="returns">
        <TabsList>
          <TabsTrigger value="returns" className="gap-2">
            <RotateCcw className="w-4 h-4" /> Returns ({returns.length})
          </TabsTrigger>
          <TabsTrigger value="exchanges" className="gap-2">
            <ArrowLeftRight className="w-4 h-4" /> Exchanges ({exchanges.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="returns" className="mt-4">
          <Card>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              renderTable(returns, 'return')
            )}
          </Card>
        </TabsContent>

        <TabsContent value="exchanges" className="mt-4">
          <Card>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              renderTable(exchanges, 'exchange')
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Return/Exchange Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalType === 'return' ? (
                <><RotateCcw className="w-5 h-5 text-red-500" /> Process Return</>
              ) : (
                <><ArrowLeftRight className="w-5 h-5 text-blue-500" /> Process Exchange</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {!selectedInvoice ? (
              /* Step 1: Select Invoice */
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by invoice number or customer name..."
                    className="pl-10"
                  />
                </div>

                <div className="border rounded-lg max-h-72 overflow-y-auto">
                  {filteredInvoices.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No invoices found
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredInvoices.slice(0, 20).map(inv => (
                        <div 
                          key={inv.id}
                          onClick={() => selectInvoice(inv)}
                          className="p-3 hover:bg-accent cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <p className="font-mono font-medium">{inv.invoice_number}</p>
                            <p className="text-sm text-muted-foreground">
                              <User className="w-3 h-3 inline mr-1" />
                              {inv.customer_name || 'Walk-in'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatWithConversion(inv.total_amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(inv.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Step 2: Select Items & Details */
              <div className="space-y-4">
                {/* Selected Invoice Info */}
                <div className="p-3 bg-accent rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-mono font-medium">{selectedInvoice.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">{selectedInvoice.customer_name || 'Walk-in'}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}>
                    Change
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Left: Return Items */}
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" /> Items to Return
                      {selectedItems.length === 0 && (
                        <span className="text-xs text-amber-600 font-normal">(Click items below to select)</span>
                      )}
                    </h4>
                    <div className="border rounded-lg max-h-40 overflow-y-auto divide-y bg-white dark:bg-gray-950">
                      {selectedInvoice?.items?.map((item) => {
                        const isSelected = selectedItems.find(i => i.item_id === item.item_id);
                        return (
                          <div 
                            key={item.item_id}
                            className={`p-3 cursor-pointer transition-colors ${
                              isSelected 
                                ? 'bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500' 
                                : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                            }`}
                            onClick={() => toggleItemSelection(item)}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  isSelected 
                                    ? 'bg-red-500 border-red-500' 
                                    : 'border-gray-300'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{item.item_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.size && `${item.size} `}{item.color && `/ ${item.color} `}
                                    • Qty: {item.quantity} × {formatWithConversion(item.rate)}
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-xs text-muted-foreground">Return:</span>
                                  <Input 
                                    type="number"
                                    min="1"
                                    max={item.quantity}
                                    value={isSelected.return_qty}
                                    onChange={(e) => updateReturnQty(item.item_id, parseInt(e.target.value) || 1)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-16 h-7 text-xs text-center"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {selectedItems.length} item(s) selected
                      </span>
                      <p className="text-sm font-medium">
                        Return Total: <span className={`${returnTotal > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{formatWithConversion(returnTotal)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Exchange Items (only for exchange) */}
                  {modalType === 'exchange' && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Tag className="w-4 h-4" /> Exchange With
                      </h4>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Search items..." className="pl-10 h-9" />
                      </div>
                      <div className="border rounded-lg max-h-32 overflow-y-auto divide-y">
                        {items.slice(0, 10).map(item => (
                          <div 
                            key={item.id}
                            onClick={() => addExchangeItem(item)}
                            className="p-2 cursor-pointer hover:bg-accent"
                          >
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{formatWithConversion(item.selling_price)}</p>
                          </div>
                        ))}
                      </div>

                      {/* Selected Exchange Items */}
                      {exchangeItems.length > 0 && (
                        <div className="border rounded-lg p-2 bg-blue-50 dark:bg-blue-900/20">
                          {exchangeItems.map(item => (
                            <div key={item.id} className="flex justify-between items-center py-1">
                              <span className="text-sm">{item.name} × {item.qty}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{formatWithConversion(item.selling_price * item.qty)}</span>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => removeExchangeItem(item.id)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-sm font-medium text-right">
                        Exchange Total: <span className="text-blue-600">{formatWithConversion(exchangeTotal)}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Reason & Details */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Reason for {modalType} *</Label>
                    <Select value={reason} onValueChange={setReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {RETURN_REASONS.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Refund Method</Label>
                    <Select value={refundMethod} onValueChange={setRefundMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="store_credit">Store Credit</SelectItem>
                        <SelectItem value="original_method">Original Payment Method</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    className="h-16"
                  />
                </div>

                {/* Summary */}
                {modalType === 'exchange' && (
                  <div className="p-4 bg-accent rounded-lg">
                    <div className="flex justify-between items-center">
                      <span>Return Value:</span>
                      <span className="text-red-600">-{formatWithConversion(returnTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Exchange Value:</span>
                      <span className="text-blue-600">+{formatWithConversion(exchangeTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold border-t pt-2 mt-2">
                      <span>{difference >= 0 ? 'Customer Pays:' : 'Refund to Customer:'}</span>
                      <span className={difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatWithConversion(Math.abs(difference))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            {selectedInvoice && (
              <Button 
                onClick={() => {
                  // Show specific validation messages
                  if (selectedItems.length === 0) {
                    toast.error('Please select items to return by clicking on them');
                    return;
                  }
                  if (!reason) {
                    toast.error('Please select a reason for return');
                    return;
                  }
                  if (modalType === 'exchange' && exchangeItems.length === 0) {
                    toast.error('Please select items to exchange with');
                    return;
                  }
                  submitReturnExchange();
                }}
                disabled={submitting}
                className={modalType === 'return' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                {submitting ? 'Processing...' : `Process ${modalType === 'return' ? 'Return' : 'Exchange'}`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Details Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" /> {viewItem?.type === 'return' ? 'Return' : 'Exchange'} Details
            </DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{viewItem.type === 'return' ? 'Return' : 'Exchange'} #</p>
                  <p className="font-mono font-medium">{viewItem.return_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Invoice #</p>
                  <p className="font-mono">{viewItem.invoice_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{viewItem.customer_name || 'Walk-in'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={statusColors[viewItem.status] || ''}>{viewItem.status}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p>{new Date(viewItem.created_at).toLocaleDateString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Refund Method</p>
                  <p className="capitalize">{viewItem.refund_method?.replace('_', ' ') || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Reason</p>
                <p className="p-2 bg-accent rounded-lg text-sm">{viewItem.reason}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Returned Items ({viewItem.return_items?.length || 0})</p>
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {viewItem.return_items?.map((item, idx) => (
                    <div key={idx} className="p-2 border-b last:border-0 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.size && `${item.size} `}{item.color && `/ ${item.color}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{item.quantity} × {formatWithConversion(item.rate)}</p>
                        <p className="font-medium text-sm">{formatWithConversion(item.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {viewItem.type === 'exchange' && viewItem.exchange_items?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Exchange Items ({viewItem.exchange_items.length})</p>
                  <div className="border rounded-lg max-h-40 overflow-y-auto bg-blue-50 dark:bg-blue-900/20">
                    {viewItem.exchange_items.map((item, idx) => (
                      <div key={idx} className="p-2 border-b last:border-0 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">{item.item_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{item.quantity} × {formatWithConversion(item.rate)}</p>
                          <p className="font-medium text-sm text-blue-600">{formatWithConversion(item.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 p-3 bg-accent rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Return Amount</p>
                  <p className="font-bold text-lg text-red-600">{formatWithConversion(viewItem.return_amount)}</p>
                </div>
                {viewItem.type === 'exchange' && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Exchange Amount</p>
                      <p className="font-bold text-lg text-blue-600">{formatWithConversion(viewItem.exchange_amount)}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Difference</p>
                      <p className={`font-bold text-lg ${viewItem.difference_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {viewItem.difference_amount >= 0 ? '+' : ''}{formatWithConversion(viewItem.difference_amount)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {viewItem.notes && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="p-2 bg-accent rounded-lg text-sm">{viewItem.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowViewModal(false)}>Close</Button>
                {viewItem.status === 'pending' && (
                  <>
                    <Button onClick={() => { updateStatus(viewItem.id, 'approved'); setShowViewModal(false); }} className="bg-green-600 hover:bg-green-700">
                      <Check className="w-4 h-4 mr-2" /> Approve
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
