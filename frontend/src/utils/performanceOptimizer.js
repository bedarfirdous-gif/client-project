/**
 * Performance optimization utilities for faster page loading
 * 
 * Features:
 * - API response caching with TTL
 * - Deferred data loading for non-critical data
 * - Request deduplication
 * - Preloading for predictable navigation
 */

// In-memory cache for API responses
const apiCache = new Map();
const pendingRequests = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if cached data is still valid
 */
const isCacheValid = (cacheEntry) => {
  if (!cacheEntry) return false;
  return Date.now() - cacheEntry.timestamp < CACHE_TTL;
};

/**
 * Cached API call with deduplication
 * Prevents multiple simultaneous requests to the same endpoint
 */
export const cachedFetch = async (api, endpoint, options = {}) => {
  const cacheKey = endpoint;
  const { forceRefresh = false, ttl = CACHE_TTL } = options;

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = apiCache.get(cacheKey);
    if (isCacheValid(cached)) {
      return cached.data;
    }
  }

  // Check if there's already a pending request for this endpoint
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // Create new request
  const request = api(endpoint)
    .then(data => {
      // Cache the response
      apiCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl
      });
      pendingRequests.delete(cacheKey);
      return data;
    })
    .catch(err => {
      pendingRequests.delete(cacheKey);
      throw err;
    });

  pendingRequests.set(cacheKey, request);
  return request;
};

/**
 * Batch fetch multiple endpoints with caching
 */
export const batchFetch = async (api, endpoints, options = {}) => {
  const { forceRefresh = false } = options;
  
  const results = await Promise.all(
    endpoints.map(endpoint => 
      cachedFetch(api, endpoint, { forceRefresh }).catch(err => {
        console.warn(`Failed to fetch ${endpoint}:`, err);
        return null;
      })
    )
  );
  
  return results;
};

/**
 * Invalidate cache for specific endpoints
 */
export const invalidateCache = (...endpoints) => {
  endpoints.forEach(endpoint => {
    apiCache.delete(endpoint);
  });
};

/**
 * Clear entire cache
 */
export const clearCache = () => {
  apiCache.clear();
};

/**
 * Preload data for a page (call before navigation)
 */
export const preloadPageData = (api, pageType) => {
  const endpointsMap = {
    pos: [
      '/api/items?active=true',
      '/api/variants',
      '/api/stores',
      '/api/customers'
    ],
    employees: [
      '/api/employees?include_inactive=true',
      '/api/stores',
      '/api/employment-applications'
    ],
    inventory: [
      '/api/inventory',
      '/api/items',
      '/api/stores'
    ],
    items: [
      '/api/items',
      '/api/variants',
      '/api/categories'
    ]
  };

  const endpoints = endpointsMap[pageType];
  if (endpoints) {
    // Fire off preload requests without waiting
    endpoints.forEach(endpoint => {
      cachedFetch(api, endpoint).catch(() => {});
    });
  }
};

/**
 * Deferred loading - load non-critical data after initial render
 */
export const deferredLoad = (callback, delay = 100) => {
  return new Promise(resolve => {
    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        Promise.resolve(callback()).then(resolve);
      }, { timeout: delay + 500 });
    } else {
      setTimeout(() => {
        Promise.resolve(callback()).then(resolve);
      }, delay);
    }
  });
};

/**
 * Load critical data first, then load secondary data
 */
export const prioritizedFetch = async (api, criticalEndpoints, secondaryEndpoints) => {
  // Load critical data immediately
  const criticalData = await batchFetch(api, criticalEndpoints);
  
  // Load secondary data in background
  const secondaryPromise = deferredLoad(() => 
    batchFetch(api, secondaryEndpoints)
  );

  return {
    critical: criticalData,
    secondary: secondaryPromise
  };
};

/**
 * Hook for optimized data fetching
 */
export const useOptimizedFetch = (api, endpoints, deps = []) => {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      try {
        setLoading(true);
        const results = await batchFetch(api, endpoints);
        if (mounted) {
          setData(results);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchAll();

    return () => {
      mounted = false;
    };
  }, deps);

  return { data, loading, error, refetch: () => batchFetch(api, endpoints, { forceRefresh: true }) };
};

// Import React for the hook
import React from 'react';
