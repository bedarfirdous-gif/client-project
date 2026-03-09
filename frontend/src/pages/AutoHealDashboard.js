import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Shield,
  Zap,
  TrendingUp,
  Clock,
  Bell,
  Search,
  PlayCircle,
  FileText,
  Bot,
  Power,
  Trash2,
  Eye,
  Wrench,
  Cpu,
  Database,
  Server,
  Lock,
  Unlock,
  RotateCcw,
  Brain,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

export default function AutoHealDashboard() {
  const { api, user, token } = useAuth();
  // Initialize with a stable, non-null shape to prevent UI from rendering a "null -> data" transition
  // that can cause a brief visual flash in components that read stats fields.
  const [stats, setStats] = useState({});
  const [interval, setInterval] = useState(false);
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('real-agent'); // Default to Real Agent tab
  const [diagnosisInput, setDiagnosisInput] = useState({
    error_message: '',
    module: '',
    context: ''
  });
  const [diagnosing, setDiagnosing] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [realtimeEvents, setRealtimeEvents] = useState([]);
  const wsRef = useRef(null);
  
  // Real AutoHeal Agent state
  const [realAgentStats, setRealAgentStats] = useState(null);
  const [realAgentErrors, setRealAgentErrors] = useState([]);
  const [realAgentFixes, setRealAgentFixes] = useState([]);
  const [realAgentLoading, setRealAgentLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  // Enterprise Self-Healing System state
  const [enterpriseDashboard, setEnterpriseDashboard] = useState(null);
  const [enterpriseLoading, setEnterpriseLoading] = useState(false);
  const [criticalModules, setCriticalModules] = useState([]);
  const [rollbackStats, setRollbackStats] = useState(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!user?.id || !token) return;
    
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const wsUrl = backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws/${user.id}?token=${token}&tenant_id=${user.tenant_id || 'default'}&user_name=${encodeURIComponent(user.name || '')}`);
    
    ws.onopen = () => {
      console.log('AutoHeal WebSocket connected');
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };
    
    ws.onclose = () => {
      console.log('AutoHeal WebSocket disconnected');
      setWsConnected(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    wsRef.current = ws;
    
    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    
    return () => {
      clearInterval(pingInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [user?.id, token]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (message) => {
    const { type, data, timestamp } = message;
    
    switch (type) {
      case 'autoheal_error_detected':
        toast.error(`Error Detected: ${data.error_type || 'Unknown'}`);
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: 'error',
          message: data.message || 'New error detected',
          timestamp
        }, ...prev.slice(0, 19)]);
        fetchData(); // Refresh data
        break;
        
      case 'autoheal_healing_started':
        toast.info(`Healing Started: ${data.action || 'Auto-healing'}`);
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: 'healing',
          message: `Healing: ${data.action || 'In progress'}`,
          timestamp
        }, ...prev.slice(0, 19)]);
        break;
        
      case 'autoheal_healing_complete':
        if (data.success) {
          toast.success(`Healed: ${data.action || 'Issue resolved'}`);
        } else {
          toast.error(`Healing Failed: ${data.error || 'Could not resolve'}`);
        }
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: data.success ? 'success' : 'failed',
          message: data.success ? 'Issue resolved' : 'Healing failed',
          timestamp
        }, ...prev.slice(0, 19)]);
        fetchData(); // Refresh data
        break;
        
      case 'autoheal_stats_update':
        setStats(prev => ({ ...prev, ...data }));
        break;
        
      case 'autoheal_new_alert':
        toast.warning(`New Alert: ${data.message || 'Check dashboard'}`);
        setAlerts(prev => [data, ...prev]);
        break;
        
      case 'autoheal_system_health':
        // Update health metrics
        setStats(prev => prev ? { ...prev, health: data } : prev);
        break;
      
      // Enterprise Self-Healing WebSocket events
      case 'self_heal_error_detected':
        toast.error(`Self-Heal: Error Detected - ${data.error_type || 'Unknown'}`, { 
          description: data.error_message?.substring(0, 100) 
        });
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: 'self_heal_error',
          message: `[Enterprise] Error detected: ${data.error_type}`,
          operation_id: data.operation_id,
          timestamp
        }, ...prev.slice(0, 19)]);
        if (activeTab === 'enterprise') fetchEnterpriseDashboard();
        break;
        
      case 'self_heal_fix_generating':
        toast.info('Self-Heal: AI Generating Fix (GPT-5.2)', {
          description: data.using_ai ? 'Using AI for patch generation' : 'Using pattern matching'
        });
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: 'self_heal_generating',
          message: `[Enterprise] Generating fix...`,
          operation_id: data.operation_id,
          timestamp
        }, ...prev.slice(0, 19)]);
        break;
        
      case 'self_heal_fix_testing':
        toast.info('Self-Heal: Testing Fix in Sandbox', {
          description: data.fix_description
        });
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: 'self_heal_testing',
          message: `[Enterprise] Testing: ${data.fix_description}`,
          operation_id: data.operation_id,
          timestamp
        }, ...prev.slice(0, 19)]);
        break;
        
      case 'self_heal_deploying':
        toast.warning('Self-Heal: Deploying Fix', {
          description: `Deploying to ${data.file_path}`
        });
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: 'self_heal_deploying',
          message: `[Enterprise] Deploying fix...`,
          operation_id: data.operation_id,
          timestamp
        }, ...prev.slice(0, 19)]);
        break;
        
      case 'self_heal_completed':
        toast.success('Self-Heal: Fix Deployed Successfully!', {
          description: data.fix_description
        });
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: 'self_heal_success',
          message: `[Enterprise] Fixed: ${data.fix_description}`,
          operation_id: data.operation_id,
          timestamp
        }, ...prev.slice(0, 19)]);
        if (activeTab === 'enterprise') fetchEnterpriseDashboard();
        break;
        
      case 'self_heal_failed':
        toast.error(`Self-Heal: Failed at ${data.step}`, {
          description: data.reason
        });
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: 'self_heal_failed',
          message: `[Enterprise] Failed: ${data.reason}`,
          operation_id: data.operation_id,
          timestamp
        }, ...prev.slice(0, 19)]);
        if (activeTab === 'enterprise') fetchEnterpriseDashboard();
        break;
        
      case 'self_heal_blocked':
        toast.warning('Self-Heal: Auto-Fix Blocked', {
          description: `Protected module: ${data.reason}`
        });
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: 'self_heal_blocked',
          message: `[Enterprise] Blocked: ${data.reason}`,
          operation_id: data.operation_id,
          timestamp
        }, ...prev.slice(0, 19)]);
        break;
        
      case 'self_heal_rollback':
        toast.warning('Self-Heal: Rollback Triggered', {
          description: 'A recent fix has been reverted'
        });
        setRealtimeEvents(prev => [{
          id: Date.now(),
          type: 'self_heal_rollback',
          message: `[Enterprise] Rollback triggered`,
          timestamp
        }, ...prev.slice(0, 19)]);
        if (activeTab === 'enterprise') fetchEnterpriseDashboard();
        break;
        
      case 'self_heal_health_update':
        // Update enterprise dashboard health data
        setEnterpriseDashboard(prev => prev ? { 
          ...prev, 
          system_health: data 
        } : prev);
        break;
        
      default:
        // Handle other message types
        break;
    }
  };

  useEffect(() => {
    fetchData();
    fetchRealAgentData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, reportsData, alertsData] = await Promise.all([
        api('/api/autoheal/stats'),
        api('/api/autoheal/reports?limit=20'),
        api('/api/autoheal/alerts?acknowledged=false&limit=10')
      ]);
      setStats(statsData);
      setReports(reportsData);
      setAlerts(alertsData);
    } catch (err) {
      toast.error('Failed to load AutoHeal data');
    } finally {
      setLoading(false);
    }
  };

  // Real AutoHeal Agent functions
  const fetchRealAgentData = async () => {
    try {
      setRealAgentLoading(true);
      const [dashboardData, errorsData, fixesData] = await Promise.all([
        api('/api/real-autoheal/dashboard'),
        api('/api/real-autoheal/errors?limit=50'),
        api('/api/real-autoheal/fixes?limit=50')
      ]);
      setRealAgentStats(dashboardData);
      setRealAgentErrors(errorsData.errors || []);
      setRealAgentFixes(fixesData.fixes || []);
    } catch (err) {
      console.error('Failed to load Real Agent data:', err);
    } finally {
      setRealAgentLoading(false);
    }
  };

  const triggerScan = async () => {
    try {
      setScanning(true);
      const result = await api('/api/real-autoheal/scan', { method: 'POST' });
      toast.success(`Scan complete: ${result.errors_detected} errors detected, ${result.fixes_successful} fixed`);
      fetchRealAgentData();
    } catch (err) {
      toast.error('Scan failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const toggleMonitoring = async () => {
    try {
      if (realAgentStats?.monitoring_active) {
        await api('/api/real-autoheal/stop-monitoring', { method: 'POST' });
        toast.success('Monitoring stopped');
      } else {
        await api('/api/real-autoheal/start-monitoring?interval=30', { method: 'POST' });
        toast.success('Monitoring started (30s interval)');
      }
      fetchRealAgentData();
    } catch (err) {
      toast.error('Failed to toggle monitoring: ' + err.message);
    }
  };

  const clearHistory = async () => {
    try {
      await api('/api/real-autoheal/clear', { method: 'DELETE' });
      toast.success('History cleared');
      fetchRealAgentData();
    } catch (err) {
      toast.error('Failed to clear history: ' + err.message);
    }
  };

  const fixSpecificError = async (errorId) => {
    try {
      const result = await api(`/api/real-autoheal/fix-error/${errorId}`, { method: 'POST' });
      if (result.status === 'verified') {
        toast.success(`Fix applied: ${result.description}`);
      } else {
        toast.warning(`Fix attempted: ${result.verification_details || result.status}`);
      }
      fetchRealAgentData();
    } catch (err) {
      toast.error('Fix failed: ' + err.message);
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await api(`/api/autoheal/alerts/${alertId}/acknowledge`, { method: 'PUT' });
      toast.success('Alert acknowledged');
      fetchData();
    } catch (err) {
      toast.error('Failed to acknowledge alert');
    }
  };

  const runDiagnosis = async () => {
    if (!diagnosisInput.error_message.trim()) {
      toast.error('Please enter an error message');
      return;
    }

    try {
      setDiagnosing(true);
      const result = await api('/api/autoheal/diagnose', {
        method: 'POST',
        body: JSON.stringify({
          error_message: diagnosisInput.error_message,
          module: diagnosisInput.module || 'manual',
          context: diagnosisInput.context ? JSON.parse(diagnosisInput.context) : {}
        })
      });
      
      toast.success(`Diagnosis complete: ${result.resolved ? 'Issue resolved!' : 'Analysis complete'}`);
      fetchData();
      setDiagnosisInput({ error_message: '', module: '', context: '' });
    } catch (err) {
      toast.error('Diagnosis failed: ' + err.message);
    } finally {
      setDiagnosing(false);
    }
  };

  // Enterprise Self-Healing System functions
  const fetchEnterpriseDashboard = async () => {
    try {
      setEnterpriseLoading(true);
      const [dashboardData, modulesData, rollbackData] = await Promise.all([
        api('/api/self-healing/dashboard'),
        api('/api/self-healing/critical-modules'),
        api('/api/self-healing/rollback-stats')
      ]);
      setEnterpriseDashboard(dashboardData);
      setCriticalModules(modulesData.modules || []);
      setRollbackStats(rollbackData);
    } catch (err) {
      console.error('Failed to load Enterprise Self-Healing data:', err);
    } finally {
      setEnterpriseLoading(false);
    }
  };

  const toggleAutoHeal = async (enabled) => {
    try {
      await api(`/api/self-healing/toggle-auto-heal?enabled=${enabled}`, { method: 'POST' });
      toast.success(`Auto-heal ${enabled ? 'enabled' : 'disabled'}`);
      fetchEnterpriseDashboard();
    } catch (err) {
      toast.error('Failed to toggle auto-heal: ' + err.message);
    }
  };

  const triggerManualRollback = async (fixId) => {
    try {
      const result = await api(`/api/self-healing/rollback/${fixId}?reason=Manual rollback from dashboard`, { method: 'POST' });
      if (result.success) {
        toast.success('Rollback successful');
      } else {
        toast.warning('Rollback attempted: ' + (result.verification_result || result.status));
      }
      fetchEnterpriseDashboard();
    } catch (err) {
      toast.error('Rollback failed: ' + err.message);
    }
  };

  const getHealthStatusColor = (status) => {
    const colors = {
      healthy: 'text-green-500',
      degraded: 'text-yellow-500',
      unhealthy: 'text-red-500'
    };
    return colors[status] || 'text-gray-500';
  };

  const getHealthStatusBadge = (status) => {
    const colors = {
      healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      unhealthy: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    return colors[severity] || colors.medium;
  };

  const getStatusIcon = (resolved, escalated) => {
    if (resolved) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (escalated) return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="autoheal-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            AutoHeal AI Dashboard
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Self-healing software agent monitoring
            {wsConnected ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-50 text-gray-600">
                Offline
              </Badge>
            )}
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Real-time Events Bar */}
      {realtimeEvents.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
              <span className="text-sm font-medium">Real-time Activity:</span>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-3 animate-marquee">
                  {realtimeEvents.slice(0, 5).map(event => (
                    <Badge 
                      key={event.id} 
                      variant="outline"
                      className={`
                        ${event.type === 'error' ? 'bg-red-100 text-red-700' : ''}
                        ${event.type === 'healing' ? 'bg-yellow-100 text-yellow-700' : ''}
                        ${event.type === 'success' ? 'bg-green-100 text-green-700' : ''}
                        ${event.type === 'failed' ? 'bg-orange-100 text-orange-700' : ''}
                      `}
                    >
                      {event.message}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today's Errors</p>
                  <p className="text-3xl font-bold">{stats.today.total_errors}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Auto-Resolved</p>
                  <p className="text-3xl font-bold text-green-600">{stats.today.auto_resolved}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolution Rate</p>
                  <p className="text-3xl font-bold">{stats.today.resolution_rate}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Alerts</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.pending_alerts}</p>
                </div>
                <Bell className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(tab) => {
        setActiveTab(tab);
        if (tab === 'enterprise' && !enterpriseDashboard) {
          fetchEnterpriseDashboard();
        }
      }}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="real-agent" className="flex items-center gap-1">
            <Bot className="w-4 h-4" />
            Real Agent
          </TabsTrigger>
          <TabsTrigger value="enterprise" className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            Enterprise
          </TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({alerts.length})</TabsTrigger>
          <TabsTrigger value="diagnose">Manual Diagnosis</TabsTrigger>
        </TabsList>

        {/* Real AutoHeal Agent Tab */}
        <TabsContent value="real-agent" className="space-y-4">
          {/* Real Agent Header */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="w-8 h-8 text-green-600" />
                  <div>
                    <h3 className="font-bold text-lg">Real AutoHeal Agent</h3>
                    <p className="text-sm text-muted-foreground">
                      Genuine error detection & auto-fix system
                    </p>
                  </div>
                  {realAgentStats?.monitoring_active ? (
                    <Badge className="bg-green-100 text-green-700 border-green-300">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                      Monitoring Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-600">
                      Monitoring Paused
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchRealAgentData}
                    disabled={realAgentLoading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${realAgentLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button 
                    variant={realAgentStats?.monitoring_active ? "destructive" : "default"}
                    size="sm" 
                    onClick={toggleMonitoring}
                  >
                    <Power className="w-4 h-4 mr-1" />
                    {realAgentStats?.monitoring_active ? 'Stop' : 'Start'} Monitoring
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={triggerScan}
                    disabled={scanning}
                  >
                    <Search className={`w-4 h-4 mr-1 ${scanning ? 'animate-spin' : ''}`} />
                    {scanning ? 'Scanning...' : 'Scan Now'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Real Agent Stats */}
          {realAgentStats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Errors Detected</p>
                      <p className="text-3xl font-bold">{realAgentStats.total_errors_detected}</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Fixes Attempted</p>
                      <p className="text-3xl font-bold">{realAgentStats.total_fixes_attempted}</p>
                    </div>
                    <Wrench className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Fixes Successful</p>
                      <p className="text-3xl font-bold text-green-600">{realAgentStats.total_fixes_successful}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                      <p className={`text-3xl font-bold ${realAgentStats.success_rate >= 80 ? 'text-green-600' : realAgentStats.success_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {realAgentStats.success_rate}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pending Errors</p>
                      <p className="text-3xl font-bold text-orange-600">{realAgentStats.pending_errors}</p>
                    </div>
                    <Clock className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Errors by Category */}
          {realAgentStats?.errors_by_category && Object.keys(realAgentStats.errors_by_category).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Errors by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(realAgentStats.errors_by_category).map(([category, count]) => (
                    <Badge key={category} variant="outline" className="text-sm py-1 px-3">
                      {category.replace(/_/g, ' ')}: {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Errors */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Detected Errors
                  </CardTitle>
                  <CardDescription>Errors found during log scanning</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  {realAgentErrors.length > 0 ? (
                    realAgentErrors.map((error, idx) => (
                      <div key={idx} className="p-3 border rounded-lg mb-2 text-sm">
                        <div className="flex items-start justify-between">
                          <Badge className={
                            error.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            error.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                            error.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }>
                            {error.severity}
                          </Badge>
                          <Badge variant="outline">{error.category?.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="mt-2 text-muted-foreground line-clamp-2">{error.message}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {error.source} • {error.occurrences > 1 ? `${error.occurrences}x` : ''} {new Date(error.detected_at).toLocaleTimeString()}
                          </span>
                          <div className="flex gap-1">
                            <Badge variant="outline" className={
                              error.fix_status === 'verified' ? 'bg-green-100 text-green-700' :
                              error.fix_status === 'failed' ? 'bg-red-100 text-red-700' :
                              error.fix_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }>
                              {error.fix_status}
                            </Badge>
                            {error.fix_status === 'pending' && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 px-2"
                                onClick={() => fixSpecificError(error.error_id)}
                              >
                                <Wrench className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-lg font-medium">No Errors Detected!</p>
                      <p className="text-muted-foreground">Your application is running smoothly</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Applied Fixes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-blue-500" />
                    Applied Fixes
                  </CardTitle>
                  <CardDescription>Auto-fixes applied by the agent</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearHistory}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  {realAgentFixes.length > 0 ? (
                    realAgentFixes.map((fix, idx) => (
                      <div key={idx} className="p-3 border rounded-lg mb-2 text-sm">
                        <div className="flex items-start justify-between">
                          <span className="font-medium">{fix.description || fix.fix_type}</span>
                          <Badge className={
                            fix.status === 'verified' ? 'bg-green-100 text-green-700' :
                            fix.status === 'applied' ? 'bg-blue-100 text-blue-700' :
                            fix.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }>
                            {fix.verified ? 'Verified' : fix.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground line-clamp-2">
                          {fix.verification_details}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline">{fix.category?.replace(/_/g, ' ')}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(fix.applied_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Bot className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-lg font-medium">No Fixes Applied Yet</p>
                      <p className="text-muted-foreground">Fixes will appear here when errors are detected and resolved</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Last Scan Info */}
          {realAgentStats?.last_scan_at && (
            <div className="text-center text-sm text-muted-foreground">
              Last scan: {new Date(realAgentStats.last_scan_at).toLocaleString()}
              {realAgentStats.monitoring_started_at && (
                <span className="ml-4">
                  Monitoring since: {new Date(realAgentStats.monitoring_started_at).toLocaleString()}
                </span>
              )}
            </div>
          )}
        </TabsContent>

        {/* Enterprise Self-Healing System Tab */}
        <TabsContent value="enterprise" className="space-y-4">
          {/* Enterprise Header */}
          <Card className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-lg">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Enterprise Self-Healing System</h2>
                    <p className="text-muted-foreground">Production-grade autonomous error detection, analysis, and deployment</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchEnterpriseDashboard}
                    disabled={enterpriseLoading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${enterpriseLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    variant={enterpriseDashboard?.auto_heal_enabled ? 'destructive' : 'default'}
                    size="sm"
                    onClick={() => toggleAutoHeal(!enterpriseDashboard?.auto_heal_enabled)}
                  >
                    <Power className="w-4 h-4 mr-2" />
                    {enterpriseDashboard?.auto_heal_enabled ? 'Disable Auto-Heal' : 'Enable Auto-Heal'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {enterpriseLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : enterpriseDashboard ? (
            <>
              {/* System Health Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">System Status</p>
                        <Badge className={getHealthStatusBadge(enterpriseDashboard.system_health?.overall_status)}>
                          {enterpriseDashboard.system_health?.overall_status?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                      </div>
                      <Activity className={`w-8 h-8 ${getHealthStatusColor(enterpriseDashboard.system_health?.overall_status)}`} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Errors Detected</p>
                        <p className="text-3xl font-bold">{enterpriseDashboard.error_stats?.total || 0}</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Auto-Fix Rate</p>
                        <p className="text-3xl font-bold text-green-600">
                          {((enterpriseDashboard.error_stats?.fix_rate || 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Protected Modules</p>
                        <p className="text-3xl font-bold">{enterpriseDashboard.protected_modules_count || 0}</p>
                      </div>
                      <Lock className="w-8 h-8 text-indigo-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Service Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    Service Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {enterpriseDashboard.system_health?.services && Object.entries(enterpriseDashboard.system_health.services).map(([key, service]) => (
                      <div key={key} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{service.name || key}</span>
                          <Badge className={getHealthStatusBadge(service.status)}>
                            {service.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Response: {service.response_time_ms?.toFixed(2) || 'N/A'}ms</p>
                          {service.last_error && <p className="text-red-500">Error: {service.last_error}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* System Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    System Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {enterpriseDashboard.system_health?.system && Object.entries(enterpriseDashboard.system_health.system).map(([key, metric]) => (
                      <div key={key} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{key}</span>
                          <Badge className={getHealthStatusBadge(metric.status)}>
                            {metric.value?.toFixed(1)}{metric.unit}
                          </Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                          <div
                            className={`h-2.5 rounded-full ${
                              metric.value > 80 ? 'bg-red-600' : metric.value > 60 ? 'bg-yellow-500' : 'bg-green-600'
                            }`}
                            style={{ width: `${Math.min(metric.value || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Learning Engine Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      Learning Engine
                    </CardTitle>
                    <CardDescription>AI-powered pattern recognition and confidence scoring</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">{enterpriseDashboard.learning_stats?.total_patterns || 0}</p>
                          <p className="text-sm text-muted-foreground">Total Patterns</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600">{enterpriseDashboard.learning_stats?.reliable_patterns || 0}</p>
                          <p className="text-sm text-muted-foreground">Reliable Patterns</p>
                        </div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span>Success Rate (24h)</span>
                          <span className="font-bold">
                            {((enterpriseDashboard.learning_stats?.success_rate_24h || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${(enterpriseDashboard.learning_stats?.success_rate_24h || 0) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Average Confidence: {((enterpriseDashboard.learning_stats?.avg_confidence || 0.5) * 100).toFixed(0)}%</p>
                        <p>Events (24h): {enterpriseDashboard.learning_stats?.total_events_24h || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Rollback Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RotateCcw className="w-5 h-5" />
                      Rollback Manager
                    </CardTitle>
                    <CardDescription>Automatic reversion system for failed deployments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">{rollbackStats?.total_rollbacks || 0}</p>
                          <p className="text-sm text-muted-foreground">Total Rollbacks</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {((rollbackStats?.success_rate || 0) * 100).toFixed(0)}%
                          </p>
                          <p className="text-sm text-muted-foreground">Success Rate</p>
                        </div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span>Active Triggers</span>
                          <Badge variant="secondary">{rollbackStats?.active_triggers || 0}</Badge>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Successful: {rollbackStats?.successful_rollbacks || 0}</p>
                        <p>Failed: {rollbackStats?.failed_rollbacks || 0}</p>
                        <p>Backups Stored: {rollbackStats?.backups_stored || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Critical Modules */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Critical Module Protection
                  </CardTitle>
                  <CardDescription>Modules protected from automatic modifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {criticalModules.length > 0 ? criticalModules.map((module, idx) => (
                        <div key={module.module_id || idx} className="p-3 border rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium">{module.name}</p>
                            <p className="text-sm text-muted-foreground">{module.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">Path: {module.file_path}</p>
                          </div>
                          <Badge className={
                            module.protection_level === 'strict' ? 'bg-red-100 text-red-800' :
                            module.protection_level === 'standard' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }>
                            {module.protection_level}
                          </Badge>
                        </div>
                      )) : (
                        <p className="text-center text-muted-foreground py-8">No critical modules defined</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Recent Operations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Recent Operations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {enterpriseDashboard.recent_operations?.length > 0 ? (
                      <div className="space-y-2">
                        {enterpriseDashboard.recent_operations.map((op, idx) => (
                          <div key={op.operation_id || idx} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={
                                op.status === 'success' || op.status === 'deployed' ? 'bg-green-100 text-green-800' :
                                op.status === 'failed' ? 'bg-red-100 text-red-800' :
                                op.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }>
                                {op.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(op.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm font-medium">{op.error_type}: {op.error_message?.substring(0, 100)}</p>
                            {op.fix_description && (
                              <p className="text-xs text-muted-foreground mt-1">Fix: {op.fix_description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No recent operations</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">Click "Refresh" to load Enterprise Self-Healing data</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Error Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Error Type Breakdown (7 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.error_breakdown?.length > 0 ? (
                  <div className="space-y-3">
                    {stats.error_breakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {item.error_type?.replace(/_/g, ' ') || 'Unknown'}
                        </span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No errors recorded</p>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent Healing Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  {reports.slice(0, 5).map((report, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-3 border-b last:border-0">
                      {getStatusIcon(report.resolved, report.escalated)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {report.error_type?.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {report.root_cause?.substring(0, 60)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={getSeverityColor(report.severity)}>
                        {report.severity}
                      </Badge>
                    </div>
                  ))}
                  {reports.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">No recent activity</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Stats */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Weekly Performance</CardTitle>
                <CardDescription>Last 7 days healing statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold">{stats.week.total_errors}</p>
                    <p className="text-sm text-muted-foreground">Total Errors</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-600">{stats.week.auto_resolved}</p>
                    <p className="text-sm text-muted-foreground">Auto-Resolved</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-purple-600">{stats.week.resolution_rate}%</p>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Healing Reports</CardTitle>
              <CardDescription>Complete history of error detection and resolution</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {reports.map((report, idx) => (
                  <div key={idx} className="p-4 border rounded-lg mb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(report.resolved, report.escalated)}
                        <span className="font-medium capitalize">
                          {report.error_type?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <Badge className={getSeverityColor(report.severity)}>
                        {report.severity}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Root Cause: </span>
                        <span>{report.root_cause?.substring(0, 150)}...</span>
                      </div>
                      
                      {report.fix_applied && (
                        <div>
                          <span className="text-muted-foreground">Fix: </span>
                          <span>{report.fix_applied.description}</span>
                          <Badge variant="outline" className="ml-2">{report.fix_applied.status}</Badge>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{new Date(report.created_at).toLocaleString()}</span>
                        {report.request_path && <span>Path: {report.request_path}</span>}
                        {report.user_role && <span>Role: {report.user_role}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">No reports found</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Pending Alerts
              </CardTitle>
              <CardDescription>Errors that require manual review</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {alerts.map((alert, idx) => (
                  <div key={idx} className="p-4 border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900 rounded-lg mb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        <span className="font-medium">{alert.type?.replace(/_/g, ' ')}</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      {alert.message && (
                        <p className="text-muted-foreground">{alert.message}</p>
                      )}
                      {alert.root_cause && (
                        <p><span className="font-medium">Cause:</span> {alert.root_cause}</p>
                      )}
                      {alert.recommendations?.length > 0 && (
                        <div>
                          <span className="font-medium">Recommendations:</span>
                          <ul className="list-disc list-inside ml-2">
                            {alert.recommendations.map((rec, i) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-medium">All Clear!</p>
                    <p className="text-muted-foreground">No pending alerts</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Diagnosis Tab */}
        <TabsContent value="diagnose">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Manual Error Diagnosis
              </CardTitle>
              <CardDescription>
                Manually trigger the AutoHeal AI to analyze and fix an error
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Error Message *</label>
                <Textarea 
                  placeholder="Enter the error message or description..."
                  value={diagnosisInput.error_message}
                  onChange={(e) => setDiagnosisInput({...diagnosisInput, error_message: e.target.value})}
                  className="mt-1"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Module/Component</label>
                <Input 
                  placeholder="e.g., auth, inventory, sales"
                  value={diagnosisInput.module}
                  onChange={(e) => setDiagnosisInput({...diagnosisInput, module: e.target.value})}
                  className="mt-1"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Additional Context (JSON)</label>
                <Textarea 
                  placeholder='{"user_id": "123", "action": "create"}'
                  value={diagnosisInput.context}
                  onChange={(e) => setDiagnosisInput({...diagnosisInput, context: e.target.value})}
                  className="mt-1 font-mono text-sm"
                  rows={3}
                />
              </div>
              
              <Button 
                onClick={runDiagnosis} 
                disabled={diagnosing || !diagnosisInput.error_message.trim()}
                className="w-full"
              >
                {diagnosing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Diagnosing...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Run Diagnosis
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
