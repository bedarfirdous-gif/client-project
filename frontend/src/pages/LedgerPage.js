import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  BookOpen, Plus, Search, Edit, Trash2, Calendar, 
  DollarSign, CreditCard, Building2, FileText, Download,
  RefreshCw, Filter, CheckCircle, XCircle, Clock, 
  TrendingUp, TrendingDown, Wallet, PiggyBank, FileSpreadsheet,
  ChevronLeft, ChevronRight, BarChart3, Settings
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'bank', label: 'Bank Transfer', icon: Building2 },
  { value: 'upi', label: 'UPI', icon: CreditCard },
  { value: 'cheque', label: 'Cheque', icon: FileText }
];

const ENTRY_TYPES = [
  { value: 'receipt', label: 'Receipt (Credit)', color: 'text-green-600' },
  { value: 'payment', label: 'Payment (Debit)', color: 'text-red-600' }
];

export default function LedgerPage() {
  const { api, user } = useAuth();
  const [activeTab, setActiveTab] = useState('entries');
  const [entries, setEntries] = useState([]);
  const [ledgerHeads, setLedgerHeads] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  
  // Dialogs
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    ledgerHeadId: '',
    paymentMode: '',
    entryType: '',
    search: ''
  });
  
  // Form state
  const [entryForm, setEntryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    particulars: '',
    ledger_head_id: '',
    entry_type: 'receipt',
    amount: '',
    payment_mode: 'cash',
    reference_number: '',
    remarks: ''
  });
  
  const [headForm, setHeadForm] = useState({
    name: '',
    head_type: 'income',
    description: '',
    opening_balance: 0
  });
  
  const [settings, setSettings] = useState({
    opening_balance: 0,
    effective_date: ''
  });
  
  // Reports state
  const [reportType, setReportType] = useState('monthly');
  const [reportData, setReportData] = useState(null);
  const [reportFilters, setReportFilters] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    startDate: '',
    endDate: ''
  });

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.ledgerHeadId) params.append('ledger_head_id', filters.ledgerHeadId);
      if (filters.paymentMode) params.append('payment_mode', filters.paymentMode);
      if (filters.entryType) params.append('entry_type', filters.entryType);
      if (filters.search) params.append('search', filters.search);
      
      const data = await api(`/api/ledger/entries?${params.toString()}`);
      setEntries(data.entries || []);
      setPagination(data.pagination || pagination);
      setSummary(data.summary || {});
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      toast.error('Failed to load ledger entries');
    } finally {
      setLoading(false);
    }
  }, [api, pagination.page, pagination.limit, filters]);

  const fetchLedgerHeads = useCallback(async () => {
    try {
      const data = await api('/api/ledger/heads');
      setLedgerHeads(data || []);
    } catch (err) {
      console.error('Failed to fetch ledger heads:', err);
    }
  }, [api]);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api('/api/ledger/settings');
      setSettings(data || { opening_balance: 0 });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, [api]);

  useEffect(() => {
    fetchEntries();
    fetchLedgerHeads();
    fetchSettings();
  }, [fetchEntries, fetchLedgerHeads, fetchSettings]);

  const resetEntryForm = () => {
    setEntryForm({
      date: new Date().toISOString().split('T')[0],
      particulars: '',
      ledger_head_id: '',
      entry_type: 'receipt',
      amount: '',
      payment_mode: 'cash',
      reference_number: '',
      remarks: ''
    });
  };

  const handleSubmitEntry = async (e) => {
    e.preventDefault();
    
    if (!entryForm.ledger_head_id) {
      toast.error('Please select a ledger head');
      return;
    }
    
    if (!entryForm.amount || parseFloat(entryForm.amount) <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    
    try {
      const payload = {
        ...entryForm,
        amount: parseFloat(entryForm.amount)
      };
      
      if (editEntry) {
        await api(`/api/ledger/entries/${editEntry.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('Entry updated successfully');
      } else {
        const result = await api('/api/ledger/entries', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success(`Entry created: ${result.voucher_number}`);
      }
      
      setShowEntryModal(false);
      setEditEntry(null);
      resetEntryForm();
      fetchEntries();
    } catch (err) {
      toast.error(err.message || 'Failed to save entry');
    }
  };

  const handleSubmitHead = async (e) => {
    e.preventDefault();
    
    try {
      await api('/api/ledger/heads', {
        method: 'POST',
        body: JSON.stringify(headForm)
      });
      toast.success('Ledger head created');
      setShowHeadModal(false);
      setHeadForm({ name: '', head_type: 'income', description: '', opening_balance: 0 });
      fetchLedgerHeads();
    } catch (err) {
      toast.error(err.message || 'Failed to create ledger head');
    }
  };

  const handleUpdateOpeningBalance = async () => {
    try {
      await api('/api/ledger/settings/opening-balance', {
        method: 'PUT',
        body: JSON.stringify({
          opening_balance: parseFloat(settings.opening_balance),
          effective_date: settings.effective_date || new Date().toISOString().split('T')[0]
        })
      });
      toast.success('Opening balance updated');
      setShowSettingsModal(false);
      fetchEntries();
    } catch (err) {
      toast.error(err.message || 'Failed to update opening balance');
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await api(`/api/ledger/entries/${entryId}`, { method: 'DELETE' });
      toast.success('Entry deleted');
      fetchEntries();
    } catch (err) {
      toast.error(err.message || 'Failed to delete entry');
    }
  };

  const handleEditEntry = (entry) => {
    setEditEntry(entry);
    setEntryForm({
      date: entry.date,
      particulars: entry.particulars,
      ledger_head_id: entry.ledger_head_id,
      entry_type: entry.entry_type,
      amount: entry.amount.toString(),
      payment_mode: entry.payment_mode,
      reference_number: entry.reference_number || '',
      remarks: entry.remarks || ''
    });
    setShowEntryModal(true);
  };

  const fetchReport = async () => {
    try {
      let data;
      if (reportType === 'monthly') {
        data = await api(`/api/ledger/reports/summary?year=${reportFilters.year}&month=${reportFilters.month}`);
      } else if (reportType === 'cash_book') {
        data = await api(`/api/ledger/reports/cash-book?start_date=${reportFilters.startDate}&end_date=${reportFilters.endDate}`);
      } else if (reportType === 'bank_book') {
        data = await api(`/api/ledger/reports/bank-book?start_date=${reportFilters.startDate}&end_date=${reportFilters.endDate}`);
      } else if (reportType === 'day_wise') {
        data = await api(`/api/ledger/reports/day-wise?start_date=${reportFilters.startDate}&end_date=${reportFilters.endDate}`);
      }
      setReportData(data);
    } catch (err) {
      toast.error('Failed to fetch report');
    }
  };

  const handleExport = async (format) => {
    try {
      const startDate = filters.startDate || '2020-01-01';
      const endDate = filters.endDate || new Date().toISOString().split('T')[0];
      
      const data = await api(`/api/ledger/export/${format}?start_date=${startDate}&end_date=${endDate}`);
      toast.success(`${format.toUpperCase()} export ready`);
      console.log('Export data:', data);
    } catch (err) {
      toast.error(`Failed to export ${format}`);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const config = {
      approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
      pending_approval: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      rejected: { color: 'bg-red-100 text-red-700', icon: XCircle }
    };
    const cfg = config[status] || config.pending_approval;
    const Icon = cfg.icon;
    
    return (
      <Badge className={`${cfg.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status?.replace('_', ' ')}
      </Badge>
    );
  };

  const getPaymentModeIcon = (mode) => {
    const found = PAYMENT_MODES.find(m => m.value === mode);
    return found?.icon || Wallet;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-testid="ledger-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" />
            Receipt & Payment Ledger
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage receipts, payments, and track running balance</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowHeadModal(true)} data-testid="add-head-btn">
            <Plus className="w-4 h-4 mr-2" />
            Ledger Head
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowSettingsModal(true)} data-testid="settings-btn">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          )}
          <Button onClick={() => { resetEntryForm(); setEditEntry(null); setShowEntryModal(true); }} data-testid="new-entry-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Opening Balance</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(summary.opening_balance)}</p>
              </div>
              <PiggyBank className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Total Receipts</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(summary.total_receipts)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Total Payments</p>
                <p className="text-xl font-bold text-red-700">{formatCurrency(summary.total_payments)}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">Closing Balance</p>
                <p className="text-xl font-bold text-purple-700">{formatCurrency(summary.closing_balance)}</p>
              </div>
              <Wallet className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries" data-testid="entries-tab">
            <FileText className="w-4 h-4 mr-2" />
            Entries
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="reports-tab">
            <BarChart3 className="w-4 h-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Entries Tab */}
        <TabsContent value="entries" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search voucher, particulars..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="pl-10"
                      data-testid="search-input"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">From Date</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-[140px]"
                  />
                </div>
                
                <div>
                  <Label className="text-xs">To Date</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-[140px]"
                  />
                </div>
                
                <Select value={filters.ledgerHeadId} onValueChange={(v) => setFilters(prev => ({ ...prev, ledgerHeadId: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Ledger Head" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Heads</SelectItem>
                    {ledgerHeads.map(head => (
                      <SelectItem key={head.id} value={head.id}>{head.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filters.paymentMode} onValueChange={(v) => setFilters(prev => ({ ...prev, paymentMode: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Payment Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    {PAYMENT_MODES.map(mode => (
                      <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filters.entryType} onValueChange={(v) => setFilters(prev => ({ ...prev, entryType: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {ENTRY_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button variant="outline" onClick={fetchEntries}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                    <FileSpreadsheet className="w-4 h-4 mr-1" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Entries Table */}
          {loading ? (
            <div className="text-center py-12">Loading entries...</div>
          ) : entries.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No entries found</p>
                <Button className="mt-4" onClick={() => setShowEntryModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Entry
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Voucher No.</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Particulars</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Ledger Head</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Mode</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Receipt (Cr)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Payment (Dr)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Balance</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {entries.map(entry => {
                      const ModeIcon = getPaymentModeIcon(entry.payment_mode);
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-blue-600">{entry.voucher_number}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              {entry.date}
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-[200px] truncate" title={entry.particulars}>
                            {entry.particulars}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{entry.ledger_head_name}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <ModeIcon className="w-3 h-3 text-gray-500" />
                              <span className="capitalize">{entry.payment_mode}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-green-600 font-medium">
                            {entry.receipt_amount > 0 ? formatCurrency(entry.receipt_amount) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600 font-medium">
                            {entry.payment_amount > 0 ? formatCurrency(entry.payment_amount) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {formatCurrency(entry.running_balance)}
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(entry.status)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEditEntry(entry)} title="Edit">
                                <Edit className="w-4 h-4" />
                              </Button>
                              {isAdmin && (
                                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteEntry(entry.id)} title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="p-4 border-t flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-3 py-1 text-sm">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Generate Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label>Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly Summary</SelectItem>
                      <SelectItem value="cash_book">Cash Book</SelectItem>
                      <SelectItem value="bank_book">Bank Book</SelectItem>
                      <SelectItem value="day_wise">Day-wise Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {reportType === 'monthly' ? (
                  <>
                    <div>
                      <Label>Year</Label>
                      <Input
                        type="number"
                        value={reportFilters.year}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                        className="w-[100px]"
                      />
                    </div>
                    <div>
                      <Label>Month</Label>
                      <Select value={reportFilters.month.toString()} onValueChange={(v) => setReportFilters(prev => ({ ...prev, month: parseInt(v) }))}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={reportFilters.startDate}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={reportFilters.endDate}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      />
                    </div>
                  </>
                )}
                
                <Button onClick={fetchReport}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </div>
              
              {/* Report Display */}
              {reportData && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  {reportType === 'monthly' && reportData.totals && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">Monthly Summary - {reportData.month}/{reportData.year}</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-green-50 rounded">
                          <p className="text-sm text-green-600">Total Receipts</p>
                          <p className="text-xl font-bold text-green-700">{formatCurrency(reportData.totals.receipts)}</p>
                        </div>
                        <div className="p-4 bg-red-50 rounded">
                          <p className="text-sm text-red-600">Total Payments</p>
                          <p className="text-xl font-bold text-red-700">{formatCurrency(reportData.totals.payments)}</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded">
                          <p className="text-sm text-blue-600">Net Balance</p>
                          <p className="text-xl font-bold text-blue-700">{formatCurrency(reportData.totals.net)}</p>
                        </div>
                      </div>
                      
                      {reportData.by_payment_mode && Object.keys(reportData.by_payment_mode).length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">By Payment Mode</h4>
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left">Mode</th>
                                <th className="px-3 py-2 text-right">Receipts</th>
                                <th className="px-3 py-2 text-right">Payments</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(reportData.by_payment_mode).map(([mode, data]) => (
                                <tr key={mode} className="border-b">
                                  <td className="px-3 py-2 capitalize">{mode}</td>
                                  <td className="px-3 py-2 text-right text-green-600">{formatCurrency(data.receipts)}</td>
                                  <td className="px-3 py-2 text-right text-red-600">{formatCurrency(data.payments)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {(reportType === 'cash_book' || reportType === 'bank_book') && reportData.entries && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">{reportType === 'cash_book' ? 'Cash Book' : 'Bank Book'} - {reportData.start_date} to {reportData.end_date}</h3>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="p-4 bg-green-50 rounded">
                          <p className="text-sm text-green-600">Total Receipts</p>
                          <p className="text-xl font-bold text-green-700">{formatCurrency(reportData.total_receipts)}</p>
                        </div>
                        <div className="p-4 bg-red-50 rounded">
                          <p className="text-sm text-red-600">Total Payments</p>
                          <p className="text-xl font-bold text-red-700">{formatCurrency(reportData.total_payments)}</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded">
                          <p className="text-sm text-blue-600">Net Flow</p>
                          <p className="text-xl font-bold text-blue-700">{formatCurrency(reportData.net_cash_flow || reportData.net_bank_flow)}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">{reportData.entries.length} transactions</p>
                    </div>
                  )}
                  
                  {reportType === 'day_wise' && reportData.days && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">Day-wise Summary - {reportData.start_date} to {reportData.end_date}</h3>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-right">Receipts</th>
                            <th className="px-3 py-2 text-right">Payments</th>
                            <th className="px-3 py-2 text-right">Net</th>
                            <th className="px-3 py-2 text-right">Transactions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.days.map(day => (
                            <tr key={day.date} className="border-b">
                              <td className="px-3 py-2">{day.date}</td>
                              <td className="px-3 py-2 text-right text-green-600">{formatCurrency(day.receipts)}</td>
                              <td className="px-3 py-2 text-right text-red-600">{formatCurrency(day.payments)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(day.net)}</td>
                              <td className="px-3 py-2 text-right">{day.transaction_count}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold">
                          <tr>
                            <td className="px-3 py-2">Total</td>
                            <td className="px-3 py-2 text-right text-green-600">{formatCurrency(reportData.grand_total?.receipts)}</td>
                            <td className="px-3 py-2 text-right text-red-600">{formatCurrency(reportData.grand_total?.payments)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(reportData.grand_total?.net)}</td>
                            <td className="px-3 py-2 text-right"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Entry Modal */}
      <Dialog open={showEntryModal} onOpenChange={setShowEntryModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              {editEntry ? 'Edit Entry' : 'New Entry'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmitEntry} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={entryForm.date}
                  onChange={(e) => setEntryForm(prev => ({ ...prev, date: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  required
                  data-testid="entry-date"
                />
              </div>
              
              <div>
                <Label>Entry Type *</Label>
                <Select value={entryForm.entry_type} onValueChange={(v) => setEntryForm(prev => ({ ...prev, entry_type: v }))}>
                  <SelectTrigger data-testid="entry-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className={type.color}>{type.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Particulars *</Label>
              <Input
                value={entryForm.particulars}
                onChange={(e) => setEntryForm(prev => ({ ...prev, particulars: e.target.value }))}
                placeholder="Description of transaction"
                required
                data-testid="entry-particulars"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ledger Head *</Label>
                <Select value={entryForm.ledger_head_id} onValueChange={(v) => setEntryForm(prev => ({ ...prev, ledger_head_id: v }))}>
                  <SelectTrigger data-testid="entry-ledger-head">
                    <SelectValue placeholder="Select ledger head" />
                  </SelectTrigger>
                  <SelectContent>
                    {ledgerHeads.map(head => (
                      <SelectItem key={head.id} value={head.id}>{head.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={entryForm.amount}
                  onChange={(e) => setEntryForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                  data-testid="entry-amount"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Mode *</Label>
                <Select value={entryForm.payment_mode} onValueChange={(v) => setEntryForm(prev => ({ ...prev, payment_mode: v }))}>
                  <SelectTrigger data-testid="entry-payment-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(mode => (
                      <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Reference Number</Label>
                <Input
                  value={entryForm.reference_number}
                  onChange={(e) => setEntryForm(prev => ({ ...prev, reference_number: e.target.value }))}
                  placeholder="Cheque/UTR No."
                  data-testid="entry-reference"
                />
              </div>
            </div>
            
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={entryForm.remarks}
                onChange={(e) => setEntryForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Additional notes"
                rows={2}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEntryModal(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="save-entry-btn">
                {editEntry ? 'Update Entry' : 'Create Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ledger Head Modal */}
      <Dialog open={showHeadModal} onOpenChange={setShowHeadModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Ledger Head</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmitHead} className="space-y-4 mt-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={headForm.name}
                onChange={(e) => setHeadForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Sales Revenue, Office Rent"
                required
              />
            </div>
            
            <div>
              <Label>Type *</Label>
              <Select value={headForm.head_type} onValueChange={(v) => setHeadForm(prev => ({ ...prev, head_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={headForm.description}
                onChange={(e) => setHeadForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            
            <div>
              <Label>Opening Balance</Label>
              <Input
                type="number"
                value={headForm.opening_balance}
                onChange={(e) => setHeadForm(prev => ({ ...prev, opening_balance: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowHeadModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Head</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Ledger Settings
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Opening Balance</Label>
              <Input
                type="number"
                step="0.01"
                value={settings.opening_balance}
                onChange={(e) => setSettings(prev => ({ ...prev, opening_balance: e.target.value }))}
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">This is the starting balance for your ledger</p>
            </div>
            
            <div>
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={settings.effective_date}
                onChange={(e) => setSettings(prev => ({ ...prev, effective_date: e.target.value }))}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSettingsModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateOpeningBalance}>Save Settings</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
