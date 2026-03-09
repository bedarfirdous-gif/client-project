import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  AlertTriangle, Bug, CheckCircle, Clock, RefreshCw, Search, Filter,
  TrendingUp, TrendingDown, Eye, Wrench, XCircle, Bell, BellOff,
  ChevronDown, ChevronRight, Zap, Shield, Database, Globe, Server,
  Code, AlertCircle, Activity, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Progress } from '../components/ui/progress';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';

// Error category icons and colors
const CATEGORY_CONFIG = {
  syntax: { icon: Code, color: '#ef4444', label: 'Syntax' },
  build_compile: { icon: Wrench, color: '#f97316', label: 'Build/Compile' },
  runtime: { icon: Zap, color: '#eab308', label: 'Runtime' },
  logical: { icon: Bug, color: '#84cc16', label: 'Logical' },
  system: { icon: Server, color: '#22c55e', label: 'System' },
  application_flow: { icon: Activity, color: '#14b8a6', label: 'App Flow' },
  user_input: { icon: AlertCircle, color: '#06b6d4', label: 'User Input' },
  api: { icon: Globe, color: '#0ea5e9', label: 'API' },
  http_network: { icon: Globe, color: '#3b82f6', label: 'HTTP/Network' },
  database: { icon: Database, color: '#6366f1', label: 'Database' },
  security: { icon: Shield, color: '#8b5cf6', label: 'Security' },
  performance: { icon: TrendingUp, color: '#a855f7', label: 'Performance' },
  configuration: { icon: Wrench, color: '#d946ef', label: 'Configuration' },
  integration: { icon: Zap, color: '#ec4899', label: 'Integration' },
  unknown: { icon: AlertTriangle, color: '#6b7280', label: 'Unknown' }
};

const SEVERITY_CONFIG = {
  critical: { color: '#dc2626', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-400', label: 'Critical' },
  high: { color: '#ea580c', bgColor: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-700 dark:text-orange-400', label: 'High' },
  medium: { color: '#ca8a04', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', textColor: 'text-yellow-700 dark:text-yellow-400', label: 'Medium' },
  low: { color: '#16a34a', bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-400', label: 'Low' },
  info: { color: '#0284c7', bgColor: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-400', label: 'Info' }
};

const SOURCE_CONFIG = {
  frontend: { icon: Globe, color: '#3b82f6', label: 'Frontend' },
  backend: { icon: Server, color: '#8b5cf6', label: 'Backend' },
  database: { icon: Database, color: '#6366f1', label: 'Database' },
  api: { icon: Zap, color: '#f59e0b', label: 'API' },
  integration: { icon: Globe, color: '#ec4899', label: 'Integration' },
  system: { icon: Server, color: '#6b7280', label: 'System' }
};

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

export default function ErrorMonitoringDashboard() {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState(false);

  // FIX: Avoid null initial state (can cause a render "flash" when UI switches from null->data)
  // Keep a stable initial shape + explicit loaded flags.
  const [stats, setStats] = useState({});
  const [isStatsLoaded, setIsStatsLoaded] = useState(false);

  const [errors, setErrors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('7');
  
  // Modals
  // FIX: Avoid initializing with `undefined` because many UI checks treat it differently than `null`
  // and can briefly render the wrong branch until the selection is set, causing flicker.
  // Use a stable sentinel (`null`) + the existing `isSelectedErrorLoaded` flag to control rendering.
  const [selectedError, setSelectedError] = useState(null);
  const [isSelectedErrorLoaded, setIsSelectedErrorLoaded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Actions
  const [processing, setProcessing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api(`/api/superadmin/errors/stats?days=${dateRange}`);
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch error stats:', err);
    }
  }, [api, dateRange]);

  const fetchErrors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (sourceFilter !== 'all') params.append('source', sourceFilter);
      if (resolvedFilter !== 'all') params.append('is_resolved', resolvedFilter === 'resolved');
      if (searchQuery) params.append('search', searchQuery);
      params.append('limit', '100');
      
      const data = await api(`/api/superadmin/errors?${params}`);
      setErrors(data.errors || []);
    } catch (err) {
      console.error('Failed to fetch errors:', err);
    } finally {
      setLoading(false);
    }
  }, [api, categoryFilter, severityFilter, sourceFilter, resolvedFilter, searchQuery]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api('/api/superadmin/errors/notifications/list');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [api]);

  useEffect(() => {
    fetchStats();
    fetchErrors();
    fetchNotifications();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchErrors();
      fetchNotifications();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchStats, fetchErrors, fetchNotifications]);

  const handleApplyFix = async (errorId) => {
    setProcessing(true);
    try {
      await api(`/api/superadmin/errors/${errorId}/fix`, { method: 'POST' });
      toast.success('Fix applied successfully');
      fetchErrors();
      fetchStats();
    } catch (err) {
      toast.error('Failed to apply fix');
    } finally {
      setProcessing(false);
    }
  };

  const handleAcknowledge = async (errorId) => {
    setProcessing(true);
    try {
      await api(`/api/superadmin/errors/${errorId}/acknowledge`, { method: 'POST' });
      toast.success('Error acknowledged');
      fetchErrors();
    } catch (err) {
      toast.error('Failed to acknowledge error');
    } finally {
      setProcessing(false);
    }
  };

  const handleIgnore = async (errorId) => {
    setProcessing(true);
    try {
      await api(`/api/superadmin/errors/${errorId}/ignore`, { method: 'POST' });
      toast.success('Error ignored');
      fetchErrors();
      fetchStats();
    } catch (err) {
      toast.error('Failed to ignore error');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await api(`/api/superadmin/errors/notifications/${notificationId}/read`, { method: 'POST' });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api('/api/superadmin/errors/notifications/read-all', { method: 'POST' });
      fetchNotifications();
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark notifications as read');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const getCategoryIcon = (category) => {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.unknown;
    const Icon = config.icon;
    return <Icon className="w-4 h-4" style={{ color: config.color }} />;
  };

  const getSeverityBadge = (severity) => {
    const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;
    return (
      <Badge className={`${config.bgColor} ${config.textColor} border-0`}>
        {config.label}
      </Badge>
    );
  };

  // Prepare chart data
  const categoryChartData = stats?.by_category ? 
    Object.entries(stats.by_category).map(([name, value], index) => ({
      name: CATEGORY_CONFIG[name]?.label || name,
      value,
      color: CATEGORY_CONFIG[name]?.color || CHART_COLORS[index % CHART_COLORS.length]
    })) : [];

  const sourceChartData = stats?.by_source ?
    Object.entries(stats.by_source).map(([name, value], index) => ({
      name: SOURCE_CONFIG[name]?.label || name,
      value,
      color: SOURCE_CONFIG[name]?.color || CHART_COLORS[index % CHART_COLORS.length]
    })) : [];

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Notifications */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Error Monitoring</h2>
          <p className="text-muted-foreground">AI-powered error detection, classification & auto-fix</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24h</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => { fetchStats(); fetchErrors(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            className="relative"
            onClick={() => setShowNotifications(true)}
          >
            <Bell className="w-4 h-4 mr-2" />
            Alerts
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Errors</p>
                <p className="text-2xl font-bold">{stats?.total_errors || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 dark:text-red-400">Critical</p>
                <p className="text-2xl font-bold text-red-600">{stats?.critical_count || 0}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 dark:text-orange-400">High</p>
                <p className="text-2xl font-bold text-orange-600">{stats?.high_count || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">Medium</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.medium_count || 0}</p>
              </div>
              <Bug className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{stats?.resolved_count || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400">Auto-Fixed</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.auto_fixed_count || 0}</p>
              </div>
              <Wrench className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Error Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.trend_data || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Area type="monotone" dataKey="count" name="Total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              By Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search errors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error List */}
      <Card>
        <CardHeader>
          <CardTitle>Error Log</CardTitle>
          <CardDescription>Click on an error to view details and AI analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Severity</TableHead>
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead className="w-[100px]">Source</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-[80px]">Count</TableHead>
                  <TableHead className="w-[140px]">Last Seen</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                      No errors found. System is running smoothly!
                    </TableCell>
                  </TableRow>
                ) : (
                  errors.map((error) => (
                    <TableRow 
                      key={error.id} 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setSelectedError(error)}
                    >
                      <TableCell>{getSeverityBadge(error.severity)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(error.category)}
                          <span className="text-xs">{CATEGORY_CONFIG[error.category]?.label || error.category}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_CONFIG[error.source]?.label || error.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate font-mono text-xs">
                        {error.message}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{error.occurrence_count}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(error.last_seen)}
                      </TableCell>
                      <TableCell>
                        {error.is_resolved ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Resolved
                          </Badge>
                        ) : error.is_acknowledged ? (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Acknowledged
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={(e) => { e.stopPropagation(); setSelectedError(error); }}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          {!error.is_resolved && (
                            <>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleApplyFix(error.id); }}
                                disabled={processing}
                              >
                                <Wrench className="w-3 h-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleIgnore(error.id); }}
                                disabled={processing}
                              >
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Error Detail Modal */}
      <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedError && getCategoryIcon(selectedError.category)}
              Error Details
            </DialogTitle>
            <DialogDescription>
              AI-powered analysis and fix suggestions
            </DialogDescription>
          </DialogHeader>
          
          {selectedError && (
            <div className="space-y-4">
              {/* Error Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Severity</Label>
                  <div className="mt-1">{getSeverityBadge(selectedError.severity)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <div className="mt-1 flex items-center gap-2">
                    {getCategoryIcon(selectedError.category)}
                    {CATEGORY_CONFIG[selectedError.category]?.label || selectedError.category}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Source</Label>
                  <div className="mt-1">{SOURCE_CONFIG[selectedError.source]?.label || selectedError.source}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Occurrences</Label>
                  <div className="mt-1">{selectedError.occurrence_count}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">First Seen</Label>
                  <div className="mt-1 text-sm">{formatDate(selectedError.first_seen)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Seen</Label>
                  <div className="mt-1 text-sm">{formatDate(selectedError.last_seen)}</div>
                </div>
              </div>
              
              {/* Error Message */}
              <div>
                <Label className="text-muted-foreground">Error Message</Label>
                <div className="mt-1 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg font-mono text-sm text-red-700 dark:text-red-300">
                  {selectedError.message}
                </div>
              </div>
              
              {/* Stack Trace */}
              {selectedError.stack_trace && (
                <div>
                  <Label className="text-muted-foreground">Stack Trace</Label>
                  <ScrollArea className="h-32 mt-1">
                    <pre className="p-3 bg-muted rounded-lg font-mono text-xs whitespace-pre-wrap">
                      {selectedError.stack_trace}
                    </pre>
                  </ScrollArea>
                </div>
              )}
              
              {/* AI Analysis */}
              {selectedError.ai_analysis && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    AI Analysis
                  </Label>
                  <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                    {selectedError.ai_analysis}
                  </div>
                </div>
              )}
              
              {/* Root Cause */}
              {selectedError.root_cause && (
                <div>
                  <Label className="text-muted-foreground">Root Cause</Label>
                  <div className="mt-1 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm">
                    {selectedError.root_cause}
                  </div>
                </div>
              )}
              
              {/* Suggested Fix */}
              {selectedError.suggested_fix && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-green-500" />
                    Suggested Fix
                  </Label>
                  <div className="mt-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm">
                    {selectedError.suggested_fix}
                  </div>
                </div>
              )}
              
              {/* Fix Code */}
              {selectedError.fix_code && (
                <div>
                  <Label className="text-muted-foreground">Fix Code</Label>
                  <ScrollArea className="h-32 mt-1">
                    <pre className="p-3 bg-muted rounded-lg font-mono text-xs whitespace-pre-wrap">
                      {selectedError.fix_code}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            {selectedError && !selectedError.is_resolved && (
              <>
                <Button variant="outline" onClick={() => handleIgnore(selectedError.id)} disabled={processing}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Ignore
                </Button>
                <Button variant="outline" onClick={() => handleAcknowledge(selectedError.id)} disabled={processing}>
                  <Eye className="w-4 h-4 mr-2" />
                  Acknowledge
                </Button>
                <Button onClick={() => handleApplyFix(selectedError.id)} disabled={processing}>
                  <Wrench className="w-4 h-4 mr-2" />
                  Apply Fix
                </Button>
              </>
            )}
            {selectedError?.is_resolved && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="w-4 h-4 mr-2" />
                Resolved by {selectedError.fix_applied_by || 'System'}
              </Badge>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications Modal */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Error Alerts
            </DialogTitle>
            <DialogDescription>
              Critical and high severity error notifications
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <BellOff className="w-12 h-12 mb-2" />
                <p>No unread notifications</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className="p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80"
                    onClick={() => handleMarkNotificationRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${SEVERITY_CONFIG[notification.severity]?.bgColor}`}>
                        <AlertTriangle className={`w-4 h-4 ${SEVERITY_CONFIG[notification.severity]?.textColor}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(notification.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          {notifications.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={handleMarkAllRead}>
                Mark All as Read
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
