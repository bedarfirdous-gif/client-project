import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { 
  Users, Shield, X, AlertTriangle, Clock, Globe, CheckCircle, 
  XCircle, RefreshCw, Eye, Bell, Wifi, WifiOff, MapPin
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

export default function SecurityCenter() {
  const { api, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [interval, setInterval] = useState(false);
  const [activeTab, setActiveTab] = useState('online'); // 'online' | 'alerts'
  const [onlineUsers, setOnlineUsers] = useState({ online: [], offline: [] });
  const [alerts, setAlerts] = useState([]);
  const [unackCount, setUnackCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const fetchData = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      const [usersData, alertsData] = await Promise.all([
        api('/api/users/online').catch(() => ({ online: [], offline: [] })),
        api('/api/security/alerts?limit=20').catch(() => ({ alerts: [], unacknowledged_count: 0 })),
      ]);
      
      setOnlineUsers(usersData);
      setAlerts(alertsData.alerts || []);
      setUnackCount(alertsData.unacknowledged_count || 0);
    } catch (err) {
      console.error('Failed to fetch security data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Send heartbeat every minute
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await api('/api/auth/heartbeat', { method: 'POST' });
      } catch (err) {
        // Ignore errors
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen && isAdmin) {
      fetchData();
    }
  }, [isOpen]);

  // Auto refresh disabled - manual refresh only
  // useEffect(() => {
  //   if (isOpen && isAdmin) {
  //     const interval = setInterval(fetchData, 60 * 60 * 1000);
  //     return () => clearInterval(interval);
  //   }
  // }, [isOpen]);

  const acknowledgeAlert = async (alertId) => {
    try {
      await api(`/api/security/alerts/${alertId}/acknowledge`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const acknowledgeAll = async () => {
    try {
      await api('/api/security/alerts/acknowledge-all', { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to acknowledge alerts:', err);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'late_night_access': return <Clock className="w-4 h-4" />;
      case 'new_ip_address': return <Globe className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'warning': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      default: return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    }
  };

  if (!isAdmin) return null;

  return (
    <>
      {/* Security Icon Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 hover:bg-accent rounded-lg transition-colors"
        data-testid="security-center-btn"
        title="Security Center"
      >
        <Shield className="w-5 h-5" />
        {unackCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {unackCount}
          </span>
        )}
        {/* Online indicator */}
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background"></span>
      </button>

      {/* Security Center Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Security Center
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-2 border-b pb-3">
            <button
              onClick={() => setActiveTab('online')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'online' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'hover:bg-accent'
              }`}
            >
              <Users className="w-4 h-4" />
              Online Users
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-green-500 text-white">
                {onlineUsers.online?.length || 0}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'alerts' 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                  : 'hover:bg-accent'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Security Alerts
              {unackCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
                  {unackCount}
                </span>
              )}
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[50vh] overflow-y-auto">
            {activeTab === 'online' ? (
              <div className="space-y-4">
                {/* Online Users */}
                <div>
                  <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                    <Wifi className="w-4 h-4" />
                    Online ({onlineUsers.online?.length || 0})
                  </h4>
                  {onlineUsers.online?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No users online</p>
                  ) : (
                    <div className="space-y-2">
                      {onlineUsers.online?.map((u) => (
                        <div 
                          key={u.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                        >
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                              {u.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-800"></span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{u.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200">
                                {u.role}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {u.ip_address || 'Unknown IP'}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Active {formatTime(u.last_activity)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Offline Users */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                    <WifiOff className="w-4 h-4" />
                    Offline ({onlineUsers.offline?.length || 0})
                  </h4>
                  {onlineUsers.offline?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">All users online</p>
                  ) : (
                    <div className="space-y-2">
                      {onlineUsers.offline?.map((u) => (
                        <div 
                          key={u.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">
                              {u.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gray-400 rounded-full border-2 border-white dark:border-gray-800"></span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-600 dark:text-gray-400">{u.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                                {u.role}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <div>Last seen</div>
                            <div>{formatTime(u.last_login)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Acknowledge All Button */}
                {unackCount > 0 && (
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={acknowledgeAll}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Acknowledge All ({unackCount})
                    </Button>
                  </div>
                )}

                {/* Alerts List */}
                {alerts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No security alerts</p>
                    <p className="text-sm">System is secure</p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div 
                      key={alert.id}
                      className={`p-4 rounded-lg border ${getAlertColor(alert.severity)} ${alert.acknowledged ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">
                              {alert.type === 'late_night_access' ? 'Late Night Access' : 
                               alert.type === 'new_ip_address' ? 'New IP Address' : 'Security Alert'}
                            </span>
                            {alert.severity === 'high' && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">HIGH</span>
                            )}
                            {alert.acknowledged && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          <p className="text-sm">{alert.message}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs opacity-75">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {alert.user_name} ({alert.user_email})
                            </span>
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {alert.ip_address}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(alert.timestamp)}
                            </span>
                          </div>
                        </div>
                        {!alert.acknowledged && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => acknowledgeAlert(alert.id)}
                            title="Acknowledge"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t pt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {activeTab === 'online' 
                ? `${onlineUsers.online?.length || 0} online, ${onlineUsers.offline?.length || 0} offline`
                : `${alerts.length} alerts, ${unackCount} unacknowledged`
              }
            </span>
            <span>Manual refresh only</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
