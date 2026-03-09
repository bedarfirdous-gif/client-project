import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, AlertTriangle, Package, Store, X, Check, Trash2, 
  PackageCheck, RefreshCw, Layers 
} from 'lucide-react';
import { Button } from './ui/button';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from './ui/popover';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import RestockAlertsPanel from './RestockAlertsPanel';

export default function StockAlertsBell({ api }) {
  const [stockAlerts, setStockAlerts] = useState([]);
  const [timeout, setTimeout] = useState(false);
  const [restockAlerts, setRestockAlerts] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRestockPanel, setShowRestockPanel] = useState(false);

  // Fetch all alert counts
  const fetchAlertCounts = useCallback(async () => {
    try {
      const [stockCount, restockCount] = await Promise.all([
        api('/api/stock-alerts/count').catch(() => ({ count: 0 })),
        api('/api/restock-alerts/count').catch(() => ({ count: 0 }))
      ]);
      setTotalUnread((stockCount.count || 0) + (restockCount.count || 0));
    } catch (err) {
      console.error('Failed to fetch alert counts:', err);
    }
  }, [api]);

  // Fetch all alerts
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const [stockData, restockData] = await Promise.all([
        api('/api/stock-alerts?unread_only=false').catch(() => []),
        api('/api/restock-alerts?unread_only=false').catch(() => [])
      ]);
      setStockAlerts(stockData || []);
      setRestockAlerts(restockData || []);
      
      const stockUnread = (stockData || []).filter(a => !a.read).length;
      const restockUnread = (restockData || []).filter(a => !a.read && !a.resolved).length;
      setTotalUnread(stockUnread + restockUnread);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Mark stock alert as read
  const markStockAlertRead = async (alertId) => {
    try {
      await api(`/api/stock-alerts/${alertId}/read`, { method: 'PUT' });
      setStockAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, read: true } : a
      ));
      setTotalUnread(prev => Math.max(0, prev - 1));
    } catch (err) {
      toast.error('Failed to mark alert as read');
    }
  };

  // Mark all stock alerts as read
  const markAllStockAlertsRead = async () => {
    try {
      await api('/api/stock-alerts/read-all', { method: 'PUT' });
      setStockAlerts(prev => prev.map(a => ({ ...a, read: true })));
      fetchAlertCounts();
      toast.success('All stock alerts marked as read');
    } catch (err) {
      toast.error('Failed to mark alerts as read');
    }
  };

  // Delete stock alert
  const deleteStockAlert = async (alertId) => {
    try {
      await api(`/api/stock-alerts/${alertId}`, { method: 'DELETE' });
      setStockAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success('Alert deleted');
    } catch (err) {
      toast.error('Failed to delete alert');
    }
  };

  // Initial fetch only - auto refresh disabled
  useEffect(() => {
    fetchAlertCounts();
  }, [fetchAlertCounts]);

  // Show toast notifications for new unread alerts on mount
  useEffect(() => {
    const showNewAlertToasts = async () => {
      try {
        const alerts = await api('/api/stock-alerts?unread_only=true').catch(() => []);
        if (alerts && alerts.length > 0) {
          // Show toast for up to 3 most urgent alerts
          const urgentAlerts = alerts
            .filter(a => !a.read)
            .sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0))
            .slice(0, 3);
          
          urgentAlerts.forEach((alert, index) => {
            setTimeout(() => {
              toast.warning(`Low Stock: ${alert.item_name}`, {
                description: `Only ${alert.current_qty} units left at ${alert.store_name}`,
                duration: 6000,
                action: {
                  label: 'View',
                  onClick: () => setIsOpen(true)
                }
              });
            }, index * 1500); // Stagger notifications
          });
          
          if (alerts.length > 3) {
            setTimeout(() => {
              toast.info(`${alerts.length - 3} more stock alerts`, {
                description: 'Click the bell icon to view all',
                duration: 4000
              });
            }, 5000);
          }
        }
      } catch (err) {
        console.error('Failed to fetch alerts for toast:', err);
      }
    };
    
    // Show toasts after a short delay to not overwhelm on page load
    const timer = setTimeout(showNewAlertToasts, 2000);
    return () => clearTimeout(timer);
  }, [api]);

  // Fetch full alerts when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, fetchAlerts]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const stockUnread = stockAlerts.filter(a => !a.read).length;
  const restockUnread = restockAlerts.filter(a => !a.read && !a.resolved).length;

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            data-testid="stock-alerts-bell"
          >
            <Bell className="w-5 h-5" />
            {totalUnread > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
              >
                {totalUnread > 9 ? '9+' : totalUnread}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent 
          className="w-96 p-0" 
          align="end"
          data-testid="stock-alerts-popover"
        >
          <Tabs defaultValue="stock" className="w-full">
            <div className="flex items-center justify-between p-2 border-b bg-gray-50 dark:bg-gray-900">
              <TabsList className="h-8">
                <TabsTrigger value="stock" className="text-xs h-7 px-2">
                  <Package className="w-3 h-3 mr-1" />
                  Stock ({stockUnread})
                </TabsTrigger>
                <TabsTrigger value="restock" className="text-xs h-7 px-2">
                  <PackageCheck className="w-3 h-3 mr-1" />
                  Restock ({restockUnread})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Stock Alerts Tab */}
            <TabsContent value="stock" className="m-0">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <span className="text-sm font-medium">Low Stock Alerts</span>
                {stockUnread > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={markAllStockAlertsRead}>
                    <Check className="w-3 h-3 mr-1" /> Mark all read
                  </Button>
                )}
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin" />
                  </div>
                ) : stockAlerts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No stock alerts</p>
                  </div>
                ) : (
                  stockAlerts.slice(0, 8).map(alert => (
                    <div 
                      key={alert.id}
                      className={`p-2 border-b last:border-b-0 ${!alert.read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            <Badge variant="outline" className={`text-xs ${getSeverityColor(alert.severity)}`}>
                              {alert.severity === 'high' ? 'OUT' : 'LOW'}
                            </Badge>
                            {!alert.read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                          </div>
                          <p className="text-sm font-medium truncate">{alert.item_name}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Store className="w-3 h-3" />
                            {alert.store_name} | Stock: {alert.current_qty}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {!alert.read && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markStockAlertRead(alert.id)}>
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400" onClick={() => deleteStockAlert(alert.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Restock Alerts Tab */}
            <TabsContent value="restock" className="m-0">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <span className="text-sm font-medium">Quality Restock Alerts</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-6"
                  onClick={() => {
                    setIsOpen(false);
                    setShowRestockPanel(true);
                  }}
                >
                  <Layers className="w-3 h-3 mr-1" /> View All
                </Button>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin" />
                  </div>
                ) : restockAlerts.filter(a => !a.resolved).length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <PackageCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No pending restock alerts</p>
                    <p className="text-xs">Items returned for quality issues appear here</p>
                  </div>
                ) : (
                  restockAlerts.filter(a => !a.resolved).slice(0, 5).map(alert => (
                    <div 
                      key={alert.id}
                      className="p-2 border-b last:border-b-0 bg-amber-50/50 dark:bg-amber-900/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                              {alert.severity === 'high' ? 'URGENT' : 'INSPECT'}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">
                              {alert.return_number}
                            </span>
                          </div>
                          <p className="text-sm font-medium truncate">{alert.item_name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {alert.return_reason} | Qty: {alert.quantity}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {restockAlerts.filter(a => !a.resolved).length > 0 && (
                <div className="p-2 border-t text-center">
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => {
                      setIsOpen(false);
                      setShowRestockPanel(true);
                    }}
                  >
                    Manage all restock alerts →
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* Full Restock Alerts Panel */}
      <RestockAlertsPanel 
        api={api} 
        isOpen={showRestockPanel} 
        onClose={() => setShowRestockPanel(false)} 
      />
    </>
  );
}
