import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  History, Search, Filter, Download, RefreshCw, ArrowUp, ArrowDown,
  Package, Truck, ShoppingCart, RotateCcw, Settings2, AlertTriangle,
  User, Calendar, Building2, ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const MOVEMENT_TYPE_CONFIG = {
  sale: { label: 'Sale', color: 'bg-red-100 text-red-700', icon: ShoppingCart },
  purchase: { label: 'Purchase', color: 'bg-green-100 text-green-700', icon: Package },
  transfer_out: { label: 'Transfer Out', color: 'bg-orange-100 text-orange-700', icon: Truck },
  transfer_in: { label: 'Transfer In', color: 'bg-blue-100 text-blue-700', icon: Truck },
  return_in: { label: 'Customer Return', color: 'bg-purple-100 text-purple-700', icon: RotateCcw },
  return_out: { label: 'Supplier Return', color: 'bg-pink-100 text-pink-700', icon: RotateCcw },
  adjustment_add: { label: 'Adjustment (+)', color: 'bg-teal-100 text-teal-700', icon: Settings2 },
  adjustment_remove: { label: 'Adjustment (-)', color: 'bg-amber-100 text-amber-700', icon: Settings2 },
  initial_stock: { label: 'Initial Stock', color: 'bg-indigo-100 text-indigo-700', icon: Package },
  damaged: { label: 'Damaged', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-700', icon: AlertTriangle }
};

export default function StockAuditTrailPage() {
  const { api } = useAuth();
  const [entries, setEntries] = useState([]);
  // Initialize `summary` with a stable non-null shape to prevent a null->object render flash.
  // `loading` already gates the async fetch lifecycle, so we don't need a null sentinel here.
  const [summary, setSummary] = useState({});
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history');
  
  // Filters
  const [filters, setFilters] = useState({
    store_id: '',
    item_id: '',
    movement_type: '',
    start_date: '',
    end_date: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (filters.store_id) params.append('store_id', filters.store_id);
      if (filters.item_id) params.append('item_id', filters.item_id);
      if (filters.movement_type) params.append('movement_type', filters.movement_type);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('limit', '200');
      
      const [entriesData, summaryData, storesData, itemsData] = await Promise.all([
        api(`/api/stock-audit-trail?${params.toString()}`),
        api(`/api/stock-audit-trail/summary?${params.toString()}`),
        api('/api/stores'),
        api('/api/items')
      ]);
      
      setEntries(entriesData.entries || []);
      setSummary(summaryData);
      setStores(storesData);
      setItems(itemsData);
    } catch (err) {
      console.error('Failed to fetch audit trail:', err);
      toast.error('Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [api, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMovementBadge = (type) => {
    const config = MOVEMENT_TYPE_CONFIG[type] || { label: type, color: 'bg-gray-100 text-gray-700', icon: Package };
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getQuantityBadge = (change) => {
    if (change > 0) {
      return (
        <span className="flex items-center gap-1 text-green-600 font-semibold">
          <ArrowUp className="w-4 h-4" />
          +{change}
        </span>
      );
    } else {
      return (
        <span className="flex items-center gap-1 text-red-600 font-semibold">
          <ArrowDown className="w-4 h-4" />
          {change}
        </span>
      );
    }
  };

  const filteredEntries = entries.filter(entry => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      entry.item_name?.toLowerCase().includes(search) ||
      entry.store_name?.toLowerCase().includes(search) ||
      entry.user_name?.toLowerCase().includes(search) ||
      entry.notes?.toLowerCase().includes(search)
    );
  });

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Item', 'Store', 'Change', 'Before', 'After', 'User', 'Reference', 'Notes'];
    const rows = filteredEntries.map(e => [
      formatDate(e.created_at),
      MOVEMENT_TYPE_CONFIG[e.movement_type]?.label || e.movement_type,
      e.item_name || '',
      e.store_name || '',
      e.quantity_change,
      e.quantity_before,
      e.quantity_after,
      e.user_name || '',
      `${e.reference_type || ''} ${e.reference_id || ''}`.trim(),
      e.notes || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-testid="stock-audit-trail-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />
            Stock Audit Trail
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track all stock movements across stores</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="history">Movement History</TabsTrigger>
          <TabsTrigger value="summary">Summary & Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by item, store, user..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={filters.store_id || "all"} onValueChange={(v) => setFilters(f => ({ ...f, store_id: v === "all" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Stores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {stores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filters.movement_type || "all"} onValueChange={(v) => setFilters(f => ({ ...f, movement_type: v === "all" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(MOVEMENT_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters(f => ({ ...f, start_date: e.target.value }))}
                  placeholder="Start Date"
                />
                
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters(f => ({ ...f, end_date: e.target.value }))}
                  placeholder="End Date"
                />
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {loading ? (
            <div className="text-center py-12">Loading audit trail...</div>
          ) : filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <History className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No stock movements found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-4">
                Showing {filteredEntries.length} movements
              </p>
              
              {filteredEntries.map(entry => (
                <Card key={entry.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div 
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                      onClick={() => toggleRow(entry.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {entry.quantity_change > 0 ? (
                            <ArrowUp className="w-5 h-5 text-green-600" />
                          ) : (
                            <ArrowDown className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">{entry.item_name || 'Unknown Item'}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Building2 className="w-3 h-3" />
                            <span>{entry.store_name || 'Unknown Store'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        {getMovementBadge(entry.movement_type)}
                        
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Change</p>
                          {getQuantityBadge(entry.quantity_change)}
                        </div>
                        
                        <div className="text-center hidden md:block">
                          <p className="text-xs text-gray-500">Before → After</p>
                          <p className="font-mono text-sm">
                            {entry.quantity_before} → {entry.quantity_after}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{formatDate(entry.created_at)}</p>
                          <p className="text-sm flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {entry.user_name || 'System'}
                          </p>
                        </div>
                        
                        {expandedRows[entry.id] ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    {expandedRows[entry.id] && (
                      <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Reference Type</p>
                          <p className="font-medium capitalize">{entry.reference_type?.replace(/_/g, ' ') || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Reference ID</p>
                          <p className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate" title={entry.reference_id}>
                            {entry.reference_id || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Variant</p>
                          <p className="font-medium">{entry.variant_display || '-'}</p>
                          {entry.variant_barcode && entry.variant_barcode !== '-' && (
                            <p className="font-mono text-xs text-gray-400">{entry.variant_barcode}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-gray-500">Variant ID</p>
                          <p className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate" title={entry.variant_id}>
                            {entry.variant_id || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Notes</p>
                          <p className="text-gray-700 dark:text-gray-300">{entry.notes || '-'}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          {summary && (
            <div className="space-y-6">
              {/* Movement Type Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Movements by Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {summary.by_movement_type?.map(item => {
                      const config = MOVEMENT_TYPE_CONFIG[item._id] || { label: item._id, color: 'bg-gray-100' };
                      return (
                        <div key={item._id} className={`p-4 rounded-lg ${config.color}`}>
                          <p className="text-sm font-medium">{config.label}</p>
                          <p className="text-2xl font-bold">{item.total_movements}</p>
                          <p className="text-sm">
                            +{item.total_added} / -{item.total_removed}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Top Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Top Items by Movements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary.top_items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-medium">{item._id?.item_name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">{item.total_movements} movements</span>
                          <span className={`font-mono font-semibold ${item.net_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.net_change >= 0 ? '+' : ''}{item.net_change}
                          </span>
                        </div>
                      </div>
                    ))}
                    {(!summary.top_items || summary.top_items.length === 0) && (
                      <p className="text-center text-gray-500 py-4">No data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* User Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    User Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary.user_activity?.map((user, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                            {user._id?.user_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span className="font-medium">{user._id?.user_name || 'Unknown'}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{user.total_movements} movements</p>
                          <p className="text-xs text-gray-500">Last: {formatDate(user.last_activity)}</p>
                        </div>
                      </div>
                    ))}
                    {(!summary.user_activity || summary.user_activity.length === 0) && (
                      <p className="text-center text-gray-500 py-4">No user activity data</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
