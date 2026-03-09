import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { Users, TrendingUp, TrendingDown, Eye, ArrowLeft, Phone, Search, IndianRupee } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { useCurrency } from '../contexts/CurrencyContext';
import { CurrencyIcon } from '../components/CurrencyIcon';

export default function CustomerLedgerPage() {
  const { api } = useAuth();
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [ledgerList, setLedgerList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fix: avoid null initial state to prevent UI flash in the Dialog while state settles.
  // Use stable initial values + an explicit "loaded" flag for conditional rendering.
  const [selectedCustomer, setSelectedCustomer] = useState({});
  const [ledgerDetail, setLedgerDetail] = useState([]);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const data = await api('/api/customer-ledger');
      setLedgerList(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customer ledger');
    } finally {
      setLoading(false);
    }
  };

  const viewLedger = async (customer) => {
    setSelectedCustomer(customer);
    setDetailLoading(true);
    try {
      const data = await api(`/api/customer-ledger/${customer.customer_id}`);
      setLedgerDetail(data);
    } catch (err) {
      toast.error('Failed to load ledger details');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeLedger = () => {
    setSelectedCustomer(null);
    setLedgerDetail(null);
  };

  const filteredList = ledgerList.filter(c => 
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  const totalSales = ledgerList.reduce((s, c) => s + c.total_sales, 0);
  const totalReceived = ledgerList.reduce((s, c) => s + c.total_paid, 0);
  const totalBalance = ledgerList.reduce((s, c) => s + c.balance, 0);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="customer-ledger-page">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200">
          <CardContent className="pt-6">
            <Users className="w-8 h-8 text-blue-600 mb-2" />
            <p className="text-sm text-muted-foreground">Total Customers</p>
            <p className="text-2xl font-bold">{ledgerList.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-200">
          <CardContent className="pt-6">
            <TrendingUp className="w-8 h-8 text-emerald-600 mb-2" />
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalSales)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-200">
          <CardContent className="pt-6">
            <IndianRupee className="w-8 h-8 text-purple-600 mb-2" />
            <p className="text-sm text-muted-foreground">Total Received</p>
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalReceived)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-200">
          <CardContent className="pt-6">
            <TrendingDown className="w-8 h-8 text-amber-600 mb-2" />
            <p className="text-sm text-muted-foreground">Outstanding Balance</p>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalBalance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or phone..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Customer List */}
      <Card>
        <CardHeader><CardTitle>Customer Ledger</CardTitle></CardHeader>
        <CardContent>
          {filteredList.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No customers found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Phone</th>
                  <th className="text-right p-3">Transactions</th>
                  <th className="text-right p-3">Total Sales</th>
                  <th className="text-right p-3">Received</th>
                  <th className="text-right p-3">Balance</th>
                  <th className="text-right p-3">Actions</th>
                </tr></thead>
                <tbody>
                  {filteredList.map((c) => (
                    <tr key={c.customer_id} className="border-b hover:bg-accent/30">
                      <td className="p-3 font-medium">{c.customer_name}</td>
                      <td className="p-3 text-muted-foreground">{c.phone || '-'}</td>
                      <td className="p-3 text-right">{c.total_transactions}</td>
                      <td className="p-3 text-right">{formatCurrency(c.total_sales)}</td>
                      <td className="p-3 text-right text-emerald-600">{formatCurrency(c.total_paid)}</td>
                      <td className="p-3 text-right">
                        <span className={c.balance > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600'}>
                          {formatCurrency(c.balance)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => viewLedger(c)}>
                          <Eye className="w-4 h-4 mr-1" /> View Ledger
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-accent/50 font-bold">
                    <td className="p-3" colSpan={3}>Total</td>
                    <td className="p-3 text-right">{formatCurrency(totalSales)}</td>
                    <td className="p-3 text-right text-emerald-600">{formatCurrency(totalReceived)}</td>
                    <td className="p-3 text-right text-amber-600">{formatCurrency(totalBalance)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ledger Detail Modal */}
      <Dialog open={!!selectedCustomer} onOpenChange={closeLedger}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={closeLedger}><ArrowLeft className="w-4 h-4" /></Button>
              Customer Ledger - {selectedCustomer?.customer_name}
            </DialogTitle>
          </DialogHeader>
          
          {detailLoading ? (
            <div className="py-8 text-center">Loading...</div>
          ) : ledgerDetail ? (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="bg-accent/50 p-4 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {ledgerDetail.customer?.name}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {ledgerDetail.customer?.phone || '-'}</div>
                  <div><span className="text-muted-foreground">Email:</span> {ledgerDetail.customer?.email || '-'}</div>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Total Debit (Sales)</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(ledgerDetail.summary?.total_debit || 0)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Total Credit (Received)</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(ledgerDetail.summary?.total_credit || 0)}</p>
                </CardContent></Card>
                <Card className="bg-amber-50 dark:bg-amber-950/30"><CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Closing Balance</p>
                  <p className="text-xl font-bold text-amber-600">{formatCurrency(ledgerDetail.summary?.closing_balance || 0)}</p>
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
                                <Badge variant={t.type === 'sale' ? 'secondary' : 'default'}>
                                  {t.type === 'sale' ? 'Sale' : 'Payment'}
                                </Badge>
                              </td>
                              <td className="p-2 font-mono text-xs">{t.reference}</td>
                              <td className="p-2">{t.description}</td>
                              <td className="p-2 text-right text-red-600">{t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
                              <td className="p-2 text-right text-emerald-600">{t.credit > 0 ? formatCurrency(t.credit) : '-'}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(t.balance)}</td>
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
