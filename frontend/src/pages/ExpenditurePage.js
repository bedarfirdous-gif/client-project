import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Plus, Search, Filter, Calendar, DollarSign, TrendingUp, TrendingDown,
  Building2, Zap, Users, Megaphone, Package, Wrench, Truck, ShoppingBag,
  Receipt, Shield, MoreHorizontal, Download, Edit2, Trash2, Eye, RefreshCw,
  PieChart, BarChart3, ArrowUpRight, ArrowDownRight, Wallet, Target,
  ChevronDown, Store, Globe, Clock, CreditCard, Banknote, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';

// Category icons mapping
const CATEGORY_ICONS = {
  rent: Building2,
  utilities: Zap,
  salaries: Users,
  marketing: Megaphone,
  supplies: Package,
  maintenance: Wrench,
  transport: Truck,
  inventory: ShoppingBag,
  taxes: Receipt,
  insurance: Shield,
  other: MoreHorizontal,
};

// Payment method icons
const PAYMENT_ICONS = {
  cash: Banknote,
  bank_transfer: Building2,
  card: CreditCard,
  upi: Wallet,
};

const EXPENSE_TYPES = [
  { id: 'daily', label: 'Daily', color: 'bg-blue-100 text-blue-700' },
  { id: 'weekly', label: 'Weekly', color: 'bg-green-100 text-green-700' },
  { id: 'monthly', label: 'Monthly', color: 'bg-purple-100 text-purple-700' },
  { id: 'one_time', label: 'One-time', color: 'bg-amber-100 text-amber-700' },
];

export default function ExpenditurePage() {
  const { api } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(false);
  const [categories, setCategories] = useState({});
  const [stores, setStores] = useState([]);

  // Avoid null initial state to prevent a null->data render transition (visual flash)
  // Use explicit loaded flags to control when UI should render data-dependent sections.
  const [summary, setSummary] = useState({});
  const [trends, setTrends] = useState({});
  const [isSummaryLoaded, setIsSummaryLoaded] = useState(false);
  const [isTrendsLoaded, setIsTrendsLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Modal states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showViewExpense, setShowViewExpense] = useState(false);

  // FIX: Avoid null initial state to prevent a null -> object render transition
  // that can cause a visible flash in dialogs/details that read selectedExpense.
  // Use an explicit flag to represent whether an expense is currently selected.
  const [selectedExpense, setSelectedExpense] = useState({});
  const [hasSelectedExpense, setHasSelectedExpense] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'other',
    expense_type: 'daily',
    store_id: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    payment_method: 'cash',
    reference_number: '',
    vendor_name: '',
    tags: [],
  });

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [expensesData, categoriesData, storesData, summaryData, trendsData] = await Promise.all([
        api('/api/expenses?limit=100'),
        api('/api/expenses/categories'),
        api('/api/stores'),
        api(`/api/expenses/summary?period=${dateRange}${selectedStore !== 'all' ? `&store_id=${selectedStore}` : ''}`),
        api(`/api/expenses/trends?months=6${selectedStore !== 'all' ? `&store_id=${selectedStore}` : ''}`),
      ]);
      
      setExpenses(expensesData.expenses || []);
      setCategories(categoriesData.categories || {});
      setStores(storesData || []);
      setSummary(summaryData);
      setTrends(trendsData);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedStore]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = !search || 
        exp.title?.toLowerCase().includes(search.toLowerCase()) ||
        exp.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
        exp.description?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStore = selectedStore === 'all' || 
        exp.store_id === selectedStore || 
        (!exp.store_id && selectedStore === 'global');
      
      const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;
      const matchesType = selectedType === 'all' || exp.expense_type === selectedType;
      
      return matchesSearch && matchesStore && matchesCategory && matchesType;
    });
  }, [expenses, search, selectedStore, selectedCategory, selectedType]);

  // Create/Update expense
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.amount || !formData.date) {
      toast.error('Please fill in required fields');
      return;
    }
    
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        store_id: formData.store_id || null,
      };
      
      if (isEditing && selectedExpense) {
        await api(`/api/expenses/${selectedExpense.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('Expense updated successfully');
      } else {
        await api('/api/expenses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Expense added successfully');
      }
      
      setShowAddExpense(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save expense');
    }
  };

  // Delete expense
  const handleDelete = async (expenseId) => {
    if (!window.confirm('Move this expense to recycle bin?')) return;
    
    try {
      await api(`/api/expenses/${expenseId}`, { method: 'DELETE' });
      toast.success('Expense moved to recycle bin');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      amount: '',
      category: 'other',
      expense_type: 'daily',
      store_id: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      payment_method: 'cash',
      reference_number: '',
      vendor_name: '',
      tags: [],
    });
    setSelectedExpense(null);
    setIsEditing(false);
  };

  // Edit expense
  const openEditModal = (expense) => {
    setFormData({
      title: expense.title || '',
      amount: expense.amount?.toString() || '',
      category: expense.category || 'other',
      expense_type: expense.expense_type || 'daily',
      store_id: expense.store_id || '',
      date: expense.date || new Date().toISOString().split('T')[0],
      description: expense.description || '',
      payment_method: expense.payment_method || 'cash',
      reference_number: expense.reference_number || '',
      vendor_name: expense.vendor_name || '',
      tags: expense.tags || [],
    });
    setSelectedExpense(expense);
    setIsEditing(true);
    setShowAddExpense(true);
  };

  // View expense
  const openViewModal = (expense) => {
    setSelectedExpense(expense);
    setShowViewExpense(true);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="expenditure-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-7 h-7 text-red-600" />
            Expenditure Management
          </h1>
          <p className="text-gray-500 mt-1">Track and manage your business expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchData} data-testid="refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={() => { resetForm(); setShowAddExpense(true); }}
            className="bg-red-600 hover:bg-red-700"
            data-testid="add-expense-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">Total Expenses</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_expenses)}</p>
                  <p className="text-red-200 text-xs mt-1">{summary.expense_count} transactions</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <TrendingDown className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_revenue)}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Net Profit</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.net_profit)}</p>
                  <p className={`text-xs mt-1 ${summary.net_profit >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                    {summary.net_profit >= 0 ? '+' : ''}{summary.profit_margin}% margin
                  </p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  {summary.net_profit >= 0 ? (
                    <ArrowUpRight className="w-6 h-6" />
                  ) : (
                    <ArrowDownRight className="w-6 h-6" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Avg Monthly</p>
                  <p className="text-2xl font-bold">{formatCurrency(trends?.avg_monthly || 0)}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>

            {/* Store Filter */}
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-[160px]" data-testid="store-filter">
                <Store className="w-4 h-4 mr-2 text-gray-500" />
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                <SelectItem value="global">Global Only</SelectItem>
                {stores.map(store => (
                  <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[160px]" data-testid="category-filter">
                <PieChart className="w-4 h-4 mr-2 text-gray-500" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(categories).map(([key, cat]) => (
                  <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[140px]" data-testid="type-filter">
                <Clock className="w-4 h-4 mr-2 text-gray-500" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EXPENSE_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Period Filter */}
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[130px]" data-testid="period-filter">
                <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 dark:bg-gray-800 p-1">
          <TabsTrigger value="overview" className="gap-2">
            <PieChart className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <Receipt className="w-4 h-4" />
            All Expenses
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-blue-600" />
                  Expenses by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary && Object.entries(summary.by_category || {}).map(([cat, data]) => {
                    const catInfo = categories[cat] || { name: cat, color: '#6B7280' };
                    const Icon = CATEGORY_ICONS[cat] || MoreHorizontal;
                    const percentage = summary.total_expenses > 0 
                      ? (data.total / summary.total_expenses * 100).toFixed(1) 
                      : 0;
                    
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: catInfo.color + '20' }}
                        >
                          <Icon className="w-5 h-5" style={{ color: catInfo.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-sm">{catInfo.name}</span>
                            <span className="font-semibold">{formatCurrency(data.total)}</span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: catInfo.color 
                              }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-gray-500">{data.count} expenses</span>
                            <span className="text-xs text-gray-500">{percentage}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!summary?.by_category || Object.keys(summary.by_category).length === 0) && (
                    <p className="text-center text-gray-500 py-8">No expenses recorded</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* By Store */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Store className="w-5 h-5 text-purple-600" />
                  Expenses by Store
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary && Object.entries(summary.by_store || {}).map(([storeId, data]) => {
                    const store = stores.find(s => s.id === storeId);
                    const storeName = storeId === 'global' ? 'Global Expenses' : (store?.name || storeId);
                    const percentage = summary.total_expenses > 0 
                      ? (data.total / summary.total_expenses * 100).toFixed(1) 
                      : 0;
                    
                    return (
                      <div key={storeId} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          {storeId === 'global' ? (
                            <Globe className="w-5 h-5 text-purple-600" />
                          ) : (
                            <Store className="w-5 h-5 text-purple-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-sm">{storeName}</span>
                            <span className="font-semibold">{formatCurrency(data.total)}</span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-gray-500">{data.count} expenses</span>
                            <span className="text-xs text-gray-500">{percentage}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!summary?.by_store || Object.keys(summary.by_store).length === 0) && (
                    <p className="text-center text-gray-500 py-8">No expenses recorded</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* By Type */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Expenses by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {EXPENSE_TYPES.map(type => {
                    const data = summary?.by_type?.[type.id] || { total: 0, count: 0 };
                    return (
                      <div 
                        key={type.id} 
                        className={`p-4 rounded-lg border ${data.count > 0 ? 'border-gray-200 dark:border-gray-700' : 'border-dashed border-gray-300 dark:border-gray-600'}`}
                      >
                        <Badge className={type.color}>{type.label}</Badge>
                        <p className="text-xl font-bold mt-2">{formatCurrency(data.total)}</p>
                        <p className="text-xs text-gray-500">{data.count} expenses</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* List Tab */}
        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium text-gray-500">Date</th>
                      <th className="text-left p-4 font-medium text-gray-500">Title</th>
                      <th className="text-left p-4 font-medium text-gray-500">Category</th>
                      <th className="text-left p-4 font-medium text-gray-500">Store</th>
                      <th className="text-left p-4 font-medium text-gray-500">Type</th>
                      <th className="text-right p-4 font-medium text-gray-500">Amount</th>
                      <th className="text-center p-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(expense => {
                      const Icon = CATEGORY_ICONS[expense.category] || MoreHorizontal;
                      const catInfo = categories[expense.category] || { name: expense.category, color: '#6B7280' };
                      const typeInfo = EXPENSE_TYPES.find(t => t.id === expense.expense_type);
                      
                      return (
                        <tr key={expense.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="p-4">
                            <span className="text-sm font-medium">{expense.date}</span>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{expense.title}</p>
                              {expense.vendor_name && (
                                <p className="text-xs text-gray-500">{expense.vendor_name}</p>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-8 h-8 rounded flex items-center justify-center"
                                style={{ backgroundColor: catInfo.color + '20' }}
                              >
                                <Icon className="w-4 h-4" style={{ color: catInfo.color }} />
                              </div>
                              <span className="text-sm">{catInfo.name}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {expense.store_id ? (
                                <>
                                  <Store className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm">{expense.store_name || 'Store'}</span>
                                </>
                              ) : (
                                <>
                                  <Globe className="w-4 h-4 text-purple-500" />
                                  <span className="text-sm text-purple-600">Global</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            {typeInfo && (
                              <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-semibold text-red-600">{formatCurrency(expense.amount)}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => openViewModal(expense)}
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => openEditModal(expense)}
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDelete(expense.id)}
                                className="text-red-500 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredExpenses.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-500">
                          <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No expenses found</p>
                          <Button 
                            variant="outline" 
                            className="mt-4"
                            onClick={() => { resetForm(); setShowAddExpense(true); }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add First Expense
                          </Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Monthly Expense Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trends?.trends?.map((month, idx) => {
                  const maxTotal = Math.max(...(trends.trends?.map(t => t.total) || [1]));
                  const percentage = (month.total / maxTotal * 100).toFixed(0);
                  
                  return (
                    <div key={month.month} className="flex items-center gap-4">
                      <span className="w-20 text-sm font-medium text-gray-600">{month.month}</span>
                      <div className="flex-1">
                        <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                          <div 
                            className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-lg transition-all flex items-center"
                            style={{ width: `${percentage}%` }}
                          >
                            <span className="text-white text-xs font-medium ml-2">
                              {formatCurrency(month.total)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="w-16 text-right text-sm text-gray-500">{month.count} exp</span>
                    </div>
                  );
                })}
                {(!trends?.trends || trends.trends.length === 0) && (
                  <p className="text-center text-gray-500 py-8">No trend data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Expense Modal */}
      <Dialog open={showAddExpense} onOpenChange={(open) => { if (!open) { resetForm(); } setShowAddExpense(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {isEditing ? 'Edit Expense' : 'Add New Expense'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Title *</Label>
                <Input
                  placeholder="Expense title..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  data-testid="expense-title"
                />
              </div>
              
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  data-testid="expense-amount"
                />
              </div>
              
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  data-testid="expense-date"
                />
              </div>
              
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger data-testid="expense-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categories).map(([key, cat]) => (
                      <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Expense Type</Label>
                <Select value={formData.expense_type} onValueChange={(v) => setFormData({ ...formData, expense_type: v })}>
                  <SelectTrigger data-testid="expense-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Store</Label>
                <Select value={formData.store_id || 'global'} onValueChange={(v) => setFormData({ ...formData, store_id: v === 'global' ? '' : v })}>
                  <SelectTrigger data-testid="expense-store">
                    <SelectValue placeholder="Global" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      <span className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-purple-500" />
                        Global (All Stores)
                      </span>
                    </SelectItem>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Payment Method</Label>
                <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                  <SelectTrigger data-testid="expense-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Vendor Name</Label>
                <Input
                  placeholder="Vendor or payee..."
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  data-testid="expense-vendor"
                />
              </div>
              
              <div>
                <Label>Reference Number</Label>
                <Input
                  placeholder="Invoice/receipt number..."
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  data-testid="expense-reference"
                />
              </div>
              
              <div className="col-span-2">
                <Label>Description</Label>
                <Input
                  placeholder="Additional details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="expense-description"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowAddExpense(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700" data-testid="save-expense-btn">
                {isEditing ? 'Update Expense' : 'Add Expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Expense Modal */}
      <Dialog open={showViewExpense} onOpenChange={setShowViewExpense}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Expense Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedExpense && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(selectedExpense.amount)}</p>
                </div>
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: (categories[selectedExpense.category]?.color || '#6B7280') + '20' }}
                >
                  {(() => {
                    const Icon = CATEGORY_ICONS[selectedExpense.category] || MoreHorizontal;
                    return <Icon className="w-6 h-6" style={{ color: categories[selectedExpense.category]?.color || '#6B7280' }} />;
                  })()}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Title</p>
                  <p className="font-medium">{selectedExpense.title}</p>
                </div>
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium">{selectedExpense.date}</p>
                </div>
                <div>
                  <p className="text-gray-500">Category</p>
                  <p className="font-medium">{categories[selectedExpense.category]?.name || selectedExpense.category}</p>
                </div>
                <div>
                  <p className="text-gray-500">Type</p>
                  <Badge className={EXPENSE_TYPES.find(t => t.id === selectedExpense.expense_type)?.color}>
                    {EXPENSE_TYPES.find(t => t.id === selectedExpense.expense_type)?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500">Store</p>
                  <p className="font-medium">{selectedExpense.store_name || 'Global'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Payment Method</p>
                  <p className="font-medium capitalize">{selectedExpense.payment_method?.replace('_', ' ')}</p>
                </div>
                {selectedExpense.vendor_name && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Vendor</p>
                    <p className="font-medium">{selectedExpense.vendor_name}</p>
                  </div>
                )}
                {selectedExpense.description && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Description</p>
                    <p className="font-medium">{selectedExpense.description}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-gray-500">Created</p>
                  <p className="font-medium text-xs">{selectedExpense.created_at} by {selectedExpense.created_by_name}</p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowViewExpense(false); openEditModal(selectedExpense); }}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" className="text-red-500" onClick={() => { handleDelete(selectedExpense.id); setShowViewExpense(false); }}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
