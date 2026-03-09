import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Zap, Bug, Gauge, RefreshCw, Play, CheckCircle, 
  XCircle, AlertTriangle, Clock, TrendingUp, Settings, 
  Sparkles, Layers, BarChart3, Shield, Code, FileCode, Power, Bell, BellRing,
  Globe, Server, Database, Terminal, GraduationCap, Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';

export default function AIAgentsDashboard({ api, user }) {
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [runningFullOptimization, setRunningFullOptimization] = useState(false);
  
  // Syntax notifications
  const [syntaxNotifications, setSyntaxNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  // Agent stats
  // NOTE: Avoid `null` initial state to prevent conditional UI (e.g. `stats && ...`)
  // from rendering nothing first and then "popping" in after fetch, which can look like a flash.
  // We already gate the whole dashboard with `loading`, so use safe default objects.
  const [blinkStats, setBlinkStats] = useState({});
  const [errorStats, setErrorStats] = useState({});
  const [perfStats, setPerfStats] = useState({});
  const [collabStats, setCollabStats] = useState({});
  const [syntaxStats, setSyntaxStats] = useState({});
  const [syntaxScanning, setSyntaxScanning] = useState(false);
  
  // Agent configs
  // Default to an object so UI bindings (e.g. `blinkAutoConfig.enabled`) don't flicker/flip between null and value.
  const [blinkAutoConfig, setBlinkAutoConfig] = useState({});
  
  // Recent activity
  const [recentFixes, setRecentFixes] = useState([]);
  
  // Runtime AutoFix Agent state
  const [runtimeStats, setRuntimeStats] = useState({});
  const [runtimeScanning, setRuntimeScanning] = useState(false);
  const [runtimeNotifications, setRuntimeNotifications] = useState([]);
  const [unreadRuntimeNotifs, setUnreadRuntimeNotifs] = useState(0);
  
  // Universal Error Fixer Agent state
  const [universalStats, setUniversalStats] = useState({});
  const [universalScanning, setUniversalScanning] = useState(false);
  const [universalNotifications, setUniversalNotifications] = useState([]);
  const [unreadUniversalNotifs, setUnreadUniversalNotifs] = useState(0);
  
  // 52 Error Fix Agent state
  const [errorFix52Stats, setErrorFix52Stats] = useState({});
  const [errorFix52Scanning, setErrorFix52Scanning] = useState(false);
  const [errorFix52Monitoring, setErrorFix52Monitoring] = useState(false);
  
  // Teach Pattern Modal state
  const [showTeachPatternModal, setShowTeachPatternModal] = useState(false);
  const [teachPatternLoading, setTeachPatternLoading] = useState(false);
  const [teachPatternForm, setTeachPatternForm] = useState({
    error_type: 'JS_SYNTAX_ERROR',
    error_name: '',
    error_message: '',
    category: 'JavaScript',
    severity: 'critical',
    file_path: '',
    fix_description: '',
    fix_code: '',
    fix_steps: ''
  });
  
  const fetchAllStats = useCallback(async () => {
    try {
      const [blink, error, perf, collab, blinkConfig, syntax, runtime, universal, errorFix52] = await Promise.all([
        api('/api/ui-blink/dashboard').catch(() => null),
        api('/api/error-autofix/dashboard').catch(() => null),
        api('/api/performance/dashboard').catch(() => null),
        api('/api/agent-collaboration/dashboard').catch(() => null),
        api('/api/ui-blink/auto-config').catch(() => null),
        api('/api/syntax-autofix/dashboard').catch(() => null),
        api('/api/runtime-autofix/dashboard').catch(() => null),
        api('/api/universal-fixer/dashboard').catch(() => null),
        api('/api/error-fix-52/dashboard').catch(() => null)
      ]);
      
      setBlinkStats(blink);
      setErrorStats(error);
      setPerfStats(perf);
      setCollabStats(collab);
      setBlinkAutoConfig(blinkConfig);
      setSyntaxStats(syntax || {});
      setRuntimeStats(runtime || {});
      setUniversalStats(universal || {});
      setErrorFix52Stats(errorFix52 || {});
      
      // Combine recent fixes from all agents
      const fixes = [];
      if (blink?.by_type) {
        Object.entries(blink.by_type).forEach(([type, count]) => {
          if (count > 0) {
            fixes.push({ type: 'ui_blink', category: type, count, agent: 'UI Blink' });
          }
        });
      }
      if (error?.by_category) {
        Object.entries(error.by_category).forEach(([cat, count]) => {
          if (count > 0) {
            fixes.push({ type: 'error', category: cat, count, agent: 'Error Fix' });
          }
        });
      }
      if (perf?.by_type) {
        Object.entries(perf.by_type).forEach(([type, count]) => {
          if (count > 0) {
            fixes.push({ type: 'perf', category: type, count, agent: 'Performance' });
          }
        });
      }
      setRecentFixes(fixes.slice(0, 10));
      
    } catch (err) {
      console.error('Failed to fetch agent stats:', err);
      toast.error('Failed to load agent statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);
  
  // Helper function to add syntax notifications
  const addSyntaxNotification = useCallback((type, title, message) => {
    const newNotif = {
      type, // 'success', 'error', 'info'
      title,
      message,
      time: new Date().toLocaleTimeString()
    };
    setSyntaxNotifications(prev => [newNotif, ...prev].slice(0, 20)); // Keep last 20
    setUnreadNotifications(prev => prev + 1);
  }, []);
  
  // Helper function to add runtime notifications
  const addRuntimeNotification = useCallback((type, title, message) => {
    const newNotif = {
      type,
      title,
      message,
      time: new Date().toLocaleTimeString()
    };
    setRuntimeNotifications(prev => [newNotif, ...prev].slice(0, 20));
    setUnreadRuntimeNotifs(prev => prev + 1);
  }, []);
  
  // Helper function to add universal fixer notifications
  const addUniversalNotification = useCallback((type, title, message) => {
    const newNotif = {
      type,
      title,
      message,
      time: new Date().toLocaleTimeString()
    };
    setUniversalNotifications(prev => [newNotif, ...prev].slice(0, 20));
    setUnreadUniversalNotifs(prev => prev + 1);
  }, []);

  // Proactive error monitoring - polls backend every 30 seconds for new errors
  const [proactiveMonitoringEnabled, setProactiveMonitoringEnabled] = useState(true);
  const [lastErrorCount, setLastErrorCount] = useState(0);
  
  useEffect(() => {
    if (!proactiveMonitoringEnabled) return;
    
    const checkForNewErrors = async () => {
      try {
        const stats = await api('/api/universal-fixer/dashboard').catch(() => null);
        if (stats) {
          const currentErrorCount = stats.stats?.total_errors || 0;
          const recentErrors = stats.recent_errors || [];
          
          // If new errors detected since last check
          if (currentErrorCount > lastErrorCount && recentErrors.length > 0) {
            const newErrorCount = currentErrorCount - lastErrorCount;
            const latestError = recentErrors[0];
            
            // Show toast notification for critical/high severity errors
            if (latestError.severity === 'critical' || latestError.severity === 'high') {
              toast.error(
                <div>
                  <p className="font-medium">Critical Error Detected!</p>
                  <p className="text-sm">{latestError.category?.replace('_', ' ').toUpperCase()}: {latestError.message?.substring(0, 50)}...</p>
                </div>,
                { duration: 8000 }
              );
            } else if (newErrorCount > 0) {
              toast.warning(
                <div>
                  <p className="font-medium">{newErrorCount} New Error{newErrorCount > 1 ? 's' : ''} Detected</p>
                  <p className="text-sm">Check the Universal Error Fixer for details</p>
                </div>,
                { duration: 5000 }
              );
            }
            
            // Add notification to bell icon
            addUniversalNotification(
              latestError.severity === 'critical' ? 'error' : 'warning',
              `${latestError.category?.replace('_', ' ').toUpperCase()} Detected`,
              `${latestError.message?.substring(0, 80)}${latestError.message?.length > 80 ? '...' : ''}`
            );
            
            // If fixes were auto-applied
            if (stats.stats?.fixes_applied > 0) {
              const fixCount = stats.recent_fixes?.filter(f => f.auto_applied)?.length || 0;
              if (fixCount > 0) {
                toast.success(
                  <div>
                    <p className="font-medium">Auto-Fix Applied!</p>
                    <p className="text-sm">{fixCount} error{fixCount > 1 ? 's' : ''} automatically fixed</p>
                  </div>,
                  { duration: 5000 }
                );
                addUniversalNotification('success', 'Auto-Fix Applied', `${fixCount} error${fixCount > 1 ? 's' : ''} automatically fixed`);
              }
            }
          }
          
          setLastErrorCount(currentErrorCount);
          setUniversalStats(stats);
        }
      } catch (err) {
        console.error('Proactive monitoring error:', err);
      }
    };
    
    // Initial check
    checkForNewErrors();
    
    // Set up polling interval (every 30 seconds)
    const pollInterval = setInterval(checkForNewErrors, 30000);
    
    return () => clearInterval(pollInterval);
  }, [proactiveMonitoringEnabled, lastErrorCount, addUniversalNotification]);
  
  useEffect(() => {
    fetchAllStats();
  }, [fetchAllStats]);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllStats();
    toast.success('Dashboard refreshed');
  };
  
  const handleFullOptimization = async () => {
    setRunningFullOptimization(true);
    try {
      // Run all optimizations in sequence
      toast.info('Starting full system optimization...');
      
      // 1. UI Blink scan
      toast.info('🔍 Scanning for UI issues...');
      await api('/api/ui-blink/scan');
      
      // 2. Error scan
      toast.info('🐛 Scanning for errors...');
      await api('/api/error-autofix/scan-all', { method: 'POST' });
      
      // 3. Performance optimization
      toast.info('⚡ Running performance optimization...');
      const perfResult = await api('/api/performance/full-optimization', { method: 'POST' });
      
      toast.success(`✅ Full optimization complete! Estimated improvement: ${perfResult?.total_improvement_ms || 0}ms`);
      
      // Refresh stats
      await fetchAllStats();
      
    } catch (err) {
      console.error('Full optimization failed:', err);
      toast.error('Optimization failed: ' + (err.message || 'Unknown error'));
    } finally {
      setRunningFullOptimization(false);
    }
  };
  
  const toggleAutoMode = async (enabled) => {
    try {
      await api(`/api/ui-blink/enable-auto?enable=${enabled}`, { method: 'POST' });
      setBlinkAutoConfig(prev => ({ ...prev, enabled }));
      toast.success(enabled ? 'Auto-fix mode enabled' : 'Auto-fix mode disabled');
    } catch (err) {
      toast.error('Failed to update auto-fix mode');
    }
  };
  
  // Calculate overall system health
  const calculateSystemHealth = () => {
    let score = 100;
    
    if (blinkStats?.pending_issues > 0) score -= Math.min(blinkStats.pending_issues * 2, 20);
    if (errorStats?.pending_errors > 0) score -= Math.min(errorStats.pending_errors * 3, 30);
    if (perfStats?.pending_issues > 0) score -= Math.min(perfStats.pending_issues, 20);
    
    return Math.max(0, Math.min(100, score));
  };
  
  const systemHealth = calculateSystemHealth();
  
  const getHealthColor = (health) => {
    if (health >= 80) return 'text-green-500';
    if (health >= 60) return 'text-yellow-500';
    if (health >= 40) return 'text-orange-500';
    return 'text-red-500';
  };
  
  const getHealthLabel = (health) => {
    if (health >= 80) return 'Excellent';
    if (health >= 60) return 'Good';
    if (health >= 40) return 'Needs Attention';
    return 'Critical';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ai-agents-dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            AI Agents Control Center
          </h1>
          <p className="text-muted-foreground">
            Monitor and control all AI agents from one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={handleFullOptimization}
            disabled={runningFullOptimization}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {runningFullOptimization ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Run Full Optimization
              </>
            )}
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Shield className={`w-8 h-8 ${getHealthColor(systemHealth)}`} />
                <div>
                  <p className="text-sm text-slate-400">System Health</p>
                  <p className={`text-3xl font-bold ${getHealthColor(systemHealth)}`}>
                    {systemHealth}%
                  </p>
                </div>
              </div>
              <p className="text-slate-400">
                Status: <span className={`font-semibold ${getHealthColor(systemHealth)}`}>
                  {getHealthLabel(systemHealth)}
                </span>
              </p>
            </div>
            
            <div className="flex-1">
              <Progress value={systemHealth} className="h-3 mb-3" />
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="text-slate-400">UI Issues</p>
                  <p className="text-xl font-bold text-amber-400">
                    {blinkStats?.pending_issues || 0}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Errors</p>
                  <p className="text-xl font-bold text-red-400">
                    {errorStats?.pending_errors || 0}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Perf Issues</p>
                  <p className="text-xl font-bold text-blue-400">
                    {perfStats?.pending_issues || 0}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-400" />
                  <Label htmlFor="auto-mode" className="text-white">Auto-Fix Mode</Label>
                </div>
                <Switch
                  id="auto-mode"
                  checked={blinkAutoConfig?.enabled || false}
                  onCheckedChange={toggleAutoMode}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                When enabled, safe fixes are applied automatically
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* UI Blink Agent */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              UI Blink Fix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Total Issues</span>
                <span className="font-bold">{blinkStats?.total_issues || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Fixed</span>
                <span className="font-bold text-green-500">{blinkStats?.fixed_issues || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Fix Rate</span>
                <Badge variant={blinkStats?.fix_rate >= 50 ? 'default' : 'secondary'}>
                  {(blinkStats?.fix_rate || 0).toFixed(0)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Auto-Fix Agent */}
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bug className="w-4 h-4 text-red-500" />
              Error Auto-Fix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Total Errors</span>
                <span className="font-bold">{errorStats?.total_errors || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Fixed</span>
                <span className="font-bold text-green-500">{errorStats?.fixed_errors || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Success Rate</span>
                <Badge variant={errorStats?.fix_success_rate >= 50 ? 'default' : 'secondary'}>
                  {(errorStats?.fix_success_rate || 0).toFixed(0)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Agent */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gauge className="w-4 h-4 text-blue-500" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Score</span>
                <span className="font-bold">{perfStats?.current_score || 0}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Optimized</span>
                <span className="font-bold text-green-500">{perfStats?.optimized_issues || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Potential Gain</span>
                <Badge variant="outline">
                  +{perfStats?.potential_improvement_ms || 0}ms
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collaboration Agent */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              Collaboration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Workflows</span>
                <span className="font-bold">{collabStats?.total_workflows || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Completed</span>
                <span className="font-bold text-green-500">{collabStats?.completed_executions || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Agents</span>
                <Badge variant="outline">
                  {collabStats?.agents_connected || 4}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Syntax AutoFix Agent */}
        <Card className="border-l-4 border-l-green-500 col-span-1 md:col-span-2 lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Code className="w-4 h-4 text-green-500" />
                Syntax AutoFix Agent
                <Badge variant="outline" className="ml-2 text-xs">
                  {syntaxStats?.model || 'Gemini 3 Flash'}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Notification Bell */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="relative">
                      {unreadNotifications > 0 ? (
                        <BellRing className="w-4 h-4 text-amber-500 animate-pulse" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                      {unreadNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Syntax Notifications</h4>
                        {syntaxNotifications.length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs h-6"
                            onClick={() => {
                              setSyntaxNotifications([]);
                              setUnreadNotifications(0);
                            }}
                          >
                            Clear All
                          </Button>
                        )}
                      </div>
                      {syntaxNotifications.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No notifications</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {syntaxNotifications.map((notif, idx) => (
                            <div 
                              key={idx} 
                              className={`p-2 rounded text-xs border ${
                                notif.type === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900/20' :
                                notif.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20' :
                                'bg-blue-50 border-blue-200 dark:bg-blue-900/20'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {notif.type === 'error' ? (
                                  <XCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                                ) : notif.type === 'success' ? (
                                  <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium">{notif.title}</p>
                                  <p className="text-muted-foreground">{notif.message}</p>
                                  <p className="text-muted-foreground mt-1">{notif.time}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Badge 
                  variant={syntaxStats?.is_monitoring ? 'default' : 'secondary'}
                  className={syntaxStats?.is_monitoring ? 'bg-green-500' : ''}
                >
                  {syntaxStats?.is_monitoring ? 'Monitoring' : 'Idle'}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={async () => {
                    try {
                      if (syntaxStats?.is_monitoring) {
                        await api('/api/syntax-autofix/stop-monitoring', { method: 'POST' });
                        toast.success('Syntax monitoring stopped');
                        addSyntaxNotification('info', 'Monitoring Stopped', 'Real-time syntax monitoring has been disabled');
                      } else {
                        await api('/api/syntax-autofix/start-monitoring?interval=30', { method: 'POST' });
                        toast.success('Syntax monitoring started (30s interval)');
                        addSyntaxNotification('success', 'Monitoring Started', 'Real-time syntax monitoring is now active (30s interval)');
                      }
                      await fetchAllStats();
                    } catch (err) {
                      toast.error('Failed to toggle monitoring');
                    }
                  }}
                >
                  <Power className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{syntaxStats?.stats?.total_scans || 0}</p>
                <p className="text-xs text-muted-foreground">Total Scans</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-red-500">{syntaxStats?.stats?.errors_detected || 0}</p>
                <p className="text-xs text-muted-foreground">Errors Found</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-green-500">{syntaxStats?.stats?.fixes_applied || 0}</p>
                <p className="text-xs text-muted-foreground">Auto-Fixed</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-blue-500">{syntaxStats?.stats?.frontend_errors || 0}</p>
                <p className="text-xs text-muted-foreground">JS/React Errors</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-amber-500">{syntaxStats?.stats?.backend_errors || 0}</p>
                <p className="text-xs text-muted-foreground">Python Errors</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button 
                size="sm" 
                onClick={async () => {
                  setSyntaxScanning(true);
                  toast.info('Scanning for syntax errors...', { duration: 2000 });
                  try {
                    const result = await api('/api/syntax-autofix/scan', { method: 'POST' });
                    if (result.total_errors === 0) {
                      toast.success('No syntax errors found! ✓', { duration: 4000 });
                      addSyntaxNotification('success', 'Scan Complete', 'No syntax errors detected in your codebase');
                    } else if (result.fixes_auto_applied > 0) {
                      toast.success(
                        <div>
                          <p className="font-medium">Syntax scan complete</p>
                          <p className="text-sm">Found {result.total_errors} errors, auto-fixed {result.fixes_auto_applied}</p>
                        </div>,
                        { duration: 5000 }
                      );
                      addSyntaxNotification('success', 'Errors Auto-Fixed', 
                        `Found ${result.total_errors} errors. Successfully auto-fixed ${result.fixes_auto_applied} errors.`);
                    } else {
                      toast.warning(
                        <div>
                          <p className="font-medium">Syntax errors detected</p>
                          <p className="text-sm">{result.total_errors} errors need manual review</p>
                        </div>,
                        { duration: 5000 }
                      );
                      addSyntaxNotification('error', 'Errors Detected', 
                        `Found ${result.total_errors} syntax errors. ${result.frontend_errors} JS/React, ${result.backend_errors} Python`);
                    }
                    await fetchAllStats();
                  } catch (err) {
                    toast.error('Scan failed: ' + (err.message || 'Unknown error'));
                    addSyntaxNotification('error', 'Scan Failed', err.message || 'Unknown error occurred');
                  } finally {
                    setSyntaxScanning(false);
                  }
                }}
                disabled={syntaxScanning}
                className="bg-green-600 hover:bg-green-700"
              >
                {syntaxScanning ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Scanning...</>
                ) : (
                  <><FileCode className="w-4 h-4 mr-2" /> Scan Now</>
                )}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={async () => {
                  setSyntaxScanning(true);
                  toast.info('Fixing all syntax errors...', { duration: 2000 });
                  try {
                    const result = await api('/api/syntax-autofix/fix-all', { method: 'POST' });
                    if (result.fixes_applied > 0) {
                      toast.success(
                        <div>
                          <p className="font-medium">Fixes Applied! ✓</p>
                          <p className="text-sm">{result.fixes_applied} syntax errors have been fixed</p>
                        </div>,
                        { duration: 5000 }
                      );
                      addSyntaxNotification('success', 'Auto-Fix Complete', 
                        `Successfully fixed ${result.fixes_applied} syntax errors`);
                    } else {
                      toast.info('No errors to fix', { duration: 3000 });
                    }
                    await fetchAllStats();
                  } catch (err) {
                    toast.error('Fix failed: ' + (err.message || 'Unknown error'));
                    addSyntaxNotification('error', 'Fix Failed', err.message || 'Unknown error occurred');
                  } finally {
                    setSyntaxScanning(false);
                  }
                }}
                disabled={syntaxScanning}
              >
                <Zap className="w-4 h-4 mr-2" /> Fix All Errors
              </Button>
            </div>
            
            {syntaxStats?.recent_errors?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Recent Errors:</p>
                <div className="space-y-1">
                  {syntaxStats.recent_errors.map((err, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-red-500/10 rounded">
                      <Badge variant="outline" className="text-xs">
                        {err.type === 'javascript' ? 'JS' : 'PY'}
                      </Badge>
                      <span className="text-muted-foreground">{err.file}:{err.line}</span>
                      <span className="truncate">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Runtime AutoFix Agent */}
        <Card className="border-l-4 border-l-orange-500 col-span-1 md:col-span-2 lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                Runtime AutoFix Agent
                <Badge variant="outline" className="ml-2 text-xs">
                  {runtimeStats?.model || 'Gemini 3 Flash'}
                </Badge>
                <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700">
                  Auto-Rollback
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Runtime Notification Bell */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="relative">
                      {unreadRuntimeNotifs > 0 ? (
                        <BellRing className="w-4 h-4 text-orange-500 animate-pulse" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                      {unreadRuntimeNotifs > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                          {unreadRuntimeNotifs > 9 ? '9+' : unreadRuntimeNotifs}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Runtime Notifications</h4>
                        {runtimeNotifications.length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs h-6"
                            onClick={() => {
                              setRuntimeNotifications([]);
                              setUnreadRuntimeNotifs(0);
                            }}
                          >
                            Clear All
                          </Button>
                        )}
                      </div>
                      {runtimeNotifications.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No notifications</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {runtimeNotifications.map((notif, idx) => (
                            <div 
                              key={idx} 
                              className={`p-2 rounded text-xs border ${
                                notif.type === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900/20' :
                                notif.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20' :
                                notif.type === 'rollback' ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20' :
                                'bg-blue-50 border-blue-200 dark:bg-blue-900/20'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {notif.type === 'error' ? (
                                  <XCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                                ) : notif.type === 'success' ? (
                                  <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                ) : notif.type === 'rollback' ? (
                                  <RefreshCw className="w-3 h-3 text-orange-500 mt-0.5 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium">{notif.title}</p>
                                  <p className="text-muted-foreground">{notif.message}</p>
                                  <p className="text-muted-foreground mt-1">{notif.time}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Badge 
                  variant={runtimeStats?.is_monitoring ? 'default' : 'secondary'}
                  className={runtimeStats?.is_monitoring ? 'bg-orange-500' : ''}
                >
                  {runtimeStats?.is_monitoring ? 'Monitoring' : 'Idle'}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={async () => {
                    try {
                      if (runtimeStats?.is_monitoring) {
                        await api('/api/runtime-autofix/stop-monitoring', { method: 'POST' });
                        toast.success('Runtime monitoring stopped');
                        addRuntimeNotification('info', 'Monitoring Stopped', 'Real-time runtime error monitoring has been disabled');
                      } else {
                        await api('/api/runtime-autofix/start-monitoring?interval=30', { method: 'POST' });
                        toast.success('Runtime monitoring started (30s interval)');
                        addRuntimeNotification('success', 'Monitoring Started', 'Real-time runtime error monitoring is now active');
                      }
                      await fetchAllStats();
                    } catch (err) {
                      toast.error('Failed to toggle monitoring');
                    }
                  }}
                >
                  <Power className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{runtimeStats?.stats?.total_errors_detected || 0}</p>
                <p className="text-xs text-muted-foreground">Total Errors</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-blue-500">{runtimeStats?.stats?.frontend_errors || 0}</p>
                <p className="text-xs text-muted-foreground">Frontend</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-purple-500">{runtimeStats?.stats?.backend_errors || 0}</p>
                <p className="text-xs text-muted-foreground">Backend</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-green-500">{runtimeStats?.stats?.fixes_applied || 0}</p>
                <p className="text-xs text-muted-foreground">Fixed</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-orange-500">{runtimeStats?.stats?.fixes_rolled_back || 0}</p>
                <p className="text-xs text-muted-foreground">Rolled Back</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-emerald-500">{(runtimeStats?.stats?.auto_fix_success_rate || 0).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button 
                size="sm" 
                onClick={async () => {
                  setRuntimeScanning(true);
                  toast.info('Scanning for runtime errors...', { duration: 2000 });
                  try {
                    const result = await api('/api/runtime-autofix/scan', { method: 'POST' });
                    if (result.total_errors === 0) {
                      toast.success('No runtime errors found! ✓', { duration: 4000 });
                      addRuntimeNotification('success', 'Scan Complete', 'No runtime errors detected in logs');
                    } else if (result.fixes_auto_applied > 0) {
                      toast.success(
                        <div>
                          <p className="font-medium">Runtime scan complete</p>
                          <p className="text-sm">Found {result.total_errors} errors, auto-fixed {result.fixes_auto_applied}</p>
                        </div>,
                        { duration: 5000 }
                      );
                      addRuntimeNotification('success', 'Errors Auto-Fixed', 
                        `Found ${result.total_errors} errors. Auto-fixed ${result.fixes_auto_applied} with rollback available.`);
                    } else if (result.total_errors > 0) {
                      toast.warning(
                        <div>
                          <p className="font-medium">Runtime errors detected</p>
                          <p className="text-sm">{result.total_errors} errors need attention</p>
                        </div>,
                        { duration: 5000 }
                      );
                      addRuntimeNotification('error', 'Errors Detected', 
                        `Found ${result.total_errors} runtime errors (${result.new_frontend_errors} frontend, ${result.new_backend_errors} backend)`);
                    }
                    await fetchAllStats();
                  } catch (err) {
                    toast.error('Scan failed: ' + (err.message || 'Unknown error'));
                    addRuntimeNotification('error', 'Scan Failed', err.message || 'Unknown error occurred');
                  } finally {
                    setRuntimeScanning(false);
                  }
                }}
                disabled={runtimeScanning}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {runtimeScanning ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Scanning...</>
                ) : (
                  <><Bug className="w-4 h-4 mr-2" /> Scan Logs</>
                )}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={async () => {
                  try {
                    await api('/api/runtime-autofix/clear-errors', { method: 'POST' });
                    toast.success('Error history cleared');
                    await fetchAllStats();
                  } catch (err) {
                    toast.error('Failed to clear errors');
                  }
                }}
              >
                <XCircle className="w-4 h-4 mr-2" /> Clear History
              </Button>
            </div>
            
            {/* Recent Runtime Errors */}
            {runtimeStats?.recent_errors?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Recent Runtime Errors:</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {runtimeStats.recent_errors.slice(0, 5).map((err, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 bg-red-500/10 rounded border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge variant="outline" className={`text-xs flex-shrink-0 ${
                          err.type === 'frontend' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {err.type === 'frontend' ? 'JS' : 'PY'}
                        </Badge>
                        <Badge variant="outline" className={`text-xs flex-shrink-0 ${
                          err.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {err.severity}
                        </Badge>
                        <span className="text-muted-foreground truncate">{err.file}:{err.line}</span>
                        <span className="truncate flex-1">{err.message}</span>
                      </div>
                      <Badge variant="secondary" className="ml-2 flex-shrink-0">×{err.occurrences}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Applied Fixes with Rollback */}
            {runtimeStats?.recent_fixes?.filter(f => f.can_rollback).length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Applied Fixes (can rollback):</p>
                <div className="space-y-2">
                  {runtimeStats.recent_fixes.filter(f => f.can_rollback).slice(0, 3).map((fix, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 bg-green-500/10 rounded border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 flex-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-muted-foreground">{fix.file}</span>
                        <span className="truncate">{fix.explanation}</span>
                        <Badge variant="outline" className="text-xs">{(fix.confidence * 100).toFixed(0)}%</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                        onClick={async () => {
                          try {
                            await api(`/api/runtime-autofix/rollback/${fix.id}`, { method: 'POST' });
                            toast.success('Fix rolled back successfully');
                            addRuntimeNotification('rollback', 'Fix Rolled Back', `Rolled back fix for ${fix.file}`);
                            await fetchAllStats();
                          } catch (err) {
                            toast.error('Failed to rollback');
                          }
                        }}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Rollback
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Universal Error Fixer Agent */}
        <Card className="border-l-4 border-l-purple-600 col-span-1 md:col-span-2 lg:col-span-4" data-testid="universal-fixer-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-600" />
                Universal Error Fixer Agent
                <Badge variant="outline" className="ml-2 text-xs">
                  {universalStats?.model || 'Gemini 3 Flash'}
                </Badge>
                <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">
                  Full Auto-Fix
                </Badge>
                {proactiveMonitoringEnabled && (
                  <Badge variant="default" className="text-xs bg-green-500 animate-pulse">
                    Proactive
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Proactive Monitoring Toggle */}
                <Button
                  variant={proactiveMonitoringEnabled ? "default" : "outline"}
                  size="sm"
                  className={`text-xs h-7 ${proactiveMonitoringEnabled ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  onClick={() => {
                    setProactiveMonitoringEnabled(!proactiveMonitoringEnabled);
                    if (!proactiveMonitoringEnabled) {
                      toast.success('Proactive monitoring enabled - checking for errors every 30s');
                    } else {
                      toast.info('Proactive monitoring disabled');
                    }
                  }}
                  data-testid="proactive-monitoring-toggle"
                  title={proactiveMonitoringEnabled ? 'Disable proactive monitoring' : 'Enable proactive monitoring'}
                >
                  {proactiveMonitoringEnabled ? (
                    <>
                      <Activity className="w-3 h-3 mr-1 animate-pulse" />
                      Watching
                    </>
                  ) : (
                    <>
                      <Activity className="w-3 h-3 mr-1" />
                      Watch
                    </>
                  )}
                </Button>
                
                {/* Universal Notification Bell */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="relative" data-testid="universal-notifications-btn">
                      {unreadUniversalNotifs > 0 ? (
                        <BellRing className="w-4 h-4 text-purple-500 animate-pulse" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                      {unreadUniversalNotifs > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
                          {unreadUniversalNotifs > 9 ? '9+' : unreadUniversalNotifs}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Universal Fixer Notifications</h4>
                        {universalNotifications.length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs h-6"
                            onClick={() => {
                              setUniversalNotifications([]);
                              setUnreadUniversalNotifs(0);
                            }}
                          >
                            Clear All
                          </Button>
                        )}
                      </div>
                      {universalNotifications.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No notifications</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {universalNotifications.map((notif, idx) => (
                            <div 
                              key={idx} 
                              className={`p-2 rounded text-xs border ${
                                notif.type === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900/20' :
                                notif.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20' :
                                notif.type === 'rollback' ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20' :
                                'bg-blue-50 border-blue-200 dark:bg-blue-900/20'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {notif.type === 'error' ? (
                                  <XCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                                ) : notif.type === 'success' ? (
                                  <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                ) : notif.type === 'rollback' ? (
                                  <RefreshCw className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium">{notif.title}</p>
                                  <p className="text-muted-foreground">{notif.message}</p>
                                  <p className="text-muted-foreground mt-1">{notif.time}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Badge 
                  variant={universalStats?.is_monitoring ? 'default' : 'secondary'}
                  className={universalStats?.is_monitoring ? 'bg-purple-500' : ''}
                >
                  {universalStats?.is_monitoring ? 'Monitoring' : 'Idle'}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  data-testid="universal-toggle-monitoring-btn"
                  onClick={async () => {
                    try {
                      if (universalStats?.is_monitoring) {
                        await api('/api/universal-fixer/stop-monitoring', { method: 'POST' });
                        toast.success('Universal monitoring stopped');
                        addUniversalNotification('info', 'Monitoring Stopped', 'Universal error monitoring has been disabled');
                      } else {
                        await api('/api/universal-fixer/start-monitoring?interval=30', { method: 'POST' });
                        toast.success('Universal monitoring started (30s interval)');
                        addUniversalNotification('success', 'Monitoring Started', 'Universal error monitoring is now active');
                      }
                      await fetchAllStats();
                    } catch (err) {
                      toast.error('Failed to toggle monitoring');
                    }
                  }}
                >
                  <Power className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs mt-1">
              Handles 404/502, Runtime, Logic, TypeError, Systematic & Random Errors with full auto-fix
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Error Categories Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="text-center p-3 bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-lg border border-red-200/30">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Server className="w-3 h-3 text-red-500" />
                  <p className="text-lg font-bold text-red-500">{universalStats?.stats?.by_category?.http_404 || 0}</p>
                </div>
                <p className="text-xs text-muted-foreground">404 Errors</p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-lg border border-orange-200/30">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="w-3 h-3 text-orange-500" />
                  <p className="text-lg font-bold text-orange-500">{universalStats?.stats?.by_category?.http_502 || 0}</p>
                </div>
                <p className="text-xs text-muted-foreground">502 Errors</p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg border border-blue-200/30">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Bug className="w-3 h-3 text-blue-500" />
                  <p className="text-lg font-bold text-blue-500">{universalStats?.stats?.by_category?.runtime || 0}</p>
                </div>
                <p className="text-xs text-muted-foreground">Runtime</p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-lg border border-amber-200/30">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Terminal className="w-3 h-3 text-amber-500" />
                  <p className="text-lg font-bold text-amber-500">{universalStats?.stats?.by_category?.type_error || 0}</p>
                </div>
                <p className="text-xs text-muted-foreground">TypeError</p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-lg border border-purple-200/30">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Database className="w-3 h-3 text-purple-500" />
                  <p className="text-lg font-bold text-purple-500">{universalStats?.stats?.by_category?.systematic || 0}</p>
                </div>
                <p className="text-xs text-muted-foreground">Systematic</p>
              </div>
            </div>
            
            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{universalStats?.stats?.total_errors || 0}</p>
                <p className="text-xs text-muted-foreground">Total Errors</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-green-500">{universalStats?.stats?.fixes_applied || 0}</p>
                <p className="text-xs text-muted-foreground">Auto-Fixed</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-blue-500">{universalStats?.stats?.fixes_verified || 0}</p>
                <p className="text-xs text-muted-foreground">Verified</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-emerald-500">{(universalStats?.stats?.auto_fix_rate || 0).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                size="sm"
                data-testid="universal-scan-btn"
                onClick={async () => {
                  setUniversalScanning(true);
                  toast.info('Scanning for all error types...', { duration: 2000 });
                  try {
                    const result = await api('/api/universal-fixer/scan', { method: 'POST' });
                    if (result.errors?.total === 0) {
                      toast.success('No errors found! System is healthy ✓', { duration: 4000 });
                      addUniversalNotification('success', 'Scan Complete', 'No errors detected in your application');
                    } else if (result.fixes?.auto_applied > 0) {
                      toast.success(
                        <div>
                          <p className="font-medium">Universal scan complete</p>
                          <p className="text-sm">Found {result.errors?.total} errors, auto-fixed {result.fixes?.auto_applied}</p>
                        </div>,
                        { duration: 5000 }
                      );
                      addUniversalNotification('success', 'Errors Auto-Fixed', 
                        `Found ${result.errors?.total} errors. Auto-fixed ${result.fixes?.auto_applied} with rollback available.`);
                    } else if (result.errors?.total > 0) {
                      toast.warning(
                        <div>
                          <p className="font-medium">Errors detected</p>
                          <p className="text-sm">{result.errors?.total} errors found ({result.errors?.http} HTTP, {result.errors?.runtime} runtime)</p>
                        </div>,
                        { duration: 5000 }
                      );
                      addUniversalNotification('error', 'Errors Detected', 
                        `Found ${result.errors?.total} errors: ${result.errors?.http} HTTP, ${result.errors?.runtime} runtime, ${result.errors?.systematic} systematic`);
                    }
                    await fetchAllStats();
                  } catch (err) {
                    toast.error('Scan failed: ' + (err.message || 'Unknown error'));
                    addUniversalNotification('error', 'Scan Failed', err.message || 'Unknown error occurred');
                  } finally {
                    setUniversalScanning(false);
                  }
                }}
                disabled={universalScanning}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {universalScanning ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Scanning...</>
                ) : (
                  <><Globe className="w-4 h-4 mr-2" /> Full Scan</>
                )}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                data-testid="universal-clear-btn"
                onClick={async () => {
                  try {
                    await api('/api/universal-fixer/clear', { method: 'POST' });
                    toast.success('Error history cleared');
                    await fetchAllStats();
                  } catch (err) {
                    toast.error('Failed to clear errors');
                  }
                }}
              >
                <XCircle className="w-4 h-4 mr-2" /> Clear History
              </Button>
            </div>
            
            {/* Recent Errors */}
            {universalStats?.recent_errors?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Recent Errors:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {universalStats.recent_errors.slice(0, 6).map((err, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 bg-red-500/10 rounded border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge variant="outline" className={`text-xs flex-shrink-0 ${
                          err.category === 'http_404' ? 'bg-red-100 text-red-700' :
                          err.category === 'http_502' ? 'bg-orange-100 text-orange-700' :
                          err.category === 'runtime' ? 'bg-blue-100 text-blue-700' :
                          err.category === 'type_error' ? 'bg-amber-100 text-amber-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {err.category?.replace('_', ' ').toUpperCase() || 'ERROR'}
                        </Badge>
                        <Badge variant="outline" className={`text-xs flex-shrink-0 ${
                          err.severity === 'critical' ? 'bg-red-100 text-red-700' : 
                          err.severity === 'high' ? 'bg-orange-100 text-orange-700' : 
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {err.severity}
                        </Badge>
                        <span className="text-muted-foreground truncate">{err.file}:{err.line}</span>
                        <span className="truncate flex-1">{err.message}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {err.is_systematic && (
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">Systematic</Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">×{err.occurrences}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Recent Fixes with Rollback */}
            {universalStats?.recent_fixes?.filter(f => f.can_rollback).length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Applied Fixes (can rollback):</p>
                <div className="space-y-2">
                  {universalStats.recent_fixes.filter(f => f.can_rollback).slice(0, 3).map((fix, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 bg-green-500/10 rounded border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 flex-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <Badge variant="outline" className="text-xs">{fix.category?.replace('_', ' ')}</Badge>
                        <span className="truncate">{fix.explanation}</span>
                        <Badge variant="outline" className="text-xs">{(fix.confidence * 100).toFixed(0)}%</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                        onClick={async () => {
                          try {
                            await api(`/api/universal-fixer/rollback/${fix.id}`, { method: 'POST' });
                            toast.success('Fix rolled back successfully');
                            addUniversalNotification('rollback', 'Fix Rolled Back', `Rolled back fix for ${fix.category}`);
                            await fetchAllStats();
                          } catch (err) {
                            toast.error('Failed to rollback');
                          }
                        }}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Rollback
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 52 Error Fix AI Agent */}
        <Card className="border-l-4 border-l-emerald-600 col-span-1 md:col-span-2 lg:col-span-4" data-testid="error-fix-52-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                52 Error Fix AI Agent
                <Badge variant="outline" className="ml-2 text-xs bg-emerald-100 text-emerald-700">
                  52 Types
                </Badge>
                <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700">
                  Full Auto-Fix
                </Badge>
                <Badge variant="outline" className="text-xs bg-cyan-100 text-cyan-700">
                  Pattern Learning
                </Badge>
                {errorFix52Monitoring && (
                  <Badge variant="default" className="text-xs bg-green-500 animate-pulse">
                    Monitoring
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={errorFix52Monitoring ? "default" : "outline"}
                  size="sm"
                  className={`text-xs h-7 ${errorFix52Monitoring ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  onClick={async () => {
                    try {
                      if (!errorFix52Monitoring) {
                        await api('/api/error-fix-52/start-monitoring', { method: 'POST' });
                        setErrorFix52Monitoring(true);
                        toast.success('Monitoring started - scanning every 60s');
                      } else {
                        await api('/api/error-fix-52/stop-monitoring', { method: 'POST' });
                        setErrorFix52Monitoring(false);
                        toast.info('Monitoring stopped');
                      }
                    } catch (err) {
                      toast.error('Failed to toggle monitoring');
                    }
                  }}
                  data-testid="error-fix-52-monitoring-toggle"
                >
                  {errorFix52Monitoring ? (
                    <><Activity className="w-3 h-3 mr-1 animate-pulse" /> Monitoring</>
                  ) : (
                    <><Activity className="w-3 h-3 mr-1" /> Monitor</>
                  )}
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs mt-1">
              Comprehensive detection & auto-fix for HTTP, JavaScript, React, Python, Database & API errors
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Category Stats - 6 Categories */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
              <div className="text-center p-2 bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-lg border border-red-200/30">
                <p className="text-lg font-bold text-red-500">{errorFix52Stats?.by_category?.HTTP || 0}</p>
                <p className="text-xs text-muted-foreground">HTTP</p>
              </div>
              <div className="text-center p-2 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 rounded-lg border border-yellow-200/30">
                <p className="text-lg font-bold text-yellow-600">{errorFix52Stats?.by_category?.JavaScript || 0}</p>
                <p className="text-xs text-muted-foreground">JavaScript</p>
              </div>
              <div className="text-center p-2 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg border border-blue-200/30">
                <p className="text-lg font-bold text-blue-500">{errorFix52Stats?.by_category?.React || 0}</p>
                <p className="text-xs text-muted-foreground">React</p>
              </div>
              <div className="text-center p-2 bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-lg border border-green-200/30">
                <p className="text-lg font-bold text-green-500">{errorFix52Stats?.by_category?.Python || 0}</p>
                <p className="text-xs text-muted-foreground">Python</p>
              </div>
              <div className="text-center p-2 bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-lg border border-purple-200/30">
                <p className="text-lg font-bold text-purple-500">{errorFix52Stats?.by_category?.Database || 0}</p>
                <p className="text-xs text-muted-foreground">Database</p>
              </div>
              <div className="text-center p-2 bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-lg border border-orange-200/30">
                <p className="text-lg font-bold text-orange-500">{errorFix52Stats?.by_category?.API || 0}</p>
                <p className="text-xs text-muted-foreground">API</p>
              </div>
            </div>
            
            {/* Severity Stats */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200">
                <p className="text-lg font-bold text-red-600">{errorFix52Stats?.critical || 0}</p>
                <p className="text-xs text-red-600">Critical</p>
              </div>
              <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200">
                <p className="text-lg font-bold text-orange-600">{errorFix52Stats?.high || 0}</p>
                <p className="text-xs text-orange-600">High</p>
              </div>
              <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
                <p className="text-lg font-bold text-yellow-600">{errorFix52Stats?.medium || 0}</p>
                <p className="text-xs text-yellow-600">Medium</p>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200">
                <p className="text-lg font-bold text-gray-600">{errorFix52Stats?.low || 0}</p>
                <p className="text-xs text-gray-600">Low</p>
              </div>
            </div>
            
            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{errorFix52Stats?.total_errors || 0}</p>
                <p className="text-xs text-muted-foreground">Total Errors</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-yellow-500">{errorFix52Stats?.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-green-500">{errorFix52Stats?.fixed || 0}</p>
                <p className="text-xs text-muted-foreground">Fixed</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-emerald-500">{errorFix52Stats?.auto_fixed || 0}</p>
                <p className="text-xs text-muted-foreground">Auto-Fixed</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <Progress value={errorFix52Stats?.success_rate || 0} className="h-2 mb-1" />
                <p className="text-lg font-bold text-emerald-500">{errorFix52Stats?.success_rate || 0}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
            
            {/* Top Error Types */}
            {errorFix52Stats?.top_errors?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Top Error Types:</p>
                <div className="flex flex-wrap gap-2">
                  {errorFix52Stats.top_errors.slice(0, 8).map((err, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {err.type?.replace('_', ' ')}: {err.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                data-testid="error-fix-52-scan-btn"
                onClick={async () => {
                  setErrorFix52Scanning(true);
                  try {
                    const result = await api('/api/error-fix-52/scan', { method: 'POST' });
                    if (result.errors_found > 0) {
                      toast.success(`Found ${result.errors_found} errors, reported ${result.errors_reported} for auto-fix`);
                    } else {
                      toast.info('No new errors found');
                    }
                    await fetchAllStats();
                  } catch (err) {
                    toast.error('Scan failed: ' + (err.message || 'Unknown error'));
                  } finally {
                    setErrorFix52Scanning(false);
                  }
                }}
                disabled={errorFix52Scanning}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {errorFix52Scanning ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Scanning...</>
                ) : (
                  <><Shield className="w-4 h-4 mr-2" /> Scan All 52 Types</>
                )}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                data-testid="error-fix-52-clear-btn"
                onClick={async () => {
                  try {
                    const result = await api('/api/error-fix-52/clear', { method: 'DELETE' });
                    toast.success(`Cleared ${result.deleted} errors`);
                    await fetchAllStats();
                  } catch (err) {
                    toast.error('Failed to clear errors');
                  }
                }}
              >
                <XCircle className="w-4 h-4 mr-2" /> Clear History
              </Button>
            </div>
            
            {/* Supported Types Badge */}
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">Supports {errorFix52Stats?.supported_types || 52} Error Types</span>
                </div>
                <div className="flex gap-1">
                  <Badge className="text-xs bg-red-100 text-red-700">10 HTTP</Badge>
                  <Badge className="text-xs bg-yellow-100 text-yellow-700">10 JS</Badge>
                  <Badge className="text-xs bg-blue-100 text-blue-700">8 React</Badge>
                  <Badge className="text-xs bg-green-100 text-green-700">10 Python</Badge>
                  <Badge className="text-xs bg-purple-100 text-purple-700">7 DB</Badge>
                  <Badge className="text-xs bg-orange-100 text-orange-700">7 API</Badge>
                </div>
              </div>
            </div>
            
            {/* Pattern Learning Stats - NEW */}
            <div className="mt-3 p-3 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg border border-cyan-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-600" />
                  <span className="text-sm font-medium text-cyan-700">Error Pattern Learning</span>
                  {errorFix52Stats?.learning?.learning_enabled && (
                    <Badge className="text-xs bg-cyan-100 text-cyan-700">Active</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-6 text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-0 hover:from-purple-600 hover:to-indigo-600"
                    onClick={() => setShowTeachPatternModal(true)}
                    data-testid="teach-pattern-btn"
                  >
                    <GraduationCap className="w-3 h-3 mr-1" />
                    Teach Pattern
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-6 text-xs text-cyan-600 hover:text-cyan-700 hover:bg-cyan-100"
                    onClick={async () => {
                      try {
                        const result = await api('/api/error-fix-52/patterns', { method: 'DELETE' });
                        toast.success(`Cleared ${result.deleted} learned patterns`);
                        await fetchAllStats();
                      } catch (err) {
                        toast.error('Failed to clear patterns');
                      }
                    }}
                  >
                    Clear Patterns
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-white dark:bg-gray-800 rounded border">
                  <p className="text-xl font-bold text-cyan-600">{errorFix52Stats?.learning?.total_patterns_learned || 0}</p>
                  <p className="text-xs text-muted-foreground">Patterns Learned</p>
                </div>
                <div className="text-center p-2 bg-white dark:bg-gray-800 rounded border">
                  <p className="text-xl font-bold text-green-600">{errorFix52Stats?.learning?.high_confidence_patterns || 0}</p>
                  <p className="text-xs text-muted-foreground">High Confidence</p>
                </div>
                <div className="text-center p-2 bg-white dark:bg-gray-800 rounded border">
                  <p className="text-xl font-bold text-blue-600">{errorFix52Stats?.learning?.fixes_from_patterns || 0}</p>
                  <p className="text-xs text-muted-foreground">Pattern-Based Fixes</p>
                </div>
              </div>
              <p className="text-xs text-cyan-600 mt-2">
                Agent automatically learns from successful fixes to improve future auto-fix accuracy
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="issues" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="issues">Issues Overview</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
          <TabsTrigger value="history">Recent Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="issues" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Issue breakdown by type */}
            {recentFixes.map((fix, idx) => (
              <Card key={idx} className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {fix.type === 'ui_blink' && <Activity className="w-4 h-4 text-amber-500" />}
                      {fix.type === 'error' && <Bug className="w-4 h-4 text-red-500" />}
                      {fix.type === 'perf' && <Gauge className="w-4 h-4 text-blue-500" />}
                      <span className="text-sm font-medium capitalize">
                        {fix.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <Badge variant="secondary">{fix.count}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    From {fix.agent} Agent
                  </p>
                </CardContent>
              </Card>
            ))}
            {recentFixes.length === 0 && (
              <Card className="col-span-3 bg-muted/30">
                <CardContent className="py-8 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                  <p className="text-muted-foreground">No issues detected! System is healthy.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="actions" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={async () => {
                toast.info('Scanning for UI issues...');
                await api('/api/ui-blink/scan');
                await fetchAllStats();
                toast.success('UI scan complete');
              }}
            >
              <Activity className="w-6 h-6 text-amber-500" />
              <span>Scan UI Issues</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={async () => {
                toast.info('Scanning for errors...');
                await api('/api/error-autofix/scan-all', { method: 'POST' });
                await fetchAllStats();
                toast.success('Error scan complete');
              }}
            >
              <Bug className="w-6 h-6 text-red-500" />
              <span>Scan All Errors</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={async () => {
                toast.info('Analyzing performance...');
                await api('/api/performance/analyze');
                await fetchAllStats();
                toast.success('Performance analysis complete');
              }}
            >
              <Gauge className="w-6 h-6 text-blue-500" />
              <span>Analyze Performance</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={async () => {
                toast.info('Running code splitting...');
                const result = await api('/api/performance/code-splitting', { method: 'POST' });
                await fetchAllStats();
                toast.success(`Code split ${result?.components_split || 0} components`);
              }}
            >
              <Zap className="w-6 h-6 text-purple-500" />
              <span>Apply Code Splitting</span>
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Agent Activity</CardTitle>
              <CardDescription>Last actions performed by AI agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {blinkStats?.fixed_issues > 0 && (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">UI Blink Fix Agent</p>
                      <p className="text-xs text-muted-foreground">
                        Fixed {blinkStats.fixed_issues} UI issues ({blinkStats.fix_rate?.toFixed(0)}% rate)
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">Active</Badge>
                  </div>
                )}
                
                {errorStats?.fixed_errors > 0 && (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Error Auto-Fix Agent</p>
                      <p className="text-xs text-muted-foreground">
                        Fixed {errorStats.fixed_errors} errors
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">Active</Badge>
                  </div>
                )}
                
                {perfStats?.optimized_issues > 0 && (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Performance Agent</p>
                      <p className="text-xs text-muted-foreground">
                        Applied {perfStats.optimized_issues} optimizations
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">Active</Badge>
                  </div>
                )}
                
                {(!blinkStats?.fixed_issues && !errorStats?.fixed_errors && !perfStats?.optimized_issues) && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No recent activity. Run a scan to get started!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Teach Error Pattern Modal */}
      <Dialog open={showTeachPatternModal} onOpenChange={setShowTeachPatternModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-600" />
              Teach Error Pattern to AI Agent
            </DialogTitle>
            <DialogDescription>
              Manually teach the AI agent how to recognize and fix specific error patterns. High confidence patterns are applied automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Error Type & Category Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="error_type">Error Type</Label>
                <Select 
                  value={teachPatternForm.error_type} 
                  onValueChange={(value) => setTeachPatternForm(prev => ({ ...prev, error_type: value }))}
                >
                  <SelectTrigger data-testid="teach-error-type">
                    <SelectValue placeholder="Select error type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JS_SYNTAX_ERROR">JS Syntax Error</SelectItem>
                    <SelectItem value="JS_TYPE_ERROR">JS Type Error</SelectItem>
                    <SelectItem value="JS_REFERENCE_ERROR">JS Reference Error</SelectItem>
                    <SelectItem value="REACT_HOOKS">React Hooks Error</SelectItem>
                    <SelectItem value="REACT_RENDER">React Render Error</SelectItem>
                    <SelectItem value="REACT_STATE">React State Error</SelectItem>
                    <SelectItem value="PY_IMPORT_ERROR">Python Import Error</SelectItem>
                    <SelectItem value="PY_TYPE_ERROR">Python Type Error</SelectItem>
                    <SelectItem value="PY_ATTRIBUTE_ERROR">Python Attribute Error</SelectItem>
                    <SelectItem value="DB_CONNECTION">Database Connection Error</SelectItem>
                    <SelectItem value="DB_QUERY">Database Query Error</SelectItem>
                    <SelectItem value="HTTP_500">HTTP 500 Error</SelectItem>
                    <SelectItem value="HTTP_404">HTTP 404 Error</SelectItem>
                    <SelectItem value="API_AUTH">API Auth Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={teachPatternForm.category} 
                  onValueChange={(value) => setTeachPatternForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger data-testid="teach-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JavaScript">JavaScript</SelectItem>
                    <SelectItem value="React">React</SelectItem>
                    <SelectItem value="Python">Python</SelectItem>
                    <SelectItem value="Database">Database</SelectItem>
                    <SelectItem value="HTTP">HTTP</SelectItem>
                    <SelectItem value="API">API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Error Name & Severity Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="error_name">Error Name</Label>
                <Input 
                  id="error_name"
                  placeholder="e.g., Duplicate Variable Declaration"
                  value={teachPatternForm.error_name}
                  onChange={(e) => setTeachPatternForm(prev => ({ ...prev, error_name: e.target.value }))}
                  data-testid="teach-error-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select 
                  value={teachPatternForm.severity} 
                  onValueChange={(value) => setTeachPatternForm(prev => ({ ...prev, severity: value }))}
                >
                  <SelectTrigger data-testid="teach-severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Error Message */}
            <div className="space-y-2">
              <Label htmlFor="error_message">Error Message (for pattern matching)</Label>
              <Textarea 
                id="error_message"
                placeholder="e.g., SyntaxError: Identifier 'displayCurrency' has already been declared"
                value={teachPatternForm.error_message}
                onChange={(e) => setTeachPatternForm(prev => ({ ...prev, error_message: e.target.value }))}
                className="min-h-[60px]"
                data-testid="teach-error-message"
              />
              <p className="text-xs text-muted-foreground">The AI will match future errors against this message pattern</p>
            </div>
            
            {/* File Path */}
            <div className="space-y-2">
              <Label htmlFor="file_path">File Path (optional)</Label>
              <Input 
                id="file_path"
                placeholder="e.g., frontend/src/pages/POSPage.js"
                value={teachPatternForm.file_path}
                onChange={(e) => setTeachPatternForm(prev => ({ ...prev, file_path: e.target.value }))}
                data-testid="teach-file-path"
              />
            </div>
            
            {/* Fix Description */}
            <div className="space-y-2">
              <Label htmlFor="fix_description">Fix Description</Label>
              <Textarea 
                id="fix_description"
                placeholder="Describe how to fix this error..."
                value={teachPatternForm.fix_description}
                onChange={(e) => setTeachPatternForm(prev => ({ ...prev, fix_description: e.target.value }))}
                className="min-h-[80px]"
                data-testid="teach-fix-description"
              />
            </div>
            
            {/* Fix Code */}
            <div className="space-y-2">
              <Label htmlFor="fix_code">Fix Code (optional)</Label>
              <Textarea 
                id="fix_code"
                placeholder="// Code example showing the fix..."
                value={teachPatternForm.fix_code}
                onChange={(e) => setTeachPatternForm(prev => ({ ...prev, fix_code: e.target.value }))}
                className="min-h-[80px] font-mono text-sm"
                data-testid="teach-fix-code"
              />
            </div>
            
            {/* Fix Steps */}
            <div className="space-y-2">
              <Label htmlFor="fix_steps">Fix Steps (one per line)</Label>
              <Textarea 
                id="fix_steps"
                placeholder="Step 1: Locate the duplicate declaration&#10;Step 2: Remove the duplicate&#10;Step 3: Verify the build succeeds"
                value={teachPatternForm.fix_steps}
                onChange={(e) => setTeachPatternForm(prev => ({ ...prev, fix_steps: e.target.value }))}
                className="min-h-[80px]"
                data-testid="teach-fix-steps"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowTeachPatternModal(false)}
            >
              Cancel
            </Button>
            <Button 
              className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
              disabled={teachPatternLoading || !teachPatternForm.error_message || !teachPatternForm.fix_description}
              onClick={async () => {
                setTeachPatternLoading(true);
                try {
                  const payload = {
                    ...teachPatternForm,
                    fix_steps: teachPatternForm.fix_steps.split('\n').filter(s => s.trim())
                  };
                  const result = await api('/api/error-fix-52/teach-pattern', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                  });
                  
                  if (result.status === 'created') {
                    toast.success('New pattern created successfully!');
                  } else if (result.status === 'updated') {
                    toast.success('Pattern updated successfully!');
                  } else {
                    toast.error(result.message || 'Failed to teach pattern');
                  }
                  
                  setShowTeachPatternModal(false);
                  setTeachPatternForm({
                    error_type: 'JS_SYNTAX_ERROR',
                    error_name: '',
                    error_message: '',
                    category: 'JavaScript',
                    severity: 'critical',
                    file_path: '',
                    fix_description: '',
                    fix_code: '',
                    fix_steps: ''
                  });
                  await fetchAllStats();
                } catch (err) {
                  toast.error('Failed to teach pattern: ' + (err.message || 'Unknown error'));
                } finally {
                  setTeachPatternLoading(false);
                }
              }}
              data-testid="teach-pattern-submit"
            >
              {teachPatternLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Teaching...
                </>
              ) : (
                <>
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Teach AI Agent
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
