import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  Activity, Power, PowerOff, Bell, BellRing, Check, X, AlertTriangle,
  RefreshCw, Play, Pause, Zap, Shield, Eye, Bot, Brain, Cpu,
  ArrowRight, Clock, CheckCircle2, XCircle, AlertCircle, TrendingUp,
  Settings, ChevronDown, ChevronUp, BarChart3, Radio, FileCode, Server,
  Wifi, WifiOff, CircleDot, Circle, Loader2, PieChart, LineChart
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Progress } from '../components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';

const AGENT_ICONS = {
  'ui_blink_fix': Eye,
  'error_autofix': AlertTriangle,
  'performance_agent': Zap,
  'error_fix_52': Shield,
  'universal_fixer': Bot,
  'syntax_autofix': Brain,
  'autoheal': Activity,
};

const STATUS_COLORS = {
  running: 'bg-green-500',
  stopped: 'bg-gray-400',
  starting: 'bg-yellow-500',
  error: 'bg-red-500',
  paused: 'bg-blue-500',
};

const SEVERITY_COLORS = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-800',
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
};

const ERROR_STATUS_COLORS = {
  detected: 'bg-yellow-500',
  routing: 'bg-blue-500',
  fixing: 'bg-purple-500',
  fixed: 'bg-green-500',
  failed: 'bg-red-500',
};

export default function AgentControlCenter() {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState(false);
  const [status, setStatus] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Live error monitoring state
  const [liveErrors, setLiveErrors] = useState([]);
  const [liveErrorStats, setLiveErrorStats] = useState({});
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(true);
  const [selectedError, setSelectedError] = useState(null);
  const [showReportError, setShowReportError] = useState(false);
  const [reportErrorForm, setReportErrorForm] = useState({
    error_type: '',
    error_message: '',
    file_path: '',
    stack_trace: ''
  });
  
  // Error Trend Analytics state
  const [trendAnalytics, setTrendAnalytics] = useState(null);
  const [trendHours, setTrendHours] = useState(24);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const livePollingRef = useRef(null);
  
  // Inter-Agent Communication state
  const [communicationLog, setCommunicationLog] = useState([]);
  const [communicationStats, setCommunicationStats] = useState({ agents: [] });
  const [loadingCommunication, setLoadingCommunication] = useState(false);
  const [selectedHandoffError, setSelectedHandoffError] = useState(null);
  const [handoffDialogOpen, setHandoffDialogOpen] = useState(false);
  const [handoffForm, setHandoffForm] = useState({ from_agent: '', to_agent: '', reason: '' });

  // Fetch orchestrator status
  const fetchStatus = useCallback(async () => {
    try {
      const data = await api('/api/orchestrator/status');
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch orchestrator status:', err);
    }
  }, [api]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api('/api/orchestrator/notifications?limit=20');
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [api]);

  // Fetch live errors
  const fetchLiveErrors = useCallback(async () => {
    try {
      const data = await api('/api/orchestrator/live-errors?limit=50&since_minutes=60');
      setLiveErrors(data.errors || []);
      setLiveErrorStats(data.stats || {});
    } catch (err) {
      console.error('Failed to fetch live errors:', err);
    }
  }, [api]);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await api('/api/orchestrator/analytics?hours=24');
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  }, [api]);
  
  // Fetch trend analytics
  const fetchTrendAnalytics = useCallback(async (hours = trendHours) => {
    setLoadingTrends(true);
    try {
      const data = await api(`/api/orchestrator/analytics/comprehensive?hours=${hours}`);
      setTrendAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch trend analytics:', err);
    } finally {
      setLoadingTrends(false);
    }
  }, [api, trendHours]);
  
  // Fetch inter-agent communication log
  const fetchCommunicationLog = useCallback(async () => {
    setLoadingCommunication(true);
    try {
      const [logData, statsData] = await Promise.all([
        api('/api/orchestrator/communication/log?limit=50&hours=24'),
        api('/api/orchestrator/communication/stats?hours=24')
      ]);
      setCommunicationLog(logData.messages || []);
      // Merge stats from both endpoints - log has message counts, stats has per-agent data
      setCommunicationStats({
        stats: logData.stats || { total_messages: 0, handoffs: 0, consultations: 0, escalations: 0 },
        agents: statsData?.agents || []
      });
    } catch (err) {
      console.error('Failed to fetch communication log:', err);
    } finally {
      setLoadingCommunication(false);
    }
  }, [api]);

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchNotifications(), fetchAnalytics(), fetchLiveErrors(), fetchTrendAnalytics(), fetchCommunicationLog()]);
      setLoading(false);
    };
    fetchAll();

    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchStatus();
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchNotifications, fetchAnalytics, fetchLiveErrors, fetchTrendAnalytics, fetchCommunicationLog]);

  // Live error monitoring polling
  useEffect(() => {
    if (isLiveMonitoring) {
      // Poll every 5 seconds for live errors
      livePollingRef.current = setInterval(() => {
        fetchLiveErrors();
      }, 5000);
    } else if (livePollingRef.current) {
      clearInterval(livePollingRef.current);
    }

    return () => {
      if (livePollingRef.current) {
        clearInterval(livePollingRef.current);
      }
    };
  }, [isLiveMonitoring, fetchLiveErrors]);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Show browser notification for critical errors
  useEffect(() => {
    const criticalErrors = liveErrors.filter(e => 
      e.severity === 'critical' && 
      e.status === 'detected' &&
      new Date(e.created_at) > new Date(Date.now() - 10000) // Last 10 seconds
    );
    
    if (criticalErrors.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      criticalErrors.forEach(error => {
        new Notification('🔴 Critical Error Detected', {
          body: `${error.error_type}: ${error.error_message.substring(0, 100)}`,
          icon: '/favicon.ico',
          tag: error.error_id
        });
      });
    }
  }, [liveErrors]);

  // Report error manually
  const reportError = async () => {
    try {
      if (!reportErrorForm.error_type || !reportErrorForm.error_message) {
        toast.error('Error type and message are required');
        return;
      }
      
      await api('/api/orchestrator/report-error', {
        method: 'POST',
        body: JSON.stringify({
          ...reportErrorForm,
          source: 'user_reported',
          auto_route: true
        })
      });
      
      toast.success('Error reported and routing to agents...');
      setShowReportError(false);
      setReportErrorForm({ error_type: '', error_message: '', file_path: '', stack_trace: '' });
      await fetchLiveErrors();
    } catch (err) {
      toast.error('Failed to report error');
    }
  };

  // Resolve error manually
  const resolveError = async (errorId, resolution) => {
    try {
      await api(`/api/orchestrator/live-errors/${errorId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({ resolution })
      });
      toast.success('Error marked as resolved');
      await fetchLiveErrors();
      setSelectedError(null);
    } catch (err) {
      toast.error('Failed to resolve error');
    }
  };
  
  // Trigger manual handoff between agents
  const triggerHandoff = async () => {
    try {
      if (!selectedHandoffError || !handoffForm.from_agent || !handoffForm.to_agent) {
        toast.error('Please select error and both agents');
        return;
      }
      
      await api('/api/orchestrator/communication/handoff', {
        method: 'POST',
        body: JSON.stringify({
          error_id: selectedHandoffError.error_id,
          from_agent: handoffForm.from_agent,
          to_agent: handoffForm.to_agent,
          reason: handoffForm.reason || 'Manual handoff by admin'
        })
      });
      
      toast.success(`Error handed off to ${handoffForm.to_agent}`);
      setHandoffDialogOpen(false);
      setSelectedHandoffError(null);
      setHandoffForm({ from_agent: '', to_agent: '', reason: '' });
      await Promise.all([fetchLiveErrors(), fetchCommunicationLog()]);
    } catch (err) {
      toast.error('Failed to trigger handoff: ' + (err.message || 'Unknown error'));
    }
  };

  // Start all agents
  const startAllAgents = async () => {
    try {
      toast.info('Starting all AI agents...');
      await api('/api/orchestrator/start-all', { method: 'POST' });
      toast.success('All agents started successfully!');
      await fetchStatus();
    } catch (err) {
      toast.error('Failed to start agents: ' + (err.message || 'Unknown error'));
    }
  };

  // Stop all agents
  const stopAllAgents = async () => {
    try {
      toast.info('Stopping all AI agents...');
      await api('/api/orchestrator/stop-all', { method: 'POST' });
      toast.success('All agents stopped');
      await fetchStatus();
    } catch (err) {
      toast.error('Failed to stop agents: ' + (err.message || 'Unknown error'));
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await api(`/api/orchestrator/notifications/${notificationId}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => 
        n.notification_id === notificationId ? { ...n, read: true } : n
      ));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Dismiss notification
  const dismissNotification = async (notificationId) => {
    try {
      await api(`/api/orchestrator/notifications/${notificationId}`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
      toast.success('Notification dismissed');
    } catch (err) {
      toast.error('Failed to dismiss notification');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Cpu className="w-8 h-8 text-blue-600" />
            AI Agents Control Center
          </h1>
          <p className="text-gray-500 mt-1">Central orchestration for all AI agents with auto-start and intelligent routing</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Notifications Bell */}
          <Button
            variant="outline"
            size="icon"
            className="relative"
            onClick={() => setShowNotifications(true)}
            data-testid="notifications-bell"
          >
            {unreadCount > 0 ? (
              <BellRing className="w-5 h-5 text-amber-500" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Button>

          {/* Refresh Button */}
          <Button variant="outline" size="icon" onClick={() => { fetchStatus(); fetchNotifications(); fetchAnalytics(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Start/Stop All */}
          {status?.orchestrator_running ? (
            <Button variant="destructive" onClick={stopAllAgents} data-testid="stop-all-btn">
              <PowerOff className="w-4 h-4 mr-2" />
              Stop All
            </Button>
          ) : (
            <Button className="bg-green-600 hover:bg-green-700" onClick={startAllAgents} data-testid="start-all-btn">
              <Power className="w-4 h-4 mr-2" />
              Start All
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className={`${status?.orchestrator_running ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'} text-white`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs">Status</p>
                <p className="text-lg font-bold">{status?.orchestrator_running ? 'ACTIVE' : 'STOPPED'}</p>
              </div>
              <Activity className="w-8 h-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs">Running Agents</p>
                <p className="text-lg font-bold">{status?.running_agents || 0}/{status?.total_agents || 0}</p>
              </div>
              <Bot className="w-8 h-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-xs">Errors Handled</p>
                <p className="text-lg font-bold">{status?.total_errors_handled || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs">Fixes Applied</p>
                <p className="text-lg font-bold">{status?.total_fixes_applied || 0}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs">Unread Alerts</p>
                <p className="text-lg font-bold">{status?.unread_notifications || 0}</p>
              </div>
              <Bell className="w-8 h-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-xs">Failed Fixes (24h)</p>
                <p className="text-lg font-bold">{status?.failed_fixes_24h || 0}</p>
              </div>
              <XCircle className="w-8 h-8 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Agents</TabsTrigger>
          <TabsTrigger value="live-errors" className="relative">
            Live Errors
            {liveErrorStats.critical > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">
                {liveErrorStats.critical}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="communication" className="flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            Comms
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="analytics">Routing</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {status?.agents?.map((agent) => {
              const IconComponent = AGENT_ICONS[agent.agent_id] || Bot;
              const isExpanded = expandedAgent === agent.agent_id;
              
              return (
                <Card key={agent.agent_id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${agent.status === 'running' ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <IconComponent className={`w-5 h-5 ${agent.status === 'running' ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{agent.agent_name}</CardTitle>
                          <CardDescription className="text-xs">{agent.agent_type}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLORS[agent.status] + ' text-white'}>
                          {agent.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedAgent(isExpanded ? null : agent.agent_id)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Errors: {agent.errors_handled}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <Check className="w-3 h-3" />
                        <span>Fixes: {agent.fixes_applied}</span>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Capabilities</p>
                          <div className="flex flex-wrap gap-1">
                            {agent.capabilities?.map((cap, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {cap.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {agent.last_activity && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            Last active: {new Date(agent.last_activity).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Live Errors Tab */}
        <TabsContent value="live-errors" className="mt-4">
          <div className="space-y-4">
            {/* Live Error Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {isLiveMonitoring ? (
                    <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={`text-sm font-medium ${isLiveMonitoring ? 'text-green-600' : 'text-gray-500'}`}>
                    {isLiveMonitoring ? 'Live Monitoring Active' : 'Monitoring Paused'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLiveMonitoring(!isLiveMonitoring)}
                >
                  {isLiveMonitoring ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  {isLiveMonitoring ? 'Pause' : 'Resume'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={fetchLiveErrors}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button onClick={() => setShowReportError(true)} className="bg-blue-600 hover:bg-blue-700">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Report Error
                </Button>
              </div>
            </div>

            {/* Live Error Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="bg-gray-50 dark:bg-gray-800">
                <CardContent className="p-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{liveErrorStats.total || 0}</p>
                    <p className="text-xs text-gray-500">Total (1h)</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-red-50 dark:bg-red-900/20">
                <CardContent className="p-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{liveErrorStats.critical || 0}</p>
                    <p className="text-xs text-gray-500">Critical</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-orange-50 dark:bg-orange-900/20">
                <CardContent className="p-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{liveErrorStats.high || 0}</p>
                    <p className="text-xs text-gray-500">High</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-green-50 dark:bg-green-900/20">
                <CardContent className="p-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{liveErrorStats.fixed || 0}</p>
                    <p className="text-xs text-gray-500">Fixed</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="p-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{liveErrorStats.fix_rate || 0}%</p>
                    <p className="text-xs text-gray-500">Fix Rate</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Error Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-red-600" />
                  Live Error Feed
                  {isLiveMonitoring && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {liveErrors.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">All Clear!</p>
                    <p className="text-sm text-gray-500">No errors detected in the last hour</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {liveErrors.map((error) => (
                      <div
                        key={error.error_id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                          error.severity === 'critical' ? 'border-red-300 bg-red-50 dark:bg-red-900/20' :
                          error.severity === 'high' ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20' :
                          'border-gray-200 bg-gray-50 dark:bg-gray-800'
                        }`}
                        onClick={() => setSelectedError(error)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-2 h-2 rounded-full ${ERROR_STATUS_COLORS[error.status]}`} />
                              <Badge className={SEVERITY_COLORS[error.severity]}>
                                {error.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {error.error_category}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {error.source}
                              </span>
                            </div>
                            <p className="font-medium text-sm">{error.error_type}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {error.error_message}
                            </p>
                            {error.file_path && (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <FileCode className="w-3 h-3" />
                                {error.file_path}
                                {error.line_number && `:${error.line_number}`}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge className={`${ERROR_STATUS_COLORS[error.status]} text-white text-xs`}>
                              {error.status}
                            </Badge>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(error.created_at).toLocaleTimeString()}
                            </p>
                            {error.assigned_agent && (
                              <p className="text-xs text-blue-600 mt-1">
                                → {error.assigned_agent}
                              </p>
                            )}
                            {error.status !== 'fixed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 text-xs h-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedHandoffError(error);
                                  setHandoffForm({
                                    from_agent: error.assigned_agent || '',
                                    to_agent: '',
                                    reason: ''
                                  });
                                  setHandoffDialogOpen(true);
                                }}
                                data-testid={`handoff-btn-${error.error_id}`}
                              >
                                <ArrowRight className="w-3 h-3 mr-1" />
                                Handoff
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Inter-Agent Communication Tab */}
        <TabsContent value="communication" className="mt-4">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-indigo-600" />
                  Inter-Agent Communication
                </h3>
                <p className="text-sm text-gray-500">Monitor agent-to-agent messages, handoffs, and consultations</p>
              </div>
              <Button variant="outline" onClick={fetchCommunicationLog} disabled={loadingCommunication}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loadingCommunication ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Communication Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700 font-medium">Total Messages</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800">{communicationStats?.stats?.total_messages || 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowRight className="w-4 h-4 text-orange-600" />
                    <span className="text-sm text-orange-700 font-medium">Handoffs</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-800">{communicationStats?.stats?.handoffs || 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-700 font-medium">Consultations</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-800">{communicationStats?.stats?.consultations || 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 border-red-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700 font-medium">Escalations</span>
                  </div>
                  <p className="text-2xl font-bold text-red-800">{communicationStats?.stats?.escalations || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* Agent Communication Stats */}
            {communicationStats?.agents?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    Agent Communication Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {communicationStats.agents.map((agent) => (
                      <div key={agent.agent_id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-indigo-600" />
                          </div>
                          <span className="font-medium text-sm">{agent.agent_name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <ArrowRight className="w-3 h-3 text-green-500" />
                            <span>Sent: {agent.sent}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ArrowRight className="w-3 h-3 text-blue-500 rotate-180" />
                            <span>Received: {agent.received}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-orange-500" />
                            <span>Handoffs Out: {agent.handoffs_sent}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-purple-500" />
                            <span>Handoffs In: {agent.handoffs_received}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Communication Log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Communication Log (Last 24h)
                </CardTitle>
                <CardDescription>Real-time inter-agent message activity</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCommunication ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : communicationLog.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ArrowRight className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No inter-agent communication recorded yet</p>
                    <p className="text-sm mt-1">Messages will appear here when agents communicate</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {communicationLog.map((msg) => (
                      <div
                        key={msg.message_id}
                        className={`p-3 rounded-lg border ${
                          msg.message_type === 'handoff' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200' :
                          msg.message_type === 'consultation' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200' :
                          msg.message_type === 'escalation' ? 'bg-red-50 dark:bg-red-900/20 border-red-200' :
                          msg.message_type === 'response' ? 'bg-green-50 dark:bg-green-900/20 border-green-200' :
                          'bg-gray-50 dark:bg-gray-800 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={
                              msg.message_type === 'handoff' ? 'bg-orange-100 text-orange-700' :
                              msg.message_type === 'consultation' ? 'bg-purple-100 text-purple-700' :
                              msg.message_type === 'escalation' ? 'bg-red-100 text-red-700' :
                              msg.message_type === 'response' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }>
                              {msg.message_type}
                            </Badge>
                            {msg.priority === 'high' && (
                              <Badge className="bg-red-100 text-red-700">HIGH</Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-indigo-600">{msg.from_agent_name}</span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-indigo-600">{msg.to_agent_name}</span>
                        </div>
                        {msg.content?.reason && (
                          <p className="text-sm text-gray-600 mt-1 italic">"{msg.content.reason}"</p>
                        )}
                        {msg.content?.question && (
                          <p className="text-sm text-gray-600 mt-1">Q: {msg.content.question}</p>
                        )}
                        {msg.error_id && (
                          <p className="text-xs text-gray-400 mt-1">Error ID: {msg.error_id.substring(0, 8)}...</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Error Trends Tab - NEW */}
        <TabsContent value="trends" className="mt-4">
          <div className="space-y-6">
            {/* Period Selector and Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Error Trend Analytics
                </h3>
                <p className="text-sm text-gray-500">Visualize error patterns and fix rates over time</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={trendHours}
                  onChange={(e) => {
                    const h = parseInt(e.target.value);
                    setTrendHours(h);
                    fetchTrendAnalytics(h);
                  }}
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
                  data-testid="trend-hours-select"
                >
                  <option value={6}>Last 6 hours</option>
                  <option value={12}>Last 12 hours</option>
                  <option value={24}>Last 24 hours</option>
                  <option value={48}>Last 48 hours</option>
                  <option value={72}>Last 3 days</option>
                  <option value={168}>Last 7 days</option>
                </select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchTrendAnalytics(trendHours)}
                  disabled={loadingTrends}
                >
                  {loadingTrends ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Summary Cards */}
            {trendAnalytics?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-slate-600 to-slate-700 text-white">
                  <CardContent className="p-4">
                    <p className="text-slate-200 text-xs">Total Errors</p>
                    <p className="text-2xl font-bold">{trendAnalytics.summary.total_errors}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                  <CardContent className="p-4">
                    <p className="text-green-100 text-xs">Fixed</p>
                    <p className="text-2xl font-bold">{trendAnalytics.summary.total_fixed}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  <CardContent className="p-4">
                    <p className="text-blue-100 text-xs">Fix Rate</p>
                    <p className="text-2xl font-bold">{trendAnalytics.summary.fix_rate}%</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white">
                  <CardContent className="p-4">
                    <p className="text-red-100 text-xs">Critical</p>
                    <p className="text-2xl font-bold">{trendAnalytics.summary.critical_errors}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {loadingTrends ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : !trendAnalytics || trendAnalytics.summary?.total_errors === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No Error Data</p>
                <p className="text-sm text-gray-500">No errors recorded in the selected time period</p>
              </div>
            ) : (
              <>
                {/* Error Timeline Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChart className="w-5 h-5 text-indigo-600" />
                      Error Timeline (Hourly)
                    </CardTitle>
                    <CardDescription>Errors detected and fixed over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendAnalytics?.hourly_trend || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorFixed" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="display_hour" stroke="#9ca3af" fontSize={12} />
                          <YAxis stroke="#9ca3af" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                            labelStyle={{ color: '#9ca3af' }}
                          />
                          <Legend />
                          <Area type="monotone" dataKey="total" name="Total Errors" stroke="#6366f1" fillOpacity={1} fill="url(#colorTotal)" />
                          <Area type="monotone" dataKey="fixed" name="Fixed" stroke="#10b981" fillOpacity={1} fill="url(#colorFixed)" />
                          <Area type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" fillOpacity={1} fill="url(#colorCritical)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Distribution Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Errors by Severity - Pie Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-600" />
                        Errors by Severity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPie>
                            <Pie
                              data={trendAnalytics?.by_severity || []}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ severity, count, percent }) => `${severity}: ${count} (${(percent * 100).toFixed(0)}%)`}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="count"
                              nameKey="severity"
                            >
                              {(trendAnalytics?.by_severity || []).map((entry, index) => {
                                const colors = {
                                  critical: '#ef4444',
                                  high: '#f97316',
                                  medium: '#eab308',
                                  low: '#6b7280'
                                };
                                return <Cell key={`cell-${index}`} fill={colors[entry.severity] || '#8b5cf6'} />;
                              })}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </RechartsPie>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Errors by Category - Bar Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Errors by Category
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trendAnalytics?.by_category || []} layout="vertical" margin={{ left: 70 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                            <YAxis type="category" dataKey="category" stroke="#9ca3af" fontSize={11} width={65} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                            />
                            <Legend />
                            <Bar dataKey="fixed" name="Fixed" stackId="a" fill="#10b981" />
                            <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Agent Performance and Source Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Agent Performance */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-green-600" />
                        Agent Performance
                      </CardTitle>
                      <CardDescription>Errors handled by each AI agent</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {trendAnalytics?.by_agent?.length > 0 ? (
                        <div className="space-y-3">
                          {trendAnalytics.by_agent.map((agent, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                  <Bot className="w-4 h-4 text-green-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{agent.agent_name}</p>
                                  <p className="text-xs text-gray-500">{agent.count} errors handled</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge className={agent.fix_rate >= 80 ? 'bg-green-100 text-green-700' : agent.fix_rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                                  {agent.fix_rate}% fix rate
                                </Badge>
                                <p className="text-xs text-gray-500 mt-1">{agent.fixed} fixed / {agent.failed} failed</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8">No agent data available</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Error Source Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Server className="w-5 h-5 text-orange-600" />
                        Error Sources
                      </CardTitle>
                      <CardDescription>Where errors originate from</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {trendAnalytics?.by_source?.length > 0 ? (
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                              <Pie
                                data={trendAnalytics?.by_source || []}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="count"
                                nameKey="source"
                                label={({ source, count }) => `${source}: ${count}`}
                              >
                                {(trendAnalytics?.by_source || []).map((entry, index) => {
                                  const colors = ['#6366f1', '#10b981', '#f97316', '#ec4899'];
                                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                })}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </RechartsPie>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8">No source data available</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Error Routing Stats (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Errors Routed</span>
                    <span className="text-2xl font-bold">{analytics?.total_errors_routed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Successfully Fixed</span>
                    <span className="text-2xl font-bold text-green-600">{analytics?.total_fixed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Success Rate</span>
                    <span className="text-2xl font-bold text-blue-600">{analytics?.overall_success_rate || 0}%</span>
                  </div>
                  <Progress value={analytics?.overall_success_rate || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Routing by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics?.by_category && Object.entries(analytics.by_category).map(([category, data]) => (
                    <div key={category} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="capitalize">{category.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{data.success}/{data.total}</span>
                        <Badge className={data.success === data.total ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                          {Math.round((data.success / Math.max(data.total, 1)) * 100)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {(!analytics?.by_category || Object.keys(analytics.by_category).length === 0) && (
                    <p className="text-center text-gray-500 py-4">No routing data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                Recent Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No notifications yet</p>
              ) : (
                <div className="space-y-3">
                  {notifications.slice(0, 10).map((notif) => (
                    <div
                      key={notif.notification_id}
                      className={`p-3 rounded-lg border ${!notif.read ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200' : 'bg-gray-50 dark:bg-gray-800 border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className={SEVERITY_COLORS[notif.severity]}>
                              {notif.severity}
                            </Badge>
                            <span className="font-medium text-sm">{notif.title}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notif.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!notif.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notif.notification_id)}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dismissNotification(notif.notification_id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notifications Dialog */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Agent Notifications
            </DialogTitle>
            <DialogDescription>
              Alerts from AI agents when auto-fix fails or requires attention
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No notifications</p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.notification_id}
                  className={`p-3 rounded-lg border ${!notif.read ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200' : 'bg-gray-50 dark:bg-gray-800 border-gray-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={SEVERITY_COLORS[notif.severity]}>
                          {notif.severity}
                        </Badge>
                        <span className="font-medium text-sm">{notif.title}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notif.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notif.notification_id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissNotification(notif.notification_id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Error Dialog */}
      <Dialog open={showReportError} onOpenChange={setShowReportError}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Report Error for Auto-Fix
            </DialogTitle>
            <DialogDescription>
              Report an error and our AI agents will attempt to fix it automatically
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Error Type *</Label>
              <Input
                placeholder="e.g., TypeError, SyntaxError, 500 Error"
                value={reportErrorForm.error_type}
                onChange={(e) => setReportErrorForm({...reportErrorForm, error_type: e.target.value})}
              />
            </div>
            <div>
              <Label>Error Message *</Label>
              <Textarea
                placeholder="Describe the error message..."
                value={reportErrorForm.error_message}
                onChange={(e) => setReportErrorForm({...reportErrorForm, error_message: e.target.value})}
                rows={3}
              />
            </div>
            <div>
              <Label>File Path (optional)</Label>
              <Input
                placeholder="e.g., /src/pages/HomePage.js"
                value={reportErrorForm.file_path}
                onChange={(e) => setReportErrorForm({...reportErrorForm, file_path: e.target.value})}
              />
            </div>
            <div>
              <Label>Stack Trace (optional)</Label>
              <Textarea
                placeholder="Paste the full stack trace..."
                value={reportErrorForm.stack_trace}
                onChange={(e) => setReportErrorForm({...reportErrorForm, stack_trace: e.target.value})}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowReportError(false)}>Cancel</Button>
            <Button onClick={reportError} className="bg-blue-600 hover:bg-blue-700">
              <Zap className="w-4 h-4 mr-1" />
              Report & Auto-Fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Details Dialog */}
      <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className={`w-5 h-5 ${
                selectedError?.severity === 'critical' ? 'text-red-600' :
                selectedError?.severity === 'high' ? 'text-orange-600' : 'text-yellow-600'
              }`} />
              Error Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedError && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={SEVERITY_COLORS[selectedError.severity]}>
                  {selectedError.severity}
                </Badge>
                <Badge variant="outline">{selectedError.error_category}</Badge>
                <Badge className={`${ERROR_STATUS_COLORS[selectedError.status]} text-white`}>
                  {selectedError.status}
                </Badge>
                <span className="text-sm text-gray-500">
                  {selectedError.source}
                </span>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Error Type</h4>
                <p className="mt-1">{selectedError.error_type}</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Message</h4>
                <p className="mt-1 text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  {selectedError.error_message}
                </p>
              </div>
              
              {selectedError.file_path && (
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Location</h4>
                  <p className="mt-1 font-mono text-sm">
                    {selectedError.file_path}
                    {selectedError.line_number && `:${selectedError.line_number}`}
                  </p>
                </div>
              )}
              
              {selectedError.stack_trace && (
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Stack Trace</h4>
                  <pre className="mt-1 text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
                    {selectedError.stack_trace}
                  </pre>
                </div>
              )}
              
              {selectedError.assigned_agent && (
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Assigned Agent</h4>
                  <p className="mt-1">{selectedError.assigned_agent}</p>
                </div>
              )}
              
              {selectedError.fix_result && (
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Fix Result</h4>
                  <p className="mt-1 text-sm">{selectedError.fix_result}</p>
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                <span>Created: {new Date(selectedError.created_at).toLocaleString()}</span>
                {selectedError.resolved_at && (
                  <span>Resolved: {new Date(selectedError.resolved_at).toLocaleString()}</span>
                )}
              </div>
              
              {selectedError.status !== 'fixed' && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => resolveError(selectedError.error_id, 'Manually investigated and resolved')}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Mark as Resolved
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Handoff Dialog */}
      <Dialog open={handoffDialogOpen} onOpenChange={setHandoffDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-orange-500" />
              Manual Error Handoff
            </DialogTitle>
            <DialogDescription>
              Transfer this error to a different agent for resolution
            </DialogDescription>
          </DialogHeader>
          
          {selectedHandoffError && (
            <div className="space-y-4 mt-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium text-sm">{selectedHandoffError.error_type}</p>
                <p className="text-xs text-gray-500 truncate">{selectedHandoffError.error_message}</p>
                <div className="flex gap-2 mt-2">
                  <Badge className={SEVERITY_COLORS[selectedHandoffError.severity]}>
                    {selectedHandoffError.severity}
                  </Badge>
                  <Badge variant="outline">{selectedHandoffError.error_category}</Badge>
                </div>
              </div>
              
              <div>
                <Label>From Agent</Label>
                <select
                  value={handoffForm.from_agent}
                  onChange={(e) => setHandoffForm({...handoffForm, from_agent: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
                  data-testid="handoff-from-agent"
                >
                  <option value="">Select source agent</option>
                  {status?.agents?.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.agent_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <Label>To Agent *</Label>
                <select
                  value={handoffForm.to_agent}
                  onChange={(e) => setHandoffForm({...handoffForm, to_agent: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
                  data-testid="handoff-to-agent"
                >
                  <option value="">Select target agent</option>
                  {status?.agents?.filter(a => a.status === 'running' && a.agent_id !== handoffForm.from_agent).map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.agent_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <Label>Reason (optional)</Label>
                <Textarea
                  placeholder="Why is this error being handed off?"
                  value={handoffForm.reason}
                  onChange={(e) => setHandoffForm({...handoffForm, reason: e.target.value})}
                  rows={2}
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setHandoffDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={triggerHandoff} 
              className="bg-orange-600 hover:bg-orange-700"
              disabled={!handoffForm.to_agent}
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              Handoff Error
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
