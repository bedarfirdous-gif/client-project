import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { Trash2, RotateCcw, AlertTriangle, UserCircle, Package, FileText, Clock, Search, RefreshCw, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Receipt, ShoppingBag } from 'lucide-react';

const ITEM_TYPE_CONFIG = {
  employee: { 
    label: 'Employee', 
    icon: UserCircle, 
    color: 'bg-blue-100 text-blue-700',
    getName: (data) => data?.name || 'Unknown Employee'
  },
  item: { 
    label: 'Item', 
    icon: Package, 
    color: 'bg-green-100 text-green-700',
    getName: (data) => data?.name || 'Unknown Item'
  },
  customer: { 
    label: 'Customer', 
    icon: UserCircle, 
    color: 'bg-purple-100 text-purple-700',
    getName: (data) => data?.name || 'Unknown Customer'
  },
  invoice: { 
    label: 'Invoice', 
    icon: Receipt, 
    color: 'bg-orange-100 text-orange-700',
    getName: (data) => data?.invoice_number || data?.id?.slice(0, 8) || 'Unknown Invoice'
  },
  purchase: { 
    label: 'Purchase', 
    icon: ShoppingBag, 
    color: 'bg-teal-100 text-teal-700',
    getName: (data) => data?.invoice_number || data?.supplier_name || 'Unknown Purchase'
  },
  document: { 
    label: 'Document', 
    icon: FileText, 
    color: 'bg-amber-100 text-amber-700',
    getName: (data) => data?.name || 'Unknown Document'
  }
};

export default function RecycleBinPage() {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  // Fix: avoid initializing with null to prevent a brief "null -> object" render flash
  // when dialogs/actions read selectedItem on first open. Use an explicit empty state instead.
  const [selectedItem, setSelectedItem] = useState({});
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEmptyDialog, setShowEmptyDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRecycleBin = async () => {
    setLoading(true);
    try {
      const typeParam = filterType !== 'all' ? `?item_type=${filterType}` : '';
      const data = await api(`/api/recycle-bin${typeParam}`);
      setItems(data.items || []);
    } catch (err) {
      toast.error('Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchRecycleBin(); 
  }, [filterType]);

  const handleRestore = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      await api(`/api/recycle-bin/${selectedItem.id}/restore`, { method: 'POST' });
      toast.success(`${selectedItem.item_type} restored successfully`);
      setShowRestoreDialog(false);
      setSelectedItem(null);
      fetchRecycleBin();
    } catch (err) {
      toast.error('Failed to restore item');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      await api(`/api/recycle-bin/${selectedItem.id}`, { method: 'DELETE' });
      toast.success(`${selectedItem.item_type} permanently deleted`);
      setShowDeleteDialog(false);
      setSelectedItem(null);
      fetchRecycleBin();
    } catch (err) {
      toast.error('Failed to delete item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmptyBin = async () => {
    setActionLoading(true);
    try {
      await api('/api/recycle-bin/empty', { method: 'DELETE' });
      toast.success('Recycle bin emptied');
      setShowEmptyDialog(false);
      fetchRecycleBin();
    } catch (err) {
      toast.error('Failed to empty recycle bin');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntilAutoDelete = (autoDeleteAt) => {
    if (!autoDeleteAt) return null;
    const now = new Date();
    const deleteDate = new Date(autoDeleteAt);
    const diffTime = deleteDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const filteredItems = items.filter(item => {
    const config = ITEM_TYPE_CONFIG[item.item_type] || ITEM_TYPE_CONFIG.document;
    const name = config.getName(item.item_data);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6" data-testid="recycle-bin-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-muted-foreground" />
            Recycle Bin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Items will be automatically deleted after 30 days
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRecycleBin} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {items.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => setShowEmptyDialog(true)}
              data-testid="empty-bin-btn"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Empty Bin
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search deleted items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger data-testid="filter-select">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="employee">Employees</SelectItem>
                  <SelectItem value="item">Items</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="invoice">Invoices</SelectItem>
                  <SelectItem value="purchase">Purchases</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trash2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Recycle Bin is Empty</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm || filterType !== 'all' 
                ? 'No items match your search criteria' 
                : 'Deleted items will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const config = ITEM_TYPE_CONFIG[item.item_type] || ITEM_TYPE_CONFIG.document;
            const ItemIcon = config.icon;
            const name = config.getName(item.item_data);
            const daysLeft = getDaysUntilAutoDelete(item.auto_delete_at);

            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow" data-testid={`recycle-item-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center`}>
                        <ItemIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className={config.color}>
                            {config.label}
                          </Badge>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Deleted {formatDate(item.deleted_at)}
                          </span>
                        </div>
                        {item.deleted_by_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            by {item.deleted_by_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {daysLeft !== null && (
                        <Badge variant={daysLeft <= 7 ? 'destructive' : 'secondary'} className="hidden sm:flex">
                          {daysLeft} days left
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowRestoreDialog(true);
                        }}
                        data-testid={`restore-btn-${item.id}`}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowDeleteDialog(true);
                        }}
                        data-testid={`delete-btn-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Item Details Preview */}
                  {item.item_type === 'employee' && item.item_data && (
                    <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      {item.item_data.employee_code && (
                        <div>
                          <span className="font-medium">Code:</span> {item.item_data.employee_code}
                        </div>
                      )}
                      {item.item_data.department && (
                        <div>
                          <span className="font-medium">Dept:</span> {item.item_data.department}
                        </div>
                      )}
                      {item.item_data.phone && (
                        <div>
                          <span className="font-medium">Phone:</span> {item.item_data.phone}
                        </div>
                      )}
                      {item.item_data.email && (
                        <div>
                          <span className="font-medium">Email:</span> {item.item_data.email}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <RotateCcw className="w-5 h-5" />
              Restore Item
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  Are you sure you want to restore <strong>
                    {ITEM_TYPE_CONFIG[selectedItem.item_type]?.getName(selectedItem.item_data) || 'this item'}
                  </strong>?
                </p>
                <p className="text-xs text-green-600 mt-2">
                  The item will be restored to its original location.
                </p>
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleRestore}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actionLoading ? 'Restoring...' : 'Restore'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Permanently Delete
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  Are you sure you want to <strong>permanently delete</strong>{' '}
                  <strong>
                    {ITEM_TYPE_CONFIG[selectedItem.item_type]?.getName(selectedItem.item_data) || 'this item'}
                  </strong>?
                </p>
                <p className="text-xs text-red-600 mt-2 font-medium">
                  This action cannot be undone!
                </p>
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handlePermanentDelete}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Deleting...' : 'Delete Forever'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Empty Bin Confirmation Dialog */}
      <Dialog open={showEmptyDialog} onOpenChange={setShowEmptyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Empty Recycle Bin
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                Are you sure you want to <strong>permanently delete all {items.length} items</strong> in the recycle bin?
              </p>
              <p className="text-xs text-red-600 mt-2 font-medium">
                This action cannot be undone! All items will be lost forever.
              </p>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEmptyDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleEmptyBin}
                disabled={actionLoading}
              >
                {actionLoading ? 'Emptying...' : 'Empty Bin'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
