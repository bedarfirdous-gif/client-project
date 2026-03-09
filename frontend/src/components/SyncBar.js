import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

/**
 * SyncBar Component - Provides sync functionality for data consistency
 * @param {function} api - API function from useAuth
 * @param {function} onSyncComplete - Callback after successful sync
 * @param {string} variant - "bar" | "button" | "icon"
 * @param {string} className - Additional CSS classes
 */
export default function SyncBar({ api, onSyncComplete, variant = "bar", className = "" }) {
  const [syncing, setSyncing] = useState(false);
  const [item, setItem] = useState(false);
  const [lastSync, setLastSync] = useState(() => {
    const saved = localStorage.getItem('lastSyncTime');
    return saved ? new Date(saved) : null;
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Sync inventory with items
      const result = await api('/api/inventory/sync-items', { method: 'POST' });
      
      const now = new Date();
      setLastSync(now);
      localStorage.setItem('lastSyncTime', now.toISOString());
      
      toast.success(result.message || 'Data synced successfully');
      
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err) {
      toast.error('Sync failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never synced';
    const diff = Date.now() - new Date(lastSync).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getSyncStatus = () => {
    if (!lastSync) return { icon: AlertCircle, color: 'text-amber-500', status: 'Never synced' };
    const diff = Date.now() - new Date(lastSync).getTime();
    const hours = diff / 3600000;
    
    if (hours < 1) return { icon: CheckCircle, color: 'text-green-500', status: 'Up to date' };
    if (hours < 24) return { icon: Clock, color: 'text-blue-500', status: 'Synced today' };
    return { icon: AlertCircle, color: 'text-amber-500', status: 'Sync recommended' };
  };

  const syncStatus = getSyncStatus();
  const StatusIcon = syncStatus.icon;

  // Icon only variant
  if (variant === "icon") {
    return (
      <Button 
        variant="ghost" 
        size="icon"
        onClick={handleSync}
        disabled={syncing}
        className={className}
        title={`Last sync: ${formatLastSync()}`}
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
      </Button>
    );
  }

  // Button variant
  if (variant === "button") {
    return (
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        className={`gap-2 ${className}`}
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing...' : 'Sync Data'}
      </Button>
    );
  }

  // Full bar variant (default)
  return (
    <div className={`flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg ${className}`}>
      <div className="flex items-center gap-3">
        <StatusIcon className={`w-5 h-5 ${syncStatus.color}`} />
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {syncStatus.status}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last sync: {formatLastSync()}
          </p>
        </div>
      </div>
      <Button 
        variant="default" 
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        className="gap-2 bg-blue-600 hover:bg-blue-700"
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing...' : 'Sync Now'}
      </Button>
    </div>
  );
}
