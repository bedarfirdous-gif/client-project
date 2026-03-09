import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

// IndexedDB Database Name
const DB_NAME = 'bijnisbooks-offline';
const DB_VERSION = 2; // Bumped version for new stores

// Store names
const STORES = {
  PENDING_SALES: 'pending_sales',
  CACHED_ITEMS: 'cached_items',
  CACHED_CUSTOMERS: 'cached_customers',
  CACHED_STORES: 'cached_stores',
  CACHED_VARIANTS: 'cached_variants',
  CACHED_DISCOUNTS: 'cached_discounts',
  CACHED_VOUCHERS: 'cached_vouchers',
  CACHED_LOYALTY: 'cached_loyalty',
  SYNC_QUEUE: 'sync_queue',
  // New stores for enhanced offline functionality
  OFFLINE_INVENTORY: 'offline_inventory',
  PENDING_CUSTOMERS: 'pending_customers',
  OFFLINE_RECEIPTS: 'offline_receipts'
};

// Open IndexedDB connection
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create all stores - this runs when DB version changes
      const stores = [
        { name: STORES.PENDING_SALES, options: { keyPath: 'id', autoIncrement: true } },
        { name: STORES.CACHED_ITEMS, options: { keyPath: 'id' } },
        { name: STORES.CACHED_CUSTOMERS, options: { keyPath: 'id' } },
        { name: STORES.CACHED_STORES, options: { keyPath: 'id' } },
        { name: STORES.CACHED_VARIANTS, options: { keyPath: 'id' } },
        { name: STORES.CACHED_DISCOUNTS, options: { keyPath: 'id' } },
        { name: STORES.CACHED_VOUCHERS, options: { keyPath: 'id' } },
        { name: STORES.CACHED_LOYALTY, options: { keyPath: 'key' } },
        { name: STORES.SYNC_QUEUE, options: { keyPath: 'id', autoIncrement: true } },
        // New stores for enhanced offline functionality
        { name: STORES.OFFLINE_INVENTORY, options: { keyPath: 'variant_id' } },
        { name: STORES.PENDING_CUSTOMERS, options: { keyPath: 'id', autoIncrement: true } },
        { name: STORES.OFFLINE_RECEIPTS, options: { keyPath: 'id', autoIncrement: true } }
      ];
      
      stores.forEach(({ name, options }) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, options);
        }
      });
    };
  });
};

// Check if a store exists
const storeExists = async (storeName) => {
  try {
    const db = await openDB();
    return db.objectStoreNames.contains(storeName);
  } catch {
    return false;
  }
};

// Generic IndexedDB operations with fallbacks
const dbOperations = {
  async add(storeName, data) {
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn(`Store ${storeName} not found, skipping add`);
        return null;
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`Failed to add to ${storeName}:`, err);
      return null;
    }
  },
  
  async put(storeName, data) {
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn(`Store ${storeName} not found, skipping put`);
        return null;
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`Failed to put to ${storeName}:`, err);
      return null;
    }
  },
  
  async get(storeName, key) {
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn(`Store ${storeName} not found, returning null`);
        return null;
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`Failed to get from ${storeName}:`, err);
      return null;
    }
  },
  
  async getAll(storeName) {
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn(`Store ${storeName} not found, returning empty array`);
        return [];
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`Failed to getAll from ${storeName}:`, err);
      return [];
    }
  },
  
  async delete(storeName, key) {
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn(`Store ${storeName} not found, skipping delete`);
        return null;
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`Failed to delete from ${storeName}:`, err);
      return null;
    }
  },
  
  async clear(storeName) {
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn(`Store ${storeName} not found, skipping clear`);
        return null;
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`Failed to clear ${storeName}:`, err);
      return null;
    }
  },
  
  async count(storeName) {
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn(`Store ${storeName} not found, returning 0`);
        return 0;
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`Failed to count ${storeName}:`, err);
      return 0;
    }
  }
};

// Offline Context
const OfflineContext = createContext(null);

export function OfflineProvider({ children, api, token }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Syncing data...');
      syncPendingSales();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Sales will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending sales count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await dbOperations.count(STORES.PENDING_SALES);
      setPendingSalesCount(count);
    } catch (err) {
      console.error('Failed to get pending count:', err);
    }
  }, []);

  // Cache essential data for offline use
  const cacheDataForOffline = useCallback(async () => {
    if (!api) return;
    
    try {
      toast.loading('Caching data for offline use...', { id: 'cache-offline' });
      
      // Cache items
      const items = await api('/api/items');
      await dbOperations.clear(STORES.CACHED_ITEMS);
      for (const item of items) {
        await dbOperations.put(STORES.CACHED_ITEMS, item);
      }

      // Cache variants
      const variants = await api('/api/variants');
      await dbOperations.clear(STORES.CACHED_VARIANTS);
      for (const variant of variants) {
        await dbOperations.put(STORES.CACHED_VARIANTS, variant);
      }

      // Cache customers
      const customers = await api('/api/customers');
      await dbOperations.clear(STORES.CACHED_CUSTOMERS);
      for (const customer of customers) {
        await dbOperations.put(STORES.CACHED_CUSTOMERS, customer);
      }

      // Cache stores
      const stores = await api('/api/stores');
      await dbOperations.clear(STORES.CACHED_STORES);
      for (const store of stores) {
        await dbOperations.put(STORES.CACHED_STORES, store);
      }

      // Cache discounts
      let discountsCount = 0;
      try {
        const discounts = await api('/api/discounts');
        await dbOperations.clear(STORES.CACHED_DISCOUNTS);
        for (const discount of discounts) {
          await dbOperations.put(STORES.CACHED_DISCOUNTS, discount);
        }
        discountsCount = discounts.length;
      } catch (err) {
        console.log('No discounts to cache or endpoint not available');
      }

      // Cache vouchers
      let vouchersCount = 0;
      try {
        const vouchers = await api('/api/vouchers');
        await dbOperations.clear(STORES.CACHED_VOUCHERS);
        for (const voucher of vouchers) {
          await dbOperations.put(STORES.CACHED_VOUCHERS, voucher);
        }
        vouchersCount = vouchers.length;
      } catch (err) {
        console.log('No vouchers to cache or endpoint not available');
      }

      // Cache loyalty program settings
      try {
        const loyalty = await api('/api/loyalty/settings');
        await dbOperations.clear(STORES.CACHED_LOYALTY);
        await dbOperations.put(STORES.CACHED_LOYALTY, { key: 'settings', ...loyalty });
      } catch (err) {
        console.log('No loyalty settings to cache or endpoint not available');
      }

      toast.success('Data cached for offline use!', { 
        id: 'cache-offline',
        description: `${items.length} items, ${variants.length} variants, ${customers.length} customers, ${discountsCount} discounts, ${vouchersCount} vouchers cached`
      });
      
      return {
        items: items.length,
        variants: variants.length,
        customers: customers.length,
        stores: stores.length,
        discounts: discountsCount,
        vouchers: vouchersCount
      };
    } catch (err) {
      console.error('Failed to cache data:', err);
      toast.error('Failed to cache data', { id: 'cache-offline' });
      throw err;
    }
  }, [api]);

  // Get cached data
  const getCachedItems = useCallback(async () => {
    return dbOperations.getAll(STORES.CACHED_ITEMS);
  }, []);

  const getCachedVariants = useCallback(async () => {
    return dbOperations.getAll(STORES.CACHED_VARIANTS);
  }, []);

  const getCachedCustomers = useCallback(async () => {
    return dbOperations.getAll(STORES.CACHED_CUSTOMERS);
  }, []);

  const getCachedStores = useCallback(async () => {
    return dbOperations.getAll(STORES.CACHED_STORES);
  }, []);

  // Get cached discounts
  const getCachedDiscounts = useCallback(async () => {
    return dbOperations.getAll(STORES.CACHED_DISCOUNTS);
  }, []);

  // Get cached vouchers
  const getCachedVouchers = useCallback(async () => {
    return dbOperations.getAll(STORES.CACHED_VOUCHERS);
  }, []);

  // Get cached loyalty settings
  const getCachedLoyalty = useCallback(async () => {
    try {
      const loyalty = await dbOperations.get(STORES.CACHED_LOYALTY, 'settings');
      return loyalty || null;
    } catch {
      return null;
    }
  }, []);

  // Validate voucher offline
  const validateVoucherOffline = useCallback(async (code, amount) => {
    const vouchers = await getCachedVouchers();
    const voucher = vouchers.find(v => 
      v.code?.toLowerCase() === code?.toLowerCase() && 
      v.is_active && 
      new Date(v.valid_until) > new Date()
    );
    
    if (!voucher) {
      return { valid: false, error: 'Voucher not found or expired' };
    }
    
    // Check minimum purchase
    if (voucher.min_purchase && amount < voucher.min_purchase) {
      return { valid: false, error: `Minimum purchase of ₹${voucher.min_purchase} required` };
    }
    
    // Check usage limit
    if (voucher.usage_limit && voucher.usage_count >= voucher.usage_limit) {
      return { valid: false, error: 'Voucher usage limit reached' };
    }
    
    // Calculate discount
    let calculated_discount = 0;
    if (voucher.discount_type === 'percentage') {
      calculated_discount = Math.min(
        (amount * voucher.discount_value) / 100,
        voucher.max_discount || Infinity
      );
    } else {
      calculated_discount = Math.min(voucher.discount_value, amount);
    }
    
    return {
      valid: true,
      voucher,
      calculated_discount: Math.round(calculated_discount * 100) / 100
    };
  }, [getCachedVouchers]);

  // Get applicable discounts offline
  const getApplicableDiscountsOffline = useCallback(async (cartItems, subtotal) => {
    const discounts = await getCachedDiscounts();
    const now = new Date();
    
    // Filter active discounts
    const activeDiscounts = discounts.filter(d => 
      d.is_active && 
      new Date(d.start_date) <= now && 
      new Date(d.end_date) >= now
    );
    
    let totalDiscount = 0;
    const appliedDiscounts = [];
    
    for (const discount of activeDiscounts) {
      if (discount.discount_type === 'item' && discount.applicable_items?.length > 0) {
        // Item-specific discount
        for (const item of cartItems) {
          if (discount.applicable_items.includes(item.item_id)) {
            const itemDiscount = discount.value_type === 'percentage' 
              ? (item.rate * item.quantity * discount.value) / 100
              : Math.min(discount.value, item.rate * item.quantity);
            totalDiscount += itemDiscount;
            appliedDiscounts.push({ ...discount, applied_amount: itemDiscount });
          }
        }
      } else if (discount.discount_type === 'cart' && subtotal >= (discount.min_purchase || 0)) {
        // Cart-level discount
        const cartDiscount = discount.value_type === 'percentage'
          ? (subtotal * discount.value) / 100
          : discount.value;
        totalDiscount += cartDiscount;
        appliedDiscounts.push({ ...discount, applied_amount: cartDiscount });
      }
    }
    
    return {
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      appliedDiscounts
    };
  }, [getCachedDiscounts]);

  // Save sale offline
  const saveSaleOffline = useCallback(async (saleData) => {
    const offlineSale = {
      ...saleData,
      offline_id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_offline_at: new Date().toISOString(),
      synced: false
    };

    await dbOperations.add(STORES.PENDING_SALES, offlineSale);
    await updatePendingCount();
    
    toast.success('Sale saved offline', {
      description: 'Will sync when back online'
    });

    return offlineSale;
  }, [updatePendingCount]);

  // Get pending sales
  const getPendingSales = useCallback(async () => {
    return dbOperations.getAll(STORES.PENDING_SALES);
  }, []);

  // Sync pending sales
  const syncPendingSales = useCallback(async () => {
    if (!isOnline || !api || isSyncing) return;

    setIsSyncing(true);
    
    try {
      const pendingSales = await dbOperations.getAll(STORES.PENDING_SALES);
      
      if (pendingSales.length === 0) {
        setIsSyncing(false);
        return;
      }

      let synced = 0;
      let failed = 0;

      for (const sale of pendingSales) {
        try {
          // Remove offline-specific fields
          const { id, synced, ...saleData } = sale;
          
          // Send to server - use dedicated offline sync endpoint
          const result = await api('/api/sales/sync-offline', {
            method: 'POST',
            body: JSON.stringify(saleData)
          });

          // Remove from IndexedDB
          await dbOperations.delete(STORES.PENDING_SALES, id);
          synced++;
          
          console.log('Synced offline sale:', result);
        } catch (err) {
          console.error('Failed to sync sale:', err);
          failed++;
        }
      }

      await updatePendingCount();
      setLastSyncTime(new Date());

      if (synced > 0) {
        toast.success(`Synced ${synced} offline sale(s)`, {
          description: failed > 0 ? `${failed} failed to sync` : undefined
        });
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, api, isSyncing, updatePendingCount]);

  // Force sync
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }
    await syncPendingSales();
  }, [isOnline, syncPendingSales]);

  // Clear all offline data
  const clearOfflineData = useCallback(async () => {
    await dbOperations.clear(STORES.PENDING_SALES);
    await dbOperations.clear(STORES.CACHED_ITEMS);
    await dbOperations.clear(STORES.CACHED_VARIANTS);
    await dbOperations.clear(STORES.CACHED_CUSTOMERS);
    await dbOperations.clear(STORES.CACHED_STORES);
    await dbOperations.clear(STORES.CACHED_DISCOUNTS);
    await dbOperations.clear(STORES.CACHED_VOUCHERS);
    await dbOperations.clear(STORES.CACHED_LOYALTY);
    await dbOperations.clear(STORES.OFFLINE_INVENTORY);
    await dbOperations.clear(STORES.PENDING_CUSTOMERS);
    await dbOperations.clear(STORES.OFFLINE_RECEIPTS);
    await updatePendingCount();
    toast.success('Offline data cleared');
  }, [updatePendingCount]);

  // ==================== ENHANCED OFFLINE FEATURES ====================

  // Track inventory changes offline
  const trackInventoryOffline = useCallback(async (items, changeType = 'sale') => {
    for (const item of items) {
      const variantId = item.variant_id || item.id;
      const quantityChange = changeType === 'sale' ? -item.quantity : item.quantity;
      
      try {
        // Get current offline inventory record
        let inventoryRecord = await dbOperations.get(STORES.OFFLINE_INVENTORY, variantId);
        
        if (!inventoryRecord) {
          // Get from cached variants
          const cachedVariant = await dbOperations.get(STORES.CACHED_VARIANTS, variantId);
          inventoryRecord = {
            variant_id: variantId,
            item_id: item.item_id,
            item_name: item.item_name || item.name,
            initial_stock: cachedVariant?.current_stock || 0,
            current_stock: cachedVariant?.current_stock || 0,
            changes: []
          };
        }
        
        // Apply change
        inventoryRecord.current_stock += quantityChange;
        inventoryRecord.changes.push({
          type: changeType,
          quantity: quantityChange,
          timestamp: new Date().toISOString(),
          reference: item.sale_id || item.offline_id || null
        });
        
        await dbOperations.put(STORES.OFFLINE_INVENTORY, inventoryRecord);
      } catch (err) {
        console.error('Failed to track inventory offline:', err);
      }
    }
  }, []);

  // Get offline inventory status
  const getOfflineInventory = useCallback(async () => {
    return dbOperations.getAll(STORES.OFFLINE_INVENTORY);
  }, []);

  // Check stock availability offline
  const checkStockOffline = useCallback(async (variantId, requestedQty) => {
    try {
      // First check offline inventory for updated stock
      const offlineRecord = await dbOperations.get(STORES.OFFLINE_INVENTORY, variantId);
      if (offlineRecord) {
        return {
          available: offlineRecord.current_stock >= requestedQty,
          currentStock: offlineRecord.current_stock,
          isOfflineData: true
        };
      }
      
      // Fallback to cached variants
      const cachedVariant = await dbOperations.get(STORES.CACHED_VARIANTS, variantId);
      if (cachedVariant) {
        return {
          available: (cachedVariant.current_stock || 0) >= requestedQty,
          currentStock: cachedVariant.current_stock || 0,
          isOfflineData: false
        };
      }
      
      return { available: true, currentStock: 0, isOfflineData: false }; // Allow sale if no data
    } catch {
      return { available: true, currentStock: 0, isOfflineData: false };
    }
  }, []);

  // Create customer offline
  const createCustomerOffline = useCallback(async (customerData) => {
    const offlineCustomer = {
      ...customerData,
      id: `offline-cust-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      created_offline_at: new Date().toISOString(),
      synced: false,
      is_offline: true
    };
    
    await dbOperations.add(STORES.PENDING_CUSTOMERS, offlineCustomer);
    
    // Also add to cached customers for immediate use
    await dbOperations.put(STORES.CACHED_CUSTOMERS, offlineCustomer);
    
    toast.success('Customer saved offline', {
      description: 'Will sync when back online'
    });
    
    return offlineCustomer;
  }, []);

  // Get pending customers (created offline)
  const getPendingCustomers = useCallback(async () => {
    return dbOperations.getAll(STORES.PENDING_CUSTOMERS);
  }, []);

  // Sync pending customers
  const syncPendingCustomers = useCallback(async () => {
    if (!isOnline || !api) return;
    
    try {
      const pendingCustomers = await dbOperations.getAll(STORES.PENDING_CUSTOMERS);
      
      if (pendingCustomers.length === 0) return;
      
      let synced = 0;
      let failed = 0;
      
      for (const customer of pendingCustomers) {
        try {
          const { id, created_offline_at, synced: _, is_offline, ...customerData } = customer;
          
          const result = await api('/api/customers', {
            method: 'POST',
            body: JSON.stringify(customerData)
          });
          
          // Remove from pending
          await dbOperations.delete(STORES.PENDING_CUSTOMERS, id);
          
          // Update cached customer with real ID
          await dbOperations.delete(STORES.CACHED_CUSTOMERS, id);
          await dbOperations.put(STORES.CACHED_CUSTOMERS, result);
          
          synced++;
        } catch (err) {
          console.error('Failed to sync customer:', err);
          failed++;
        }
      }
      
      if (synced > 0) {
        toast.success(`Synced ${synced} offline customer(s)`);
      }
    } catch (err) {
      console.error('Customer sync error:', err);
    }
  }, [isOnline, api]);

  // Save receipt for offline printing later
  const saveReceiptOffline = useCallback(async (receiptData) => {
    const receipt = {
      ...receiptData,
      saved_at: new Date().toISOString(),
      printed: false
    };
    
    const id = await dbOperations.add(STORES.OFFLINE_RECEIPTS, receipt);
    return { ...receipt, id };
  }, []);

  // Get saved receipts
  const getSavedReceipts = useCallback(async () => {
    return dbOperations.getAll(STORES.OFFLINE_RECEIPTS);
  }, []);

  // Mark receipt as printed
  const markReceiptPrinted = useCallback(async (receiptId) => {
    try {
      const receipt = await dbOperations.get(STORES.OFFLINE_RECEIPTS, receiptId);
      if (receipt) {
        receipt.printed = true;
        receipt.printed_at = new Date().toISOString();
        await dbOperations.put(STORES.OFFLINE_RECEIPTS, receipt);
      }
    } catch (err) {
      console.error('Failed to mark receipt as printed:', err);
    }
  }, []);

  // Delete printed receipts (cleanup)
  const clearPrintedReceipts = useCallback(async () => {
    const receipts = await dbOperations.getAll(STORES.OFFLINE_RECEIPTS);
    for (const receipt of receipts) {
      if (receipt.printed) {
        await dbOperations.delete(STORES.OFFLINE_RECEIPTS, receipt.id);
      }
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isOnline,
    pendingSalesCount,
    isSyncing,
    lastSyncTime,
    saveSaleOffline,
    getPendingSales,
    syncPendingSales,
    forceSync,
    cacheDataForOffline,
    getCachedItems,
    getCachedVariants,
    getCachedCustomers,
    getCachedStores,
    getCachedDiscounts,
    getCachedVouchers,
    getCachedLoyalty,
    validateVoucherOffline,
    getApplicableDiscountsOffline,
    clearOfflineData,
    // Enhanced offline features
    trackInventoryOffline,
    getOfflineInventory,
    checkStockOffline,
    createCustomerOffline,
    getPendingCustomers,
    syncPendingCustomers,
    saveReceiptOffline,
    getSavedReceipts,
    markReceiptPrinted,
    clearPrintedReceipts
  }), [
    isOnline,
    pendingSalesCount,
    isSyncing,
    lastSyncTime,
    saveSaleOffline,
    getPendingSales,
    syncPendingSales,
    forceSync,
    cacheDataForOffline,
    getCachedItems,
    getCachedVariants,
    getCachedCustomers,
    getCachedStores,
    getCachedDiscounts,
    getCachedVouchers,
    getCachedLoyalty,
    validateVoucherOffline,
    getApplicableDiscountsOffline,
    clearOfflineData,
    // Enhanced offline features
    trackInventoryOffline,
    getOfflineInventory,
    checkStockOffline,
    createCustomerOffline,
    getPendingCustomers,
    syncPendingCustomers,
    saveReceiptOffline,
    getSavedReceipts,
    markReceiptPrinted,
    clearPrintedReceipts
  ]);

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
}

// Offline Status Indicator Component
export function OfflineIndicator() {
  const { isOnline, pendingSalesCount, isSyncing, forceSync } = useOffline();

  if (isOnline && pendingSalesCount === 0) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${
      isOnline ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
    }`}>
      {!isOnline ? (
        <>
          <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          <span className="font-medium">Offline Mode</span>
          {pendingSalesCount > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
              {pendingSalesCount} pending
            </span>
          )}
        </>
      ) : pendingSalesCount > 0 ? (
        <>
          <span className="font-medium">{pendingSalesCount} pending sale(s)</span>
          <button
            onClick={forceSync}
            disabled={isSyncing}
            className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-sm"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </>
      ) : null}
    </div>
  );
}

export default OfflineProvider;
