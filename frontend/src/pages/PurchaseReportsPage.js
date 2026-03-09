import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, TrendingUp, TrendingDown, IndianRupee, Calendar, Building2, Users, BarChart3, Download } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PurchaseReportsPage() {
  const { api } = useAuth();
  const { formatCurrency, getCurrencyInfo, currencySymbol } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [timeout, setTimeout] = useState(false);
  // Avoid null initial state which can cause a mount/unmount visual flash
  // when the summary section conditionally renders after data arrives.
  const [summary, setSummary] = useState({});
  const [bySupplier, setBySupplier] = useState([]);
  const [byStore, setByStore] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      let dateParams = '';
      if (startDate && endDate) {
        dateParams = `?start_date=${startDate}&end_date=${endDate}`;
      }
      
      const [d1, d2, d3, d4] = await Promise.all([
        api(`/api/purchase-reports/summary${dateParams}`),
        api(`/api/purchase-reports/by-supplier${dateParams}`),
        api(`/api/purchase-reports/by-store${dateParams}`),
        api(`/api/purchase-reports/monthly?year=${selectedYear}`)
      ]);
      setSummary(d1);
      setBySupplier(d2);
      setByStore(d3);
      setMonthly(d4);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const applyDateFilter = () => {
    setLoading(true);
    fetchData();
  };

  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
    setLoading(true);
    fetchData();
  };

  const maxMonthlyAmount = Math.max(...monthly.map(m => m.total_amount), 1);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="purchase-reports-page">
      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
            </div>
            <Button onClick={applyDateFilter}>Apply Filter</Button>
            <Button variant="outline" onClick={clearFilter}>Clear</Button>
            <Button 
              variant="outline"
              onClick={() => {
                try {
                  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
                  const pageWidth = doc.internal.pageSize.getWidth();
                  const primaryColor = [200, 30, 30];
                  
                  let y = 15;
                  
                  // Header
                  doc.setTextColor(...primaryColor);
                  doc.setFontSize(22);
                  doc.setFont('helvetica', 'bold');
                  doc.text('Purchase Report', 15, y);
                  
                  doc.setFontSize(10);
                  doc.setTextColor(100, 100, 100);
                  doc.setFont('helvetica', 'normal');
                  if (startDate && endDate) {
                    doc.text(`Period: ${startDate} to ${endDate}`, pageWidth - 15, y, { align: 'right' });
                  }
                  y += 6;
                  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 15, y, { align: 'right' });
                  y += 15;
                  
                  // Summary
                  doc.setTextColor(...primaryColor);
                  doc.setFontSize(12);
                  doc.setFont('helvetica', 'bold');
                  doc.text('Summary', 15, y);
                  y += 8;
                  
                  doc.setTextColor(60, 60, 60);
                  doc.setFontSize(10);
                  doc.setFont('helvetica', 'normal');
                  doc.text(`Total Purchases: ${currencySymbol}${(summary.total_purchases || 0).toLocaleString()}`, 15, y);
                  doc.text(`Total Invoices: ${summary.total_invoices || 0}`, 100, y);
                  y += 6;
                  doc.text(`Paid Amount: ${currencySymbol}${(summary.paid_amount || 0).toLocaleString()}`, 15, y);
                  doc.text(`Pending: ${currencySymbol}${(summary.pending_amount || 0).toLocaleString()}`, 100, y);
                  y += 12;
                  
                  // Supplier Table
                  if (bySupplier.length > 0) {
                    doc.setTextColor(...primaryColor);
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('By Supplier', 15, y);
                    y += 5;
                    
                    const supplierData = bySupplier.map((s, idx) => [
                      idx + 1,
                      s.supplier_name || 'Unknown',
                      s.invoice_count || 0,
                      `${currencySymbol}${(s.total_amount || 0).toLocaleString()}`,
                      `${currencySymbol}${(s.pending_amount || 0).toLocaleString()}`
                    ]);
                    
                    autoTable(doc, {
                      startY: y,
                      head: [['#', 'Supplier', 'Invoices', 'Total', 'Pending']],
                      body: supplierData,
                      theme: 'striped',
                      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
                      bodyStyles: { fontSize: 8 },
                      margin: { left: 15, right: 15 }
                    });
                    y = doc.lastAutoTable.finalY + 10;
                  }
                  
                  doc.save(`Purchase_Report_${new Date().toISOString().split('T')[0]}.pdf`);
                  toast.success('PDF report downloaded');
                } catch (err) {
                  console.error('PDF error:', err);
                  toast.error('Failed to generate PDF');
                }
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  const params = new URLSearchParams();
                  if (startDate) params.append('start_date', startDate);
                  if (endDate) params.append('end_date', endDate);
                  
                  const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/purchase-reports/export/excel?${params}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                  });
                  
                  if (!response.ok) throw new Error('Export failed');
                  
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `purchase_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                  toast.success('Excel report downloaded');
                } catch (err) {
                  toast.error('Failed to export Excel');
                }
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200">
            <CardContent className="pt-6">
              <IndianRupee className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-sm text-muted-foreground">Total Purchases</p>
              <p className="text-2xl font-bold text-blue-600">{currencySymbol}{summary.total_purchases?.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.total_invoices} invoices</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-200">
            <CardContent className="pt-6">
              <TrendingUp className="w-8 h-8 text-emerald-600 mb-2" />
              <p className="text-sm text-muted-foreground">Paid Amount</p>
              <p className="text-2xl font-bold text-emerald-600">{currencySymbol}{summary.paid_amount?.toLocaleString()}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-200">
            <CardContent className="pt-6">
              <Calendar className="w-8 h-8 text-amber-600 mb-2" />
              <p className="text-sm text-muted-foreground">Pending Amount</p>
              <p className="text-2xl font-bold text-amber-600">{currencySymbol}{summary.pending_amount?.toLocaleString()}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-200">
            <CardContent className="pt-6">
              <TrendingDown className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-sm text-muted-foreground">Total Returns</p>
              <p className="text-2xl font-bold text-orange-600">{currencySymbol}{summary.total_return_amount?.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.total_returns} returns</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-200">
            <CardContent className="pt-6">
              <FileText className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-sm text-muted-foreground">Net Purchases</p>
              <p className="text-2xl font-bold text-purple-600">{currencySymbol}{summary.net_purchases?.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Additional Stats Row */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Tax (GST)</p>
              <p className="text-xl font-bold">{currencySymbol}{summary.total_tax?.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Discounts</p>
              <p className="text-xl font-bold text-red-600">{currencySymbol}{summary.total_discount?.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Freight</p>
              <p className="text-xl font-bold">{currencySymbol}{summary.total_freight?.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="monthly" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monthly"><BarChart3 className="w-4 h-4 mr-2" />Monthly Trend</TabsTrigger>
          <TabsTrigger value="supplier"><Users className="w-4 h-4 mr-2" />By Supplier</TabsTrigger>
          <TabsTrigger value="store"><Building2 className="w-4 h-4 mr-2" />By Store</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Monthly Purchase Trend - {selectedYear}</CardTitle>
                <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setLoading(true); setTimeout(fetchData, 100); }}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Simple Bar Chart */}
                <div className="flex items-end gap-2 h-64 px-4">
                  {monthly.map((m, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600"
                        style={{ height: `${(m.total_amount / maxMonthlyAmount) * 100}%`, minHeight: m.total_amount > 0 ? '4px' : '0' }}
                        title={`${currencySymbol}${m.total_amount.toLocaleString()}`}
                      />
                      <span className="text-xs mt-2 text-muted-foreground">{MONTHS[idx]}</span>
                    </div>
                  ))}
                </div>
                
                {/* Data Table */}
                <div className="overflow-x-auto mt-6">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">
                      <th className="text-left p-2">Month</th>
                      <th className="text-right p-2">Invoices</th>
                      <th className="text-right p-2">Amount</th>
                    </tr></thead>
                    <tbody>
                      {monthly.map((m, idx) => (
                        <tr key={idx} className="border-b hover:bg-accent/30">
                          <td className="p-2">{MONTHS[idx]} {selectedYear}</td>
                          <td className="p-2 text-right">{m.invoice_count}</td>
                          <td className="p-2 text-right font-bold">{currencySymbol}{m.total_amount.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-accent/50 font-bold">
                        <td className="p-2">Total</td>
                        <td className="p-2 text-right">{monthly.reduce((s, m) => s + m.invoice_count, 0)}</td>
                        <td className="p-2 text-right">{currencySymbol}{monthly.reduce((s, m) => s + m.total_amount, 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplier">
          <Card>
            <CardHeader><CardTitle>Purchases by Supplier</CardTitle></CardHeader>
            <CardContent>
              {bySupplier.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-right p-3">Invoices</th>
                      <th className="text-right p-3">Total Amount</th>
                      <th className="text-right p-3">Paid</th>
                      <th className="text-right p-3">Pending</th>
                    </tr></thead>
                    <tbody>
                      {bySupplier.map((s, idx) => (
                        <tr key={idx} className="border-b hover:bg-accent/30">
                          <td className="p-3 font-medium">{s.supplier_name}</td>
                          <td className="p-3 text-right">{s.invoice_count}</td>
                          <td className="p-3 text-right font-bold">{currencySymbol}{s.total_amount?.toLocaleString()}</td>
                          <td className="p-3 text-right text-emerald-600">{currencySymbol}{s.paid_amount?.toLocaleString()}</td>
                          <td className="p-3 text-right text-amber-600">{currencySymbol}{s.pending_amount?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-accent/50 font-bold">
                        <td className="p-3">Total</td>
                        <td className="p-3 text-right">{bySupplier.reduce((s, x) => s + x.invoice_count, 0)}</td>
                        <td className="p-3 text-right">{currencySymbol}{bySupplier.reduce((s, x) => s + x.total_amount, 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-emerald-600">{currencySymbol}{bySupplier.reduce((s, x) => s + x.paid_amount, 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-amber-600">{currencySymbol}{bySupplier.reduce((s, x) => s + x.pending_amount, 0).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="store">
          <Card>
            <CardHeader><CardTitle>Purchases by Store</CardTitle></CardHeader>
            <CardContent>
              {byStore.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">
                      <th className="text-left p-3">Store</th>
                      <th className="text-right p-3">Invoices</th>
                      <th className="text-right p-3">Total Amount</th>
                    </tr></thead>
                    <tbody>
                      {byStore.map((s, idx) => (
                        <tr key={idx} className="border-b hover:bg-accent/30">
                          <td className="p-3 font-medium">{s.store_name}</td>
                          <td className="p-3 text-right">{s.invoice_count}</td>
                          <td className="p-3 text-right font-bold">{currencySymbol}{s.total_amount?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-accent/50 font-bold">
                        <td className="p-3">Total</td>
                        <td className="p-3 text-right">{byStore.reduce((s, x) => s + x.invoice_count, 0)}</td>
                        <td className="p-3 text-right">{currencySymbol}{byStore.reduce((s, x) => s + x.total_amount, 0).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
