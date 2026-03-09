import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  BookOpen, Users, Building2, TrendingUp, TrendingDown, 
  ArrowUpRight, ArrowDownRight, Eye, Search, Settings,
  RefreshCw, Filter, FileText, Receipt, Banknote,
  Wallet, CreditCard, ShoppingCart, Package, Download, FileSpreadsheet
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useCurrency } from '../contexts/CurrencyContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

export default function CentralAccountingPage() {
  const { api, user } = useAuth();
  const { formatCurrency } = useCurrency();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('central');
  
  // Loading states
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [centralLedger, setCentralLedger] = useState({ entries: [], summary: {} });
  const [debtorLedger, setDebtorLedger] = useState({ debtors: [], summary: {} });
  const [creditorLedger, setCreditorLedger] = useState({ creditors: [], summary: {} });
  const [cashLedger, setCashLedger] = useState({ entries: [], summary: {} });
  const [bankLedger, setBankLedger] = useState({ entries: [], summary: {} });
  const [purchaseLedger, setPurchaseLedger] = useState({ entries: [], summary: {} });
  const [salesLedger, setSalesLedger] = useState({ entries: [], summary: {} });
  const [accountingSummary, setAccountingSummary] = useState({});
  const [accountingSettings, setAccountingSettings] = useState({});
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    entryType: '',
    search: ''
  });
  
  // Transaction detail dialog
  const [selectedParty, setSelectedParty] = useState(null);
  const [partyTransactions, setPartyTransactions] = useState([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  
  // Settings dialog
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    opening_cash_balance: 0,
    opening_bank_balance: 0
  });

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [central, debtors, creditors, cash, bank, purchases, sales, summary, settings] = await Promise.all([
        api('/api/accounting/central-ledger'),
        api('/api/accounting/debtor-ledger'),
        api('/api/accounting/creditor-ledger'),
        api('/api/accounting/cash-ledger'),
        api('/api/accounting/bank-ledger'),
        api('/api/accounting/purchase-ledger'),
        api('/api/accounting/sales-ledger'),
        api('/api/accounting/summary'),
        api('/api/accounting/settings')
      ]);
      
      setCentralLedger(central);
      setDebtorLedger(debtors);
      setCreditorLedger(creditors);
      setCashLedger(cash);
      setBankLedger(bank);
      setPurchaseLedger(purchases);
      setSalesLedger(sales);
      setAccountingSummary(summary);
      setAccountingSettings(settings);
      setSettingsForm({
        opening_cash_balance: settings.opening_cash_balance || 0,
        opening_bank_balance: settings.opening_bank_balance || 0
      });
    } catch (err) {
      console.error('Failed to load accounting data:', err);
      toast.error('Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch filtered central ledger
  const fetchFilteredCentralLedger = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.entryType && filters.entryType !== 'all') params.append('entry_type', filters.entryType);
      
      const data = await api(`/api/accounting/central-ledger?${params.toString()}`);
      setCentralLedger(data);
    } catch (err) {
      toast.error('Failed to filter ledger');
    }
  };

  // View party transactions
  const viewPartyTransactions = async (party, type) => {
    setSelectedParty({ ...party, type });
    setTransactionLoading(true);
    try {
      const endpoint = type === 'debtor' 
        ? `/api/accounting/debtor-ledger/${party.customer_id}/transactions`
        : `/api/accounting/creditor-ledger/${party.supplier_id}/transactions`;
      const data = await api(endpoint);
      setPartyTransactions(data.transactions || []);
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setTransactionLoading(false);
    }
  };

  const closeTransactionDialog = () => {
    setSelectedParty(null);
    setPartyTransactions([]);
  };

  // Save accounting settings
  const saveSettings = async () => {
    try {
      await api('/api/accounting/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsForm)
      });
      toast.success('Settings saved successfully');
      setShowSettingsDialog(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };

  // Export ledger to PDF or Excel
  const exportLedger = async (ledgerType, format) => {
    try {
      toast.loading(`Generating ${format.toUpperCase()} file...`, { id: 'export' });
      
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/accounting/export/${ledgerType}/${format}?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ledgerType}_ledger_${new Date().toISOString().slice(0,10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`${format.toUpperCase()} downloaded successfully`, { id: 'export' });
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export ledger', { id: 'export' });
    }
  };

  // Export button component
  const ExportButtons = ({ ledgerType }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`export-${ledgerType}-btn`}>
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => exportLedger(ledgerType, 'excel')}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
          Export to Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportLedger(ledgerType, 'pdf')}>
          <FileText className="w-4 h-4 mr-2 text-red-600" />
          Export to PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Entry type badge
  const getEntryTypeBadge = (type) => {
    const badges = {
      sale: { label: 'Sale', color: 'bg-green-100 text-green-800' },
      purchase: { label: 'Purchase', color: 'bg-blue-100 text-blue-800' },
      receipt: { label: 'Receipt', color: 'bg-emerald-100 text-emerald-800' },
      payment: { label: 'Payment', color: 'bg-orange-100 text-orange-800' },
      sale_return: { label: 'Sale Return', color: 'bg-red-100 text-red-800' },
      purchase_return: { label: 'Purchase Return', color: 'bg-purple-100 text-purple-800' }
    };
    const badge = badges[type] || { label: type, color: 'bg-gray-100 text-gray-800' };
    return <Badge className={badge.color}>{badge.label}</Badge>;
  };

  // Payment status badge
  const getPaymentStatusBadge = (status) => {
    const badges = {
      paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
      partial: { label: 'Partial', color: 'bg-orange-100 text-orange-800' }
    };
    const badge = badges[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return <Badge className={badge.color}>{badge.label}</Badge>;
  };

  // Filter entries by search
  const filteredCentralEntries = centralLedger.entries?.filter(entry => 
    entry.party_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
    entry.reference_number?.toLowerCase().includes(filters.search.toLowerCase()) ||
    entry.description?.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];

  const filteredDebtors = debtorLedger.debtors?.filter(d =>
    d.customer_name?.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];

  const filteredCreditors = creditorLedger.creditors?.filter(c =>
    c.supplier_name?.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];

  const filteredCashEntries = cashLedger.entries?.filter(e =>
    e.party_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
    e.reference_number?.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];

  const filteredBankEntries = bankLedger.entries?.filter(e =>
    e.party_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
    e.reference_number?.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];

  const filteredPurchaseEntries = purchaseLedger.entries?.filter(e =>
    e.supplier_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
    e.invoice_number?.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];

  const filteredSalesEntries = salesLedger.entries?.filter(e =>
    e.customer_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
    e.invoice_number?.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <div className="space-y-6" data-testid="central-accounting-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" />
            Accounting Ledgers
          </h1>
          <p className="text-muted-foreground">Double-entry accounting system</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button onClick={() => setShowSettingsDialog(true)} variant="outline" data-testid="settings-btn">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          )}
          <Button onClick={fetchData} variant="outline" data-testid="refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-200" data-testid="total-sales-card">
          <CardContent className="pt-3 pb-2">
            <TrendingUp className="w-5 h-5 text-green-600 mb-1" />
            <p className="text-xs text-muted-foreground">Total Sales</p>
            <p className="text-sm font-bold text-green-600">{formatCurrency(accountingSummary.total_sales || 0)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200" data-testid="total-purchases-card">
          <CardContent className="pt-3 pb-2">
            <TrendingDown className="w-5 h-5 text-blue-600 mb-1" />
            <p className="text-xs text-muted-foreground">Total Purchases</p>
            <p className="text-sm font-bold text-blue-600">{formatCurrency(accountingSummary.total_purchases || 0)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-200" data-testid="total-receipts-card">
          <CardContent className="pt-3 pb-2">
            <ArrowDownRight className="w-5 h-5 text-emerald-600 mb-1" />
            <p className="text-xs text-muted-foreground">Receipts</p>
            <p className="text-sm font-bold text-emerald-600">{formatCurrency(accountingSummary.total_receipts || 0)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-200" data-testid="total-payments-card">
          <CardContent className="pt-3 pb-2">
            <ArrowUpRight className="w-5 h-5 text-orange-600 mb-1" />
            <p className="text-xs text-muted-foreground">Payments</p>
            <p className="text-sm font-bold text-orange-600">{formatCurrency(accountingSummary.total_payments || 0)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-200" data-testid="receivable-card">
          <CardContent className="pt-3 pb-2">
            <Users className="w-5 h-5 text-amber-600 mb-1" />
            <p className="text-xs text-muted-foreground">Receivable</p>
            <p className="text-sm font-bold text-amber-600">{formatCurrency(accountingSummary.total_receivable || 0)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-200" data-testid="payable-card">
          <CardContent className="pt-3 pb-2">
            <Building2 className="w-5 h-5 text-purple-600 mb-1" />
            <p className="text-xs text-muted-foreground">Payable</p>
            <p className="text-sm font-bold text-purple-600">{formatCurrency(accountingSummary.total_payable || 0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/10 border-teal-200" data-testid="cash-balance-card">
          <CardContent className="pt-3 pb-2">
            <Banknote className="w-5 h-5 text-teal-600 mb-1" />
            <p className="text-xs text-muted-foreground">Cash Balance</p>
            <p className="text-sm font-bold text-teal-600">{formatCurrency(cashLedger.summary?.closing_balance || 0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 border-indigo-200" data-testid="bank-balance-card">
          <CardContent className="pt-3 pb-2">
            <CreditCard className="w-5 h-5 text-indigo-600 mb-1" />
            <p className="text-xs text-muted-foreground">Bank Balance</p>
            <p className="text-sm font-bold text-indigo-600">{formatCurrency(bankLedger.summary?.closing_balance || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="central" data-testid="central-tab">
            <BookOpen className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Central</span>
          </TabsTrigger>
          <TabsTrigger value="debtors" data-testid="debtors-tab">
            <Users className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Debtors</span>
          </TabsTrigger>
          <TabsTrigger value="creditors" data-testid="creditors-tab">
            <Building2 className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Creditors</span>
          </TabsTrigger>
          <TabsTrigger value="cash" data-testid="cash-tab">
            <Banknote className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Cash</span>
          </TabsTrigger>
          <TabsTrigger value="bank" data-testid="bank-tab">
            <CreditCard className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Bank</span>
          </TabsTrigger>
          <TabsTrigger value="purchases" data-testid="purchases-tab">
            <Package className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Purchases</span>
          </TabsTrigger>
          <TabsTrigger value="sales" data-testid="sales-tab">
            <ShoppingCart className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Sales</span>
          </TabsTrigger>
        </TabsList>

        {/* Search Bar */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          
          {activeTab === 'central' && (
            <>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-36"
                data-testid="start-date-input"
              />
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-36"
                data-testid="end-date-input"
              />
              <Select value={filters.entryType || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, entryType: v === "all" ? "" : v }))}>
                <SelectTrigger className="w-32" data-testid="entry-type-select">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="sale">Sales</SelectItem>
                  <SelectItem value="purchase">Purchases</SelectItem>
                  <SelectItem value="receipt">Receipts</SelectItem>
                  <SelectItem value="payment">Payments</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={fetchFilteredCentralLedger} variant="outline" size="sm" data-testid="filter-btn">
                <Filter className="w-4 h-4 mr-1" />
                Filter
              </Button>
            </>
          )}
        </div>

        {/* Central Ledger Tab */}
        <TabsContent value="central" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>All Transactions ({filteredCentralEntries.length})</span>
                <div className="flex items-center gap-2">
                  <ExportButtons ledgerType="central" />
                  <Badge variant="outline">
                    Total: {formatCurrency(centralLedger.summary?.total_amount || 0)}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCentralEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="no-entries-message">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No accounting entries yet</p>
                  <p className="text-sm">Entries will appear here when you create sales or purchase invoices</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="central-ledger-table">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3 font-medium">Date</th>
                        <th className="text-left py-2 px-3 font-medium">Account</th>
                        <th className="text-left py-2 px-3 font-medium">Description</th>
                        <th className="text-left py-2 px-3 font-medium">Type</th>
                        <th className="text-right py-2 px-3 font-medium">Debit</th>
                        <th className="text-right py-2 px-3 font-medium">Credit</th>
                        <th className="text-right py-2 px-3 font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCentralEntries.map((entry, idx) => (
                        <tr key={entry.id || idx} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-3">{entry.date}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium">{entry.party_name}</div>
                            <div className="text-xs text-muted-foreground">{entry.reference_number}</div>
                          </td>
                          <td className="py-2 px-3">{entry.description}</td>
                          <td className="py-2 px-3">{getEntryTypeBadge(entry.entry_type)}</td>
                          <td className="py-2 px-3 text-right text-green-600 font-medium">
                            {entry.debit_account ? formatCurrency(entry.amount) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-red-600 font-medium">
                            {entry.credit_account ? formatCurrency(entry.amount) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold">
                            {formatCurrency(entry.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debtor Ledger Tab */}
        <TabsContent value="debtors" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10">
              <CardContent className="pt-3 pb-2">
                <Users className="w-5 h-5 text-blue-600 mb-1" />
                <p className="text-xs text-muted-foreground">Total Customers</p>
                <p className="text-lg font-bold">{debtorLedger.summary?.total_customers || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10">
              <CardContent className="pt-3 pb-2">
                <TrendingUp className="w-5 h-5 text-green-600 mb-1" />
                <p className="text-xs text-muted-foreground">Total Sales</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(debtorLedger.summary?.total_sales || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10">
              <CardContent className="pt-3 pb-2">
                <Receipt className="w-5 h-5 text-emerald-600 mb-1" />
                <p className="text-xs text-muted-foreground">Total Receipts</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(debtorLedger.summary?.total_receipts || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10">
              <CardContent className="pt-3 pb-2">
                <Wallet className="w-5 h-5 text-amber-600 mb-1" />
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(debtorLedger.summary?.total_receivable || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Customer Balances ({filteredDebtors.length})</span>
                <ExportButtons ledgerType="debtors" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDebtors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="no-debtors-message">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No customer balances yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="debtor-ledger-table">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3 font-medium">Customer</th>
                        <th className="text-right py-2 px-3 font-medium">Opening</th>
                        <th className="text-right py-2 px-3 font-medium">Sales</th>
                        <th className="text-right py-2 px-3 font-medium">Receipts</th>
                        <th className="text-right py-2 px-3 font-medium">Returns</th>
                        <th className="text-right py-2 px-3 font-medium">Balance</th>
                        <th className="text-center py-2 px-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDebtors.map((debtor, idx) => (
                        <tr key={debtor.id || idx} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-3">
                            <div className="font-medium">{debtor.customer_name}</div>
                            <div className="text-xs text-muted-foreground">Last: {debtor.last_transaction_date || 'N/A'}</div>
                          </td>
                          <td className="py-2 px-3 text-right">{formatCurrency(debtor.opening_balance || 0)}</td>
                          <td className="py-2 px-3 text-right text-green-600">{formatCurrency(debtor.total_sales || 0)}</td>
                          <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(debtor.total_receipts || 0)}</td>
                          <td className="py-2 px-3 text-right text-red-600">{formatCurrency(debtor.total_returns || 0)}</td>
                          <td className="py-2 px-3 text-right font-bold text-amber-600">{formatCurrency(debtor.current_balance || 0)}</td>
                          <td className="py-2 px-3 text-center">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => viewPartyTransactions(debtor, 'debtor')}
                              data-testid={`view-debtor-${debtor.customer_id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Creditor Ledger Tab */}
        <TabsContent value="creditors" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10">
              <CardContent className="pt-3 pb-2">
                <Building2 className="w-5 h-5 text-purple-600 mb-1" />
                <p className="text-xs text-muted-foreground">Total Suppliers</p>
                <p className="text-lg font-bold">{creditorLedger.summary?.total_suppliers || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10">
              <CardContent className="pt-3 pb-2">
                <TrendingDown className="w-5 h-5 text-blue-600 mb-1" />
                <p className="text-xs text-muted-foreground">Total Purchases</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(creditorLedger.summary?.total_purchases || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10">
              <CardContent className="pt-3 pb-2">
                <CreditCard className="w-5 h-5 text-orange-600 mb-1" />
                <p className="text-xs text-muted-foreground">Total Payments</p>
                <p className="text-lg font-bold text-orange-600">{formatCurrency(creditorLedger.summary?.total_payments || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10">
              <CardContent className="pt-3 pb-2">
                <Wallet className="w-5 h-5 text-red-600 mb-1" />
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(creditorLedger.summary?.total_payable || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Supplier Balances ({filteredCreditors.length})</span>
                <ExportButtons ledgerType="creditors" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCreditors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="no-creditors-message">
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No supplier balances yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="creditor-ledger-table">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3 font-medium">Supplier</th>
                        <th className="text-right py-2 px-3 font-medium">Opening</th>
                        <th className="text-right py-2 px-3 font-medium">Purchases</th>
                        <th className="text-right py-2 px-3 font-medium">Payments</th>
                        <th className="text-right py-2 px-3 font-medium">Returns</th>
                        <th className="text-right py-2 px-3 font-medium">Balance</th>
                        <th className="text-center py-2 px-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCreditors.map((creditor, idx) => (
                        <tr key={creditor.id || idx} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-3">
                            <div className="font-medium">{creditor.supplier_name}</div>
                            <div className="text-xs text-muted-foreground">Last: {creditor.last_transaction_date || 'N/A'}</div>
                          </td>
                          <td className="py-2 px-3 text-right">{formatCurrency(creditor.opening_balance || 0)}</td>
                          <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(creditor.total_purchases || 0)}</td>
                          <td className="py-2 px-3 text-right text-orange-600">{formatCurrency(creditor.total_payments || 0)}</td>
                          <td className="py-2 px-3 text-right text-purple-600">{formatCurrency(creditor.total_returns || 0)}</td>
                          <td className="py-2 px-3 text-right font-bold text-red-600">{formatCurrency(creditor.current_balance || 0)}</td>
                          <td className="py-2 px-3 text-center">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => viewPartyTransactions(creditor, 'creditor')}
                              data-testid={`view-creditor-${creditor.supplier_id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Ledger Tab */}
        <TabsContent value="cash" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/10">
              <CardContent className="pt-3 pb-2">
                <Banknote className="w-5 h-5 text-slate-600 mb-1" />
                <p className="text-xs text-muted-foreground">Opening Balance</p>
                <p className="text-lg font-bold">{formatCurrency(cashLedger.summary?.opening_balance || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10">
              <CardContent className="pt-3 pb-2">
                <ArrowDownRight className="w-5 h-5 text-green-600 mb-1" />
                <p className="text-xs text-muted-foreground">Cash Received</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(cashLedger.summary?.total_receipts || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10">
              <CardContent className="pt-3 pb-2">
                <ArrowUpRight className="w-5 h-5 text-red-600 mb-1" />
                <p className="text-xs text-muted-foreground">Cash Paid</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(cashLedger.summary?.total_payments || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/10">
              <CardContent className="pt-3 pb-2">
                <Wallet className="w-5 h-5 text-teal-600 mb-1" />
                <p className="text-xs text-muted-foreground">Closing Balance</p>
                <p className="text-lg font-bold text-teal-600">{formatCurrency(cashLedger.summary?.closing_balance || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Cash Transactions ({filteredCashEntries.length})</span>
                <ExportButtons ledgerType="cash" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCashEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="no-cash-entries">
                  <Banknote className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No cash transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="cash-ledger-table">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3 font-medium">Date</th>
                        <th className="text-left py-2 px-3 font-medium">Description</th>
                        <th className="text-left py-2 px-3 font-medium">Reference</th>
                        <th className="text-left py-2 px-3 font-medium">Type</th>
                        <th className="text-right py-2 px-3 font-medium">Debit (In)</th>
                        <th className="text-right py-2 px-3 font-medium">Credit (Out)</th>
                        <th className="text-right py-2 px-3 font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCashEntries.map((entry, idx) => (
                        <tr key={entry.id || idx} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-3">{entry.date}</td>
                          <td className="py-2 px-3">{entry.party_name || entry.description}</td>
                          <td className="py-2 px-3 text-muted-foreground">{entry.reference_number}</td>
                          <td className="py-2 px-3">{getEntryTypeBadge(entry.entry_type)}</td>
                          <td className="py-2 px-3 text-right text-green-600 font-medium">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-red-600 font-medium">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold">{formatCurrency(entry.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Ledger Tab */}
        <TabsContent value="bank" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/10">
              <CardContent className="pt-3 pb-2">
                <CreditCard className="w-5 h-5 text-slate-600 mb-1" />
                <p className="text-xs text-muted-foreground">Opening Balance</p>
                <p className="text-lg font-bold">{formatCurrency(bankLedger.summary?.opening_balance || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10">
              <CardContent className="pt-3 pb-2">
                <ArrowDownRight className="w-5 h-5 text-green-600 mb-1" />
                <p className="text-xs text-muted-foreground">Bank Received</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(bankLedger.summary?.total_receipts || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10">
              <CardContent className="pt-3 pb-2">
                <ArrowUpRight className="w-5 h-5 text-red-600 mb-1" />
                <p className="text-xs text-muted-foreground">Bank Paid</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(bankLedger.summary?.total_payments || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/10">
              <CardContent className="pt-3 pb-2">
                <Wallet className="w-5 h-5 text-indigo-600 mb-1" />
                <p className="text-xs text-muted-foreground">Closing Balance</p>
                <p className="text-lg font-bold text-indigo-600">{formatCurrency(bankLedger.summary?.closing_balance || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Bank Transactions ({filteredBankEntries.length})</span>
                <ExportButtons ledgerType="bank" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredBankEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="no-bank-entries">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No bank transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="bank-ledger-table">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3 font-medium">Date</th>
                        <th className="text-left py-2 px-3 font-medium">Description</th>
                        <th className="text-left py-2 px-3 font-medium">Reference</th>
                        <th className="text-left py-2 px-3 font-medium">Mode</th>
                        <th className="text-left py-2 px-3 font-medium">Type</th>
                        <th className="text-right py-2 px-3 font-medium">Debit (In)</th>
                        <th className="text-right py-2 px-3 font-medium">Credit (Out)</th>
                        <th className="text-right py-2 px-3 font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBankEntries.map((entry, idx) => (
                        <tr key={entry.id || idx} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-3">{entry.date}</td>
                          <td className="py-2 px-3">{entry.party_name || entry.description}</td>
                          <td className="py-2 px-3 text-muted-foreground">{entry.reference_number}</td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className="text-xs">{entry.payment_mode?.toUpperCase()}</Badge>
                          </td>
                          <td className="py-2 px-3">{getEntryTypeBadge(entry.entry_type)}</td>
                          <td className="py-2 px-3 text-right text-green-600 font-medium">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-red-600 font-medium">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold">{formatCurrency(entry.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchase Ledger Tab */}
        <TabsContent value="purchases" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10">
              <CardContent className="pt-3 pb-2">
                <FileText className="w-5 h-5 text-blue-600 mb-1" />
                <p className="text-xs text-muted-foreground">Total Invoices</p>
                <p className="text-lg font-bold">{purchaseLedger.summary?.total_invoices || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/10">
              <CardContent className="pt-3 pb-2">
                <Package className="w-5 h-5 text-slate-600 mb-1" />
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="text-lg font-bold">{formatCurrency(purchaseLedger.summary?.total_amount || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10">
              <CardContent className="pt-3 pb-2">
                <Receipt className="w-5 h-5 text-purple-600 mb-1" />
                <p className="text-xs text-muted-foreground">Total GST</p>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(purchaseLedger.summary?.total_gst || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10">
              <CardContent className="pt-3 pb-2">
                <TrendingDown className="w-5 h-5 text-blue-600 mb-1" />
                <p className="text-xs text-muted-foreground">Gross Total</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(purchaseLedger.summary?.total_gross || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Purchase Invoices ({filteredPurchaseEntries.length})</span>
                <ExportButtons ledgerType="purchases" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredPurchaseEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="no-purchase-entries">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No purchase invoices yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="purchase-ledger-table">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3 font-medium">Date</th>
                        <th className="text-left py-2 px-3 font-medium">Invoice No.</th>
                        <th className="text-left py-2 px-3 font-medium">Supplier</th>
                        <th className="text-right py-2 px-3 font-medium">Amount</th>
                        <th className="text-right py-2 px-3 font-medium">GST</th>
                        <th className="text-right py-2 px-3 font-medium">Total</th>
                        <th className="text-center py-2 px-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPurchaseEntries.map((entry, idx) => (
                        <tr key={entry.id || idx} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-3">{entry.date}</td>
                          <td className="py-2 px-3 font-medium">{entry.invoice_number}</td>
                          <td className="py-2 px-3">{entry.supplier_name}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(entry.amount)}</td>
                          <td className="py-2 px-3 text-right text-purple-600">{formatCurrency(entry.gst)}</td>
                          <td className="py-2 px-3 text-right font-bold text-blue-600">{formatCurrency(entry.total)}</td>
                          <td className="py-2 px-3 text-center">{getPaymentStatusBadge(entry.payment_status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Ledger Tab */}
        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10">
              <CardContent className="pt-3 pb-2">
                <FileText className="w-5 h-5 text-green-600 mb-1" />
                <p className="text-xs text-muted-foreground">Total Invoices</p>
                <p className="text-lg font-bold">{salesLedger.summary?.total_invoices || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/10">
              <CardContent className="pt-3 pb-2">
                <ShoppingCart className="w-5 h-5 text-slate-600 mb-1" />
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="text-lg font-bold">{formatCurrency(salesLedger.summary?.total_amount || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10">
              <CardContent className="pt-3 pb-2">
                <Receipt className="w-5 h-5 text-purple-600 mb-1" />
                <p className="text-xs text-muted-foreground">Total GST</p>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(salesLedger.summary?.total_gst || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10">
              <CardContent className="pt-3 pb-2">
                <TrendingUp className="w-5 h-5 text-green-600 mb-1" />
                <p className="text-xs text-muted-foreground">Gross Total</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(salesLedger.summary?.total_gross || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Sales Invoices ({filteredSalesEntries.length})</span>
                <ExportButtons ledgerType="sales" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSalesEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="no-sales-entries">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No sales invoices yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="sales-ledger-table">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3 font-medium">Date</th>
                        <th className="text-left py-2 px-3 font-medium">Invoice No.</th>
                        <th className="text-left py-2 px-3 font-medium">Customer</th>
                        <th className="text-right py-2 px-3 font-medium">Amount</th>
                        <th className="text-right py-2 px-3 font-medium">GST</th>
                        <th className="text-right py-2 px-3 font-medium">Total</th>
                        <th className="text-center py-2 px-3 font-medium">Payment</th>
                        <th className="text-center py-2 px-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSalesEntries.map((entry, idx) => (
                        <tr key={entry.id || idx} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-3">{entry.date}</td>
                          <td className="py-2 px-3 font-medium">{entry.invoice_number}</td>
                          <td className="py-2 px-3">{entry.customer_name}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(entry.amount)}</td>
                          <td className="py-2 px-3 text-right text-purple-600">{formatCurrency(entry.gst)}</td>
                          <td className="py-2 px-3 text-right font-bold text-green-600">{formatCurrency(entry.total)}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className="text-xs">{entry.payment_method?.toUpperCase()}</Badge>
                          </td>
                          <td className="py-2 px-3 text-center">{getPaymentStatusBadge(entry.payment_status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedParty} onOpenChange={(open) => !open && closeTransactionDialog()}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedParty?.type === 'debtor' ? (
                <Users className="w-5 h-5 text-amber-600" />
              ) : (
                <Building2 className="w-5 h-5 text-purple-600" />
              )}
              {selectedParty?.type === 'debtor' 
                ? selectedParty?.customer_name 
                : selectedParty?.supplier_name}
              <Badge variant="outline" className="ml-2">
                Balance: {formatCurrency(selectedParty?.current_balance || 0)}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {transactionLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : partyTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No transactions found</p>
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="party-transactions-table">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Reference</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-right py-2 px-3 font-medium">Debit</th>
                    <th className="text-right py-2 px-3 font-medium">Credit</th>
                    <th className="text-right py-2 px-3 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {partyTransactions.map((txn, idx) => (
                    <tr key={txn.id || idx} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3">{txn.date}</td>
                      <td className="py-2 px-3">{txn.reference_number}</td>
                      <td className="py-2 px-3">{getEntryTypeBadge(txn.entry_type)}</td>
                      <td className="py-2 px-3 text-right text-green-600 font-medium">
                        {txn.debit > 0 ? formatCurrency(txn.debit) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-red-600 font-medium">
                        {txn.credit > 0 ? formatCurrency(txn.credit) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        {formatCurrency(txn.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Accounting Settings
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Opening Cash Balance</label>
              <Input
                type="number"
                value={settingsForm.opening_cash_balance}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, opening_cash_balance: parseFloat(e.target.value) || 0 }))}
                placeholder="Enter opening cash balance"
                data-testid="opening-cash-input"
              />
              <p className="text-xs text-muted-foreground mt-1">This is the starting cash balance for your books</p>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Opening Bank Balance</label>
              <Input
                type="number"
                value={settingsForm.opening_bank_balance}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, opening_bank_balance: parseFloat(e.target.value) || 0 }))}
                placeholder="Enter opening bank balance"
                data-testid="opening-bank-input"
              />
              <p className="text-xs text-muted-foreground mt-1">This is the starting bank balance for your books</p>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>Cancel</Button>
              <Button onClick={saveSettings} data-testid="save-settings-btn">Save Settings</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
