import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { showNotification } from '../components/PushNotifications';

// WebSocket connection hook for real-time updates
export function useWebSocket(token, userId, tenantId, userName) {
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Event handlers registry
  const handlers = useRef({});

  const connect = useCallback(() => {
    if (!token || !userId) return;

    // Construct WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const wsHost = backendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}//${wsHost}/ws/${userId}?token=${token}&tenant_id=${tenantId}&user_name=${encodeURIComponent(userName || '')}`;

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Clear reconnect timeout
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        
        // Attempt to reconnect after 5 seconds
        if (!reconnectTimeout.current) {
          reconnectTimeout.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connect();
          }, 5000);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
          
          // Handle specific message types
          handleMessage(message);
          
          // Call registered handlers
          if (handlers.current[message.type]) {
            handlers.current[message.type].forEach(handler => handler(message));
          }
          if (handlers.current['*']) {
            handlers.current['*'].forEach(handler => handler(message));
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };
    } catch (err) {
      console.error('WebSocket connection failed:', err);
    }
  }, [token, userId, tenantId, userName]);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  // Register event handler
  const on = useCallback((eventType, handler) => {
    if (!handlers.current[eventType]) {
      handlers.current[eventType] = [];
    }
    handlers.current[eventType].push(handler);
    
    // Return unsubscribe function
    return () => {
      handlers.current[eventType] = handlers.current[eventType].filter(h => h !== handler);
    };
  }, []);

  // Handle incoming messages
  const handleMessage = (message) => {
    const { type, title, data, severity } = message;

    switch (type) {
      case 'sale_created':
        toast.success(title || 'New Sale!', {
          description: `Invoice ${data?.invoice_number || ''} - ₹${(data?.amount || 0).toLocaleString()}`
        });
        showNotification('New Sale', {
          body: `₹${(data?.amount || 0).toLocaleString()} - ${data?.customer_name || 'Walk-in'}`,
          tag: `sale-${data?.invoice_number}`
        });
        break;

      case 'customer_created':
        toast.info(title || 'New Customer', {
          description: data?.name || 'A new customer has registered'
        });
        break;

      case 'stock_transfer':
        toast.info(title || 'Stock Transfer', {
          description: `${data?.from_store} → ${data?.to_store}`
        });
        break;

      case 'low_stock_alert':
        toast.warning(title || 'Low Stock Alert', {
          description: `${data?.item_name} is running low (${data?.quantity} left)`
        });
        showNotification('Low Stock Alert', {
          body: `${data?.item_name} has only ${data?.quantity} units left`,
          tag: `low-stock-${data?.item_id}`
        });
        break;

      case 'security_alert':
        toast.error(title || 'Security Alert', {
          description: data?.message || 'Security event detected'
        });
        showNotification('Security Alert', {
          body: data?.message,
          tag: `security-${data?.id}`,
          requireInteraction: true
        });
        break;

      case 'user_online':
        setOnlineUsers(prev => {
          if (!prev.includes(data?.user_id)) {
            return [...prev, data?.user_id];
          }
          return prev;
        });
        break;

      case 'user_offline':
        setOnlineUsers(prev => prev.filter(id => id !== data?.user_id));
        break;

      case 'chat_typing':
        // Typing indicator is handled by registered event handlers
        // Just log for debugging
        console.log(`${data?.user_name} is ${data?.is_typing ? 'typing...' : 'stopped typing'}`);
        break;

      default:
        // Generic notification for unknown types
        if (title) {
          const toastFn = severity === 'error' ? toast.error :
                         severity === 'warning' ? toast.warning :
                         severity === 'success' ? toast.success : toast.info;
          toastFn(title, { description: data?.message });
        }
    }
  };

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    onlineUsers,
    sendMessage,
    on,
    reconnect: connect
  };
}

// Context for WebSocket (optional usage)
import React, { createContext, useContext } from 'react';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children, token, userId, tenantId, userName }) {
  const ws = useWebSocket(token, userId, tenantId, userName);
  
  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  return useContext(WebSocketContext);
}
