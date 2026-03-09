import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Scan, Activity,
  FileWarning, FileCheck, Cpu, HardDrive, MemoryStick, Wifi,
  Play, Square, RefreshCw, Trash2, AlertTriangle, CheckCircle,
  XCircle, Clock, Loader2, Bug, Zap, Database, Server,
  Lock, Unlock, Eye, FolderSearch, AlertOctagon, FileX,
  Settings, BarChart3, TrendingUp, History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';

// Severity badge component
const SeverityBadge = ({ severity }) => {
  const config = {
    critical: { color: 'bg-red-500 text-white', icon: AlertOctagon },
    high: { color: 'bg-orange-500 text-white', icon: AlertTriangle },
    medium: { color: 'bg-yellow-500 text-black', icon: AlertTriangle },
    low: { color: 'bg-blue-500 text-white', icon: Shield },
  };
  const cfg = config[severity] || config.medium;
  const Icon = cfg.icon;
  
  return (
    <Badge className={`${cfg.color} gap-1`}>
      <Icon className="w-3 h-3" />
      {severity}
    </Badge>
  );
};

// Status indicator component
const StatusIndicator = ({ status, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  const colors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    critical: 'bg-red-500',
    running: 'bg-green-500 animate-pulse',
    stopped: 'bg-gray-400',
  };
  
  return (
    <span className={`${sizeClass} rounded-full ${colors[status] || 'bg-gray-400'}`} />
  );
};

// Metric card component
const MetricCard = ({ title, value, unit, icon: Icon, status, threshold }) => {
  const getStatusColor = () => {
    if (!threshold) return 'text-foreground';
    if (value > threshold.critical) return 'text-red-500';
    if (value > threshold.warning) return 'text-yellow-500';
    return 'text-green-500';
  };
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{title}</span>
          </div>
          {status && <StatusIndicator status={status} size="sm" />}
        </div>
        <div className="mt-2">
          <span className={`text-2xl font-bold ${getStatusColor()}`}>{value}</span>
          <span className="text-sm text-muted-foreground ml-1">{unit}</span>
        </div>
        {threshold && (
          <Progress 
            value={value} 
            className="mt-2 h-1.5" 
          />
        )}
      </CardContent>
    </Card>
  );
};

// Fix history item component
const FixHistoryItem = ({ fix }) => {
  const resultConfig = {
    success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/30' },
    partial: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
    skipped: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-950/30' },
  };
  const cfg = resultConfig[fix.result] || resultConfig.skipped;
  const Icon = cfg.icon;
  
  return (
    <div className={`p-3 rounded-lg ${cfg.bg} mb-2`} data-testid={`fix-item-${fix.fix_id}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 mt-0.5 ${cfg.color}`} />
          <div>
            <p className="font-medium text-sm">{fix.error_type}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{fix.details}</p>
          </div>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="text-[10px]">
            {fix.execution_time_ms}ms
          </Badge>
          <p className="text-[10px] text-muted-foreground mt-1">
            {new Date(fix.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

// Threat item component
const ThreatItem = ({ threat, onQuarantine }) => (
  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 mb-2" data-testid={`threat-${threat.file}`}>
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3">
        <FileWarning className="w-5 h-5 text-red-500 mt-0.5" />
        <div>
          <p className="font-medium text-sm text-red-700 dark:text-red-300">{threat.file.split('/').pop()}</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Pattern: {threat.pattern}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{threat.file}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <SeverityBadge severity={threat.severity} />
        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => onQuarantine(threat.file)}>
          <Trash2 className="w-3 h-3 mr-1" />
          Quarantine
        </Button>
      </div>
    </div>
  </div>
);

export default function SecurityDashboard() {
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [interval, setInterval] = useState(false);
  
  // State
  // NOTE: Initializing these as `null` can cause a first-render mismatch where the UI briefly renders an "empty" branch
  // (e.g. `data && ...`) and then immediately switches to the loaded branch, resulting in a visible flash.
  // Use stable empty objects and explicit "loaded" flags so the UI can render a consistent placeholder/skeleton state.
  const [healerStatus, setHealerStatus] = useState({});
  const [systemHealth, setSystemHealth] = useState({});
  const [scanResult, setScanResult] = useState({});
  const [integrityResult, setIntegrityResult] = useState({});
  const [isLoaded, setIsLoaded] = useState({ status: false, health: false, scan: false, integrity: false });
  const [loading, setLoading] = useState({ status: false, health: false, scan: false, integrity: false });
  const [scanning, setScanning] = useState(false);
  const [fixInProgress, setFixInProgress] = useState(false);
  const [selectedFixType, setSelectedFixType] = useState('');
  const [showFixDialog, setShowFixDialog] = useState(false);

  // Fetch healer status
  const fetchStatus = useCallback(async () => {
    setLoading(prev => ({ ...prev, status: true }));
    try {
      const data = await api('/api/autonomous-healer/status');
      setHealerStatus(data);
    } catch (err) {
      console.error('Failed to fetch healer status:', err);
    } finally {
      setLoading(prev => ({ ...prev, status: false }));
    }
  }, [api]);

  // Fetch system health
  const fetchHealth = useCallback(async () => {
    setLoading(prev => ({ ...prev, health: true }));
    try {
      const data = await api('/api/autonomous-healer/health');
      setSystemHealth(data);
    } catch (err) {
      console.error('Failed to fetch system health:', err);
    } finally {
      setLoading(prev => ({ ...prev, health: false }));
    }
  }, [api]);

  // Run security scan
  const runSecurityScan = async () => {
    setScanning(true);
    try {
      const data = await api('/api/autonomous-healer/scan', { method: 'POST' });
      setScanResult(data);
      if (data.clean) {
        toast.success('Security scan complete - No threats detected!');
      } else {
        toast.error(`Security scan found ${data.threats_found?.length || 0} threat(s)!`);
      }
    } catch (err) {
      toast.error('Security scan failed');
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  // Run integrity check
  const runIntegrityCheck = async () => {
    setLoading(prev => ({ ...prev, integrity: true }));
    try {
      const data = await api('/api/autonomous-healer/integrity', { method: 'POST' });
      setIntegrityResult(data);
      if (data.integrity_ok) {
        toast.success('File integrity verified - All files intact!');
      } else {
        toast.warning(`Integrity issues found: ${data.modified_files?.length || 0} modified, ${data.missing_files?.length || 0} missing`);
      }
    } catch (err) {
      toast.error('Integrity check failed');
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, integrity: false }));
    }
  };

  // Start autonomous healer
  const startHealer = async () => {
    try {
      await api('/api/autonomous-healer/start', { method: 'POST' });
      toast.success('Autonomous healer started');
      fetchStatus();
    } catch (err) {
      toast.error('Failed to start healer');
    }
  };

  // Stop autonomous healer
  const stopHealer = async () => {
    try {
      await api('/api/autonomous-healer/stop', { method: 'POST' });
      toast.success('Autonomous healer stopped');
      fetchStatus();
    } catch (err) {
      toast.error('Failed to stop healer');
    }
  };

  // Trigger manual fix
  const triggerFix = async (errorType) => {
    setFixInProgress(true);
    try {
      const data = await api('/api/autonomous-healer/fix', {
        method: 'POST',
        body: JSON.stringify({
          error_type: errorType,
          error_message: `Manual fix triggered for ${errorType}`
        })
      });
      
      if (data.result === 'success') {
        toast.success(`Fix successful: ${data.details}`);
      } else if (data.result === 'skipped') {
        toast.info(`Fix skipped: ${data.details}`);
      } else {
        toast.warning(`Fix result: ${data.result} - ${data.details}`);
      }
      
      fetchStatus();
    } catch (err) {
      toast.error('Fix failed');
      console.error(err);
    } finally {
      setFixInProgress(false);
      setShowFixDialog(false);
    }
  };

  // Quarantine threat
  const quarantineThreat = async (filePath) => {
    toast.info(`Quarantining: ${filePath.split('/').pop()}`);
    // In a real implementation, this would call the quarantine API
  };

  // Initial fetch
  useEffect(() => {
    fetchStatus();
    fetchHealth();
  }, [fetchStatus, fetchHealth]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      fetchHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchHealth]);

  const fixTypes = [
    { value: 'database', label: 'Database Connection', icon: Database },
    { value: 'memory', label: 'Memory Cleanup', icon: MemoryStick },
    { value: 'network', label: 'Network Issues', icon: Wifi },
    { value: 'dependency', label: 'Dependencies', icon: Settings },
    { value: 'permission', label: 'Permissions', icon: Lock },
    { value: 'frontend', label: 'Frontend', icon: Server },
    { value: 'async', label: 'Async Errors', icon: Zap },
    { value: 'thread', label: 'Thread Issues', icon: Cpu },
  ];

  return (
    <div className="space-y-6" data-testid="security-dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            Security Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Antivirus scanning, system protection & autonomous healing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={healerStatus?.is_running ? "default" : "secondary"} 
            className="gap-1"
          >
            <StatusIndicator status={healerStatus?.is_running ? 'running' : 'stopped'} size="sm" />
            {healerStatus?.is_running ? 'Protection Active' : 'Protection Inactive'}
          </Badge>
          {healerStatus?.is_running ? (
            <Button variant="outline" size="sm" onClick={stopHealer}>
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
          ) : (
            <Button size="sm" onClick={startHealer}>
              <Play className="w-4 h-4 mr-1" />
              Start Protection
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="CPU Usage"
          value={systemHealth?.metrics?.cpu_percent?.toFixed(1) || '0'}
          unit="%"
          icon={Cpu}
          status={systemHealth?.status}
          threshold={{ warning: 70, critical: 90 }}
        />
        <MetricCard
          title="Memory Usage"
          value={systemHealth?.metrics?.memory_percent?.toFixed(1) || '0'}
          unit="%"
          icon={MemoryStick}
          threshold={{ warning: 75, critical: 90 }}
        />
        <MetricCard
          title="Disk Usage"
          value={systemHealth?.metrics?.disk_percent?.toFixed(1) || '0'}
          unit="%"
          icon={HardDrive}
          threshold={{ warning: 80, critical: 95 }}
        />
        <MetricCard
          title="Success Rate"
          value={healerStatus?.statistics?.success_rate?.toFixed(1) || '100'}
          unit="%"
          icon={TrendingUp}
        />
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="scan" className="gap-2" data-testid="tab-scan">
            <Scan className="w-4 h-4" />
            <span className="hidden sm:inline">Antivirus</span>
          </TabsTrigger>
          <TabsTrigger value="integrity" className="gap-2" data-testid="tab-integrity">
            <FileCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Integrity</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="w-5 h-5" />
                  System Status
                </CardTitle>
                <CardDescription>Real-time system health monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <StatusIndicator status={systemHealth?.status || 'healthy'} />
                      <span className="font-medium">Overall Status</span>
                    </div>
                    <Badge variant={systemHealth?.status === 'healthy' ? 'default' : 'destructive'}>
                      {systemHealth?.status || 'Unknown'}
                    </Badge>
                  </div>
                  
                  {systemHealth?.issues?.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-destructive">Active Issues:</p>
                      {systemHealth.issues.map((issue, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-destructive/10 rounded">
                          <span className="text-sm">{issue.type}</span>
                          <span className="text-sm font-mono">{issue.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">No issues detected</span>
                    </div>
                  )}
                  
                  <Button variant="outline" className="w-full" onClick={() => { fetchHealth(); fetchStatus(); }}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Status
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Manual fix triggers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {fixTypes.map((fix) => {
                    const Icon = fix.icon;
                    return (
                      <Button
                        key={fix.value}
                        variant="outline"
                        className="h-auto py-3 flex-col gap-1"
                        onClick={() => { setSelectedFixType(fix.value); setShowFixDialog(true); }}
                        disabled={fixInProgress}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs">{fix.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="w-5 h-5" />
                  Fix Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold">{healerStatus?.statistics?.total_fixes || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Fixes</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{healerStatus?.statistics?.successful || 0}</p>
                    <p className="text-sm text-muted-foreground">Successful</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-600">{healerStatus?.statistics?.partial || 0}</p>
                    <p className="text-sm text-muted-foreground">Partial</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <p className="text-3xl font-bold text-red-600">{healerStatus?.statistics?.failed || 0}</p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Antivirus Scan Tab */}
        <TabsContent value="scan" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {scanResult?.clean === false ? (
                      <ShieldAlert className="w-5 h-5 text-red-500" />
                    ) : scanResult?.clean === true ? (
                      <ShieldCheck className="w-5 h-5 text-green-500" />
                    ) : (
                      <Shield className="w-5 h-5" />
                    )}
                    Antivirus Scanner
                  </CardTitle>
                  <CardDescription>Scan for malware, vulnerabilities, and suspicious code</CardDescription>
                </div>
                <Button onClick={runSecurityScan} disabled={scanning} data-testid="run-scan-btn">
                  {scanning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Scan className="w-4 h-4 mr-2" />
                      Run Full Scan
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {scanResult ? (
                <div className="space-y-4">
                  {/* Scan Summary */}
                  <div className={`p-4 rounded-lg ${scanResult.clean ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {scanResult.clean ? (
                          <ShieldCheck className="w-8 h-8 text-green-500" />
                        ) : (
                          <ShieldX className="w-8 h-8 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">
                            {scanResult.clean ? 'System is Clean' : 'Threats Detected!'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Scanned {scanResult.files_scanned} files
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {new Date(scanResult.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Threats */}
                  {scanResult.threats_found?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2 text-red-600">
                        <AlertOctagon className="w-4 h-4" />
                        Threats Found ({scanResult.threats_found.length})
                      </h4>
                      <ScrollArea className="h-[200px]">
                        {scanResult.threats_found.map((threat, idx) => (
                          <ThreatItem key={idx} threat={threat} onQuarantine={quarantineThreat} />
                        ))}
                      </ScrollArea>
                    </div>
                  )}

                  {/* Suspicious Files */}
                  {scanResult.suspicious_files?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2 text-yellow-600">
                        <AlertTriangle className="w-4 h-4" />
                        Suspicious Files ({scanResult.suspicious_files.length})
                      </h4>
                      <ScrollArea className="h-[150px]">
                        {scanResult.suspicious_files.map((file, idx) => (
                          <div key={idx} className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg mb-2">
                            <div className="flex items-center gap-2">
                              <FileWarning className="w-4 h-4 text-yellow-500" />
                              <span className="text-sm font-medium">{file.file.split('/').pop()}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{file.reason}</p>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Scan className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No scan results yet</p>
                  <p className="text-sm mt-1">Click "Run Full Scan" to start</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrity Tab */}
        <TabsContent value="integrity" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5" />
                    File Integrity Verification
                  </CardTitle>
                  <CardDescription>Verify critical files haven't been modified</CardDescription>
                </div>
                <Button onClick={runIntegrityCheck} disabled={loading.integrity} data-testid="run-integrity-btn">
                  {loading.integrity ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <FolderSearch className="w-4 h-4 mr-2" />
                      Verify Integrity
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {integrityResult ? (
                <div className="space-y-4">
                  {/* Integrity Summary */}
                  <div className={`p-4 rounded-lg ${integrityResult.integrity_ok ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                    <div className="flex items-center gap-3">
                      {integrityResult.integrity_ok ? (
                        <FileCheck className="w-8 h-8 text-green-500" />
                      ) : (
                        <FileX className="w-8 h-8 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">
                          {integrityResult.integrity_ok ? 'All Files Intact' : 'Integrity Issues Found'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Checked {integrityResult.files_checked} critical files
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Modified Files */}
                  {integrityResult.modified_files?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 text-yellow-600">Modified Files</h4>
                      {integrityResult.modified_files.map((file, idx) => (
                        <div key={idx} className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg mb-2">
                          <p className="text-sm font-medium">{file.file}</p>
                          <p className="text-xs text-muted-foreground">
                            Expected: {file.expected_hash}... | Current: {file.current_hash}...
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Missing Files */}
                  {integrityResult.missing_files?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 text-red-600">Missing Files</h4>
                      {integrityResult.missing_files.map((file, idx) => (
                        <div key={idx} className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg mb-2">
                          <p className="text-sm font-medium">{file}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No integrity check performed yet</p>
                  <p className="text-sm mt-1">Click "Verify Integrity" to start</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Fix History
              </CardTitle>
              <CardDescription>Recent automatic and manual fixes</CardDescription>
            </CardHeader>
            <CardContent>
              {healerStatus?.recent_fixes?.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  {healerStatus.recent_fixes.map((fix, idx) => (
                    <FixHistoryItem key={idx} fix={fix} />
                  ))}
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No fix history yet</p>
                  <p className="text-sm mt-1">Fixes will appear here as they're applied</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fix Confirmation Dialog */}
      <Dialog open={showFixDialog} onOpenChange={setShowFixDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trigger Manual Fix</DialogTitle>
            <DialogDescription>
              Are you sure you want to trigger a fix for "{selectedFixType}"? This may restart services.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFixDialog(false)}>Cancel</Button>
            <Button onClick={() => triggerFix(selectedFixType)} disabled={fixInProgress}>
              {fixInProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              Apply Fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
