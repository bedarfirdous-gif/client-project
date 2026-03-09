import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  Truck, Package, MapPin, Clock, CheckCircle, AlertCircle, 
  Search, Filter, Calendar, User, Phone, RefreshCw,
  ChevronDown, ChevronUp, Eye, Edit, XCircle, Navigation
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

// Delivery status configurations
const DELIVERY_STATUSES = {
  pending: { label: 'Pending', color: 'bg-gray-500', icon: Clock },
  processing: { label: 'Processing', color: 'bg-blue-500', icon: Package },
  dispatched: { label: 'Dispatched', color: 'bg-amber-500', icon: Truck },
  in_transit: { label: 'In Transit', color: 'bg-purple-500', icon: Navigation },
  delivered: { label: 'Delivered', color: 'bg-green-500', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-500', icon: XCircle },
  returned: { label: 'Returned', color: 'bg-orange-500', icon: AlertCircle },
};

export default function SalesDeliveryPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  // Fix: avoid null initial state to prevent a render pass where UI briefly hides (flash)
  // when selectedDelivery transitions from null -> object.
  // Use a stable default object + an explicit flag for "has selection".
  const [selectedDelivery, setSelectedDelivery] = useState({});
  const [hasSelectedDelivery, setHasSelectedDelivery] = useState(false);
  const [saving, setSaving] = useState(false);

  const [updateForm, setUpdateForm] = useState({
    status: '',
    notes: '',
    delivery_person: '',
    delivery_phone: '',
  });

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      // Fetch sales/invoices that need delivery tracking
      const [salesData, invoicesData] = await Promise.all([
        api('/api/sales').catch(() => []),
        api('/api/invoices').catch(() => []),
      ]);

      // Combine and create delivery records
      const allDeliveries = [
        ...salesData.map(s => ({
          id: s.id,
          type: 'sale',
          order_number: s.invoice_number || `SALE-${s.id?.slice(-6)}`,
          customer_name: s.customer_name || 'Walk-in Customer',
          customer_phone: s.customer_phone || '',
          customer_address: s.customer_address || s.delivery_address || '',
          total_amount: s.total_amount || 0,
          items_count: (s.items || []).length,
          created_at: s.sale_date || s.created_at,
          status: s.delivery_status || 'pending',
          delivery_person: s.delivery_person || '',
          delivery_phone: s.delivery_phone || '',
          delivery_notes: s.delivery_notes || '',
          dispatched_at: s.dispatched_at,
          delivered_at: s.delivered_at,
        })),
        ...invoicesData.filter(i => i.status === 'sent' || i.status === 'paid').map(i => ({
          id: i.id,
          type: 'invoice',
          order_number: i.invoice_number,
          customer_name: i.customer_name || 'Unknown',
          customer_phone: i.customer_phone || '',
          customer_address: i.customer_address || '',
          total_amount: i.total || 0,
          items_count: (i.line_items || []).length,
          created_at: i.issue_date || i.created_at,
          status: i.delivery_status || 'pending',
          delivery_person: i.delivery_person || '',
          delivery_phone: i.delivery_phone || '',
          delivery_notes: i.delivery_notes || '',
          dispatched_at: i.dispatched_at,
          delivered_at: i.delivered_at,
        })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setDeliveries(allDeliveries);
    } catch (err) {
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  const openUpdateModal = (delivery) => {
    setSelectedDelivery(delivery);
    setUpdateForm({
      status: delivery.status,
      notes: delivery.delivery_notes || '',
      delivery_person: delivery.delivery_person || '',
      delivery_phone: delivery.delivery_phone || '',
    });
    setShowUpdateModal(true);
  };

  const updateDeliveryStatus = async () => {
    if (!selectedDelivery) return;
    setSaving(true);
    try {
      const endpoint = selectedDelivery.type === 'sale' 
        ? `/api/sales/${selectedDelivery.id}`
        : `/api/invoices/${selectedDelivery.id}`;

      const updateData = {
        delivery_status: updateForm.status,
        delivery_notes: updateForm.notes,
        delivery_person: updateForm.delivery_person,
        delivery_phone: updateForm.delivery_phone,
      };

      if (updateForm.status === 'dispatched' && !selectedDelivery.dispatched_at) {
        updateData.dispatched_at = new Date().toISOString();
      }
      if (updateForm.status === 'delivered' && !selectedDelivery.delivered_at) {
        updateData.delivered_at = new Date().toISOString();
      }

      await api(endpoint, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      toast.success('Delivery status updated');
      setShowUpdateModal(false);
      fetchDeliveries();
    } catch (err) {
      toast.error('Failed to update delivery');
    } finally {
      setSaving(false);
    }
  };

  // Filter deliveries
  const filteredDeliveries = deliveries.filter(d => {
    const matchesSearch = 
      d.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: deliveries.length,
    pending: deliveries.filter(d => d.status === 'pending').length,
    dispatched: deliveries.filter(d => d.status === 'dispatched' || d.status === 'in_transit').length,
    delivered: deliveries.filter(d => d.status === 'delivered').length,
    failed: deliveries.filter(d => d.status === 'failed' || d.status === 'returned').length,
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="delivery-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Delivery Management
          </h1>
          <p className="text-muted-foreground">Track and manage order deliveries</p>
        </div>
        <Button variant="outline" onClick={fetchDeliveries}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-gray-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">In Transit</p>
                <p className="text-2xl font-bold text-amber-600">{stats.dispatched}</p>
              </div>
              <Truck className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Failed/Returned</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by order number or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(DELIVERY_STATUSES).map(([key, status]) => (
              <SelectItem key={key} value={key}>{status.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Deliveries List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">Order #</th>
                  <th className="text-left p-4 font-medium">Customer</th>
                  <th className="text-left p-4 font-medium">Address</th>
                  <th className="text-right p-4 font-medium">Amount</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Delivery Person</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No deliveries found</p>
                    </td>
                  </tr>
                ) : (
                  filteredDeliveries.map((delivery) => {
                    const status = DELIVERY_STATUSES[delivery.status] || DELIVERY_STATUSES.pending;
                    const StatusIcon = status.icon;
                    
                    return (
                      <tr key={`${delivery.type}-${delivery.id}`} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <span className="font-mono font-medium">{delivery.order_number}</span>
                          <p className="text-xs text-muted-foreground">{delivery.items_count} items</p>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">{delivery.customer_name}</p>
                          {delivery.customer_phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {delivery.customer_phone}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          {delivery.customer_address ? (
                            <p className="text-sm flex items-start gap-1 max-w-xs">
                              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span className="truncate">{delivery.customer_address}</span>
                            </p>
                          ) : (
                            <span className="text-muted-foreground text-sm">No address</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-semibold">
                          {currencySymbol}{delivery.total_amount?.toLocaleString()}
                        </td>
                        <td className="p-4">
                          <Badge className={`${status.color} text-white`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {delivery.delivery_person ? (
                            <div>
                              <p className="text-sm font-medium">{delivery.delivery_person}</p>
                              {delivery.delivery_phone && (
                                <p className="text-xs text-muted-foreground">{delivery.delivery_phone}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not assigned</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => { setSelectedDelivery(delivery); setShowDetailsModal(true); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openUpdateModal(delivery)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
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

      {/* Update Status Modal */}
      <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Update Delivery Status
            </DialogTitle>
          </DialogHeader>
          
          {selectedDelivery && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-mono font-semibold">{selectedDelivery.order_number}</p>
                <p className="text-sm text-muted-foreground">{selectedDelivery.customer_name}</p>
              </div>

              <div className="space-y-2">
                <Label>Delivery Status *</Label>
                <Select value={updateForm.status} onValueChange={(v) => setUpdateForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DELIVERY_STATUSES).map(([key, status]) => (
                      <SelectItem key={key} value={key}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Delivery Person</Label>
                <Input
                  placeholder="Delivery person name"
                  value={updateForm.delivery_person}
                  onChange={(e) => setUpdateForm(p => ({ ...p, delivery_person: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Delivery Person Phone</Label>
                <Input
                  placeholder="Phone number"
                  value={updateForm.delivery_phone}
                  onChange={(e) => setUpdateForm(p => ({ ...p, delivery_phone: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Delivery notes..."
                  value={updateForm.notes}
                  onChange={(e) => setUpdateForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateModal(false)}>
              Cancel
            </Button>
            <Button onClick={updateDeliveryStatus} disabled={saving} className="bg-primary">
              {saving ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Delivery Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedDelivery && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-mono text-lg font-semibold">{selectedDelivery.order_number}</p>
                  <Badge className={`mt-1 ${DELIVERY_STATUSES[selectedDelivery.status]?.color} text-white`}>
                    {DELIVERY_STATUSES[selectedDelivery.status]?.label}
                  </Badge>
                </div>
                <p className="text-xl font-bold text-primary">{currencySymbol}{selectedDelivery.total_amount?.toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedDelivery.customer_name}</p>
                  {selectedDelivery.customer_phone && (
                    <p className="text-sm text-muted-foreground">{selectedDelivery.customer_phone}</p>
                  )}
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Order Date</p>
                  <p className="font-medium">{selectedDelivery.created_at?.split('T')[0]}</p>
                </div>
              </div>

              {selectedDelivery.customer_address && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Delivery Address
                  </p>
                  <p className="font-medium">{selectedDelivery.customer_address}</p>
                </div>
              )}

              {selectedDelivery.delivery_person && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">Delivery Person</p>
                  <p className="font-medium">{selectedDelivery.delivery_person}</p>
                  {selectedDelivery.delivery_phone && (
                    <p className="text-sm text-muted-foreground">{selectedDelivery.delivery_phone}</p>
                  )}
                </div>
              )}

              {selectedDelivery.dispatched_at && (
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-500" />
                    <span>Dispatched: {new Date(selectedDelivery.dispatched_at).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {selectedDelivery.delivered_at && (
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Delivered: {new Date(selectedDelivery.delivered_at).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {selectedDelivery.delivery_notes && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600">Notes</p>
                  <p className="text-sm">{selectedDelivery.delivery_notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
            <Button onClick={() => { setShowDetailsModal(false); openUpdateModal(selectedDelivery); }}>
              <Edit className="w-4 h-4 mr-2" /> Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
