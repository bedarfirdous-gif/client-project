import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { usePermissions } from '../contexts/PermissionContext';
import { ReadOnlyBanner } from '../components/RBACComponents';
import { toast } from 'sonner';
import { 
  Search, Filter, Package, Plus, Minus, TrendingUp, TrendingDown, 
  Store, RefreshCw, AlertTriangle, Eye, Edit, Trash2, 
  MoreVertical, Download, FileText, FileSpreadsheet, Printer, Barcode,
  CheckSquare, Square, Camera, Upload, Image as ImageIcon, Settings
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import BarcodeLabelGenerator from '../components/BarcodeLabelGenerator';
import jsPDF from 'jspdf';
import SyncBar from '../components/SyncBar';

export default function InventoryPage({ onNavigate }) {
  const { api } = useAuth();
  const { currencySymbol, formatWithConversion } = useCurrency();
  const { isReadOnly, canPerformAction } = usePermissions();
  const [inventory, setInventory] = useState([]);
  const [item, setItem] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [font, setFont] = useState(false);
  const [fontSize, setFontSize] = useState(false);
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('');
  const [search, setSearch] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  // FIX: avoid null initial state (can cause a render pass with "no data" then a second pass with data, i.e. a visual flash)
  // Use a stable empty object and clear it when modals close.
  const [selectedInventory, setSelectedInventory] = useState({});
  const [adjustForm, setAdjustForm] = useState({ variant_id: '', store_id: '', quantity: 0, purchase_rate: 0 });
  const [stockFilter, setStockFilter] = useState('all'); // all, low, out
  
  // Barcode state
  const [showBarcodeGenerator, setShowBarcodeGenerator] = useState(false);
  const [selectedItemsForBarcode, setSelectedItemsForBarcode] = useState([]);
  
  // Selection state for Mark All / Unmark All
  const [selectedRows, setSelectedRows] = useState(new Set());
  
  // Image upload state
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  // FIX: same as above; stable initial object avoids null->object flicker when opening the image modal
  const [selectedItemForImage, setSelectedItemForImage] = useState({});
  const imageInputRef = useRef(null);

  // FIX: clear selected objects when modals are closed to preserve "nothing selected" semantics
  useEffect(() => {
    if (!showViewModal && !showEditModal) setSelectedInventory({});
  }, [showViewModal, showEditModal]);

  useEffect(() => {
    if (!showImageUpload) setSelectedItemForImage({});
  }, [showImageUpload]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch inventory, items, variants - these are required
      const [invData, itemsData, variantsData] = await Promise.all([
        api(`/api/inventory${selectedStore ? `?store_id=${selectedStore}` : ''}`),
        api('/api/items'),
        api('/api/variants'),
      ]);
      setInventory(invData);
      setItems(itemsData);
      setVariants(variantsData);
      
      // Fetch stores separately - may fail for users without 'stores' permission
      try {
        const storesData = await api('/api/stores');
        setStores(storesData);
      } catch (storeErr) {
        // User doesn't have stores permission - set empty array silently
        setStores([]);
        console.log('Stores not available - user may not have stores permission');
      }
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedStore]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdjust = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/inventory/adjust?variant_id=${adjustForm.variant_id}&store_id=${adjustForm.store_id}&quantity=${adjustForm.quantity}&purchase_rate=${adjustForm.purchase_rate}`, {
        method: 'POST'
      });
      toast.success('Inventory adjusted');
      setShowAdjust(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const getItemName = (itemId, invRecord = null) => {
    // First try to find the item in the items array
    const item = items.find(i => i.id === itemId);
    if (item?.name) return item.name;
    
    // Fallback to item_name stored in the inventory record
    if (invRecord?.item_name) return invRecord.item_name;
    
    return 'Unknown';
  };
  const getVariantInfo = (variantId) => variants.find(v => v.id === variantId);
  const getStoreName = (storeId) => stores.find(s => s.id === storeId)?.name || 'Unknown';
  const getItemInfo = (itemId) => items.find(i => i.id === itemId);

  // View inventory details
  const openViewModal = (inv) => {
    setSelectedInventory(inv);
    setShowViewModal(true);
  };

  // Edit inventory (open adjust modal with pre-filled data)
  const openEditModal = (inv) => {
    setSelectedInventory(inv);
    setAdjustForm({
      variant_id: inv.variant_id,
      store_id: inv.store_id,
      quantity: 0,
      purchase_rate: inv.purchase_rate || 0
    });
    setShowEditModal(true);
  };

  // Delete inventory record
  const handleDelete = async (inv) => {
    if (!window.confirm(`Are you sure you want to delete inventory for "${getItemName(inv.item_id, inv)}" at ${getStoreName(inv.store_id)}?`)) return;
    
    try {
      await api(`/api/inventory/${inv.id}`, { method: 'DELETE' });
      toast.success('Inventory record deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete inventory');
    }
  };

  // Handle edit submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/inventory/adjust?variant_id=${adjustForm.variant_id}&store_id=${adjustForm.store_id}&quantity=${adjustForm.quantity}&purchase_rate=${adjustForm.purchase_rate}`, {
        method: 'POST'
      });
      toast.success('Inventory updated');
      setShowEditModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Calculate inventory statistics
  const totalItems = inventory.length;
  const totalQuantity = inventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
  const totalValue = inventory.reduce((sum, inv) => sum + ((inv.quantity || 0) * (inv.purchase_rate || 0)), 0);
  const lowStockItems = inventory.filter(inv => {
    const item = getItemInfo(inv.item_id);
    const minStock = item?.min_stock_alert || 5;
    return inv.quantity > 0 && inv.quantity <= minStock;
  });
  const outOfStockItems = inventory.filter(inv => inv.quantity <= 0);

  // Filter and search inventory
  const filteredInventory = inventory.filter(inv => {
    const itemName = getItemName(inv.item_id, inv).toLowerCase();
    const variant = getVariantInfo(inv.variant_id);
    const sku = variant?.sku?.toLowerCase() || '';
    const searchMatch = search === '' || itemName.includes(search.toLowerCase()) || sku.includes(search.toLowerCase());
    
    let stockMatch = true;
    if (stockFilter === 'low') {
      const item = getItemInfo(inv.item_id);
      const minStock = item?.min_stock_alert || 5;
      stockMatch = inv.quantity > 0 && inv.quantity <= minStock;
    } else if (stockFilter === 'out') {
      stockMatch = inv.quantity <= 0;
    }
    
    return searchMatch && stockMatch;
  });

  // Group inventory by item
  const groupedInventory = filteredInventory.reduce((acc, inv) => {
    const key = inv.item_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(inv);
    return acc;
  }, {});

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text('Inventory Report', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });
    
    let y = 40;
    const lineHeight = 8;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Item', 14, y);
    doc.text('SKU', 60, y);
    doc.text('Store', 100, y);
    doc.text('Qty', 140, y);
    doc.text('Value', 165, y);
    doc.setFont(undefined, 'normal');
    
    y += lineHeight;
    
    filteredInventory.forEach((inv, index) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      
      const itemName = getItemName(inv.item_id, inv);
      const variant = getVariantInfo(inv.variant_id);
      const storeName = getStoreName(inv.store_id);
      const value = (inv.quantity || 0) * (inv.purchase_rate || 0);
      
      doc.text(itemName.substring(0, 25), 14, y);
      doc.text((variant?.sku || '-').substring(0, 20), 60, y);
      doc.text(storeName.substring(0, 20), 100, y);
      doc.text(String(inv.quantity || 0), 140, y);
      doc.text(`${currencySymbol}${value.toLocaleString()}`, 165, y);
      
      y += lineHeight;
    });
    
    doc.save('inventory-report.pdf');
    toast.success('PDF exported successfully');
  };

  // Export to Excel/CSV
  const exportToExcel = () => {
    const headers = ['Item Name', 'SKU', 'Variant', 'Store', 'Quantity', 'Purchase Rate', 'Total Value'];
    const rows = filteredInventory.map(inv => {
      const variant = getVariantInfo(inv.variant_id);
      return [
        getItemName(inv.item_id, inv),
        variant?.sku || '',
        `${variant?.size || ''} ${variant?.color || ''}`.trim() || '-',
        getStoreName(inv.store_id),
        inv.quantity || 0,
        inv.purchase_rate || 0,
        (inv.quantity || 0) * (inv.purchase_rate || 0)
      ];
    });
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inventory-report.csv';
    link.click();
    toast.success('CSV exported successfully');
  };

  // Navigate to Add Product
  const handleAddProduct = () => {
    if (onNavigate) {
      // Set sessionStorage flag as backup
      sessionStorage.setItem('openAddProduct', 'true');
      onNavigate('items');
      // Trigger add product modal after navigation with longer delay
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-add-product'));
      }, 800);
    }
  };

  // Mark All / Unmark All functions
  const handleMarkAll = () => {
    const allIds = new Set(filteredInventory.map(inv => inv.id));
    setSelectedRows(allIds);
    toast.success(`Selected all ${filteredInventory.length} items`);
  };

  const handleUnmarkAll = () => {
    setSelectedRows(new Set());
    toast.success('Cleared selection');
  };

  const handleToggleRow = (invId) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invId)) {
        newSet.delete(invId);
      } else {
        newSet.add(invId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      toast.error('No items selected');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedRows.size} inventory records?`)) return;
    
    try {
      for (const invId of selectedRows) {
        await api(`/api/inventory/${invId}`, { method: 'DELETE' });
      }
      toast.success(`Deleted ${selectedRows.size} records`);
      setSelectedRows(new Set());
      fetchData();
    } catch (err) {
      toast.error('Failed to delete some records');
    }
  };

  // Image upload handler
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedItemForImage) return;
    
    setUploadingImage(true);
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    
    try {
      // Upload images
      const uploadResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/upload/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }
      
      const uploadData = await uploadResponse.json();
      const newImageUrls = uploadData.urls || [];
      
      // Get current item images
      const currentItem = items.find(i => i.id === selectedItemForImage.id);
      const existingImages = currentItem?.images || [];
      
      // Update item with new images
      await api(`/api/items/${selectedItemForImage.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          images: [...existingImages, ...newImageUrls]
        })
      });
      
      toast.success(`Uploaded ${newImageUrls.length} image(s) successfully`);
      setShowImageUpload(false);
      setSelectedItemForImage(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to upload images');
      console.error(err);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const openImageUploadModal = (item) => {
    setSelectedItemForImage(item);
    setShowImageUpload(true);
  };

  return (
    <div className="space-y-6" data-testid="inventory-page">
      {/* Read-Only Banner for Viewers */}
      <ReadOnlyBanner module="Inventory" />
      
      {/* Sync Bar */}
      <SyncBar api={api} onSyncComplete={fetchData} />
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total SKUs</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalItems}</p>
              </div>
              <Package className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Total Quantity</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totalQuantity.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Total Value</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{formatWithConversion(totalValue)}</p>
              </div>
              <Store className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`bg-gradient-to-br cursor-pointer transition-all ${
            stockFilter === 'low' 
              ? 'from-amber-200 to-amber-300 border-amber-400' 
              : 'from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-amber-200 hover:border-amber-400'
          }`}
          onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Low Stock</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{lowStockItems.length}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`bg-gradient-to-br cursor-pointer transition-all ${
            stockFilter === 'out' 
              ? 'from-red-200 to-red-300 border-red-400' 
              : 'from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-red-200 hover:border-red-400'
          }`}
          onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">Out of Stock</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{outOfStockItems.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Select value={selectedStore || "all"} onValueChange={(v) => setSelectedStore(v === "all" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {stockFilter !== 'all' && (
            <Badge 
              variant="outline" 
              className="cursor-pointer"
              onClick={() => setStockFilter('all')}
            >
              {stockFilter === 'low' ? 'Low Stock' : 'Out of Stock'} ✕
            </Badge>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={filteredInventory.length === 0}>
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToPDF}>
                <FileText className="w-4 h-4 mr-2" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Export as Excel/CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Actions Dropdown with Mark All / Unmark All */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="actions-menu">
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
                data-testid="mark-all-btn"
              >
                <CheckSquare className="w-4 h-4 mr-2" /> Mark All
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  handleUnmarkAll();
                }} 
                data-testid="unmark-all-btn"
              >
                <Square className="w-4 h-4 mr-2" /> Unmark All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={async (e) => {
                  e.preventDefault();
                  try {
                    toast.loading('Syncing inventory with items...');
                    const result = await api('/api/inventory/sync-items', { method: 'POST' });
                    toast.dismiss();
                    toast.success(result.message || 'Sync complete');
                    fetchData();
                  } catch (err) {
                    toast.dismiss();
                    toast.error('Failed to sync: ' + (err.message || 'Unknown error'));
                  }
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Sync Items
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  if (selectedRows.size === 0) {
                    toast.error('Select items first');
                    return;
                  }
                  const selectedInvItems = inventory.filter(inv => selectedRows.has(inv.id));
                  const itemsForBarcode = selectedInvItems.map(inv => {
                    const item = items.find(i => i.id === inv.item_id);
                    return item;
                  }).filter(Boolean);
                  setSelectedItemsForBarcode(itemsForBarcode);
                  setShowBarcodeGenerator(true);
                }}
              >
                <Printer className="w-4 h-4 mr-2" /> Print Barcodes
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
          
          {/* Barcodes Button */}
          <Button 
            variant="outline" 
            onClick={() => {
              setSelectedItemsForBarcode(items);
              setShowBarcodeGenerator(true);
            }}
            disabled={items.length === 0}
          >
            <Printer className="w-4 h-4 mr-2" /> Barcodes
          </Button>
          
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          
          {canPerformAction('inventory', 'adjust') && (
            <Button onClick={() => setShowAdjust(true)} data-testid="adjust-inventory-btn">
              <Plus className="w-4 h-4 mr-2" /> Adjust Stock
            </Button>
          )}
          
          {/* Add Product Button */}
          {canPerformAction('items', 'create') && (
            <Button onClick={handleAddProduct} className="bg-blue-600 hover:bg-blue-700">
              <Package className="w-4 h-4 mr-2" /> Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredInventory.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {search || stockFilter !== 'all' ? 'No matching inventory records' : 'No inventory records found'}
            </p>
            {(search || stockFilter !== 'all') && (
              <Button variant="link" onClick={() => { setSearch(''); setStockFilter('all'); }}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <div 
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${selectedRows.size === filteredInventory.length && filteredInventory.length > 0 ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 hover:border-blue-400'}`}
                    onClick={() => {
                      if (selectedRows.size === filteredInventory.length) {
                        handleUnmarkAll();
                      } else {
                        handleMarkAll();
                      }
                    }}
                  >
                    {selectedRows.size === filteredInventory.length && filteredInventory.length > 0 && <CheckSquare className="w-3 h-3" />}
                  </div>
                </TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Variant (SKU)</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Purchase Rate</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((inv) => {
                const variant = getVariantInfo(inv.variant_id);
                const item = getItemInfo(inv.item_id);
                const minStock = item?.min_stock_alert || 5;
                const isLow = inv.quantity > 0 && inv.quantity <= minStock;
                const isOut = inv.quantity <= 0;
                const value = (inv.quantity || 0) * (inv.purchase_rate || 0);
                const isSelected = selectedRows.has(inv.id);
                
                return (
                  <TableRow key={inv.id} className={`${isOut ? 'bg-red-50/50 dark:bg-red-900/10' : isLow ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <TableCell>
                      <div 
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 hover:border-blue-400'}`}
                        onClick={() => handleToggleRow(inv.id)}
                      >
                        {isSelected && <CheckSquare className="w-3 h-3" />}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{getItemName(inv.item_id, inv)}</TableCell>
                    <TableCell>
                      <div>
                        {variant?.size && <span className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded mr-1">{variant.size}</span>}
                        {variant?.color && <span className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{variant.color}</span>}
                        <p className="text-xs text-muted-foreground mt-1">{variant?.sku || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStoreName(inv.store_id)}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{inv.quantity || 0}</TableCell>
                    <TableCell className="text-right">{formatWithConversion(inv.purchase_rate || 0)}</TableCell>
                    <TableCell className="text-right font-medium">{formatWithConversion(value)}</TableCell>
                    <TableCell>
                      {isOut ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : isLow ? (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Low Stock</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">In Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`inventory-actions-${inv.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => openViewModal(inv)} className="rounded-lg">
                            <Eye className="w-4 h-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditModal(inv)} className="rounded-lg">
                            <Edit className="w-4 h-4 mr-2" /> Edit Stock
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              const itemData = items.find(i => i.id === inv.item_id);
                              if (itemData) {
                                // Navigate to Items page with edit mode for this item
                                window.location.href = `/items?edit=${itemData.id}`;
                              } else {
                                toast.error('Item not found');
                              }
                            }} 
                            className="rounded-lg"
                          >
                            <Settings className="w-4 h-4 mr-2" /> Edit Item Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              const itemData = items.find(i => i.id === inv.item_id);
                              if (itemData) {
                                openImageUploadModal(itemData);
                              } else {
                                toast.error('Item not found');
                              }
                            }} 
                            className="rounded-lg"
                          >
                            <Camera className="w-4 h-4 mr-2" /> Upload Image
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(inv)} className="text-red-600 dark:text-red-400 rounded-lg">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete Record
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

      {/* Adjust Modal */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="space-y-2">
              <Label>Variant</Label>
              <Select value={adjustForm.variant_id} onValueChange={(v) => setAdjustForm({...adjustForm, variant_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                <SelectContent>
                  {variants.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {getItemName(v.item_id)} - {v.size || '-'}/{v.color || '-'} ({v.barcode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Store</Label>
              <Select value={adjustForm.store_id} onValueChange={(v) => setAdjustForm({...adjustForm, store_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity (+/-)</Label>
              <Input type="number" value={adjustForm.quantity} onChange={(e) => setAdjustForm({...adjustForm, quantity: parseInt(e.target.value) || 0})} />
              <p className="text-xs text-muted-foreground">Use negative values to reduce stock</p>
            </div>
            <div className="space-y-2">
              <Label>Purchase Rate</Label>
              <Input type="number" value={adjustForm.purchase_rate} onChange={(e) => setAdjustForm({...adjustForm, purchase_rate: parseFloat(e.target.value) || 0})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdjust(false)}>Cancel</Button>
              <Button type="submit">Adjust</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Details Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" /> Inventory Details
            </DialogTitle>
          </DialogHeader>
          {selectedInventory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Item Name</p>
                  <p className="font-medium">{getItemName(selectedInventory.item_id, selectedInventory)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Store</p>
                  <p className="font-medium">{getStoreName(selectedInventory.store_id)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Variant</p>
                  <p className="font-medium">
                    {getVariantInfo(selectedInventory.variant_id)?.size || '-'} / {getVariantInfo(selectedInventory.variant_id)?.color || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">SKU</p>
                  <p className="font-mono text-sm">{getVariantInfo(selectedInventory.variant_id)?.sku || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Current Quantity</p>
                  <p className="font-bold text-xl">{selectedInventory.quantity || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Purchase Rate</p>
                  <p className="font-medium">{formatWithConversion(selectedInventory.purchase_rate || 0)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Value</p>
                  <p className="font-bold text-emerald-600">{formatWithConversion((selectedInventory.quantity || 0) * (selectedInventory.purchase_rate || 0))}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  {selectedInventory.quantity <= 0 ? (
                    <Badge variant="destructive">Out of Stock</Badge>
                  ) : selectedInventory.quantity <= (getItemInfo(selectedInventory.item_id)?.min_stock_alert || 5) ? (
                    <Badge className="bg-amber-100 text-amber-700">Low Stock</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700">In Stock</Badge>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowViewModal(false)}>Close</Button>
                <Button onClick={() => { setShowViewModal(false); openEditModal(selectedInventory); }}>
                  <Edit className="w-4 h-4 mr-2" /> Adjust Stock
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Adjust Stock Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" /> Adjust Stock
            </DialogTitle>
          </DialogHeader>
          {selectedInventory && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="p-3 bg-accent rounded-lg">
                <p className="font-medium">{getItemName(selectedInventory.item_id, selectedInventory)}</p>
                <p className="text-sm text-muted-foreground">
                  {getVariantInfo(selectedInventory.variant_id)?.size || '-'} / {getVariantInfo(selectedInventory.variant_id)?.color || '-'} • {getStoreName(selectedInventory.store_id)}
                </p>
                <p className="text-sm mt-1">Current Stock: <span className="font-bold">{selectedInventory.quantity || 0}</span></p>
              </div>
              <div className="space-y-2">
                <Label>Quantity Adjustment (+/-)</Label>
                <Input type="number" value={adjustForm.quantity} onChange={(e) => setAdjustForm({...adjustForm, quantity: parseInt(e.target.value) || 0})} />
                <p className="text-xs text-muted-foreground">Use positive to add, negative to reduce</p>
              </div>
              <div className="space-y-2">
                <Label>New Purchase Rate (optional)</Label>
                <Input type="number" value={adjustForm.purchase_rate} onChange={(e) => setAdjustForm({...adjustForm, purchase_rate: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Label Generator */}
      <BarcodeLabelGenerator
        isOpen={showBarcodeGenerator}
        onClose={() => setShowBarcodeGenerator(false)}
        items={selectedItemsForBarcode}
      />
      {/* Image Upload Modal */}
      <Dialog open={showImageUpload} onOpenChange={setShowImageUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" /> Upload Product Image
            </DialogTitle>
          </DialogHeader>
          {selectedItemForImage && (
            <div className="space-y-4">
              <div className="p-3 bg-accent rounded-lg">
                <p className="font-medium">{selectedItemForImage.name}</p>
                <p className="text-sm text-muted-foreground">SKU: {selectedItemForImage.sku || '-'}</p>
              </div>
              
              {/* Current Images */}
              {selectedItemForImage.images && selectedItemForImage.images.length > 0 && (
                <div className="space-y-2">
                  <Label>Current Images ({selectedItemForImage.images.length})</Label>
                  <div className="flex gap-2 flex-wrap">
                    {selectedItemForImage.images.slice(0, 4).map((img, idx) => (
                      <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden border">
                        <img loading="lazy" src={img} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {selectedItemForImage.images.length > 4 && (
                      <div className="w-16 h-16 rounded-lg border flex items-center justify-center bg-accent">
                        <span className="text-sm text-muted-foreground">+{selectedItemForImage.images.length - 4}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Upload Area */}
              <div className="space-y-2">
                <Label>Add New Images</Label>
                <div 
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => imageInputRef.current?.click()}
                >
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <p className="font-medium">Click to upload images</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB each</p>
                    </div>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowImageUpload(false)} disabled={uploadingImage}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
