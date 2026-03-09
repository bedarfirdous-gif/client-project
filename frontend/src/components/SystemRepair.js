import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  RefreshCw, Trash2, Shield, AlertTriangle, CheckCircle, 
  Database, HardDrive, Activity, Zap, Settings, Bug,
  RotateCcw, Power, Clock, FileText, XCircle, Loader2
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

// Constants for crash detection
const CRASH_LOG_KEY = 'bijnisbooks_crash_log';
const REFRESH_LOG_KEY = 'bijnisbooks_refresh_log';
const SAFE_MODE_KEY = 'bijnisbooks_safe_mode';
const CRASH_THRESHOLD = 3; // Number of crashes in short time to trigger safe mode
const CRASH_WINDOW_MS = 60000; // 1 minute window for crash detection

// System health check utilities
const SystemUtils = {
  // Log a crash/error event
  logCrash: (error, context = '') => {
    try {
      const crashes = JSON.parse(localStorage.getItem(CRASH_LOG_KEY) || '[]');
      crashes.push({
        timestamp: Date.now(),
        error: error?.message || String(error),
        context,
        url: window.location.href,
        userAgent: navigator.userAgent
      });
      // Keep only last 50 crashes
      if (crashes.length > 50) crashes.splice(0, crashes.length - 50);
      localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(crashes));
    } catch (e) {
      console.error('Failed to log crash:', e);
    }
  },

  // Log refresh action
  logRefresh: (type, success = true) => {
    try {
      const refreshes = JSON.parse(localStorage.getItem(REFRESH_LOG_KEY) || '[]');
      refreshes.push({
        timestamp: Date.now(),
        type,
        success,
        url: window.location.href
      });
      // Keep only last 100 refresh logs
      if (refreshes.length > 100) refreshes.splice(0, refreshes.length - 100);
      localStorage.setItem(REFRESH_LOG_KEY, JSON.stringify(refreshes));
    } catch (e) {
      console.error('Failed to log refresh:', e);
    }
  },

  // Check if safe mode should be activated
  shouldEnterSafeMode: () => {
    try {
      const crashes = JSON.parse(localStorage.getItem(CRASH_LOG_KEY) || '[]');
      const recentCrashes = crashes.filter(c => Date.now() - c.timestamp < CRASH_WINDOW_MS);
      return recentCrashes.length >= CRASH_THRESHOLD;
    } catch (e) {
      return false;
    }
  },

  // Check if currently in safe mode
  isInSafeMode: () => {
    return localStorage.getItem(SAFE_MODE_KEY) === 'true';
  },

  // Enter safe mode
  enterSafeMode: () => {
    localStorage.setItem(SAFE_MODE_KEY, 'true');
    SystemUtils.logRefresh('enter_safe_mode', true);
  },

  // Exit safe mode
  exitSafeMode: () => {
    localStorage.removeItem(SAFE_MODE_KEY);
    SystemUtils.logRefresh('exit_safe_mode', true);
  },

  // Get crash log
  getCrashLog: () => {
    try {
      return JSON.parse(localStorage.getItem(CRASH_LOG_KEY) || '[]');
    } catch {
      return [];
    }
  },

  // Get refresh log
  getRefreshLog: () => {
    try {
      return JSON.parse(localStorage.getItem(REFRESH_LOG_KEY) || '[]');
    } catch {
      return [];
    }
  },

  // Clear crash log
  clearCrashLog: () => {
    localStorage.removeItem(CRASH_LOG_KEY);
  },

  // Get system health info
  getSystemHealth: () => {
    const crashes = SystemUtils.getCrashLog();
    const recentCrashes = crashes.filter(c => Date.now() - c.timestamp < 3600000); // Last hour
    const refreshes = SystemUtils.getRefreshLog();
    const recentRefreshes = refreshes.filter(r => Date.now() - r.timestamp < 3600000);
    
    let status = 'healthy';
    if (recentCrashes.length >= 1) status = 'warning';
    if (recentCrashes.length >= CRASH_THRESHOLD) status = 'critical';
    
    return {
      status,
      totalCrashes: crashes.length,
      recentCrashes: recentCrashes.length,
      totalRefreshes: refreshes.length,
      recentRefreshes: recentRefreshes.length,
      isInSafeMode: SystemUtils.isInSafeMode(),
      lastCrash: crashes.length > 0 ? new Date(crashes[crashes.length - 1].timestamp) : null
    };
  }
};

// Export for global error handling
export { SystemUtils };

// Refresh Button Component for Dashboard
export function RefreshButton({ onRefresh, size = 'default' }) {
  const [refreshing, setRefreshing] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [item, setItem] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    SystemUtils.logRefresh('manual_refresh', true);
    
    try {
      // Clear session data that might cause issues
      sessionStorage.clear();
      
      // Call parent refresh if provided
      if (onRefresh) {
        await onRefresh();
      }
      
      toast.success('Application refreshed successfully');
    } catch (err) {
      SystemUtils.logCrash(err, 'manual_refresh');
      toast.error('Refresh failed - try clearing cache');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size={size}
      onClick={handleRefresh}
      disabled={refreshing}
      className="gap-2"
      data-testid="refresh-btn"
    >
      <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
      {size !== 'icon' && (refreshing ? 'Refreshing...' : 'Refresh')}
    </Button>
  );
}

// System Health Indicator
export function SystemHealthIndicator({ onClick }) {
  const [health, setHealth] = useState(() => SystemUtils.getSystemHealth());

  if (!health) return null;

  const statusColors = {
    healthy: 'bg-green-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500'
  };

  const statusIcons = {
    healthy: <CheckCircle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    critical: <XCircle className="w-4 h-4" />
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={onClick}
      className="gap-2"
      data-testid="system-health-btn"
    >
      <span className={`w-2 h-2 rounded-full ${statusColors[health.status]} ${health.status !== 'healthy' ? 'animate-pulse' : ''}`} />
      {health.isInSafeMode && (
        <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Safe Mode</Badge>
      )}
    </Button>
  );
}

// Main System Repair Dialog
export default function SystemRepairDialog({ isOpen, onClose }) {
  const { api } = useAuth();
  // Initialize with current health immediately (instead of null) to prevent a visual flash
  // on first render; loadData() still refreshes when the dialog opens.
  const [health, setHealth] = useState(() => SystemUtils.getSystemHealth());
  const [cleaning, setCleaning] = useState(false);
  const [cleanProgress, setCleanProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  // Load health and logs when dialog opens
  const loadData = useCallback(() => {
    setHealth(SystemUtils.getSystemHealth());
    setLogs([...SystemUtils.getCrashLog(), ...SystemUtils.getRefreshLog()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50));
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const clearLocalCache = async () => {
    setCleaning(true);
    setCleanProgress(10);
    
    try {
      // Step 1: Clear session storage
      sessionStorage.clear();
      setCleanProgress(20);
      SystemUtils.logRefresh('clear_session_storage', true);
      
      // Step 2: Clear local storage (except critical keys)
      const keysToKeep = ['token', 'user', 'theme', 'language', SAFE_MODE_KEY];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToKeep.some(k => key.includes(k))) {
          localStorage.removeItem(key);
        }
      });
      setCleanProgress(40);
      SystemUtils.logRefresh('clear_local_storage', true);
      
      // Step 3: Clear IndexedDB
      const databases = ['bijnisbooks-offline', 'bijnisbooks-db'];
      for (const dbName of databases) {
        try {
          await new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(dbName);
            req.onsuccess = resolve;
            req.onerror = reject;
            req.onblocked = resolve;
          });
        } catch (e) {
          console.warn(`Could not delete ${dbName}:`, e);
        }
      }
      setCleanProgress(60);
      SystemUtils.logRefresh('clear_indexeddb', true);
      
      // Step 4: Clear Service Worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      setCleanProgress(80);
      SystemUtils.logRefresh('clear_sw_cache', true);
      
      // Step 5: Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      setCleanProgress(90);
      SystemUtils.logRefresh('unregister_sw', true);
      
      // Step 6: Clear crash log
      SystemUtils.clearCrashLog();
      setCleanProgress(100);
      
      toast.success('Cache cleared successfully! Reloading...');
      SystemUtils.logRefresh('full_cache_clear', true);
      
      // Reload after short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      SystemUtils.logCrash(err, 'clear_cache');
      toast.error('Failed to clear some caches');
      setCleaning(false);
    }
  };

  const repairSystem = async () => {
    setCleaning(true);
    setCleanProgress(0);
    
    try {
      // Step 1: Clear frontend caches
      setCleanProgress(20);
      await clearLocalCache();
      
      // Step 2: Call backend cleanup API
      setCleanProgress(50);
      try {
        await api('/api/system/cleanup', { method: 'POST' });
        SystemUtils.logRefresh('backend_cleanup', true);
      } catch (e) {
        console.warn('Backend cleanup not available:', e);
      }
      
      // Step 3: Exit safe mode if in it
      if (SystemUtils.isInSafeMode()) {
        SystemUtils.exitSafeMode();
      }
      
      setCleanProgress(100);
      toast.success('System repair complete! Reloading...');
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      SystemUtils.logCrash(err, 'repair_system');
      toast.error('System repair failed');
      setCleaning(false);
    }
  };

  const toggleSafeMode = () => {
    if (SystemUtils.isInSafeMode()) {
      SystemUtils.exitSafeMode();
      toast.success('Safe Mode disabled. Reloading...');
    } else {
      SystemUtils.enterSafeMode();
      toast.success('Safe Mode enabled. Reloading with minimal features...');
    }
    setTimeout(() => window.location.reload(), 1000);
  };

  const softRefresh = async () => {
    SystemUtils.logRefresh('soft_refresh', true);
    sessionStorage.clear();
    
    // Dispatch custom event to trigger data refresh in components
    window.dispatchEvent(new CustomEvent('bijnisbooks-refresh'));
    
    toast.success('Application state refreshed');
    setHealth(SystemUtils.getSystemHealth());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" /> System Maintenance
          </DialogTitle>
          <DialogDescription>
            Refresh, repair, and monitor system health
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* System Health Status */}
          {health && (
            <Card className={`border-2 ${
              health.status === 'healthy' ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10' :
              health.status === 'warning' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-900/10' :
              'border-red-200 bg-red-50/50 dark:bg-red-900/10'
            }`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {health.status === 'healthy' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : health.status === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="font-medium capitalize">{health.status}</span>
                  </div>
                  {health.isInSafeMode && (
                    <Badge className="bg-amber-500">Safe Mode Active</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Recent Errors</p>
                    <p className="font-medium">{health.recentCrashes} (last hour)</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Refreshes</p>
                    <p className="font-medium">{health.totalRefreshes}</p>
                  </div>
                  {health.lastCrash && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Last Error</p>
                      <p className="font-medium text-xs">{health.lastCrash.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Bar */}
          {cleaning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Cleaning in progress...</span>
                <span>{cleanProgress}%</span>
              </div>
              <Progress value={cleanProgress} className="h-2" />
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={softRefresh} 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center gap-1"
              disabled={cleaning}
              data-testid="soft-refresh-btn"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="text-xs">Quick Refresh</span>
            </Button>
            
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1"
              disabled={cleaning}
              data-testid="hard-reload-btn"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="text-xs">Hard Reload</span>
            </Button>
            
            <Button 
              onClick={clearLocalCache} 
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1 text-amber-600 border-amber-200 hover:bg-amber-50"
              disabled={cleaning}
              data-testid="clear-cache-btn"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-xs">Clear Cache</span>
            </Button>
            
            <Button 
              onClick={repairSystem}
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
              disabled={cleaning}
              data-testid="repair-system-btn"
            >
              <Zap className="w-5 h-5" />
              <span className="text-xs">Full Repair</span>
            </Button>
          </div>

          {/* Safe Mode Toggle */}
          <Card className="border-amber-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-sm">Safe Mode</p>
                    <p className="text-xs text-muted-foreground">Load minimal features if unstable</p>
                  </div>
                </div>
                <Button 
                  variant={SystemUtils.isInSafeMode() ? "default" : "outline"}
                  size="sm"
                  onClick={toggleSafeMode}
                  disabled={cleaning}
                  data-testid="safe-mode-btn"
                >
                  {SystemUtils.isInSafeMode() ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* System Logs */}
          <div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowLogs(!showLogs)}
              className="w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> System Logs ({logs.length})
              </span>
              <span>{showLogs ? '▲' : '▼'}</span>
            </Button>
            
            {showLogs && (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                {logs.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">No logs recorded</p>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="p-2 border-b last:border-0 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className={log.error ? 'text-red-600' : 'text-green-600'}>
                          {log.error ? 'Error' : log.type || 'Action'}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {log.error && <p className="text-red-600 truncate">{log.error}</p>}
                      {log.context && <p className="text-muted-foreground">{log.context}</p>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={cleaning}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
