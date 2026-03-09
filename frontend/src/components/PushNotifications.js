import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, BellRing, Settings, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

// Push notification configuration
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export default function PushNotifications({ userId, tenantId }) {
  const [permission, setPermission] = useState(Notification.permission);
  // Keep `subscription` nullable (Push API returns `PushSubscription | null`).
  // Fix state flash: initialize from the synchronous cached value (if available)
  // so the first paint matches the browser's current subscription state.
  // We still run `getSubscription()` in an effect to confirm/update.
  const initialSubscription = (() => {
    try {
      return navigator.serviceWorker?.controller?.pushManager?.subscription ?? null;
    } catch {
      return null;
    }
  })();

  const [subscription, setSubscription] = useState(initialSubscription);
  // If we could synchronously determine the subscription, consider it loaded to avoid
  // rendering the interim "disabled" UI and then flipping.
  const [isLoaded, setIsLoaded] = useState(Boolean(initialSubscription));
  const [loading, setLoading] = useState(false);

  // Check if push notifications are supported
  const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    if (isSupported) {
      checkExistingSubscription();
    } else {
      // If not supported, there's nothing to load.
      setIsLoaded(true);
    }
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      // `sub` is either a PushSubscription or `null`.
      setSubscription(sub);
    } catch (err) {
      console.error('Error checking subscription:', err);
      // Treat errors as "no subscription" but still mark loaded to avoid a stuck skeleton.
      setSubscription(null);
    } finally {
      setIsLoaded(true);
    }
  };

  const requestPermission = async () => {
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        await subscribeToNotifications();
        toast.success('Push notifications enabled!');
      } else if (result === 'denied') {
        toast.error('Notification permission denied');
      }
    } catch (err) {
      console.error('Permission request failed:', err);
      toast.error('Failed to enable notifications');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = async () => {
    try {
      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      setSubscription(sub);

      // Send subscription to backend
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          user_id: userId,
          tenant_id: tenantId
        })
      });

      return sub;
    } catch (err) {
      console.error('Subscription failed:', err);
      throw err;
    }
  };

  const unsubscribeFromNotifications = async () => {
    setLoading(true);
    try {
      if (subscription) {
        await subscription.unsubscribe();
        
        // Notify backend
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/notifications/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ user_id: userId })
        });

        setSubscription(null);
        toast.success('Push notifications disabled');
      }
    } catch (err) {
      console.error('Unsubscribe failed:', err);
      toast.error('Failed to disable notifications');
    } finally {
      setLoading(false);
    }
  };

  // Send a test notification
  const sendTestNotification = () => {
    if (permission === 'granted') {
      new Notification('BIJNISBOOKS', {
        body: 'Test notification - Push notifications are working!',
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'test-notification',
        requireInteraction: false
      });
      toast.success('Test notification sent!');
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <BellOff className="w-4 h-4" />
        <span className="text-sm">Push notifications not supported</span>
      </div>
    );
  }

  // Avoid a visual flash: don't render the "disabled" UI until we've checked
  // the existing PushSubscription via `getSubscription()`.
  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Bell className="w-4 h-4" />
        <span className="text-sm">Loading push notification status…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {permission === 'granted' && subscription ? (
            <BellRing className="w-5 h-5 text-green-500" />
          ) : permission === 'denied' ? (
            <BellOff className="w-5 h-5 text-red-500" />
          ) : (
            <Bell className="w-5 h-5 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium">Push Notifications</p>
            <p className="text-sm text-muted-foreground">
              {permission === 'granted' && subscription
                ? 'Enabled - You will receive alerts'
                : permission === 'denied'
                ? 'Blocked - Enable in browser settings'
                : 'Enable to receive real-time alerts'}
            </p>
          </div>
        </div>

        {permission === 'granted' && subscription ? (
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={sendTestNotification}
            >
              Test
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={unsubscribeFromNotifications}
              disabled={loading}
            >
              {loading ? 'Disabling...' : 'Disable'}
            </Button>
          </div>
        ) : permission !== 'denied' ? (
          <Button 
            onClick={requestPermission}
            disabled={loading}
          >
            {loading ? 'Enabling...' : 'Enable'}
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Blocked
          </Button>
        )}
      </div>

      {/* Notification Types */}
      {permission === 'granted' && subscription && (
        <div className="bg-accent/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">You'll be notified about:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              New sales and orders
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Security alerts (new IP logins)
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Low stock warnings
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Stock transfer updates
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Show browser notification helper
export const showNotification = (title, options = {}) => {
  if (Notification.permission === 'granted') {
    return new Notification(title, {
      icon: '/logo192.png',
      badge: '/logo192.png',
      ...options
    });
  }
};

// Notification types
export const NotificationTypes = {
  SALE: 'sale',
  SECURITY: 'security',
  LOW_STOCK: 'low_stock',
  TRANSFER: 'transfer',
  CUSTOMER: 'customer'
};
