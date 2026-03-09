import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Package, Check, X, Clock, Truck, Building2, Search, Filter,
  Eye, CheckCircle, AlertCircle, RefreshCw, ArrowRight, Calendar,
  User, FileText, Minus, Plus, ChevronDown, Download, Printer
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import SyncBar from '../components/SyncBar';

export default function StockReceiverPage() {
  const { api, user } = useAuth();
  const [incomingTransfers, setIncomingTransfers] = useState([]);
  const [receivedTransfers, setReceivedTransfers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Receive modal state
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  // Use a stable empty object instead of null to prevent brief UI flash
  // when modal content reads transfer fields before state is set.
  const [selectedTransfer, setSelectedTransfer] = useState({});
  const [receiveItems, setReceiveItems] = useState([]);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiving, setReceiving] = useState(false);
  
  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  // Same rationale as selectedTransfer: avoid null-driven conditional flicker.
  const [viewTransfer, setViewTransfer] = useState({});

  // Get user's assigned store
  const userStoreId = user?.store_ids?.[0] || null;
  const userStoreName = stores.find(s => s.id === userStoreId)?.name || 'Your Store';

  useEffect(() => {
    fetchData();
  }, [api]);

  const fetchData = async () => {
    try {
      const [transfersData, storesData] = await Promise.all([
        api('/api/stock-receiver/incoming'),
        api('/api/stores'),
      ]);
      
      // Separate pending and received transfers
      const pending = transfersData.filter(t => t.status === 'pending' || t.status === 'in_transit');
      const received = transfersData.filter(t => t.status === 'received' || t.status === 'completed');
      
      setIncomingTransfers(pending);
      setReceivedTransfers(received);
      setStores(storesData);
    } catch (err) {
      toast.error('Failed to load incoming transfers');
    } finally {
      setLoading(false);
    }
  };

  const getStoreName = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    return store ? store.name : 'Unknown Store';
  };

  const openReceiveModal = (transfer) => {
    setSelectedTransfer(transfer);
    // Initialize receive items with transfer items
    setReceiveItems(transfer.items.map(item => ({
      ...item,
      received_quantity: item.quantity, // Default to full quantity
      damaged_quantity: 0,
      notes: ''
    })));
    setReceiveNotes('');
    setShowReceiveModal(true);
  };

  const updateReceiveItem = (index, field, value) => {
    setReceiveItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value };
        // Ensure received + damaged doesn't exceed original quantity
        if (field === 'received_quantity' || field === 'damaged_quantity') {
          const maxQty = item.quantity;
          const received = field === 'received_quantity' ? value : item.received_quantity;
          const damaged = field === 'damaged_quantity' ? value : item.damaged_quantity;
          if (received + damaged > maxQty) {
            if (field === 'received_quantity') {
              updated.damaged_quantity = Math.max(0, maxQty - value);
            } else {
              updated.received_quantity = Math.max(0, maxQty - value);
            }
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const handleReceiveTransfer = async () => {
    if (!selectedTransfer) return;
    
    // Validate at least some items are received
    const totalReceived = receiveItems.reduce((sum, item) => sum + item.received_quantity, 0);
    if (totalReceived === 0) {
      toast.error('Please receive at least one item');
      return;
    }

    setReceiving(true);
    try {
      await api('/api/stock-receiver/receive', {
        method: 'POST',
        body: JSON.stringify({
          transfer_id: selectedTransfer.id,
          items: receiveItems.map(item => ({
            item_id: item.item_id,
            item_name: item.item_name,
            variant_id: item.variant_id,
            sent_quantity: item.quantity,
            received_quantity: item.received_quantity,
            damaged_quantity: item.damaged_quantity,
            notes: item.notes
          })),
          notes: receiveNotes
        })
      });

      toast.success('Stock received successfully! Inventory updated.');
      setShowReceiveModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to receive stock');
    } finally {
      setReceiving(false);
    }
  };

  const handleRejectTransfer = async (transfer) => {
    if (!window.confirm('Are you sure you want to reject this transfer? The stock will be returned to the sender.')) {
      return;
    }

    try {
      await api(`/api/stock-receiver/reject/${transfer.id}`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Rejected by receiver' })
      });
      toast.success('Transfer rejected');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to reject transfer');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700 border-amber-300',
      in_transit: 'bg-blue-100 text-blue-700 border-blue-300',
      received: 'bg-green-100 text-green-700 border-green-300',
      completed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      rejected: 'bg-red-100 text-red-700 border-red-300',
      partial: 'bg-purple-100 text-purple-700 border-purple-300'
    };
    return styles[status] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="stock-receiver-page">
      {/* Sync Bar */}
      <SyncBar api={api} onSyncComplete={fetchData} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-7 h-7 text-blue-600" />
            Stock Receiver
          </h1>
          <p className="text-muted-foreground mt-1">
            Receive incoming stock transfers to your store
          </p>
          {userStoreId && (
            <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              Receiving at: <span className="font-semibold">{userStoreName}</span>
            </p>
          )}
        </div>
        <Button variant="outline" onClick={fetchData} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {incomingTransfers.length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">In Transit</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {incomingTransfers.filter(t => t.status === 'in_transit').length}
                </p>
              </div>
              <Truck className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Received Today</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {receivedTransfers.filter(t => {
                    const today = new Date().toDateString();
                    return new Date(t.received_at).toDateString() === today;
                  }).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Total Items</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {incomingTransfers.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0), 0)}
                </p>
              </div>
              <Package className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pending ({incomingTransfers.length})
          </TabsTrigger>
          <TabsTrigger value="received" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Received ({receivedTransfers.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Transfers */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Incoming Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incomingTransfers.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600">No Pending Transfers</h3>
                  <p className="text-muted-foreground mt-1">
                    You don't have any incoming stock transfers at the moment
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incomingTransfers.map(transfer => (
                    <div 
                      key={transfer.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={getStatusBadge(transfer.status)}>
                              {transfer.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              #{transfer.id.slice(0, 8)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{getStoreName(transfer.from_store_id)}</span>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-blue-600">{getStoreName(transfer.to_store_id)}</span>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {transfer.items.length} items ({transfer.items.reduce((s, i) => s + i.quantity, 0)} qty)
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(transfer.created_at)}
                            </span>
                          </div>
                          
                          {transfer.notes && (
                            <p className="text-sm text-muted-foreground mt-2 italic">
                              "{transfer.notes}"
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setViewTransfer(transfer);
                              setShowViewModal(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRejectTransfer(transfer)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                          <Button 
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => openReceiveModal(transfer)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Receive Stock
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Received Transfers */}
        <TabsContent value="received">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Received Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {receivedTransfers.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600">No Received Transfers Yet</h3>
                  <p className="text-muted-foreground mt-1">
                    Transfers you receive will appear here
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transfer ID</TableHead>
                      <TableHead>From Store</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Received At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivedTransfers.map(transfer => (
                      <TableRow key={transfer.id}>
                        <TableCell className="font-mono text-sm">
                          #{transfer.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>{getStoreName(transfer.from_store_id)}</TableCell>
                        <TableCell>
                          {transfer.items.length} items ({transfer.items.reduce((s, i) => s + (i.received_quantity || i.quantity), 0)} qty)
                        </TableCell>
                        <TableCell>{formatDate(transfer.received_at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadge(transfer.status)}>
                            {transfer.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setViewTransfer(transfer);
                              setShowViewModal(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Receive Stock Modal */}
      <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              Receive Stock Transfer
            </DialogTitle>
            <DialogDescription>
              Verify the received quantities and mark any damaged items
            </DialogDescription>
          </DialogHeader>

          {selectedTransfer && (
            <div className="space-y-6">
              {/* Transfer Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">
                    From: <strong>{getStoreName(selectedTransfer.from_store_id)}</strong>
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">
                    To: <strong>{getStoreName(selectedTransfer.to_store_id)}</strong>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Transfer ID: {selectedTransfer.id} | Created: {formatDate(selectedTransfer.created_at)}
                </p>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Sent Qty</TableHead>
                      <TableHead className="text-center">Received Qty</TableHead>
                      <TableHead className="text-center">Damaged</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiveItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.item_name || 'Unknown Item'}</p>
                            {item.variant_name && (
                              <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{item.quantity}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8"
                              onClick={() => updateReceiveItem(index, 'received_quantity', Math.max(0, item.received_quantity - 1))}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input 
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={item.received_quantity}
                              onChange={(e) => updateReceiveItem(index, 'received_quantity', Math.min(item.quantity, parseInt(e.target.value) || 0))}
                              className="w-16 text-center h-8"
                            />
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8"
                              onClick={() => updateReceiveItem(index, 'received_quantity', Math.min(item.quantity, item.received_quantity + 1))}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            min="0"
                            max={item.quantity - item.received_quantity}
                            value={item.damaged_quantity}
                            onChange={(e) => updateReceiveItem(index, 'damaged_quantity', parseInt(e.target.value) || 0)}
                            className="w-16 text-center h-8 mx-auto"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            placeholder="Item notes..."
                            value={item.notes}
                            onChange={(e) => updateReceiveItem(index, 'notes', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Summary */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Sent</p>
                    <p className="text-xl font-bold">{receiveItems.reduce((s, i) => s + i.quantity, 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Received</p>
                    <p className="text-xl font-bold text-green-600">
                      {receiveItems.reduce((s, i) => s + i.received_quantity, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Damaged/Missing</p>
                    <p className="text-xl font-bold text-red-600">
                      {receiveItems.reduce((s, i) => s + i.damaged_quantity + (i.quantity - i.received_quantity - i.damaged_quantity), 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Receiving Notes (Optional)</Label>
                <Textarea 
                  placeholder="Add any notes about this delivery..."
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReceiveModal(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleReceiveTransfer}
              disabled={receiving}
            >
              {receiving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm Receipt & Update Inventory
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Transfer Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Transfer Details
            </DialogTitle>
          </DialogHeader>

          {viewTransfer?.id && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Transfer ID</p>
                  <p className="font-mono">{viewTransfer.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline" className={getStatusBadge(viewTransfer.status || 'pending')}>
                    {(viewTransfer.status || 'pending').replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">From Store</p>
                  <p className="font-medium">{getStoreName(viewTransfer.from_store_id)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">To Store</p>
                  <p className="font-medium">{getStoreName(viewTransfer.to_store_id)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p>{formatDate(viewTransfer.created_at)}</p>
                </div>
                {viewTransfer.received_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Received</p>
                    <p>{formatDate(viewTransfer.received_at)}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Sent</TableHead>
                        {viewTransfer?.status === 'received' && (
                          <>
                            <TableHead className="text-center">Received</TableHead>
                            <TableHead className="text-center">Damaged</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewTransfer?.items || []).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <p className="font-medium">{item.item_name || 'Unknown'}</p>
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          {viewTransfer?.status === 'received' && (
                            <>
                              <TableCell className="text-center text-green-600">
                                {item.received_quantity || item.quantity}
                              </TableCell>
                              <TableCell className="text-center text-red-600">
                                {item.damaged_quantity || 0}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {viewTransfer.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="italic">"{viewTransfer.notes}"</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
