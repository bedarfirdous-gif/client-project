import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { Building2, TrendingUp, TrendingDown, Eye, ArrowLeft, Search, RotateCcw, IndianRupee, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';

export default function SupplierLedgerPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [ledgerList, setLedgerList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  // Avoid initializing to `null` to prevent conditional-render flashes (null -> data -> null)
  // when opening/closing the ledger view. Use stable empty objects instead.
  const [selectedSupplier, setSelectedSupplier] = useState({});
  const [ledgerDetail, setLedgerDetail] = useState({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const data = await api('/api/supplier-ledger');
      setLedgerList(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load supplier ledger');
    } finally {
      setLoading(false);
    }
  };

  const syncLedgerTransactions = async () => {
    setSyncing(true);
    try {
      const result = await api('/api/purchase-invoices/reprocess-accounting', {
        method: 'POST'
      });
      toast.success(`Synced ${result.processed} purchase invoice(s) to ledger`);
      // Refresh data after sync
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to sync ledger transactions');
    } finally {
      setSyncing(false);
    }
  };

  const viewLedger = async (supplier) => {
    setSelectedSupplier(supplier);
    setDetailLoading(true);
    try {
      const data = await api(`/api/supplier-ledger/${supplier.supplier_id}`);
      setLedgerDetail(data);
    } catch (err) {
      toast.error('Failed to load ledger details');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeLedger = () => {
    setSelectedSupplier(null);
    setLedgerDetail(null);
  };

  const filteredList = ledgerList.filter(s => 
    s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.includes(searchTerm) ||
    s.gst_number?.includes(searchTerm)
  );

  const totalPurchases = ledgerList.reduce((s, c) => s + c.total_purchases, 0);
  const totalPaid = ledgerList.reduce((s, c) => s + c.total_paid, 0);
  const totalReturns = ledgerList.reduce((s, c) => s + c.total_returns, 0);
  const totalBalance = ledgerList.reduce((s, c) => s + c.balance, 0);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="supplier-ledger-page">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200">
          <CardContent className="pt-6">
            <Building2 className="w-8 h-8 text-blue-600 mb-2" />
            <p className="text-sm text-muted-foreground">Total Suppliers</p>
            <p className="text-2xl font-bold">{ledgerList.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-200">
          <CardContent className="pt-6">
            <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
            <p className="text-sm text-muted-foreground">Total Purchases</p>
            <p className="text-2xl font-bold text-purple-600">{currencySymbol}{totalPurchases.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-200">
          <CardContent className="pt-6">
            <IndianRupee className="w-8 h-8 text-emerald-600 mb-2" />
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-600">{currencySymbol}{totalPaid.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-200">
          <CardContent className="pt-6">
            <RotateCcw className="w-8 h-8 text-orange-600 mb-2" />
            <p className="text-sm text-muted-foreground">Total Returns</p>
            <p className="text-2xl font-bold text-orange-600">{currencySymbol}{totalReturns.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-200">
          <CardContent className="pt-6">
            <TrendingDown className="w-8 h-8 text-red-600 mb-2" />
            <p className="text-sm text-muted-foreground">Outstanding Payable</p>
            <p className="text-2xl font-bold text-red-600">{currencySymbol}{totalBalance.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, phone or GST..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
          onClick={syncLedgerTransactions} 
          disabled={syncing}
          variant="outline"
          data-testid="sync-ledger-btn"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Ledger Transactions'}
        </Button>
      </div>

      {/* Supplier List */}
      <Card>
        <CardHeader><CardTitle>Supplier Ledger</CardTitle></CardHeader>
        <CardContent>
          {filteredList.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No suppliers found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left p-3">Supplier</th>
                  <th className="text-left p-3">GST Number</th>
                  <th className="text-right p-3">Transactions</th>
                  <th className="text-right p-3">Purchases</th>
                  <th className="text-right p-3">Paid</th>
                  <th className="text-right p-3">Returns</th>
                  <th className="text-right p-3">Balance</th>
                  <th className="text-right p-3">Actions</th>
                </tr></thead>
                <tbody>
                  {filteredList.map((s) => (
                    <tr key={s.supplier_id} className="border-b hover:bg-accent/30">
                      <td className="p-3">
                        <div className="font-medium">{s.supplier_name}</div>
                        <div className="text-xs text-muted-foreground">{s.phone || ''}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">{s.gst_number || '-'}</td>
                      <td className="p-3 text-right">{s.total_transactions}</td>
                      <td className="p-3 text-right">{currencySymbol}{s.total_purchases.toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-600">{currencySymbol}{s.total_paid.toLocaleString()}</td>
                      <td className="p-3 text-right text-orange-600">{currencySymbol}{s.total_returns.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <span className={s.balance > 0 ? 'text-red-600 font-bold' : 'text-emerald-600'}>
                          {currencySymbol}{s.balance.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => viewLedger(s)}>
                          <Eye className="w-4 h-4 mr-1" /> View Ledger
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-accent/50 font-bold">
                    <td className="p-3" colSpan={3}>Total</td>
                    <td className="p-3 text-right">{currencySymbol}{totalPurchases.toLocaleString()}</td>
                    <td className="p-3 text-right text-emerald-600">{currencySymbol}{totalPaid.toLocaleString()}</td>
                    <td className="p-3 text-right text-orange-600">{currencySymbol}{totalReturns.toLocaleString()}</td>
                    <td className="p-3 text-right text-red-600">{currencySymbol}{totalBalance.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ledger Detail Modal */}
      <Dialog open={!!selectedSupplier} onOpenChange={closeLedger}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={closeLedger}><ArrowLeft className="w-4 h-4" /></Button>
              Supplier Ledger - {selectedSupplier?.supplier_name}
            </DialogTitle>
          </DialogHeader>
          
          {detailLoading ? (
            <div className="py-8 text-center">Loading...</div>
          ) : ledgerDetail ? (
            <div className="space-y-4">
              {/* Supplier Info */}
              <div className="bg-accent/50 p-4 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {ledgerDetail.supplier?.name}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {ledgerDetail.supplier?.phone || '-'}</div>
                  <div><span className="text-muted-foreground">Email:</span> {ledgerDetail.supplier?.email || '-'}</div>
                  <div><span className="text-muted-foreground">GST:</span> {ledgerDetail.supplier?.gst_number || '-'}</div>
                </div>
                {ledgerDetail.supplier?.address && (
                  <div className="mt-2 text-sm"><span className="text-muted-foreground">Address:</span> {ledgerDetail.supplier.address}</div>
                )}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Total Credit (Purchases)</p>
                  <p className="text-xl font-bold text-purple-600">{currencySymbol}{ledgerDetail.summary?.total_credit?.toLocaleString()}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Total Debit (Paid + Returns)</p>
                  <p className="text-xl font-bold text-emerald-600">{currencySymbol}{ledgerDetail.summary?.total_debit?.toLocaleString()}</p>
                </CardContent></Card>
                <Card className="bg-red-50 dark:bg-red-950/30"><CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Closing Balance (Payable)</p>
                  <p className="text-xl font-bold text-red-600">{currencySymbol}{ledgerDetail.summary?.closing_balance?.toLocaleString()}</p>
                </CardContent></Card>
              </div>

              {/* Transactions Table */}
              <Card>
                <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
                <CardContent>
                  {ledgerDetail.transactions?.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">No transactions found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b bg-accent/50">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Reference</th>
                          <th className="text-left p-2">Description</th>
                          <th className="text-right p-2">Debit</th>
                          <th className="text-right p-2">Credit</th>
                          <th className="text-right p-2">Balance</th>
                        </tr></thead>
                        <tbody>
                          {ledgerDetail.transactions?.map((t, idx) => (
                            <tr key={idx} className="border-b hover:bg-accent/30">
                              <td className="p-2">{t.date}</td>
                              <td className="p-2">
                                <Badge variant={t.type === 'purchase' ? 'secondary' : t.type === 'return' ? 'outline' : 'default'}>
                                  {t.type === 'purchase' ? 'Purchase' : t.type === 'return' ? 'Return' : 'Payment'}
                                </Badge>
                              </td>
                              <td className="p-2 font-mono text-xs">{t.reference}</td>
                              <td className="p-2">{t.description}</td>
                              <td className="p-2 text-right text-emerald-600">{t.debit > 0 ? `${currencySymbol}${t.debit.toLocaleString()}` : '-'}</td>
                              <td className="p-2 text-right text-purple-600">{t.credit > 0 ? `${currencySymbol}${t.credit.toLocaleString()}` : '-'}</td>
                              <td className="p-2 text-right font-medium">{currencySymbol}{t.balance.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
