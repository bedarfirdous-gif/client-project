import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart3, TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Users, Package,
  Calendar, Download, Filter, RefreshCw, PieChart, Activity, Target,
  ArrowUp, ArrowDown, Percent, Clock, CreditCard, Banknote, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';

import { useCurrency } from '../contexts/CurrencyContext';
export default function SalesReportsPage() {
  const { formatWithConversion } = useCurrency();
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('this_month');
  const [salesData, setSalesData] = useState([]);
  const [customersData, setCustomersData] = useState([]);
  const [itemsData, setItemsData] = useState([]);

  // Computed analytics
  const [analytics, setAnalytics] = useState({
    revenue: { total: 0, growth: 0, average: 0 },
    orders: { total: 0, growth: 0, average: 0 },
    customers: { total: 0, new: 0, returning: 0 },
    products: { total: 0, topSelling: [], lowPerforming: [] },
    payments: { cash: 0, card: 0, upi: 0, bank: 0, other: 0 },
    daily: [],
    hourly: [],
    categories: [],
  });

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sales, customers, items] = await Promise.all([
        api('/api/sales').catch(() => []),
        api('/api/customers').catch(() => []),
        api('/api/items').catch(() => []),
      ]);

      setSalesData(sales);
      setCustomersData(customers);
      setItemsData(items);
      calculateAnalytics(sales, customers, items);
    } catch (err) {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate, endDate = now;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    return { startDate, endDate };
  };

  const calculateAnalytics = (sales, customers, items) => {
    const { startDate, endDate } = getDateRange();
    
    // Filter sales by period
    const periodSales = sales.filter(s => {
      const saleDate = new Date(s.sale_date || s.created_at);
      return saleDate >= startDate && saleDate <= endDate;
    });

    // Previous period for comparison
    const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);
    const prevSales = sales.filter(s => {
      const saleDate = new Date(s.sale_date || s.created_at);
      return saleDate >= prevStartDate && saleDate < startDate;
    });

    // Revenue analytics
    const totalRevenue = periodSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const prevRevenue = prevSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;

    // Orders analytics
    const totalOrders = periodSales.length;
    const prevOrders = prevSales.length;
    const ordersGrowth = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders * 100) : 0;

    // Customer analytics
    const periodCustomerIds = new Set(periodSales.map(s => s.customer_id).filter(Boolean));
    const prevCustomerIds = new Set(prevSales.map(s => s.customer_id).filter(Boolean));
    const newCustomers = [...periodCustomerIds].filter(id => !prevCustomerIds.has(id)).length;

    // Product analytics
    const productSales = {};
    periodSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = item.item_id || item.variant_id;
        if (!productSales[key]) productSales[key] = { id: key, quantity: 0, revenue: 0 };
        productSales[key].quantity += item.quantity || 0;
        productSales[key].revenue += (item.quantity || 0) * (item.rate || item.price || 0);
      });
    });
    
    const sortedProducts = Object.values(productSales)
      .map(p => ({ ...p, name: items.find(i => i.id === p.id)?.name || 'Unknown' }))
      .sort((a, b) => b.revenue - a.revenue);

    // Payment method analytics
    const payments = { cash: 0, card: 0, upi: 0, bank: 0, other: 0 };
    periodSales.forEach(sale => {
      const method = (sale.payment_method || 'cash').toLowerCase();
      if (method.includes('cash')) payments.cash += sale.total_amount || 0;
      else if (method.includes('card')) payments.card += sale.total_amount || 0;
      else if (method.includes('upi')) payments.upi += sale.total_amount || 0;
      else if (method.includes('bank')) payments.bank += sale.total_amount || 0;
      else payments.other += sale.total_amount || 0;
    });

    // Daily breakdown
    const dailyData = {};
    periodSales.forEach(sale => {
      const date = (sale.sale_date || sale.created_at || '').split('T')[0];
      if (!dailyData[date]) dailyData[date] = { date, orders: 0, revenue: 0 };
      dailyData[date].orders += 1;
      dailyData[date].revenue += sale.total_amount || 0;
    });

    // Hourly breakdown
    const hourlyData = Array(24).fill(0).map((_, i) => ({ hour: i, orders: 0, revenue: 0 }));
    periodSales.forEach(sale => {
      const date = new Date(sale.sale_date || sale.created_at);
      const hour = date.getHours();
      hourlyData[hour].orders += 1;
      hourlyData[hour].revenue += sale.total_amount || 0;
    });

    // Category breakdown
    const categoryData = {};
    periodSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const itemInfo = items.find(i => i.id === item.item_id);
        const category = itemInfo?.category || 'Uncategorized';
        if (!categoryData[category]) categoryData[category] = { category, orders: 0, revenue: 0 };
        categoryData[category].orders += 1;
        categoryData[category].revenue += (item.quantity || 0) * (item.rate || item.price || 0);
      });
    });

    setAnalytics({
      revenue: { 
        total: totalRevenue, 
        growth: revenueGrowth, 
        average: totalOrders > 0 ? totalRevenue / totalOrders : 0 
      },
      orders: { 
        total: totalOrders, 
        growth: ordersGrowth, 
        average: periodDays > 0 ? totalOrders / periodDays : 0 
      },
      customers: { 
        total: periodCustomerIds.size, 
        new: newCustomers, 
        returning: periodCustomerIds.size - newCustomers 
      },
      products: { 
        total: Object.keys(productSales).length, 
        topSelling: sortedProducts.slice(0, 5),
        lowPerforming: sortedProducts.slice(-5).reverse()
      },
      payments,
      daily: Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date)),
      hourly: hourlyData,
      categories: Object.values(categoryData).sort((a, b) => b.revenue - a.revenue),
    });
  };

  const formatCurrency = (amount) => formatWithConversion(amount || 0);
  const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxDailyRevenue = Math.max(...analytics.daily.map(d => d.revenue), 1);
  const maxHourlyOrders = Math.max(...analytics.hourly.map(h => h.orders), 1);
  const totalPayments = Object.values(analytics.payments).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6" data-testid="sales-reports-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Sales Reports & Analytics
          </h1>
          <p className="text-muted-foreground">Comprehensive sales performance insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              try {
                const doc = new jsPDF({ unit: 'mm', format: 'a4' });
                const pageWidth = doc.internal.pageSize.getWidth();
                
                // Colors
                const primaryColor = [200, 30, 30];
                
                let y = 15;
                
                // Header
                doc.setTextColor(...primaryColor);
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.text('Sales Report', 15, y);
                
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.setFont('helvetica', 'normal');
                doc.text(`Period: ${period.replace('_', ' ').toUpperCase()}`, pageWidth - 15, y, { align: 'right' });
                y += 6;
                doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 15, y, { align: 'right' });
                y += 15;
                
                // KPI Summary
                doc.setTextColor(...primaryColor);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Summary', 15, y);
                y += 8;
                
                doc.setTextColor(60, 60, 60);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(`Total Revenue: ${formatCurrency(analytics.revenue.total)}`, 15, y);
                doc.text(`Total Orders: ${analytics.orders.total}`, 100, y);
                y += 6;
                doc.text(`Average Order: ${formatCurrency(analytics.revenue.average)}`, 15, y);
                doc.text(`Total Customers: ${analytics.customers.total}`, 100, y);
                y += 12;
                
                // Sales Table
                const salesTableData = salesData.slice(0, 50).map((sale, idx) => [
                  idx + 1,
                  sale.invoice_number,
                  new Date(sale.created_at).toLocaleDateString(),
                  sale.customer_name || 'Walk-in',
                  sale.payment_method?.toUpperCase() || 'CASH',
                  `₹${(sale.total_amount || 0).toFixed(2)}`
                ]);
                
                if (salesTableData.length > 0) {
                  doc.setTextColor(...primaryColor);
                  doc.setFontSize(12);
                  doc.setFont('helvetica', 'bold');
                  doc.text('Recent Sales', 15, y);
                  y += 5;
                  
                  autoTable(doc, {
                    startY: y,
                    head: [['#', 'Invoice', 'Date', 'Customer', 'Payment', 'Amount']],
                    body: salesTableData,
                    theme: 'striped',
                    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
                    bodyStyles: { fontSize: 8 },
                    columnStyles: {
                      0: { cellWidth: 10 },
                      1: { cellWidth: 30 },
                      2: { cellWidth: 25 },
                      3: { cellWidth: 45 },
                      4: { cellWidth: 25 },
                      5: { cellWidth: 30, halign: 'right' }
                    },
                    margin: { left: 15, right: 15 }
                  });
                }
                
                doc.save(`Sales_Report_${period}.pdf`);
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
                const params = new URLSearchParams({ payment_type: 'all' });
                // Calculate dates based on period
                const now = new Date();
                let fromDate, toDate = now.toISOString().split('T')[0];
                
                switch(period) {
                  case 'today':
                    fromDate = toDate;
                    break;
                  case 'yesterday':
                    const yd = new Date(now);
                    yd.setDate(yd.getDate() - 1);
                    fromDate = toDate = yd.toISOString().split('T')[0];
                    break;
                  case 'this_week':
                    const sw = new Date(now);
                    sw.setDate(sw.getDate() - 7);
                    fromDate = sw.toISOString().split('T')[0];
                    break;
                  case 'this_month':
                    fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    break;
                  case 'last_month':
                    fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                    toDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                    break;
                  default:
                    fromDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                }
                
                params.append('from_date', fromDate);
                params.append('to_date', toDate);
                
                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/reports/sales/export/excel?${params}`, {
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                
                if (!response.ok) throw new Error('Export failed');
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sales_report_${period}.xlsx`;
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
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const params = new URLSearchParams({ payment_type: 'all' });
                const now = new Date();
                let fromDate, toDate = now.toISOString().split('T')[0];
                
                switch(period) {
                  case 'today': fromDate = toDate; break;
                  case 'yesterday':
                    const yd = new Date(now);
                    yd.setDate(yd.getDate() - 1);
                    fromDate = toDate = yd.toISOString().split('T')[0];
                    break;
                  case 'this_week':
                    const sw = new Date(now);
                    sw.setDate(sw.getDate() - 7);
                    fromDate = sw.toISOString().split('T')[0];
                    break;
                  case 'this_month':
                    fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    break;
                  case 'last_month':
                    fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                    toDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                    break;
                  default:
                    fromDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                }
                
                params.append('from_date', fromDate);
                params.append('to_date', toDate);
                
                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/reports/sales/export/tally?${params}`, {
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                
                if (!response.ok) throw new Error('Export failed');
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `tally_import_${period}.xml`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                toast.success('Tally XML downloaded');
              } catch (err) {
                toast.error('Failed to export Tally XML');
              }
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Tally
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <IndianRupee className="w-8 h-8 text-emerald-600" />
              <div className={`flex items-center gap-1 text-sm ${analytics.revenue.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {analytics.revenue.growth >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {formatPercent(analytics.revenue.growth)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(analytics.revenue.total)}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg: {formatCurrency(analytics.revenue.average)}/order</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
              <div className={`flex items-center gap-1 text-sm ${analytics.orders.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {analytics.orders.growth >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {formatPercent(analytics.orders.growth)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold text-blue-600">{analytics.orders.total}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg: {analytics.orders.average.toFixed(1)}/day</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-purple-600" />
              <Badge variant="outline" className="text-purple-600 border-purple-300">
                +{analytics.customers.new} new
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Customers</p>
            <p className="text-2xl font-bold text-purple-600">{analytics.customers.total}</p>
            <p className="text-xs text-muted-foreground mt-1">{analytics.customers.returning} returning</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 text-amber-600" />
              <Target className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-sm text-muted-foreground">Products Sold</p>
            <p className="text-2xl font-bold text-amber-600">{analytics.products.total}</p>
            <p className="text-xs text-muted-foreground mt-1">Unique SKUs</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily Trend</TabsTrigger>
          <TabsTrigger value="hourly">Hourly Pattern</TabsTrigger>
          <TabsTrigger value="payments">Payment Methods</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" /> Daily Revenue Trend
              </CardTitle>
              <CardDescription>Revenue performance over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.daily.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No data for selected period</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end gap-1 h-64">
                    {analytics.daily.map((d, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center group">
                        <div className="relative w-full">
                          <div 
                            className="w-full bg-emerald-500 rounded-t transition-all hover:bg-emerald-600"
                            style={{ height: `${(d.revenue / maxDailyRevenue) * 200}px`, minHeight: d.revenue > 0 ? '4px' : '0' }}
                          />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                            {formatCurrency(d.revenue)}
                            <br />{d.orders} orders
                          </div>
                        </div>
                        <span className="text-[9px] mt-1 text-muted-foreground rotate-45 origin-left">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hourly">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" /> Hourly Order Pattern
              </CardTitle>
              <CardDescription>Peak hours for orders throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-end gap-1 h-48">
                  {analytics.hourly.map((h, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center group">
                      <div className="relative w-full">
                        <div 
                          className={`w-full rounded-t transition-all ${h.orders > maxHourlyOrders * 0.7 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                          style={{ height: `${(h.orders / maxHourlyOrders) * 150}px`, minHeight: h.orders > 0 ? '4px' : '0' }}
                        />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {h.orders} orders
                          <br />{formatCurrency(h.revenue)}
                        </div>
                      </div>
                      <span className="text-[9px] mt-1 text-muted-foreground">{h.hour}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-blue-500" />
                    <span>Normal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-amber-500" />
                    <span>Peak Hours</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Payment Method Distribution
              </CardTitle>
              <CardDescription>Revenue breakdown by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Visual bars */}
                <div className="space-y-4">
                  {[
                    { key: 'cash', label: 'Cash', icon: Banknote, color: 'bg-green-500' },
                    { key: 'card', label: 'Card', icon: CreditCard, color: 'bg-blue-500' },
                    { key: 'upi', label: 'UPI', icon: Activity, color: 'bg-purple-500' },
                    { key: 'bank', label: 'Bank Transfer', icon: IndianRupee, color: 'bg-amber-500' },
                    { key: 'other', label: 'Other', icon: Package, color: 'bg-gray-500' },
                  ].map(method => {
                    const value = analytics.payments[method.key];
                    const percent = totalPayments > 0 ? (value / totalPayments * 100) : 0;
                    return (
                      <div key={method.key} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <method.icon className="w-4 h-4" />
                            {method.label}
                          </span>
                          <span className="font-medium">{formatCurrency(value)} ({percent.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${method.color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="flex items-center justify-center">
                  <div className="text-center p-6 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Payments</p>
                    <p className="text-3xl font-bold text-primary">{formatCurrency(totalPayments)}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {analytics.orders.total} transactions
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="w-5 h-5" /> Top Selling Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.products.topSelling.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No product data</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.products.topSelling.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                            idx === 0 ? 'bg-amber-400 text-white' : 
                            idx === 1 ? 'bg-gray-300 text-gray-700' :
                            idx === 2 ? 'bg-amber-600 text-white' :
                            'bg-emerald-100 text-emerald-600'
                          }`}>{idx + 1}</span>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.quantity} units</p>
                          </div>
                        </div>
                        <span className="font-bold text-emerald-600">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <TrendingDown className="w-5 h-5" /> Low Performing Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.products.lowPerforming.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No product data</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.products.lowPerforming.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold">{idx + 1}</span>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.quantity} units</p>
                          </div>
                        </div>
                        <span className="font-medium text-red-600">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Category Breakdown */}
      {analytics.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" /> Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {analytics.categories.slice(0, 6).map((cat, idx) => (
                <div key={idx} className="p-4 bg-accent/50 rounded-lg text-center">
                  <p className="font-medium truncate">{cat.category}</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(cat.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{cat.orders} orders</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
