import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { usePermissions } from '../contexts/PermissionContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { CurrencyIcon } from '../components/CurrencyIcon';
import { ReadOnlyBanner } from '../components/RBACComponents';
import { toast } from 'sonner';
import { BarChart3, TrendingUp, ShoppingCart, Users, Package, ArrowUp, ArrowDown, Store, Eye, EyeOff, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SalesDashboardPage({ onNavigate }) {
  const { currencySymbol } = useCurrency();
  const { api, user } = useAuth();
  const { isReadOnly, canPerformAction } = usePermissions();
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(false);
  
  // Privacy Mode Utility - masks sensitive values
  const maskValue = (value, isPrivate) => {
    if (!isPrivate) return value;
    return '••••••';
  };

  const maskCurrency = (value, isPrivate) => {
    if (!isPrivate) return formatCurrency(value || 0);
    return '••••••';
  };

  // FIX: Avoid initializing to `null` to prevent a first-render UI flash
  // when the component reads `stats.*` (or conditionally renders based on it).
  // Keep a stable object shape until real data arrives.
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    thisMonthRevenue: 0,
    thisMonthOrders: 0,
    avgOrderValue: 0,
    totalCustomers: 0,
    revenueGrowth: 0
  });

  const [topProducts, setTopProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [period, setPeriod] = useState('this_month');
  
  // Privacy Mode State - persisted per user
  const [privacyMode, setPrivacyMode] = useState(() => {
    const saved = localStorage.getItem(`privacyMode_${user?.id || 'default'}`);
    return saved === 'true';
  });

  // Toggle Privacy Mode
  const togglePrivacyMode = () => {
    const newValue = !privacyMode;
    setPrivacyMode(newValue);
    localStorage.setItem(`privacyMode_${user?.id || 'default'}`, newValue.toString());
    toast.success(newValue ? 'Privacy Mode Enabled - Sales data hidden' : 'Privacy Mode Disabled - Sales data visible');
  };

  // Quick Actions for Sales Dashboard - Only POS, Items, Inventory
  const quickActions = [
    { id: 'pos', label: 'POS', icon: ShoppingCart, color: 'from-red-500 to-red-600', shadow: 'shadow-red-200' },
    { id: 'items', label: 'Items', icon: Package, color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-200' },
    { id: 'inventory', label: 'Inventory', icon: Store, color: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-200' },
  ];

  useEffect(() => { fetchData(); }, [period]);

  const fetchData = async () => {
    try {
      const [salesData, customersData, itemsData] = await Promise.all([
        api('/api/sales'),
        api('/api/customers'),
        api('/api/items')
      ]);

      // Calculate stats
      const today = new Date();
      const thisMonth = today.toISOString().slice(0, 7);
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7);

      const thisMonthSales = salesData.filter(s => s.sale_date?.startsWith(thisMonth) || s.created_at?.startsWith(thisMonth));
      const lastMonthSales = salesData.filter(s => s.sale_date?.startsWith(lastMonth) || s.created_at?.startsWith(lastMonth));

      const totalRevenue = salesData.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const thisMonthRevenue = thisMonthSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const lastMonthRevenue = lastMonthSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const revenueGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;

      setStats({
        totalRevenue,
        totalOrders: salesData.length,
        thisMonthRevenue,
        thisMonthOrders: thisMonthSales.length,
        avgOrderValue: salesData.length > 0 ? totalRevenue / salesData.length : 0,
        totalCustomers: customersData.length,
        revenueGrowth
      });

      // Top products by quantity sold
      const productSales = {};
      salesData.forEach(sale => {
        (sale.items || []).forEach(item => {
          const key = item.item_id || item.variant_id;
          if (!productSales[key]) productSales[key] = { id: key, quantity: 0, revenue: 0 };
          productSales[key].quantity += item.quantity || 0;
          productSales[key].revenue += (item.quantity || 0) * (item.rate || item.price || 0);
        });
      });
      const topProds = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(p => ({
          ...p,
          name: itemsData.find(i => i.id === p.id)?.name || 'Unknown'
        }));
      setTopProducts(topProds);

      // Top customers by revenue
      const customerSales = {};
      salesData.forEach(sale => {
        const cid = sale.customer_id;
        if (cid) {
          if (!customerSales[cid]) customerSales[cid] = { id: cid, orders: 0, revenue: 0 };
          customerSales[cid].orders += 1;
          customerSales[cid].revenue += sale.total_amount || 0;
        }
      });
      const topCusts = Object.values(customerSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(c => ({
          ...c,
          name: customersData.find(cust => cust.id === c.id)?.name || 'Walk-in'
        }));
      setTopCustomers(topCusts);

      // Monthly sales
      const monthly = {};
      salesData.forEach(sale => {
        const date = sale.sale_date || sale.created_at || '';
        const month = date.slice(0, 7);
        if (month) {
          if (!monthly[month]) monthly[month] = { month, orders: 0, revenue: 0 };
          monthly[month].orders += 1;
          monthly[month].revenue += sale.total_amount || 0;
        }
      });
      setMonthlySales(Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)).slice(-12));

    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  const maxRevenue = Math.max(...monthlySales.map(m => m.revenue), 1);

  return (
    <div className="space-y-6" data-testid="sales-dashboard-page">
      {/* Read-Only Banner for Viewers */}
      <ReadOnlyBanner module="Sales Dashboard" />
      
      {/* Privacy Mode Toggle */}
      <div className="flex items-center justify-between bg-card border rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${privacyMode ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
            {privacyMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Privacy Mode</span>
              {privacyMode && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  <Lock className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {privacyMode ? 'Sales data is hidden from view' : 'Hide sensitive sales figures from display'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{privacyMode ? 'On' : 'Off'}</span>
          <Switch 
            checked={privacyMode} 
            onCheckedChange={togglePrivacyMode}
            data-testid="privacy-mode-toggle"
          />
        </div>
      </div>
      
      {/* Quick Actions - POS, Items, Inventory */}
      <div className="grid grid-cols-3 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onNavigate && onNavigate(action.id)}
              className={`group relative p-6 rounded-xl bg-gradient-to-br ${action.color} text-white shadow-lg ${action.shadow} hover:scale-105 transition-all duration-200 hover:shadow-xl`}
              data-testid={`quick-${action.id}`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-white/20 rounded-full">
                  <Icon className="w-8 h-8" />
                </div>
                <span className="font-semibold text-lg">{action.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-200">
          <CardContent className="pt-6">
            <CurrencyIcon className="w-8 h-8 text-emerald-600 mb-2" />
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className={`text-2xl font-bold text-emerald-600 ${privacyMode ? 'blur-sm select-none' : ''}`}>
              {maskCurrency(stats?.totalRevenue, privacyMode)}
            </p>
            <p className={`text-xs text-muted-foreground mt-1 ${privacyMode ? 'blur-sm select-none' : ''}`}>
              {privacyMode ? '••• orders' : `${stats?.totalOrders} orders`}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200">
          <CardContent className="pt-6">
            <TrendingUp className="w-8 h-8 text-blue-600 mb-2" />
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className={`text-2xl font-bold text-blue-600 ${privacyMode ? 'blur-sm select-none' : ''}`}>
              {maskCurrency(stats?.thisMonthRevenue, privacyMode)}
            </p>
            <div className={`flex items-center gap-1 mt-1 ${privacyMode ? 'blur-sm select-none' : ''}`}>
              {stats?.revenueGrowth >= 0 ? (
                <ArrowUp className="w-3 h-3 text-emerald-600" />
              ) : (
                <ArrowDown className="w-3 h-3 text-red-600" />
              )}
              <span className={`text-xs ${stats?.revenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {privacyMode ? '••••' : `${Math.abs(stats?.revenueGrowth || 0).toFixed(1)}%`} vs last month
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-200">
          <CardContent className="pt-6">
            <ShoppingCart className="w-8 h-8 text-purple-600 mb-2" />
            <p className="text-sm text-muted-foreground">Avg Order Value</p>
            <p className={`text-2xl font-bold text-purple-600 ${privacyMode ? 'blur-sm select-none' : ''}`}>
              {maskCurrency(stats?.avgOrderValue, privacyMode)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-200">
          <CardContent className="pt-6">
            <Users className="w-8 h-8 text-amber-600 mb-2" />
            <p className="text-sm text-muted-foreground">Total Customers</p>
            <p className="text-2xl font-bold text-amber-600">{stats?.totalCustomers}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Sales Chart */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Monthly Sales Trend</CardTitle></CardHeader>
          <CardContent>
            {monthlySales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No sales data</p>
            ) : (
              <div className="space-y-4">
                <div className={`flex items-end gap-2 h-48 ${privacyMode ? 'blur-md select-none' : ''}`}>
                  {monthlySales.map((m, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-emerald-500 rounded-t-sm transition-all hover:bg-emerald-600"
                        style={{ height: `${(m.revenue / maxRevenue) * 100}%`, minHeight: m.revenue > 0 ? '4px' : '0' }}
                        title={privacyMode ? 'Hidden' : `${currencySymbol}${m.revenue.toLocaleString()}`}
                      />
                      <span className="text-[10px] mt-1 text-muted-foreground">{m.month.slice(5)}</span>
                    </div>
                  ))}
                </div>
                {privacyMode && (
                  <p className="text-center text-sm text-muted-foreground">
                    <Lock className="w-4 h-4 inline mr-1" />
                    Chart data hidden in Privacy Mode
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Top Selling Products</CardTitle></CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No product data</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-bold">{idx + 1}</span>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className={`text-xs text-muted-foreground ${privacyMode ? 'blur-sm select-none' : ''}`}>
                          {privacyMode ? '••• units sold' : `${p.quantity} units sold`}
                        </p>
                      </div>
                    </div>
                    <span className={`font-bold text-emerald-600 ${privacyMode ? 'blur-sm select-none' : ''}`}>
                      {maskCurrency(p.revenue, privacyMode)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Top Customers</CardTitle></CardHeader>
        <CardContent>
          {topCustomers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No customer data</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {topCustomers.map((c, idx) => (
                <div key={idx} className="p-4 bg-accent/50 rounded-lg text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-lg font-bold mb-2">{idx + 1}</div>
                  <p className="font-medium truncate">{c.name}</p>
                  <p className={`text-sm text-muted-foreground ${privacyMode ? 'blur-sm select-none' : ''}`}>
                    {privacyMode ? '••• orders' : `${c.orders} orders`}
                  </p>
                  <p className={`font-bold text-emerald-600 ${privacyMode ? 'blur-sm select-none' : ''}`}>
                    {maskCurrency(c.revenue, privacyMode)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
