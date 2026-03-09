import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  BookOpen, Calendar, Search, Download, RefreshCw, Filter,
  TrendingUp, TrendingDown, ArrowRight, Wallet, Building2,
  FileText, ChevronRight, Eye, Printer, FileSpreadsheet
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useCurrency } from '../contexts/CurrencyContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

export default function AccountingBooksPage() {
  const { api } = useAuth();
  const { formatCurrency } = useCurrency();
  
  // State
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('day-book');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLedger, setSelectedLedger] = useState('');
  
  // Data
  const [dayBook, setDayBook] = useState(null);
  const [cashBook, setCashBook] = useState(null);
  const [bankBook, setBankBook] = useState(null);
  const [trialBalance, setTrialBalance] = useState(null);
  const [ledgerReport, setLedgerReport] = useState(null);
  const [ledgers, setLedgers] = useState([]);
  const [bankLedgers, setBankLedgers] = useState([]);
  
  // Dialog
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);

  // Fetch ledgers for selection
  const fetchLedgers = useCallback(async () => {
    try {
      const res = await api('/api/ledger-management/ledgers?active_only=true&limit=1000');
      setLedgers(res.ledgers || []);
      setBankLedgers((res.ledgers || []).filter(l => 
        l.group_id === 'bank_accounts' || l.bank_name || l.account_number
      ));
    } catch (err) {
      console.error('Failed to fetch ledgers:', err);
    }
  }, [api]);

  useEffect(() => {
    fetchLedgers();
  }, [fetchLedgers]);

  // Fetch Day Book
  const fetchDayBook = async () => {
    setLoading(true);
    try {
      const res = await api(`/api/books/day-book?start_date=${startDate}&end_date=${endDate}`);
      setDayBook(res);
    } catch (err) {
      toast.error('Failed to fetch Day Book');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Cash Book
  const fetchCashBook = async () => {
    setLoading(true);
    try {
      const res = await api(`/api/books/cash-book?start_date=${startDate}&end_date=${endDate}`);
      setCashBook(res);
    } catch (err) {
      toast.error('Failed to fetch Cash Book');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Bank Book
  const fetchBankBook = async () => {
    setLoading(true);
    try {
      let url = `/api/books/bank-book?start_date=${startDate}&end_date=${endDate}`;
      if (selectedLedger) url += `&bank_ledger_id=${selectedLedger}`;
      const res = await api(url);
      setBankBook(res);
    } catch (err) {
      toast.error('Failed to fetch Bank Book');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Trial Balance
  const fetchTrialBalance = async () => {
    setLoading(true);
    try {
      const res = await api(`/api/books/trial-balance?as_on_date=${endDate}`);
      setTrialBalance(res);
    } catch (err) {
      toast.error('Failed to fetch Trial Balance');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Ledger Report
  const fetchLedgerReport = async (ledgerId) => {
    setLoading(true);
    try {
      const res = await api(`/api/books/ledger-wise?ledger_id=${ledgerId}&start_date=${startDate}&end_date=${endDate}`);
      setLedgerReport(res);
      setShowLedgerDialog(true);
    } catch (err) {
      toast.error('Failed to fetch Ledger Report');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'day-book') fetchDayBook();
    else if (activeTab === 'cash-book') fetchCashBook();
    else if (activeTab === 'bank-book') fetchBankBook();
    else if (activeTab === 'trial-balance') fetchTrialBalance();
  }, [activeTab]);

  // Handle date change and refetch
  const handleRefresh = () => {
    if (activeTab === 'day-book') fetchDayBook();
    else if (activeTab === 'cash-book') fetchCashBook();
    else if (activeTab === 'bank-book') fetchBankBook();
    else if (activeTab === 'trial-balance') fetchTrialBalance();
  };

  // Export to CSV
  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported successfully');
  };

  return (
    <div className="p-6 space-y-6" data-testid="accounting-books-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-blue-600" />
            Accounting Books
          </h1>
          <p className="text-gray-500 mt-1">Day Book, Cash Book, Bank Book & Trial Balance</p>
        </div>
      </div>

      {/* Date Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            {activeTab === 'bank-book' && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Bank Account</label>
                <Select value={selectedLedger} onValueChange={setSelectedLedger}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Banks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Banks</SelectItem>
                    {bankLedgers.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => {
              if (activeTab === 'day-book' && dayBook?.vouchers) 
                exportToCSV(dayBook.vouchers, 'day_book');
              else if (activeTab === 'cash-book' && cashBook?.transactions)
                exportToCSV(cashBook.transactions, 'cash_book');
              else if (activeTab === 'bank-book' && bankBook?.transactions)
                exportToCSV(bankBook.transactions, 'bank_book');
              else if (activeTab === 'trial-balance' && trialBalance?.trial_balance)
                exportToCSV(trialBalance.trial_balance, 'trial_balance');
            }}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="day-book" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Day Book
          </TabsTrigger>
          <TabsTrigger value="cash-book" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Cash Book
          </TabsTrigger>
          <TabsTrigger value="bank-book" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Bank Book
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Trial Balance
          </TabsTrigger>
        </TabsList>

        {/* Day Book Tab */}
        <TabsContent value="day-book" className="mt-4">
          {dayBook && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-gray-500 uppercase">Total Vouchers</p>
                    <p className="text-2xl font-bold">{dayBook.summary?.total_vouchers || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-gray-500 uppercase">Total Debit</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(dayBook.summary?.total_debit || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-gray-500 uppercase">Total Credit</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(dayBook.summary?.total_credit || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Vouchers Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Voucher Entries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Voucher No.</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Type</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Particulars</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold">Debit</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayBook.vouchers?.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-500">
                              No vouchers found for selected date range
                            </td>
                          </tr>
                        ) : (
                          dayBook.vouchers?.map(v => (
                            <tr key={v.id} className="border-t hover:bg-gray-50">
                              <td className="py-3 px-4 text-sm">{v.date}</td>
                              <td className="py-3 px-4 font-mono text-sm">{v.voucher_number}</td>
                              <td className="py-3 px-4">
                                <Badge variant="outline">{v.voucher_type_name}</Badge>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600">{v.narration || '-'}</td>
                              <td className="py-3 px-4 text-right font-mono text-green-600">
                                {formatCurrency(v.total_debit || 0)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-red-600">
                                {formatCurrency(v.total_credit || 0)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {dayBook.vouchers?.length > 0 && (
                        <tfoot className="bg-gray-100 font-bold">
                          <tr>
                            <td colSpan={4} className="py-3 px-4 text-right">Total:</td>
                            <td className="py-3 px-4 text-right font-mono text-green-600">
                              {formatCurrency(dayBook.summary?.total_debit || 0)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-red-600">
                              {formatCurrency(dayBook.summary?.total_credit || 0)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Cash Book Tab */}
        <TabsContent value="cash-book" className="mt-4">
          {cashBook && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-blue-600 uppercase">Opening Balance</p>
                    <p className="text-2xl font-bold text-blue-700">{formatCurrency(cashBook.summary?.opening_balance || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-green-600 uppercase">Total Receipts</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(cashBook.summary?.total_receipts || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-red-600 uppercase">Total Payments</p>
                    <p className="text-2xl font-bold text-red-700">{formatCurrency(cashBook.summary?.total_payments || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-purple-600 uppercase">Closing Balance</p>
                    <p className="text-2xl font-bold text-purple-700">{formatCurrency(cashBook.summary?.closing_balance || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Transactions Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cash Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Voucher</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Particulars</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold">Receipt (Dr)</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold">Payment (Cr)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Opening Balance Row */}
                        <tr className="bg-blue-50">
                          <td className="py-3 px-4 text-sm">{startDate}</td>
                          <td className="py-3 px-4 text-sm">-</td>
                          <td className="py-3 px-4 text-sm font-medium">Opening Balance</td>
                          <td className="py-3 px-4 text-right font-mono">
                            {cashBook.summary?.opening_balance >= 0 ? formatCurrency(cashBook.summary?.opening_balance) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {cashBook.summary?.opening_balance < 0 ? formatCurrency(-cashBook.summary?.opening_balance) : '-'}
                          </td>
                        </tr>
                        {cashBook.transactions?.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-500">
                              No cash transactions found
                            </td>
                          </tr>
                        ) : (
                          cashBook.transactions?.map((t, idx) => (
                            <tr key={idx} className="border-t hover:bg-gray-50">
                              <td className="py-3 px-4 text-sm">{t.date}</td>
                              <td className="py-3 px-4 font-mono text-sm">{t.voucher_number || '-'}</td>
                              <td className="py-3 px-4 text-sm">{t.particulars || t.narration || '-'}</td>
                              <td className="py-3 px-4 text-right font-mono text-green-600">
                                {t.debit > 0 ? formatCurrency(t.debit) : '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-red-600">
                                {t.credit > 0 ? formatCurrency(t.credit) : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                        {/* Closing Balance Row */}
                        <tr className="bg-purple-50 font-bold">
                          <td className="py-3 px-4 text-sm">{endDate}</td>
                          <td className="py-3 px-4 text-sm">-</td>
                          <td className="py-3 px-4 text-sm">Closing Balance</td>
                          <td className="py-3 px-4 text-right font-mono">
                            {cashBook.summary?.closing_balance >= 0 ? formatCurrency(cashBook.summary?.closing_balance) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {cashBook.summary?.closing_balance < 0 ? formatCurrency(-cashBook.summary?.closing_balance) : '-'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Bank Book Tab */}
        <TabsContent value="bank-book" className="mt-4">
          {bankBook && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-blue-600 uppercase">Opening Balance</p>
                    <p className="text-2xl font-bold text-blue-700">{formatCurrency(bankBook.summary?.opening_balance || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-green-600 uppercase">Total Deposits</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(bankBook.summary?.total_deposits || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-red-600 uppercase">Total Withdrawals</p>
                    <p className="text-2xl font-bold text-red-700">{formatCurrency(bankBook.summary?.total_withdrawals || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-purple-600 uppercase">Closing Balance</p>
                    <p className="text-2xl font-bold text-purple-700">{formatCurrency(bankBook.summary?.closing_balance || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Bank Accounts */}
              {bankBook.bank_ledgers?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {bankBook.bank_ledgers.map(b => (
                    <Badge key={b.id} variant="outline" className="py-1 px-3">
                      <Building2 className="w-3 h-3 mr-1" />
                      {b.name}
                      {b.account_number && <span className="ml-1 text-gray-400">({b.account_number.slice(-4)})</span>}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Transactions Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Bank Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Voucher</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Particulars</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold">Deposit (Dr)</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold">Withdrawal (Cr)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-blue-50">
                          <td className="py-3 px-4 text-sm">{startDate}</td>
                          <td className="py-3 px-4">-</td>
                          <td className="py-3 px-4 font-medium">Opening Balance</td>
                          <td className="py-3 px-4 text-right font-mono">
                            {bankBook.summary?.opening_balance >= 0 ? formatCurrency(bankBook.summary?.opening_balance) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">-</td>
                        </tr>
                        {bankBook.transactions?.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-500">
                              No bank transactions found
                            </td>
                          </tr>
                        ) : (
                          bankBook.transactions?.map((t, idx) => (
                            <tr key={idx} className="border-t hover:bg-gray-50">
                              <td className="py-3 px-4 text-sm">{t.date}</td>
                              <td className="py-3 px-4 font-mono text-sm">{t.voucher_number || '-'}</td>
                              <td className="py-3 px-4 text-sm">{t.particulars || t.narration || '-'}</td>
                              <td className="py-3 px-4 text-right font-mono text-green-600">
                                {t.debit > 0 ? formatCurrency(t.debit) : '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-red-600">
                                {t.credit > 0 ? formatCurrency(t.credit) : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                        <tr className="bg-purple-50 font-bold">
                          <td className="py-3 px-4">{endDate}</td>
                          <td className="py-3 px-4">-</td>
                          <td className="py-3 px-4">Closing Balance</td>
                          <td className="py-3 px-4 text-right font-mono">
                            {bankBook.summary?.closing_balance >= 0 ? formatCurrency(bankBook.summary?.closing_balance) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Trial Balance Tab */}
        <TabsContent value="trial-balance" className="mt-4">
          {trialBalance && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-gray-500 uppercase">Ledger Count</p>
                    <p className="text-2xl font-bold">{trialBalance.summary?.ledger_count || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-green-600 uppercase">Total Debit</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(trialBalance.summary?.total_debit || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-red-600 uppercase">Total Credit</p>
                    <p className="text-2xl font-bold text-red-700">{formatCurrency(trialBalance.summary?.total_credit || 0)}</p>
                  </CardContent>
                </Card>
                <Card className={trialBalance.summary?.is_balanced ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs uppercase">Status</p>
                    <p className={`text-lg font-bold ${trialBalance.summary?.is_balanced ? 'text-green-700' : 'text-red-700'}`}>
                      {trialBalance.summary?.is_balanced ? '✓ Balanced' : `Diff: ${formatCurrency(trialBalance.summary?.difference || 0)}`}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Trial Balance Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Trial Balance as on {endDate}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Ledger Name</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold">Type</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold">Debit (Dr)</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold">Credit (Cr)</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalance.trial_balance?.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-500">
                              No ledger balances found
                            </td>
                          </tr>
                        ) : (
                          trialBalance.trial_balance?.map((l, idx) => (
                            <tr key={idx} className="border-t hover:bg-gray-50">
                              <td className="py-3 px-4 font-medium">{l.ledger_name}</td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className="text-xs capitalize">{l.ledger_type}</Badge>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-green-600">
                                {l.debit > 0 ? formatCurrency(l.debit) : '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-red-600">
                                {l.credit > 0 ? formatCurrency(l.credit) : '-'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => fetchLedgerReport(l.ledger_id)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {trialBalance.trial_balance?.length > 0 && (
                        <tfoot className="bg-gray-100 font-bold">
                          <tr>
                            <td colSpan={2} className="py-3 px-4 text-right">Total:</td>
                            <td className="py-3 px-4 text-right font-mono text-green-600">
                              {formatCurrency(trialBalance.summary?.total_debit || 0)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-red-600">
                              {formatCurrency(trialBalance.summary?.total_credit || 0)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Ledger Detail Dialog */}
      <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Ledger Account: {ledgerReport?.ledger?.name}
            </DialogTitle>
          </DialogHeader>
          
          {ledgerReport && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Opening Balance</p>
                  <p className={`text-lg font-bold ${ledgerReport.summary?.opening_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(ledgerReport.summary?.opening_balance || 0))} {ledgerReport.summary?.opening_balance_type}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total Debit</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(ledgerReport.summary?.total_debit || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total Credit</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(ledgerReport.summary?.total_credit || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Closing Balance</p>
                  <p className={`text-lg font-bold ${ledgerReport.summary?.closing_balance_type === 'Dr' ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(ledgerReport.summary?.closing_balance || 0)} {ledgerReport.summary?.closing_balance_type}
                  </p>
                </div>
              </div>

              {/* Transactions */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-3 text-sm">Date</th>
                      <th className="text-left py-2 px-3 text-sm">Voucher</th>
                      <th className="text-left py-2 px-3 text-sm">Particulars</th>
                      <th className="text-right py-2 px-3 text-sm">Debit</th>
                      <th className="text-right py-2 px-3 text-sm">Credit</th>
                      <th className="text-right py-2 px-3 text-sm">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-blue-50">
                      <td className="py-2 px-3">{ledgerReport.summary?.start_date}</td>
                      <td colSpan={2} className="py-2 px-3 font-medium">Opening Balance</td>
                      <td className="py-2 px-3 text-right">
                        {ledgerReport.summary?.opening_balance > 0 ? formatCurrency(ledgerReport.summary?.opening_balance) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {ledgerReport.summary?.opening_balance < 0 ? formatCurrency(-ledgerReport.summary?.opening_balance) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCurrency(Math.abs(ledgerReport.summary?.opening_balance || 0))} {ledgerReport.summary?.opening_balance_type}
                      </td>
                    </tr>
                    {ledgerReport.transactions?.map((t, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm">{t.date}</td>
                        <td className="py-2 px-3 font-mono text-sm">{t.voucher_number}</td>
                        <td className="py-2 px-3 text-sm">{t.particulars || '-'}</td>
                        <td className="py-2 px-3 text-right font-mono text-green-600">
                          {t.debit > 0 ? formatCurrency(t.debit) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-red-600">
                          {t.credit > 0 ? formatCurrency(t.credit) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatCurrency(Math.abs(t.running_balance || 0))} {t.running_balance >= 0 ? 'Dr' : 'Cr'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-purple-50 font-bold">
                      <td className="py-2 px-3">{ledgerReport.summary?.end_date}</td>
                      <td colSpan={2} className="py-2 px-3">Closing Balance</td>
                      <td className="py-2 px-3 text-right text-green-600">
                        {formatCurrency(ledgerReport.summary?.total_debit || 0)}
                      </td>
                      <td className="py-2 px-3 text-right text-red-600">
                        {formatCurrency(ledgerReport.summary?.total_credit || 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCurrency(ledgerReport.summary?.closing_balance || 0)} {ledgerReport.summary?.closing_balance_type}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
