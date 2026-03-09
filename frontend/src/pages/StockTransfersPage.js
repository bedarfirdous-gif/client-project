import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { Plus, Truck, Check, X, ArrowRight, Search, Package, Building2, Minus, Eye, Download, Printer, Edit, Trash2, MoreVertical, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import SyncBar from '../components/SyncBar';

export default function StockTransfersPage() {
  const { api, user } = useAuth();
  const { currencySymbol } = useCurrency();
  const [transfers, setTransfers] = useState([]);
  const [textColor, setTextColor] = useState(false);
  const [fillColor, setFillColor] = useState(false);
  const [drawColor, setDrawColor] = useState(false);
  const [font, setFont] = useState(false);
  const [fontSize, setFontSize] = useState(false);
  const [form, setForm] = useState(false);
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Avoid null-initialized state for objects used in conditional rendering.
  // Using stable defaults prevents a null -> object transition that can cause a visual flash.
  const [viewTransfer, setViewTransfer] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveTransfer, setReceiveTransfer] = useState({});

  // Optional helpers (keep existing booleans intact) if the UI checks for "has data".
  // const hasViewTransfer = !!viewTransfer?.id;
  // const hasReceiveTransfer = !!receiveTransfer?.id;

  const [receivedItems, setReceivedItems] = useState([]);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  
  // Transfer form state
  const [fromStore, setFromStore] = useState('');
  const [toStore, setToStore] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualEntry, setManualEntry] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Get user's assigned store (first store in their store_ids array)
  const userAssignedStoreId = user?.store_ids?.[0] || null;
  const userStoreIds = user?.store_ids || [];
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'manager';

  // Filter stores based on user's assignment (admins see all stores)
  const accessibleStores = isAdmin 
    ? stores 
    : stores.filter(s => userStoreIds.includes(s.id));

  useEffect(() => {
    fetchData();
  }, [api]);

  // Auto-set fromStore when stores are loaded and user has assigned store
  useEffect(() => {
    if (stores.length > 0 && !fromStore) {
      if (userAssignedStoreId && stores.find(s => s.id === userAssignedStoreId)) {
        setFromStore(userAssignedStoreId);
      } else if (stores.length > 0) {
        // Fallback to first accessible store
        const firstAccessible = accessibleStores[0];
        if (firstAccessible) {
          setFromStore(firstAccessible.id);
        }
      }
    }
  }, [stores, userAssignedStoreId]);

  const fetchData = async () => {
    try {
      // Fetch transfers and stores first (required)
      const [transfersData, storesData] = await Promise.all([
        api('/api/stock-transfers').catch(() => []),
        api('/api/stores').catch(() => []),
      ]);
      setTransfers(transfersData || []);
      setStores(storesData || []);

      // Fetch items and inventory (may fail for some roles)
      try {
        const [itemsData, inventoryData] = await Promise.all([
          api('/api/items'),
          api('/api/inventory'),
        ]);
        setItems(itemsData || []);
        setInventory(inventoryData || []);
      } catch (itemErr) {
        console.log('Items/Inventory fetch failed (may be permission issue):', itemErr);
        // Try fetching via POS endpoint which might have different permissions
        try {
          const posItems = await api('/api/pos/items');
          if (posItems && posItems.length > 0) {
            setItems(posItems);
          }
        } catch (posErr) {
          console.log('POS items also unavailable');
        }
        toast.warning('Limited access: Some item data may not be available');
      }
    } catch (err) {
      toast.error('Failed to load data: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Get stock for an item in a specific store
  const getStockInStore = (itemId, storeId) => {
    if (!storeId) return 0;
    const inv = inventory.find(i => i.item_id === itemId && i.store_id === storeId);
    return inv?.quantity || inv?.current_stock || 0;
  };

  // Get stock for an item in user's assigned store
  const getStockInUserStore = (itemId) => {
    if (!userAssignedStoreId) return 0;
    return getStockInStore(itemId, userAssignedStoreId);
  };

  // Get total stock across all stores
  const getTotalStock = (itemId) => {
    return inventory
      .filter(i => i.item_id === itemId)
      .reduce((sum, i) => sum + (i.quantity || i.current_stock || 0), 0);
  };

  // Get user's assigned store name
  const getUserStoreName = () => {
    if (!userAssignedStoreId) return 'No Store Assigned';
    const store = stores.find(s => s.id === userAssignedStoreId);
    return store ? store.name : 'Unknown Store';
  };

  const getStoreName = (id) => {
    const store = stores.find(s => s.id === id);
    return store ? store.name : 'Unknown';
  };

  // Filter items by search query
  const filteredItems = items.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add item to transfer
  const addItem = (item) => {
    if (!fromStore) {
      toast.error('Please select a source store first');
      return;
    }
    
    const stockInStore = getStockInStore(item.id, fromStore);
    if (stockInStore <= 0) {
      toast.error(`No stock available for ${item.name} in selected store`);
      return;
    }
    
    const existing = selectedItems.find(i => i.id === item.id);
    if (existing) {
      if (existing.quantity < stockInStore) {
        setSelectedItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        ));
      } else {
        toast.error(`Maximum available stock is ${stockInStore}`);
      }
    } else {
      setSelectedItems(prev => [...prev, { 
        ...item, 
        quantity: 1, 
        max_quantity: stockInStore,
        available_stock: stockInStore
      }]);
    }
  };

  // Update item quantity
  const updateQuantity = (itemId, delta) => {
    setSelectedItems(prev => prev.map(i => {
      if (i.id === itemId) {
        const newQty = Math.max(1, Math.min(i.quantity + delta, i.max_quantity));
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  // Remove item from transfer
  const removeItem = (itemId) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  };

  // Parse manual entry (SKU or barcode, comma/newline separated)
  const parseManualEntry = () => {
    const entries = manualEntry.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
    entries.forEach(entry => {
      const item = items.find(i => 
        i.sku?.toLowerCase() === entry.toLowerCase() ||
        i.barcode === entry ||
        i.name?.toLowerCase() === entry.toLowerCase()
      );
      if (item) {
        addItem(item);
      } else {
        toast.error(`Item not found: ${entry}`);
      }
    });
    setManualEntry('');
  };

  // Submit transfer
  const submitTransfer = async () => {
    if (!fromStore || !toStore) {
      toast.error('Please select source and destination stores');
      return;
    }
    if (fromStore === toStore) {
      toast.error('Source and destination stores must be different');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/stock-transfers', {
        method: 'POST',
        body: JSON.stringify({
          from_store_id: fromStore,
          to_store_id: toStore,
          items: selectedItems.map(i => ({
            item_id: i.id,
            item_name: i.name,
            sku: i.sku,
            quantity: i.quantity
          })),
          notes: notes
        })
      });
      toast.success('Stock transfer created successfully');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to create transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFromStore('');
    setToStore('');
    setSelectedItems([]);
    setSearchQuery('');
    setManualEntry('');
    setNotes('');
  };

  const approveTransfer = async (id) => {
    try {
      await api(`/api/stock-transfers/${id}/approve`, { method: 'PUT' });
      toast.success('Transfer approved');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const rejectTransfer = async (id) => {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    try {
      await api(`/api/stock-transfers/${id}/reject?reason=${encodeURIComponent(reason)}`, { method: 'PUT' });
      toast.success('Transfer rejected');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Delete transfer
  const deleteTransfer = async (id, transferNumber) => {
    if (!window.confirm(`Are you sure you want to delete transfer #${transferNumber}? This action cannot be undone.`)) return;
    try {
      await api(`/api/stock-transfers/${id}`, { method: 'DELETE' });
      toast.success('Transfer deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete transfer');
    }
  };

  // Open receive modal for approved transfers
  const openReceiveModal = (transfer) => {
    setReceiveTransfer(transfer);
    // Initialize received items with expected quantities
    setReceivedItems(transfer.items?.map(item => ({
      ...item,
      received_qty: item.quantity
    })) || []);
    setReceiveNotes('');
    setShowReceiveModal(true);
  };

  // Update received quantity for an item
  const updateReceivedQty = (variantId, qty) => {
    setReceivedItems(prev => prev.map(item => 
      item.variant_id === variantId ? { ...item, received_qty: Math.max(0, qty) } : item
    ));
  };

  // Submit receive confirmation
  const confirmReceive = async () => {
    if (!receiveTransfer) return;
    
    setSubmitting(true);
    try {
      const result = await api(`/api/stock-transfers/${receiveTransfer.id}/receive`, {
        method: 'PUT',
        body: JSON.stringify({
          received_items: receivedItems.map(item => ({
            variant_id: item.variant_id,
            item_id: item.item_id,
            item_name: item.item_name,
            quantity: item.received_qty
          })),
          notes: receiveNotes
        })
      });
      
      if (result.discrepancies?.length > 0) {
        toast.warning(`Transfer received with ${result.discrepancies.length} discrepancy(ies)`, {
          description: 'Check transfer details for differences'
        });
      } else {
        toast.success('Transfer received successfully!');
      }
      
      setShowReceiveModal(false);
      setReceiveTransfer(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Download PDF for physical verification
  const downloadTransferPDF = async (transfer) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      let y = 20;
      
      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('STOCK TRANSFER DOCUMENT', 105, y, { align: 'center' });
      y += 10;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('For Physical Verification at Store', 105, y, { align: 'center' });
      y += 15;
      
      // Transfer Details Box
      doc.setDrawColor(200);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(15, y, 180, 35, 3, 3, 'FD');
      y += 10;
      
      doc.setFontSize(10);
      doc.text(`Transfer #: ${transfer.transfer_number}`, 25, y);
      doc.text(`Date: ${new Date(transfer.created_at).toLocaleDateString()}`, 120, y);
      y += 8;
      doc.text(`From Store: ${getStoreName(transfer.from_store_id)}`, 25, y);
      doc.text(`To Store: ${getStoreName(transfer.to_store_id)}`, 120, y);
      y += 8;
      doc.text(`Status: ${transfer.status?.toUpperCase()}`, 25, y);
      doc.text(`Total Qty: ${transfer.total_quantity}`, 120, y);
      y += 20;
      
      // Items Table Header
      doc.setFillColor(50, 50, 50);
      doc.setTextColor(255, 255, 255);
      doc.rect(15, y, 180, 10, 'F');
      doc.setFontSize(10);
      doc.text('S.No', 20, y + 7);
      doc.text('Item Name', 35, y + 7);
      doc.text('SKU', 100, y + 7);
      doc.text('Qty', 140, y + 7);
      doc.text('Verified', 165, y + 7);
      y += 15;
      
      // Items
      doc.setTextColor(0, 0, 0);
      transfer.items?.forEach((item, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(`${idx + 1}`, 20, y);
        doc.text(item.item_name?.substring(0, 30) || 'Item', 35, y);
        doc.text(item.sku || '-', 100, y);
        doc.text(item.quantity?.toString() || '0', 140, y);
        doc.rect(165, y - 5, 15, 8); // Checkbox for verification
        y += 10;
      });
      
      y += 10;
      
      // Signature Section
      doc.setDrawColor(150);
      doc.line(15, y, 195, y);
      y += 15;
      
      doc.text('Sent By: ___________________', 25, y);
      doc.text('Received By: ___________________', 110, y);
      y += 15;
      doc.text('Date: ___________________', 25, y);
      doc.text('Date: ___________________', 110, y);
      y += 15;
      doc.text('Signature: ___________________', 25, y);
      doc.text('Signature: ___________________', 110, y);
      
      doc.save(`stock_transfer_${transfer.transfer_number}.pdf`);
      toast.success('PDF downloaded!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    received: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-green-100 text-green-700',
  };

  const totalQuantity = selectedItems.reduce((sum, i) => sum + i.quantity, 0);

  // Mark All / Unmark All functions
  const handleMarkAll = () => {
    const allIds = new Set(transfers.map(t => t.id));
    setSelectedRows(allIds);
    toast.success(`Selected all ${transfers.length} transfers`);
  };

  const handleUnmarkAll = () => {
    setSelectedRows(new Set());
    toast.success('Cleared selection');
  };

  const handleToggleRow = (transferId) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transferId)) {
        newSet.delete(transferId);
      } else {
        newSet.add(transferId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      toast.error('No transfers selected');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedRows.size} transfers? Only pending transfers will be deleted.`)) return;
    
    try {
      const result = await api('/api/stock-transfers/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ transfer_ids: Array.from(selectedRows) })
      });
      
      if (result.deleted_count > 0) {
        toast.success(`Deleted ${result.deleted_count} transfer(s)`);
      }
      
      if (result.failed?.length > 0) {
        toast.warning(`${result.failed.length} transfer(s) could not be deleted`, {
          description: result.failed.map(f => f.reason).join(', ')
        });
      }
      
      setSelectedRows(new Set());
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete transfers');
    }
  };

  return (
    <div className="space-y-6" data-testid="stock-transfers-page">
      {/* Sync Bar */}
      <SyncBar api={api} onSyncComplete={fetchData} />
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Stock Transfers</h2>
          <p className="text-sm text-muted-foreground">Transfer inventory between stores</p>
          {userAssignedStoreId && (
            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Your Store: <span className="font-medium">{getUserStoreName()}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="transfers-actions-menu">
                <MoreVertical className="w-4 h-4" /> Actions
                {selectedRows.size > 0 && (
                  <Badge variant="secondary" className="ml-1">{selectedRows.size}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  handleMarkAll();
                }} 
                data-testid="transfers-mark-all-btn"
              >
                <CheckSquare className="w-4 h-4 mr-2" /> Mark All
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  handleUnmarkAll();
                }} 
                data-testid="transfers-unmark-all-btn"
              >
                <Square className="w-4 h-4 mr-2" /> Unmark All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  handleBulkDelete();
                }}
                className="text-red-600 dark:text-red-400"
                disabled={selectedRows.size === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button onClick={() => setShowModal(true)} data-testid="new-transfer-btn">
            <Plus className="w-4 h-4 mr-2" /> New Transfer
          </Button>
        </div>
      </div>

      {/* Transfers List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transfers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No stock transfers found</p>
            <Button onClick={() => setShowModal(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" /> Create First Transfer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <div 
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${selectedRows.size === transfers.length && transfers.length > 0 ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 hover:border-blue-400'}`}
                    onClick={() => {
                      if (selectedRows.size === transfers.length) {
                        handleUnmarkAll();
                      } else {
                        handleMarkAll();
                      }
                    }}
                  >
                    {selectedRows.size === transfers.length && transfers.length > 0 && <CheckSquare className="w-3 h-3" />}
                  </div>
                </TableHead>
                <TableHead>Transfer #</TableHead>
                <TableHead>From Store</TableHead>
                <TableHead></TableHead>
                <TableHead>To Store</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((t) => {
                const isSelected = selectedRows.has(t.id);
                return (
                <TableRow key={t.id} className={isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                  <TableCell>
                    <div 
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 hover:border-blue-400'}`}
                      onClick={() => handleToggleRow(t.id)}
                    >
                      {isSelected && <CheckSquare className="w-3 h-3" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono-data font-medium">{t.transfer_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      {getStoreName(t.from_store_id)}
                    </div>
                  </TableCell>
                  <TableCell><ArrowRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      {getStoreName(t.to_store_id)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono-data">{t.items?.length || t.total_items}</TableCell>
                  <TableCell className="text-right font-mono-data">{t.total_quantity}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[t.status] || ''}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`transfer-actions-${t.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl w-48">
                        <DropdownMenuItem onClick={() => setViewTransfer(t)} className="rounded-lg">
                          <Eye className="w-4 h-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadTransferPDF(t)} className="rounded-lg">
                          <Download className="w-4 h-4 mr-2" /> Download PDF
                        </DropdownMenuItem>
                        {t.status === 'pending' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => approveTransfer(t.id)} className="rounded-lg text-green-600">
                              <Check className="w-4 h-4 mr-2" /> Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => rejectTransfer(t.id)} className="rounded-lg text-red-600">
                              <X className="w-4 h-4 mr-2" /> Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {t.status === 'approved' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openReceiveModal(t)} className="rounded-lg text-blue-600">
                              <Package className="w-4 h-4 mr-2" /> Receive Items
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteTransfer(t.id, t.transfer_number)} className="rounded-lg text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Transfer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* View Transfer Modal */}
      <Dialog open={!!viewTransfer?.id} onOpenChange={() => setViewTransfer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" /> Transfer Details - {viewTransfer?.transfer_number}
            </DialogTitle>
          </DialogHeader>
          
          {viewTransfer?.id && (
            <div className="space-y-4">
              {/* Transfer Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-accent rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">From Store</p>
                  <p className="font-medium">{getStoreName(viewTransfer.from_store_id)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">To Store</p>
                  <p className="font-medium">{getStoreName(viewTransfer.to_store_id)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusColors[viewTransfer?.status] || ''}>
                    {viewTransfer?.status || 'pending'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{viewTransfer?.created_at ? new Date(viewTransfer.created_at).toLocaleString() : '-'}</p>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-medium mb-2">Items ({viewTransfer.items?.length || 0})</h4>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewTransfer.items?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell className="font-mono-data">{item.sku}</TableCell>
                          <TableCell className="text-right font-mono-data">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {viewTransfer.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="p-2 bg-accent rounded">{viewTransfer.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => downloadTransferPDF(viewTransfer)}>
                  <Download className="w-4 h-4 mr-2" /> Download PDF
                </Button>
                <Button variant="outline" onClick={() => setViewTransfer(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Transfer Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" /> Create Stock Transfer
            </DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-6 flex-1 overflow-hidden">
            {/* Left Side - Store Selection & Item Search */}
            <div className="space-y-4 overflow-y-auto pr-2">
              {/* Store Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Store *</Label>
                  {userAssignedStoreId && !isAdmin && (
                    <p className="text-xs text-blue-600 mb-1">Your assigned store: {getUserStoreName()}</p>
                  )}
                  <Select value={fromStore} onValueChange={(value) => {
                    setFromStore(value);
                    setSelectedItems([]); // Clear selected items when store changes
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessibleStores.map(store => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name} {store.id === userAssignedStoreId ? '(Your Store)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To Store *</Label>
                  <Select value={toStore} onValueChange={setToStore}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.filter(s => s.id !== fromStore).map(store => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Manual Entry */}
              <div className="space-y-2">
                <Label>Quick Add by SKU/Barcode</Label>
                <div className="flex gap-2">
                  <Textarea 
                    value={manualEntry}
                    onChange={(e) => setManualEntry(e.target.value)}
                    placeholder="Enter SKU or barcode (comma or newline separated)"
                    className="h-20"
                  />
                  <Button onClick={parseManualEntry} variant="outline" className="shrink-0">
                    Add
                  </Button>
                </div>
              </div>

              {/* Item Search */}
              <div className="space-y-2">
                <Label>Search Items</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or SKU..."
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {!fromStore ? (
                  <div className="p-4 text-center text-amber-600 text-sm bg-amber-50">
                    ⚠️ Select a source store to view available stock
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No items found
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredItems.slice(0, 20).map(item => {
                      const stockInStore = getStockInStore(item.id, fromStore);
                      const isOutOfStock = stockInStore <= 0;
                      return (
                        <div 
                          key={item.id}
                          onClick={() => !isOutOfStock && addItem(item)}
                          className={`p-2 flex justify-between items-center ${
                            isOutOfStock 
                              ? 'bg-gray-50 opacity-60 cursor-not-allowed' 
                              : 'hover:bg-accent cursor-pointer'
                          }`}
                        >
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${stockInStore > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              Stock: {stockInStore}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isOutOfStock ? 'Out of Stock' : `${currencySymbol}${item.selling_price || 0}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="h-16"
                />
              </div>
            </div>

            {/* Right Side - Selected Items */}
            <div className="border rounded-lg p-4 bg-accent/30 flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Items to Transfer
                </h4>
                <Badge variant="secondary">{selectedItems.length} items, {totalQuantity} qty</Badge>
              </div>
              
              {selectedItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Click items from the left to add them
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {selectedItems.map(item => (
                    <div key={item.id} className="bg-background rounded-lg p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                        <p className="text-xs text-green-600 font-medium">Available: {item.available_stock || item.max_quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-mono text-sm">{item.quantity}</span>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4 mt-4 border-t">
                <Button 
                  onClick={submitTransfer} 
                  disabled={submitting || selectedItems.length === 0}
                  className="w-full"
                >
                  {submitting ? 'Creating...' : `Create Transfer (${totalQuantity} items)`}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receive Transfer Modal */}
      <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" /> Receive Stock Transfer
            </DialogTitle>
          </DialogHeader>

          {receiveTransfer && (
            <div className="space-y-4">
              {/* Transfer Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-accent rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Transfer #</p>
                  <p className="font-medium">{receiveTransfer.transfer_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">From Store</p>
                  <p className="font-medium">{getStoreName(receiveTransfer.from_store_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">To Store</p>
                  <p className="font-medium">{getStoreName(receiveTransfer.to_store_id)}</p>
                </div>
              </div>

              {/* Items to Receive */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Verify Received Items
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Confirm the quantity received for each item. Adjust if there are any discrepancies.
                </p>
                
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Expected</TableHead>
                        <TableHead className="text-center">Received</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivedItems.map((item, idx) => {
                        const expected = item.quantity;
                        const received = item.received_qty;
                        const diff = received - expected;
                        
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <p className="font-medium">{item.item_name}</p>
                              {item.size && <span className="text-xs text-muted-foreground">{item.size}</span>}
                              {item.color && <span className="text-xs text-muted-foreground ml-1">/ {item.color}</span>}
                            </TableCell>
                            <TableCell className="text-center font-mono text-muted-foreground">
                              {expected}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 w-7 p-0"
                                  onClick={() => updateReceivedQty(item.variant_id, received - 1)}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <Input
                                  type="number"
                                  value={received}
                                  onChange={(e) => updateReceivedQty(item.variant_id, parseInt(e.target.value) || 0)}
                                  className="w-16 h-7 text-center"
                                />
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 w-7 p-0"
                                  onClick={() => updateReceivedQty(item.variant_id, received + 1)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {diff === 0 ? (
                                <Badge className="bg-green-100 text-green-700">Match</Badge>
                              ) : diff > 0 ? (
                                <Badge className="bg-blue-100 text-blue-700">+{diff}</Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-700">{diff}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="Add any notes about the received items..."
                  className="h-20"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowReceiveModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={confirmReceive} 
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {submitting ? 'Confirming...' : 'Confirm Receipt'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
