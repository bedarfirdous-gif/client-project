import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { 
  Bell, X, ShoppingCart, Package, Truck, Users, Store, 
  DollarSign, AlertTriangle, Clock, Check, RefreshCw,
  ArrowRight, ArrowLeft, Tag, Gift, Receipt, Building2, Wifi, WifiOff
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// Activity type icons and colors
const ACTIVITY_CONFIG = {
  sale: { icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Sale' },
  sale_created: { icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'New Sale' },
  purchase: { icon: Receipt, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Purchase' },
  transfer_out: { icon: ArrowRight, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'Transfer Out' },
  transfer_in: { icon: ArrowLeft, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30', label: 'Transfer In' },
  stock_transfer: { icon: Truck, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30', label: 'Stock Transfer' },
  stock_update: { icon: Package, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Stock Update' },
  new_customer: { icon: Users, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30', label: 'New Customer' },
  customer_created: { icon: Users, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30', label: 'New Customer' },
  low_stock: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Low Stock Alert' },
  low_stock_alert: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Low Stock Alert' },
  voucher_used: { icon: Gift, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Voucher Used' },
  discount_applied: { icon: Tag, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30', label: 'Discount Applied' },
  return: { icon: RefreshCw, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30', label: 'Return' },
  user_online: { icon: Users, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'User Online' },
  user_offline: { icon: Users, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-900/30', label: 'User Offline' },
};

export default function ActivityCenter() {
  const { api, user, token } = useAuth();
  const { currencySymbol } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [interval, setInterval] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [wsConnected, setWsConnected] = useState(false);
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!token || !user?.id) return;

    const connectWebSocket = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const backendUrl = (process.env.REACT_APP_BACKEND_URL || '').replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${backendUrl}/ws/${user.id}?token=${token}&tenant_id=${user.tenant_id || 'default'}&user_name=${encodeURIComponent(user.name || '')}`;

      try {
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log('ActivityCenter WebSocket connected');
          setWsConnected(true);
          if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = null;
          }
        };

        ws.current.onclose = () => {
          console.log('ActivityCenter WebSocket disconnected');
          setWsConnected(false);
          // Reconnect after 5 seconds
          reconnectTimeout.current = setTimeout(connectWebSocket, 5000);
        };

        ws.current.onerror = (err) => {
          console.error('WebSocket error:', err);
        };

        ws.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };
      } catch (err) {
        console.error('WebSocket connection failed:', err);
        // Retry connection
        reconnectTimeout.current = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    // Keepalive ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [token, user?.id, user?.tenant_id, user?.name]);

  const handleWebSocketMessage = (message) => {
    if (message.type === 'pong') return;
    
    // Add real-time activity
    const newActivity = {
      id: `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: message.type,
      title: message.title || message.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: message.data?.message || message.data?.description || JSON.stringify(message.data || {}),
      store: message.data?.store_name || 'All Stores',
      timestamp: message.timestamp || new Date().toISOString(),
      amount: message.data?.amount || message.data?.total_amount,
      isNew: true
    };

    setActivities(prev => [newActivity, ...prev].slice(0, 50));
    setUnreadCount(prev => prev + 1);
  };

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // Fetch recent activities from multiple endpoints
      const [sales, transfers, customers] = await Promise.all([
        api('/api/dashboard/recent-sales').catch(() => []),
        api('/api/stock-transfers').catch(() => []),
        api('/api/customers').catch(() => []),
      ]);

      // Transform data into activities
      const allActivities = [];

      // Add sales activities
      sales.slice(0, 10).forEach(sale => {
        allActivities.push({
          id: `sale-${sale.id}`,
          type: 'sale',
          title: `Sale ${sale.invoice_number}`,
          description: `${currencySymbol}${sale.total_amount?.toLocaleString()} - ${sale.customer_name || 'Walk-in'}`,
          store: sale.store_name || 'Main Store',
          timestamp: sale.created_at,
          amount: sale.total_amount,
        });
      });

      // Add transfer activities
      transfers.slice(0, 10).forEach(transfer => {
        allActivities.push({
          id: `transfer-${transfer.id}`,
          type: transfer.status === 'completed' ? 'transfer_in' : 'transfer_out',
          title: `Stock Transfer`,
          description: `${transfer.from_store_name} → ${transfer.to_store_name}`,
          store: transfer.from_store_name,
          timestamp: transfer.created_at,
          status: transfer.status,
        });
      });

      // Add recent customers
      customers.slice(0, 5).forEach(customer => {
        if (customer.created_at) {
          allActivities.push({
            id: `customer-${customer.id}`,
            type: 'new_customer',
            title: `New Customer`,
            description: customer.name,
            store: 'All Stores',
            timestamp: customer.created_at,
          });
        }
      });

      // Sort by timestamp
      allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setActivities(allActivities);
      setUnreadCount(Math.min(allActivities.length, 5));
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    // Auto refresh disabled - manual refresh only
    // const interval = setInterval(fetchActivities, 60000);
    // return () => clearInterval(interval);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Bell Icon Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 hover:bg-accent rounded-lg transition-colors"
        data-testid="activity-bell"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {/* WebSocket connection indicator */}
        <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-background ${wsConnected ? 'bg-green-500' : 'bg-gray-400'}`} title={wsConnected ? 'Real-time connected' : 'Connecting...'} />
      </button>

      {/* Activity Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Activity Center
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={fetchActivities}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Filter Tabs */}
          <div className="flex gap-2 flex-wrap border-b pb-3">
            {[
              { id: 'all', label: 'All' },
              { id: 'sale', label: 'Sales' },
              { id: 'transfer_out', label: 'Transfers' },
              { id: 'new_customer', label: 'Customers' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  filter === tab.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-accent hover:bg-accent/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Activity List */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {loading && activities.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No activities found</p>
              </div>
            ) : (
              filteredActivities.map((activity) => {
                const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.sale;
                const Icon = config.icon;
                
                return (
                  <div 
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                  >
                    <div className={`p-2 rounded-lg ${config.bg}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{activity.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Store className="w-3 h-3" />
                        <span>{activity.store}</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(activity.timestamp)}</span>
                      </div>
                    </div>
                    {activity.amount && (
                      <div className="text-right">
                        <span className="font-bold text-green-600">
                          {currencySymbol}{activity.amount.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Summary Footer */}
          <div className="border-t pt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              {wsConnected ? (
                <><Wifi className="w-4 h-4 text-green-500" /> Real-time</>
              ) : (
                <><WifiOff className="w-4 h-4 text-gray-400" /> Connecting...</>
              )}
            </span>
            <span>{filteredActivities.length} activities</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
