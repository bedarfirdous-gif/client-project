import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingCart, Users,
  Package, Calendar, RefreshCw, ArrowUpRight, ArrowDownRight,
  Filter, Download, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useCurrency, CURRENCIES } from '../contexts/CurrencyContext';
import { CurrencyIcon } from '../components/CurrencyIcon';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function AnalyticsDashboardPage() {
  const { api } = useAuth();
  const { formatCurrency, formatWithConversion, displayCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d'); // 7d, 30d, 90d, 1y
  const [analytics, setAnalytics] = useState({
    salesTrend: [],
    topProducts: [],
    revenueByCategory: [],
    customerGrowth: [],
    paymentMethods: [],
    hourlyDistribution: [],
    summary: {}
  });

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const data = await api(`/api/analytics/dashboard?date_range=${dateRange}`);
      setAnalytics(data);
    } catch (err) {
      toast.error('Failed to load analytics');
      // Use mock data for demo
      setAnalytics(generateMockData());
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = () => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
    const salesTrend = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      salesTrend.push({
        date: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        revenue: Math.floor(Math.random() * 50000) + 10000,
        orders: Math.floor(Math.random() * 30) + 5,
        profit: Math.floor(Math.random() * 15000) + 3000
      });
    }

    return {
      salesTrend,
      topProducts: [
        { name: 'Classic T-Shirt', sales: 145, revenue: 217500 },
        { name: 'Denim Jeans', sales: 98, revenue: 245000 },
        { name: 'Cotton Kurta', sales: 87, revenue: 130500 },
        { name: 'Silk Saree', sales: 45, revenue: 315000 },
        { name: 'Leather Wallet', sales: 156, revenue: 78000 }
      ],
      revenueByCategory: [
        { name: 'Clothing', value: 450000 },
        { name: 'Accessories', value: 125000 },
        { name: 'Footwear', value: 180000 },
        { name: 'Electronics', value: 95000 },
        { name: 'Others', value: 50000 }
      ],
      customerGrowth: salesTrend.map((d, i) => ({
        date: d.date,
        newCustomers: Math.floor(Math.random() * 10) + 1,
        totalCustomers: 100 + i * 5
      })),
      paymentMethods: [
        { name: 'Cash', value: 35 },
        { name: 'UPI', value: 40 },
        { name: 'Card', value: 20 },
        { name: 'Credit', value: 5 }
      ],
      hourlyDistribution: Array.from({ length: 12 }, (_, i) => ({
        hour: `${9 + i}:00`,
        sales: Math.floor(Math.random() * 15) + 2
      })),
      summary: {
        totalRevenue: 986500,
        totalOrders: 534,
        avgOrderValue: 1848,
        totalCustomers: 289,
        newCustomers: 47,
        topSellingCategory: 'Clothing',
        revenueGrowth: 12.5,
        ordersGrowth: 8.3
      }
    };
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  // Format currency for chart axis (compact format like 10k, 1M)
  const formatChartCurrency = (value) => {
    const symbol = CURRENCIES[displayCurrency]?.symbol || '₹';
    if (value >= 1000000) return `${symbol}${(value/1000000).toFixed(1)}M`;
    if (value >= 1000) return `${symbol}${(value/1000).toFixed(0)}k`;
    return `${symbol}${value}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('revenue') || entry.name.includes('Revenue') || entry.name.includes('profit') 
                ? formatWithConversion(entry.value) 
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { summary } = analytics;

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Track your business performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            {['7d', '30d', '90d', '1y'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  dateRange === range 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-accent'
                }`}
              >
                {range === '1y' ? '1 Year' : range}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={fetchAnalytics}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Revenue</p>
                <p className="text-2xl font-bold mt-1">{formatWithConversion(summary.totalRevenue)}</p>
                <div className="flex items-center gap-1 mt-2 text-sm">
                  {summary.revenueGrowth >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  <span>{Math.abs(summary.revenueGrowth)}%</span>
                </div>
              </div>
              <CurrencyIcon className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Total Orders</p>
                <p className="text-2xl font-bold mt-1">{summary.totalOrders}</p>
                <div className="flex items-center gap-1 mt-2 text-sm">
                  {summary.ordersGrowth >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  <span>{Math.abs(summary.ordersGrowth)}%</span>
                </div>
              </div>
              <ShoppingCart className="w-8 h-8 text-emerald-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-purple-100 text-sm">Avg Order Value</p>
                <p className="text-2xl font-bold mt-1">{formatWithConversion(summary.avgOrderValue)}</p>
                <p className="text-sm mt-2 text-purple-200">Per transaction</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-amber-100 text-sm">New Customers</p>
                <p className="text-2xl font-bold mt-1">{summary.newCustomers}</p>
                <p className="text-sm mt-2 text-amber-200">Total: {summary.totalCustomers}</p>
              </div>
              <Users className="w-8 h-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Sales Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analytics.salesTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" tickFormatter={formatChartCurrency} />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Bar
                  yAxisId="right"
                  dataKey="orders"
                  name="Orders"
                  fill="#8b5cf6"
                  opacity={0.7}
                  radius={[4, 4, 0, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Top Selling Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={formatChartCurrency} className="text-xs" />
                  <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                    {analytics.topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Revenue by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.revenueByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {analytics.revenueByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatWithConversion(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Customer Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Customer Acquisition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.customerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="totalCustomers"
                    name="Total Customers"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="newCustomers"
                    name="New Customers"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CurrencyIcon className="w-5 h-5" />
              Payment Methods Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.paymentMethods}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {analytics.paymentMethods.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Sales by Hour (Today)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.hourlyDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="sales" name="Sales Count" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  {analytics.hourlyDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.sales > 10 ? '#10b981' : entry.sales > 5 ? '#f59e0b' : '#94a3b8'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
