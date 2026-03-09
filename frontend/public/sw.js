// Enhanced Service Worker for PWA - BijnisBooks Retail Management System
const CACHE_NAME = 'bijnisbooks-v2';
const STATIC_CACHE = 'bijnisbooks-static-v2';
const DYNAMIC_CACHE = 'bijnisbooks-dynamic-v2';
const API_CACHE = 'bijnisbooks-api-v2';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

// API routes to cache for offline
const API_ROUTES_TO_CACHE = [
  '/api/items',
  '/api/categories',
  '/api/brands',
  '/api/customers',
  '/api/stores',
  '/api/discounts'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.log('[SW] Some assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return clients.claim();
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  try {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests - let them pass through normally without any processing
    if (request.method !== 'GET') {
      return;
    }

    // Skip chrome-extension and other non-http requests
    if (!url.protocol.startsWith('http')) {
      return;
    }

    // Skip API auth requests - don't cache login/register
    if (url.pathname.includes('/api/auth/')) {
      return;
    }

    // Skip cross-origin requests to avoid cloning issues
    if (url.origin !== self.location.origin) {
      return;
    }

    // API requests - network first, cache fallback
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(networkFirstStrategy(request.clone(), API_CACHE));
      return;
    }

    // Static assets - cache first, network fallback
    if (request.destination === 'script' || 
        request.destination === 'style' || 
        request.destination === 'font' ||
        request.destination === 'image') {
      event.respondWith(cacheFirstStrategy(request.clone(), STATIC_CACHE));
      return;
    }

    // HTML pages - network first for freshness
    if (request.destination === 'document') {
      event.respondWith(networkFirstStrategy(request.clone(), DYNAMIC_CACHE));
      return;
    }

    // Default - network first
    event.respondWith(networkFirstStrategy(request.clone(), DYNAMIC_CACHE));
  } catch (error) {
    // Log error but don't break the request - let it pass through normally
    console.warn('[SW] Fetch handler error:', error.message);
    return;
  }
});

// Cache-first strategy
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache-first strategy failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for document requests
    if (request.destination === 'document') {
      return caches.match('/');
    }
    
    // Return error for API requests
    if (request.url.includes('/api/')) {
      return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'BijnisBooks',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'general',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        const url = event.notification.data?.url || '/';
        return clients.openWindow(url);
      })
  );
});

// Background sync for offline sales
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncOfflineData('offline-sales', '/api/sales'));
  }
  if (event.tag === 'sync-customers') {
    event.waitUntil(syncOfflineData('offline-customers', '/api/customers'));
  }
});

// Generic sync function
async function syncOfflineData(storeName, endpoint) {
  try {
    const db = await openDB();
    const items = await getAll(db, storeName);
    
    for (const item of items) {
      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${item.token}`
          },
          body: JSON.stringify(item.data)
        });
        await deleteItem(db, storeName, item.id);
        console.log('[SW] Synced item:', item.id);
      } catch (err) {
        console.error('[SW] Failed to sync item:', err);
      }
    }
  } catch (err) {
    console.error('[SW] Sync failed:', err);
  }
}

// IndexedDB helpers
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('bijnisbooks-offline', 2);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline-sales')) {
        db.createObjectStore('offline-sales', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('offline-customers')) {
        db.createObjectStore('offline-customers', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deleteItem(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
