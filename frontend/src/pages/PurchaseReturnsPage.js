import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { Plus, Eye, Trash2, RotateCcw, CheckCircle, XCircle, Clock, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';

export default function PurchaseReturnsPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  // FIX (state_flash): `selectedInvoice` was initialized with `null`, which is commonly used in JSX guards.
  // During initial render (and when opening the modal), this can cause sections to briefly unmount/remount
  // as data arrives, appearing as a visual flash.
  // Use a stable empty object and validate selection by `id` when submitting.
  const [showDetail, setShowDetail] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState({});
  const [returnItems, setReturnItems] = useState([]);
  const [form, setForm] = useState({
    return_date: new Date().toISOString().split('T')[0],
    return_reason: '',
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoice?.id) {
      toast.error('Please select an invoice');
      return;
    }
    const itemsToReturn = returnItems.filter(it => it.return_qty > 0);
    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    try {
      const payload = {
        purchase_invoice_id: selectedInvoice.id,
        supplier_id: selectedInvoice.supplier_id,
        store_id: selectedInvoice.store_id,
        return_date: form.return_date,
        items: itemsToReturn.map(it => ({
          item_id: it.item_id,
          variant_id: it.variant_id,
          quantity: it.return_qty,
          rate: it.rate,
          reason: it.reason || form.return_reason
        })),
        subtotal: calcRefund(),
        refund_amount: calcRefund(),
        return_reason: form.return_reason,
        notes: form.notes
      };
      await api('/api/purchase-returns', { method: 'POST', body: JSON.stringify(payload) });
      toast.success('Purchase return created successfully');
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create purchase return');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [d1, d2, d3, d4, d5] = await Promise.all([
        api('/api/purchase-returns'),
        api('/api/purchase-invoices'),
        api('/api/suppliers'),
        api('/api/stores'),
        api('/api/items')
      ]);
      setReturns(d1);
      setInvoices(d2);
      setSuppliers(d3);
      setStores(d4);
      setItems(d5);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getSupplierName = (id) => suppliers.find(x => x.id === id)?.name || '-';
  const getStoreName = (id) => stores.find(x => x.id === id)?.name || '-';
  const getItemName = (id) => items.find(x => x.id === id)?.name || 'Unknown';

  const openModal = () => {
    setSelectedInvoice(null);
    setReturnItems([]);
    setForm({ return_date: new Date().toISOString().split('T')[0], return_reason: '', notes: '' });
    setShowModal(true);
  };

  const handleInvoiceSelect = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (inv) {
      setSelectedInvoice(inv);
      setReturnItems(inv.items.map(it => ({
        ...it,
        return_qty: 0,
        reason: ''
      })));
    }
  };

  const updateReturnQty = (idx, qty) => {
    const updated = [...returnItems];
    const maxQty = updated[idx].quantity || 0;
    updated[idx].return_qty = Math.min(Math.max(0, qty), maxQty);
    setReturnItems(updated);
  };

  const updateReturnReason = (idx, reason) => {
    const updated = [...returnItems];
    updated[idx].reason = reason;
    setReturnItems(updated);
  };

  const calcRefund = () => {
    return returnItems.reduce((sum, it) => sum + (it.return_qty * it.rate), 0);
  };

  const updateStatus = async (id, status) => {
    try {
      await api(`/api/purchase-returns/${id}/status?status=${status}`, { method: 'PUT' });
      toast.success('Status updated');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteReturn = async (id) => {
    if (!window.confirm('Delete this return?')) return;
    try {
      await api(`/api/purchase-returns/${id}`, { method: 'DELETE' });
      toast.success('Return deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const totalReturns = returns.reduce((s, r) => s + (r.refund_amount || 0), 0);
  const pendingReturns = returns.filter(r => r.status === 'pending');
  const completedReturns = returns.filter(r => r.status === 'completed');

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved': return <Badge variant="outline" className="border-blue-500 text-blue-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'completed': return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="purchase-returns-page">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <RotateCcw className="w-8 h-8 text-orange-600 mb-2" />
          <p className="text-sm text-muted-foreground">Total Returns</p>
          <p className="text-2xl font-bold">{currencySymbol}{totalReturns.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <Clock className="w-8 h-8 text-amber-600 mb-2" />
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{pendingReturns.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <CheckCircle className="w-8 h-8 text-emerald-600 mb-2" />
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-emerald-600">{completedReturns.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <Package className="w-8 h-8 text-purple-600 mb-2" />
          <p className="text-sm text-muted-foreground">Total Returns</p>
          <p className="text-2xl font-bold">{returns.length}</p>
        </CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={openModal} data-testid="add-return-btn">
          <Plus className="w-4 h-4 mr-2" /> New Return
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Purchase Returns</CardTitle></CardHeader>
        <CardContent>
          {returns.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No purchase returns yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left p-3">Return #</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Invoice</th>
                  <th className="text-left p-3">Supplier</th>
                  <th className="text-right p-3">Refund</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Actions</th>
                </tr></thead>
                <tbody>
                  {returns.map((ret) => (
                    <tr key={ret.id} className="border-b hover:bg-accent/30">
                      <td className="p-3 font-medium">{ret.return_number}</td>
                      <td className="p-3">{ret.return_date}</td>
                      <td className="p-3">{invoices.find(i => i.id === ret.purchase_invoice_id)?.invoice_number || '-'}</td>
                      <td className="p-3">{getSupplierName(ret.supplier_id)}</td>
                      <td className="p-3 text-right font-bold text-orange-600">{currencySymbol}{ret.refund_amount?.toLocaleString()}</td>
                      <td className="p-3 text-center">{getStatusBadge(ret.status)}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setShowDetail(ret)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {ret.status === 'pending' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => updateStatus(ret.id, 'approved')}>
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus(ret.id, 'rejected')}>
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {ret.status === 'approved' && (
                            <Button size="sm" variant="default" onClick={() => updateStatus(ret.id, 'completed')}>
                              Complete
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteReturn(ret.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Return Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Return</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Purchase Invoice *</Label>
                <Select onValueChange={handleInvoiceSelect}>
                  <SelectTrigger><SelectValue placeholder="Select invoice to return" /></SelectTrigger>
                  <SelectContent>
                    {invoices.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number} - {getSupplierName(inv.supplier_id)} ({currencySymbol}{inv.total_amount?.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Return Date *</Label>
                <Input type="date" value={form.return_date} onChange={(e) => setForm({...form, return_date: e.target.value})} required />
              </div>
            </div>

            {selectedInvoice && (
              <>
                <div className="bg-accent/50 p-3 rounded-lg text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <div><span className="text-muted-foreground">Supplier:</span> {getSupplierName(selectedInvoice.supplier_id)}</div>
                    <div><span className="text-muted-foreground">Store:</span> {getStoreName(selectedInvoice.store_id)}</div>
                    <div><span className="text-muted-foreground">Invoice Total:</span> {currencySymbol}{selectedInvoice.total_amount?.toLocaleString()}</div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <Label className="text-base font-semibold">Select Items to Return</Label>
                  {returnItems.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">No items in this invoice</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                        <div className="col-span-4">Item</div>
                        <div className="col-span-2">Purchased</div>
                        <div className="col-span-2">Return Qty</div>
                        <div className="col-span-2">Rate</div>
                        <div className="col-span-2">Refund</div>
                      </div>
                      {returnItems.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-accent/30 p-2 rounded">
                          <div className="col-span-4 text-sm">{getItemName(it.item_id)}</div>
                          <div className="col-span-2 text-sm">{it.quantity}</div>
                          <div className="col-span-2">
                            <Input 
                              type="number" 
                              min="0" 
                              max={it.quantity} 
                              value={it.return_qty} 
                              onChange={(e) => updateReturnQty(idx, parseInt(e.target.value) || 0)} 
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-2 text-sm">{currencySymbol}{it.rate}</div>
                          <div className="col-span-2 text-sm font-bold text-orange-600">{currencySymbol}{(it.return_qty * it.rate).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Return Reason</Label>
                  <Input value={form.return_reason} onChange={(e) => setForm({...form, return_reason: e.target.value})} placeholder="e.g., Damaged goods, Wrong items, Quality issues" />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Additional notes..." />
                </div>

                <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Refund Amount:</span>
                    <span className="text-2xl font-bold text-orange-600">{currencySymbol}{calcRefund().toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" disabled={!selectedInvoice}>Create Return</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Return Details - {showDetail?.return_number}</DialogTitle></DialogHeader>
          {showDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Supplier:</span> {getSupplierName(showDetail.supplier_id)}</div>
                <div><span className="text-muted-foreground">Store:</span> {getStoreName(showDetail.store_id)}</div>
                <div><span className="text-muted-foreground">Date:</span> {showDetail.return_date}</div>
                <div><span className="text-muted-foreground">Status:</span> {getStatusBadge(showDetail.status)}</div>
              </div>
              {showDetail.return_reason && (
                <div className="text-sm"><span className="text-muted-foreground">Reason:</span> {showDetail.return_reason}</div>
              )}
              {showDetail.items?.length > 0 && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium mb-2">Returned Items</h4>
                  <div className="space-y-2">
                    {showDetail.items.map((it, i) => (
                      <div key={i} className="flex justify-between items-center bg-accent/30 p-2 rounded text-sm">
                        <div>
                          <span className="font-medium">{getItemName(it.item_id)}</span>
                          <span className="text-muted-foreground ml-2">x{it.quantity}</span>
                        </div>
                        <span className="font-bold text-orange-600">{currencySymbol}{(it.quantity * it.rate).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg flex justify-between items-center">
                <span className="font-semibold">Total Refund:</span>
                <span className="text-xl font-bold text-orange-600">{currencySymbol}{showDetail.refund_amount?.toLocaleString()}</span>
              </div>
              {showDetail.notes && <p className="text-sm text-muted-foreground">Notes: {showDetail.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
