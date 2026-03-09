import { openDB } from 'idb';

const DB_NAME = 'bijnisbooks-offline';
const DB_VERSION = 2;

// Store names
export const STORES = {
  OFFLINE_SALES: 'offline-sales',
  CACHED_ITEMS: 'cached-items',
  CACHED_CUSTOMERS: 'cached-customers',
  CACHED_STORES: 'cached-stores',
  CACHED_VARIANTS: 'cached-variants',
  SYNC_QUEUE: 'sync-queue',
  APP_STATE: 'app-state'
};

// Initialize the database
export async function initDB() {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Offline sales store
      if (!db.objectStoreNames.contains(STORES.OFFLINE_SALES)) {
        const salesStore = db.createObjectStore(STORES.OFFLINE_SALES, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        salesStore.createIndex('by-date', 'created_at');
        salesStore.createIndex('by-synced', 'synced');
      }

      // Cached items store
      if (!db.objectStoreNames.contains(STORES.CACHED_ITEMS)) {
        const itemsStore = db.createObjectStore(STORES.CACHED_ITEMS, { keyPath: 'id' });
        itemsStore.createIndex('by-name', 'name');
        itemsStore.createIndex('by-sku', 'sku');
        itemsStore.createIndex('by-barcode', 'barcode');
      }

      // Cached customers store
      if (!db.objectStoreNames.contains(STORES.CACHED_CUSTOMERS)) {
        const customersStore = db.createObjectStore(STORES.CACHED_CUSTOMERS, { keyPath: 'id' });
        customersStore.createIndex('by-phone', 'phone');
        customersStore.createIndex('by-name', 'name');
      }

      // Cached stores
      if (!db.objectStoreNames.contains(STORES.CACHED_STORES)) {
        db.createObjectStore(STORES.CACHED_STORES, { keyPath: 'id' });
      }

      // Cached variants
      if (!db.objectStoreNames.contains(STORES.CACHED_VARIANTS)) {
        const variantsStore = db.createObjectStore(STORES.CACHED_VARIANTS, { keyPath: 'id' });
        variantsStore.createIndex('by-item', 'item_id');
        variantsStore.createIndex('by-barcode', 'barcode');
      }

      // Sync queue for all pending operations
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        syncStore.createIndex('by-type', 'type');
        syncStore.createIndex('by-created', 'created_at');
      }

      // App state (last sync time, etc.)
      if (!db.objectStoreNames.contains(STORES.APP_STATE)) {
        db.createObjectStore(STORES.APP_STATE, { keyPath: 'key' });
      }
    }
  });
  
  return db;
}

// Get database instance (singleton pattern)
let dbInstance = null;
export async function getDB() {
  if (!dbInstance) {
    dbInstance = await initDB();
  }
  return dbInstance;
}

// ============== OFFLINE SALES ==============

export async function saveOfflineSale(saleData, token) {
  const db = await getDB();
  const offlineSale = {
    ...saleData,
    offline_id: `OFFLINE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
    synced: false,
    token: token
  };
  
  const id = await db.add(STORES.OFFLINE_SALES, offlineSale);
  return { ...offlineSale, id };
}

export async function getOfflineSales() {
  const db = await getDB();
  return db.getAllFromIndex(STORES.OFFLINE_SALES, 'by-synced', IDBKeyRange.only(false));
}

export async function getAllOfflineSales() {
  const db = await getDB();
  return db.getAll(STORES.OFFLINE_SALES);
}

export async function markSaleAsSynced(id, serverId) {
  const db = await getDB();
  const sale = await db.get(STORES.OFFLINE_SALES, id);
  if (sale) {
    sale.synced = true;
    sale.server_id = serverId;
    sale.synced_at = new Date().toISOString();
    await db.put(STORES.OFFLINE_SALES, sale);
  }
}

export async function deleteOfflineSale(id) {
  const db = await getDB();
  await db.delete(STORES.OFFLINE_SALES, id);
}

export async function getOfflineSalesCount() {
  const db = await getDB();
  const unsyncedSales = await db.getAllFromIndex(STORES.OFFLINE_SALES, 'by-synced', IDBKeyRange.only(false));
  return unsyncedSales.length;
}

// ============== CACHED DATA ==============

export async function cacheItems(items) {
  const db = await getDB();
  const tx = db.transaction(STORES.CACHED_ITEMS, 'readwrite');
  const store = tx.objectStore(STORES.CACHED_ITEMS);
  
  // Clear existing items
  await store.clear();
  
  // Add all items
  for (const item of items) {
    await store.add(item);
  }
  
  await tx.done;
  
  // Update last sync time
  await updateAppState('items_last_sync', new Date().toISOString());
}

export async function getCachedItems() {
  const db = await getDB();
  return db.getAll(STORES.CACHED_ITEMS);
}

export async function getCachedItemByBarcode(barcode) {
  const db = await getDB();
  return db.getFromIndex(STORES.CACHED_ITEMS, 'by-barcode', barcode);
}

export async function cacheVariants(variants) {
  const db = await getDB();
  const tx = db.transaction(STORES.CACHED_VARIANTS, 'readwrite');
  const store = tx.objectStore(STORES.CACHED_VARIANTS);
  
  await store.clear();
  
  for (const variant of variants) {
    await store.add(variant);
  }
  
  await tx.done;
  await updateAppState('variants_last_sync', new Date().toISOString());
}

export async function getCachedVariants() {
  const db = await getDB();
  return db.getAll(STORES.CACHED_VARIANTS);
}

export async function getCachedVariantByBarcode(barcode) {
  const db = await getDB();
  return db.getFromIndex(STORES.CACHED_VARIANTS, 'by-barcode', barcode);
}

export async function cacheCustomers(customers) {
  const db = await getDB();
  const tx = db.transaction(STORES.CACHED_CUSTOMERS, 'readwrite');
  const store = tx.objectStore(STORES.CACHED_CUSTOMERS);
  
  await store.clear();
  
  for (const customer of customers) {
    await store.add(customer);
  }
  
  await tx.done;
  await updateAppState('customers_last_sync', new Date().toISOString());
}

export async function getCachedCustomers() {
  const db = await getDB();
  return db.getAll(STORES.CACHED_CUSTOMERS);
}

export async function cacheStores(stores) {
  const db = await getDB();
  const tx = db.transaction(STORES.CACHED_STORES, 'readwrite');
  const store = tx.objectStore(STORES.CACHED_STORES);
  
  await store.clear();
  
  for (const s of stores) {
    await store.add(s);
  }
  
  await tx.done;
  await updateAppState('stores_last_sync', new Date().toISOString());
}

export async function getCachedStores() {
  const db = await getDB();
  return db.getAll(STORES.CACHED_STORES);
}

// ============== SYNC QUEUE ==============

export async function addToSyncQueue(type, data, endpoint, method = 'POST') {
  const db = await getDB();
  const queueItem = {
    type,
    data,
    endpoint,
    method,
    created_at: new Date().toISOString(),
    attempts: 0,
    last_attempt: null,
    error: null
  };
  
  return db.add(STORES.SYNC_QUEUE, queueItem);
}

export async function getSyncQueue() {
  const db = await getDB();
  return db.getAll(STORES.SYNC_QUEUE);
}

export async function getSyncQueueByType(type) {
  const db = await getDB();
  return db.getAllFromIndex(STORES.SYNC_QUEUE, 'by-type', type);
}

export async function updateSyncQueueItem(id, updates) {
  const db = await getDB();
  const item = await db.get(STORES.SYNC_QUEUE, id);
  if (item) {
    Object.assign(item, updates);
    await db.put(STORES.SYNC_QUEUE, item);
  }
}

export async function removeSyncQueueItem(id) {
  const db = await getDB();
  await db.delete(STORES.SYNC_QUEUE, id);
}

export async function getSyncQueueCount() {
  const db = await getDB();
  const queue = await db.getAll(STORES.SYNC_QUEUE);
  return queue.length;
}

// ============== APP STATE ==============

export async function updateAppState(key, value) {
  const db = await getDB();
  await db.put(STORES.APP_STATE, { key, value, updated_at: new Date().toISOString() });
}

export async function getAppState(key) {
  const db = await getDB();
  const state = await db.get(STORES.APP_STATE, key);
  return state?.value;
}

export async function getLastSyncTime(dataType) {
  return getAppState(`${dataType}_last_sync`);
}

// ============== UTILITY ==============

export async function clearAllCachedData() {
  const db = await getDB();
  
  const stores = [
    STORES.CACHED_ITEMS,
    STORES.CACHED_CUSTOMERS,
    STORES.CACHED_STORES,
    STORES.CACHED_VARIANTS
  ];
  
  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readwrite');
    await tx.objectStore(storeName).clear();
    await tx.done;
  }
}

export async function getStorageStats() {
  const db = await getDB();
  
  const stats = {
    offlineSales: (await db.getAll(STORES.OFFLINE_SALES)).length,
    cachedItems: (await db.getAll(STORES.CACHED_ITEMS)).length,
    cachedCustomers: (await db.getAll(STORES.CACHED_CUSTOMERS)).length,
    cachedStores: (await db.getAll(STORES.CACHED_STORES)).length,
    cachedVariants: (await db.getAll(STORES.CACHED_VARIANTS)).length,
    syncQueue: (await db.getAll(STORES.SYNC_QUEUE)).length,
    lastItemsSync: await getAppState('items_last_sync'),
    lastCustomersSync: await getAppState('customers_last_sync')
  };
  
  return stats;
}
