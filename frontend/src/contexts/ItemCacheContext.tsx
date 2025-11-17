/**
 * ItemCacheContext - Caches item list data
 * 
 * Features:
 * - In-memory cache (React state) - fast access while page is open
 * - Backend Redis cache - fast loading across page refreshes
 * - 10-minute TTL (time-to-live)
 * - Manual refresh capability
 * - Progress tracking for batch editor loading states
 * 
 * Note: We do NOT use sessionStorage because Items dataset (15MB) exceeds
 * browser quota (5-10MB). Redis backend cache provides persistence instead.
 * Architecture matches CollaboratorCacheContext for consistency.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Item, itemsAPI } from '../services/api';

interface ItemCache {
  items: Item[];
  lastModified: string;
  cachedAt: number; // Timestamp when data was cached
  count: number; // Number of items in cache
}

interface ItemCacheContextType {
  // Cache state
  cache: ItemCache | null;
  isLoading: boolean;
  loadProgress: number; // 0-100 percentage for UI
  error: string | null;
  
  // Cache operations
  getItems: (forceRefresh?: boolean) => Promise<Item[]>;
  getById: (id: number) => Promise<Item | null>;
  getByCatalogNumber: (catalogNumber: string) => Promise<Item | null>;
  invalidateCache: () => void;
  refreshCache: () => Promise<Item[]>;
}

const ItemCacheContext = createContext<ItemCacheContextType | undefined>(undefined);

const CACHE_KEY = 'item_list_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

interface ItemCacheProviderProps {
  children: ReactNode;
}

export const ItemCacheProvider: React.FC<ItemCacheProviderProps> = ({ children }) => {
  const [cache, setCache] = useState<ItemCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if cache is still valid based on TTL
   * Note: Unlike Languoids, Items don't have a getLastModified() endpoint,
   * so we rely solely on TTL for cache invalidation
   */
  const isCacheValid = useCallback(async (currentCache: ItemCache): Promise<boolean> => {
    // Check TTL (client-side time-based invalidation)
    const now = Date.now();
    const age = now - currentCache.cachedAt;
    
    if (age >= CACHE_TTL) {
      console.log(`[ItemCache] Cache expired by TTL (age: ${Math.round(age / 1000)}s)`);
      return false;
    }

    console.log(`[ItemCache] Cache is valid (age: ${Math.round(age / 1000)}s)`);
    return true;
  }, []);

  /**
   * Fetch fresh data from backend and update cache
   * Handles async cache rebuilding with polling
   */
  const fetchAndCache = useCallback(async (): Promise<Item[]> => {
    console.log('[ItemCache] Fetching fresh data from backend...');
    setLoadProgress(0);
    setError(null);

    try {
      // Fetch ALL items in a single request (no pagination)
      // Backend will return them sorted by catalog_number
      console.log('[ItemCache] Requesting all items (no pagination)...');
      setLoadProgress(10);
      
      let response = await itemsAPI.list({
        // No pagination params to get ALL items
        // Backend should return unpaginated results
      });
      
      // Handle 202 Accepted - cache is rebuilding, poll until ready
      let pollAttempts = 0;
      const maxPollAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
      
      if (response.status === 202) {
        // Only set loading state if we actually need to poll
        console.log('[ItemCache] Cache rebuilding, starting polling...');
        setIsLoading(true);
      }
      
      while (response.status === 202 && pollAttempts < maxPollAttempts) {
        pollAttempts++;
        const progressPercent = 10 + Math.min(80, pollAttempts * 2); // Increment progress
        setLoadProgress(progressPercent);
        console.log(`[ItemCache] Cache rebuilding... polling attempt ${pollAttempts}/${maxPollAttempts}`);
        
        // Wait 2 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Poll again
        response = await itemsAPI.list({});
      }
      
      if (response.status === 202) {
        throw new Error('Cache rebuild timed out after 2 minutes. Please try again.');
      }
      
      const allItems = response.results;
      const totalCount = response.count;
        
      console.log(`[ItemCache] Loaded ${allItems.length} items (total: ${totalCount})`);
      setLoadProgress(95); // Fetching complete, building cache
      
      // Use current timestamp as lastModified since we don't have backend tracking
      const lastModified = new Date().toISOString();

      const newCache: ItemCache = {
        items: allItems,
        lastModified,
        cachedAt: Date.now(),
        count: totalCount,
      };

      setCache(newCache);
      setLoadProgress(100); // Complete
      console.log(`[ItemCache] Cached ${allItems.length} items with proper backend sorting`);
      
      return allItems;
    } catch (err) {
      console.error('[ItemCache] Failed to fetch items:', err);
      const errorMessage = 'Failed to load items. Please try again.';
      setError(errorMessage);
      setLoadProgress(0);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get items from cache or fetch if invalid/missing
   * @param forceRefresh - If true, bypass in-memory cache and fetch from backend (will trigger polling if cache is rebuilding)
   */
  const getItems = useCallback(async (forceRefresh = false): Promise<Item[]> => {
    // Force refresh: always fetch from backend
    if (forceRefresh) {
      console.log('[ItemCache] Force refresh requested, fetching from backend...');
      return fetchAndCache();
    }
    
    // If no cache, fetch fresh data
    if (!cache) {
      console.log('[ItemCache] No cache found, fetching...');
      return fetchAndCache();
    }

    // Check if cache is still valid
    const valid = await isCacheValid(cache);
    
    if (valid) {
      console.log('[ItemCache] Using cached data');
      setLoadProgress(100);
      return cache.items;
    }

    // Cache invalid, fetch fresh data
    console.log('[ItemCache] Cache invalid, fetching fresh data...');
    return fetchAndCache();
  }, [cache, isCacheValid, fetchAndCache]);

  /**
   * Get item by database ID from cache
   * Ensures cache is loaded before lookup
   */
  const getById = useCallback(async (id: number): Promise<Item | null> => {
    const items = await getItems(); // Ensures cache is loaded
    return items.find(item => item.id === id) || null;
  }, [getItems]);

  /**
   * Get item by catalog_number from cache
   * Ensures cache is loaded before lookup
   */
  const getByCatalogNumber = useCallback(async (catalogNumber: string): Promise<Item | null> => {
    const items = await getItems(); // Ensures cache is loaded
    return items.find(item => item.catalog_number === catalogNumber) || null;
  }, [getItems]);

  /**
   * Manually invalidate cache (clear it)
   */
  const invalidateCache = useCallback(() => {
    console.log('[ItemCache] Manually invalidating cache');
    setCache(null);
    setLoadProgress(0);
  }, []);

  /**
   * Force refresh cache (fetch fresh data regardless of validity)
   * This bypasses the Redis cache by using pagination, forcing a DB query
   */
  const refreshCache = useCallback(async (): Promise<Item[]> => {
    console.log('[ItemCache] Forcing cache refresh from database (bypassing Redis)');
    setIsLoading(true);
    setLoadProgress(0);
    setError(null);

    try {
      // Fetch ALL items with pagination to bypass Redis cache
      // Backend only uses Redis cache for non-paginated requests
      setLoadProgress(10);
      
      const response = await itemsAPI.list({
        page: '1',         // Add pagination to bypass cache
        page_size: '99999' // Large page size to get all in one request
      });
      
      const allItems = response.results;
      const totalCount = response.count;
      
      console.log(`[ItemCache] Loaded ${allItems.length} fresh items from database`);
      setLoadProgress(95);
      
      // Use current timestamp as lastModified
      const lastModified = new Date().toISOString();

      const newCache: ItemCache = {
        items: allItems,
        lastModified,
        cachedAt: Date.now(),
        count: totalCount,
      };

      setCache(newCache);
      setLoadProgress(100);
      console.log(`[ItemCache] Refreshed cache with ${allItems.length} items from database`);
      
      return allItems;
    } catch (err) {
      console.error('[ItemCache] Failed to refresh cache:', err);
      const errorMessage = 'Failed to refresh items. Please try again.';
      setError(errorMessage);
      setLoadProgress(0);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty deps is fine - we're not reading cache, just setting it

  const value: ItemCacheContextType = {
    cache,
    isLoading,
    loadProgress,
    error,
    getItems,
    getById,
    getByCatalogNumber,
    invalidateCache,
    refreshCache,
  };

  return (
    <ItemCacheContext.Provider value={value}>
      {children}
    </ItemCacheContext.Provider>
  );
};

/**
 * Hook to use item cache context
 */
export const useItemCache = (): ItemCacheContextType => {
  const context = useContext(ItemCacheContext);
  if (context === undefined) {
    throw new Error('useItemCache must be used within an ItemCacheProvider');
  }
  return context;
};

