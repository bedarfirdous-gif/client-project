import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Package, Users, Store, DollarSign, AlertTriangle, 
  ShoppingCart, TrendingUp, ArrowUpRight, Clock, RefreshCw,
  Receipt, Truck, Tags, BookOpen, UserCircle, Wallet, Settings,
  FileText, BarChart3, Percent, Gift, CreditCard, Building2, Wrench,
  Search, X, Loader2, ArrowRight, Sparkles, Eye, ChevronRight, Globe,
  Star, Filter, Grid
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { usePermissions } from '../contexts/PermissionContext';
import { RefreshButton } from '../components/SystemRepair';
import BackupCodeBar from '../components/BackupCodeBar';
import { useCurrency, CURRENCIES } from '../contexts/CurrencyContext';

export default function DashboardPage({ onNavigate }) {
  const { api } = useAuth();
  const { hasPageAccess } = usePermissions();
  const { formatCurrency, formatWithConversion, displayCurrency, setDisplayCurrency } = useCurrency();
  // Avoid null initial state to prevent null -> populated render flash
  // (UI can render stable "0" values via optional chaining until real data arrives)
  const [stats, setStats] = useState({});
  const [recentSales, setRecentSales] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [allItems, setAllItems] = useState([]); // All items for carousel
  const [categories, setCategories] = useState([]); // Item categories
  const [selectedCategory, setSelectedCategory] = useState('all'); // Category filter
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false); // Featured filter
  const [loading, setLoading] = useState(true);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  
  // Auto-scroll state for product carousel
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const carouselRef = useRef(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  // Keep a stable object shape instead of null to avoid flicker in results UI
  // while still using `showResults` to control visibility.
  const [searchResults, setSearchResults] = useState({ items: [], customers: [], sales: [], employees: [] });
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  const fetchData = async () => {
    try {
      const [statsData, salesData, stockData, itemsData, categoriesData] = await Promise.all([
        api('/api/dashboard/stats'),
        api('/api/dashboard/recent-sales'),
        api('/api/dashboard/low-stock'),
        api('/api/items?limit=100'), // Fetch more items for carousel
        api('/api/categories').catch(() => []), // Fetch categories
      ]);
      setStats(statsData);
      setRecentSales(salesData);
      setLowStock(stockData);
      // Get items from the response (handle both array and paginated response)
      const items = Array.isArray(itemsData) ? itemsData : (itemsData.items || []);
      setAllItems(items);
      // Extract unique categories from items if API doesn't provide them
      const cats = Array.isArray(categoriesData) && categoriesData.length > 0 
        ? categoriesData 
        : [...new Set(items.map(i => i.category).filter(Boolean))].map(c => ({ id: c, name: c }));
      setCategories(cats);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Filter items based on category and featured status
  const filteredItems = useMemo(() => {
    let result = allItems;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(item => item.category === selectedCategory);
    }
    
    // Filter by featured status
    if (showFeaturedOnly) {
      result = result.filter(item => item.is_featured || item.featured);
    }
    
    return result;
  }, [allItems, selectedCategory, showFeaturedOnly]);

  // Auto-scroll effect for product carousel
  useEffect(() => {
    if (allItems.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentItemIndex((prev) => (prev + 1) % allItems.length);
    }, 3000); // Change item every 3 seconds
    
    return () => clearInterval(interval);
  }, [allItems.length]);

  // Global search function
  const handleSearch = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults(null);
      setShowResults(false);
      return;
    }
    
    setSearching(true);
    setShowResults(true);
    
    try {
      const results = await api(`/api/global-search?q=${encodeURIComponent(query)}`);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults({ items: [], customers: [], sales: [], employees: [] });
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    if (searchQuery.length >= 2) {
      searchTimeout.current = setTimeout(() => {
        handleSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults(null);
      setShowResults(false);
    }
    
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setShowResults(false);
  };

  const navigateToResult = (type, id) => {
    clearSearch();
    if (onNavigate) {
      onNavigate(type, id);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const restoreBackup = async () => {
    try {
      const result = await api('/api/admin/restore-backup', { method: 'POST' });
      toast.success('Backup restored successfully!');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Quick action tiles with icons - Large grid layout
  const quickActions = [
    { id: 'pos', label: 'POS', icon: ShoppingCart, color: 'from-red-500 to-red-600', shadow: 'shadow-red-200' },
    { id: 'items', label: 'Items', icon: Package, color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-200' },
    { id: 'inventory', label: 'Inventory', icon: Store, color: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-200' },
    { id: 'customers', label: 'Customers', icon: Users, color: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-200' },
    { id: 'purchases', label: 'Purchases', icon: Receipt, color: 'from-amber-500 to-amber-600', shadow: 'shadow-amber-200' },
    { id: 'transfers', label: 'Transfers', icon: Truck, color: 'from-cyan-500 to-cyan-600', shadow: 'shadow-cyan-200' },
    { id: 'vouchers', label: 'Vouchers', icon: Gift, color: 'from-pink-500 to-pink-600', shadow: 'shadow-pink-200' },
    { id: 'accounting-reports', label: 'Ledger', icon: BookOpen, color: 'from-indigo-500 to-indigo-600', shadow: 'shadow-indigo-200' },
    { id: 'discounts', label: 'Discounts', icon: Percent, color: 'from-orange-500 to-orange-600', shadow: 'shadow-orange-200' },
    { id: 'suppliers', label: 'Suppliers', icon: Building2, color: 'from-teal-500 to-teal-600', shadow: 'shadow-teal-200' },
    { id: 'stores', label: 'Stores', icon: Store, color: 'from-violet-500 to-violet-600', shadow: 'shadow-violet-200' },
    { id: 'employees', label: 'Employees', icon: UserCircle, color: 'from-rose-500 to-rose-600', shadow: 'shadow-rose-200' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Items', value: stats?.total_items || 0, icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { label: 'Today Revenue', value: formatCurrency(stats?.today_revenue || 0), icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-100', mono: true },
    { label: 'Today Orders', value: stats?.today_orders || 0, icon: ShoppingCart, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    { label: 'Customers', value: stats?.total_customers || 0, icon: Users, color: 'text-amber-600', bgColor: 'bg-amber-100' },
    { label: 'Stores', value: stats?.total_stores || 0, icon: Store, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
    { label: 'Employees', value: stats?.total_employees || 0, icon: UserCircle, color: 'text-pink-600', bgColor: 'bg-pink-100' },
    { label: 'Low Stock', value: stats?.low_stock_items || 0, icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
    { label: 'Pending Transfers', value: stats?.pending_transfers || 0, icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="dashboard-page">
      {/* Currency Selector */}
      <div className="flex justify-end">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
            className="flex items-center gap-2"
            data-testid="currency-selector-btn"
          >
            <Globe className="h-4 w-4" />
            <span>{CURRENCIES[displayCurrency]?.symbol} {displayCurrency}</span>
          </Button>
          {showCurrencyPicker && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
              {Object.values(CURRENCIES).map(curr => (
                <button
                  key={curr.code}
                  onClick={() => {
                    setDisplayCurrency(curr.code);
                    setShowCurrencyPicker(false);
                    toast.success(`Currency changed to ${curr.name}`);
                  }}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center gap-2 ${
                    displayCurrency === curr.code ? 'bg-primary/10 text-primary font-medium' : ''
                  }`}
                >
                  <span className="w-6">{curr.symbol}</span>
                  <span>{curr.code}</span>
                  <span className="text-muted-foreground text-xs ml-auto">{curr.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Global Search Bar */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search items, customers, sales, employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            className="pl-10 pr-10 h-12 text-base rounded-xl border-2 focus:border-primary shadow-sm"
            data-testid="global-search-input"
          />
          {searchQuery && (
            <button 
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-muted rounded-full"
              data-testid="clear-search-btn"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <X className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
        
        {/* Search Results Dropdown */}
        {showResults && searchResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-xl shadow-lg z-50 max-h-[70vh] overflow-y-auto" data-testid="search-results-dropdown">
            {/* Items Results */}
            {searchResults.items?.length > 0 && (
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => navigateToResult('items')}
                  >
                    View All <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                {searchResults.items.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigateToResult('items', item.id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg text-left transition-colors"
                    data-testid={`search-result-item-${item.id}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground truncate">SKU: {item.sku} • {formatCurrency(item.selling_price || 0)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Customers Results */}
            {searchResults.customers?.length > 0 && (
              <div className="p-2 border-t">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customers</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => navigateToResult('customers')}
                  >
                    View All <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                {searchResults.customers.slice(0, 5).map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => navigateToResult('customers', customer.id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg text-left transition-colors"
                    data-testid={`search-result-customer-${customer.id}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{customer.phone || customer.email || 'No contact'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Sales Results */}
            {searchResults.sales?.length > 0 && (
              <div className="p-2 border-t">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => navigateToResult('sales')}
                  >
                    View All <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                {searchResults.sales.slice(0, 5).map((sale) => (
                  <button
                    key={sale.id}
                    onClick={() => navigateToResult('sales', sale.id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg text-left transition-colors"
                    data-testid={`search-result-sale-${sale.id}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{sale.invoice_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{sale.customer_name || 'Walk-in'} • {formatCurrency(sale.total_amount || 0)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Employees Results */}
            {searchResults.employees?.length > 0 && (
              <div className="p-2 border-t">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employees</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => navigateToResult('employees')}
                  >
                    View All <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                {searchResults.employees.slice(0, 5).map((employee) => (
                  <button
                    key={employee.id}
                    onClick={() => navigateToResult('employees', employee.id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg text-left transition-colors"
                    data-testid={`search-result-employee-${employee.id}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-5 h-5 text-rose-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{employee.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{employee.role} • {employee.phone || employee.email || 'No contact'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* No Results */}
            {!searching && searchResults && 
              !searchResults.items?.length && 
              !searchResults.customers?.length && 
              !searchResults.sales?.length && 
              !searchResults.employees?.length && (
              <div className="p-6 text-center">
                <Search className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
              </div>
            )}
            
            {/* Searching indicator */}
            {searching && (
              <div className="p-6 text-center">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Searching...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* System Actions Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg sm:text-xl font-bold">Welcome Back!</h2>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={fetchData} size="sm" />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('open-system-repair'))}
            className="gap-2"
            data-testid="system-repair-btn"
          >
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">System Tools</span>
          </Button>
        </div>
      </div>

      {/* Hero Banner - Product Showcase with Scrolling Images */}
      <div 
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 cursor-pointer group transition-all hover:shadow-xl hover:shadow-purple-200 dark:hover:shadow-purple-900/30"
        onClick={() => onNavigate && onNavigate('items')}
        data-testid="catalogue-hero-banner"
      >
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="flex flex-col md:flex-row">
          {/* Left Content */}
          <div className="relative z-10 p-6 sm:p-8 md:w-1/2">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white font-medium">
                NEW ARRIVALS
              </span>
              {/* Featured Toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowFeaturedOnly(!showFeaturedOnly); }}
                className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${
                  showFeaturedOnly 
                    ? 'bg-yellow-400 text-yellow-900' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                data-testid="featured-toggle"
              >
                <Star className="w-3 h-3" fill={showFeaturedOnly ? "currentColor" : "none"} />
                Featured
              </button>
            </div>
            
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">
              Explore Your Product Catalogue
            </h3>
            <p className="text-white/80 text-sm sm:text-base mb-3">
              {showFeaturedOnly 
                ? `${filteredItems.length} featured products` 
                : selectedCategory !== 'all'
                  ? `${filteredItems.length} products in ${selectedCategory}`
                  : `Browse ${stats?.total_items || filteredItems.length} products across all categories`
              }
            </p>
            
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-4 max-h-20 overflow-y-auto">
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedCategory('all'); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-white text-purple-700'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                data-testid="category-all"
              >
                <Grid className="w-3 h-3 inline mr-1" />
                All
              </button>
              {categories.slice(0, 8).map((cat) => (
                <button
                  key={cat.id || cat.name || cat}
                  onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat.name || cat); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === (cat.name || cat)
                      ? 'bg-white text-purple-700'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                  data-testid={`category-${cat.name || cat}`}
                >
                  {(cat.name || cat).substring(0, 12)}
                </button>
              ))}
              {categories.length > 8 && (
                <span className="px-2 py-1 text-white/60 text-xs">
                  +{categories.length - 8} more
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                size="lg"
                className="bg-white text-purple-700 hover:bg-white/90 gap-2 font-semibold shadow-lg"
                onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('items'); }}
                data-testid="explore-catalogue-btn"
              >
                Explore Catalogue
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-white/50 text-white hover:bg-white/20 gap-2"
                onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('pos'); }}
              >
                Start Selling
              </Button>
            </div>
          </div>
          
          {/* Right - Scrolling Product Cards with Filtered Items */}
          <div className="relative md:w-1/2 h-40 md:h-auto overflow-hidden">
            {filteredItems.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white/70">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No products found</p>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedCategory('all'); setShowFeaturedOnly(false); }}
                    className="text-xs underline mt-1 hover:text-white"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center">
                <div 
                  ref={carouselRef}
                  className="flex gap-3 animate-scroll-left"
                  style={{
                    animationDuration: `${Math.max(filteredItems.length * 3, 20)}s`
                  }}
                >
                  {/* First set of product cards - Filtered Items */}
                  {filteredItems.map((item, idx) => (
                    <div 
                      key={`first-${item?.id || idx}`}
                      className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm shadow-lg transform hover:scale-105 transition-transform cursor-pointer relative"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (item?.id) onNavigate && onNavigate('items', { itemId: item.id }); 
                      }}
                    >
                      {/* Featured Badge */}
                      {(item?.is_featured || item?.featured) && (
                        <div className="absolute top-1 right-1 z-10">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        </div>
                      )}
                      {item?.image_url ? (
                        <div className="w-full h-full relative">
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-full h-full flex-col items-center justify-center bg-white/20 p-2">
                            <Package className="w-8 h-8 text-white/80 mb-1" />
                            <span className="text-white/90 text-xs font-medium text-center truncate w-full">
                              {item?.name || `Product ${idx + 1}`}
                            </span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-1">
                            <span className="text-white text-xs font-medium truncate block text-center">
                              {item.name?.substring(0, 12)}{item.name?.length > 12 ? '..' : ''} 
                              {item.selling_price && (
                                <span className="text-white/80 ml-1">{formatWithConversion(item.selling_price)}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-white/20 p-2">
                          <Package className="w-8 h-8 text-white/80 mb-1" />
                          <span className="text-white/90 text-xs font-medium text-center truncate w-full">
                            {item?.name?.substring(0, 12) || `Product ${idx + 1}`}
                          </span>
                          {item?.selling_price && (
                            <span className="text-white/70 text-xs mt-1">
                              {formatWithConversion(item.selling_price)}
                            </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {/* Duplicate for seamless loop */}
                {filteredItems.map((item, idx) => (
                  <div 
                    key={`second-${item?.id || idx}`}
                    className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm shadow-lg transform hover:scale-105 transition-transform cursor-pointer relative"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (item?.id) onNavigate && onNavigate('items', { itemId: item.id }); 
                    }}
                  >
                    {/* Featured Badge */}
                    {(item?.is_featured || item?.featured) && (
                      <div className="absolute top-1 right-1 z-10">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      </div>
                    )}
                    {item?.image_url ? (
                      <div className="w-full h-full relative">
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="hidden w-full h-full flex-col items-center justify-center bg-white/20 p-2">
                          <Package className="w-8 h-8 text-white/80 mb-1" />
                          <span className="text-white/90 text-xs font-medium text-center truncate w-full">
                            {item?.name || `Product ${idx + 1}`}
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-1">
                          <span className="text-white text-xs font-medium truncate block text-center">
                            {item.name?.substring(0, 12)}{item.name?.length > 12 ? '..' : ''} 
                            {item.selling_price && (
                              <span className="text-white/80 ml-1">{formatWithConversion(item.selling_price)}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-white/20 p-2">
                        <Package className="w-8 h-8 text-white/80 mb-1" />
                        <span className="text-white/90 text-xs font-medium text-center truncate w-full">
                          {item?.name?.substring(0, 12) || `Product ${idx + 1}`}
                        </span>
                        {item?.selling_price && (
                          <span className="text-white/70 text-xs mt-1">
                            {formatWithConversion(item.selling_price)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Restore Button - Mobile Optimized */}
      {stats?.total_items === 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm sm:text-base">Backup Available</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Restore your data from the backup file</p>
              </div>
              <Button onClick={restoreBackup} size="sm" className="w-full sm:w-auto" data-testid="restore-backup-btn">
                <RefreshCw className="w-4 h-4 mr-2" /> Restore Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backup Codes Security Bar */}
      <BackupCodeBar />

      {/* Quick Actions - Mobile-Optimized Grid */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-3">
          {quickActions.filter(action => hasPageAccess(action.id)).map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onNavigate && onNavigate(action.id)}
                className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br ${action.color} text-white transition-all transform hover:scale-105 active:scale-95 shadow-md ${action.shadow} dark:shadow-none`}
                data-testid={`quick-${action.id}`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
                <span className="text-[9px] sm:text-[10px] font-medium text-center leading-tight">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Grid - Mobile Optimized */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
          {statCards.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card key={idx} className="animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                <CardContent className="p-3 sm:pt-6 sm:px-6">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                      <p className={`text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 truncate ${stat.mono ? 'font-mono-data' : ''}`}>
                        {stat.value}
                      </p>
                    </div>
                    <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor} ${stat.color} flex-shrink-0 ml-2`}>
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Sales & Low Stock - Mobile Stacked */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Sales */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> Recent Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 sm:py-8">No sales yet</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {recentSales.slice(0, 5).map((sale, idx) => (
                  <div key={sale.id || idx} className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="font-medium text-xs sm:text-sm truncate">{sale.invoice_number}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {sale.customer_name || 'Walk-in'} • {new Date(sale.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-mono-data font-medium text-xs sm:text-sm text-emerald-600 flex-shrink-0">
                      {formatCurrency(sale.total_amount || 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" /> Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 sm:py-8">All items well stocked</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {lowStock.slice(0, 5).map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="font-medium text-xs sm:text-sm truncate">{item.name}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">SKU: {item.sku}</p>
                    </div>
                    <span className="font-mono-data text-[10px] sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex-shrink-0">
                      {item.current_stock} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
