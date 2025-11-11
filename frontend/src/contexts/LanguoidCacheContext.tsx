/**
 * LanguoidCacheContext - Caches languoid list data with smart invalidation
 * 
 * Features:
 * - In-memory cache with sessionStorage persistence
 * - 10-minute TTL (time-to-live)
 * - Smart invalidation based on backend last-modified timestamp
 * - Manual refresh capability
 * 
 * ⚠️ IMPORTANT: This pattern is specific to the Languoid list page due to:
 * - Bounded dataset size (~10,000 records max)
 * - Expensive hierarchical tree building
 * - Frontend-only filtering requirements
 * 
 * Do NOT apply this pattern to other model list pages (Items, Collections, etc.)
 * without consulting the project manager and verifying dataset constraints.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Languoid, languoidsAPI } from '../services/api';

interface LanguoidCache {
  languoids: Languoid[];
  lastModified: string;
  cachedAt: number; // Timestamp when data was cached
  count: number; // Number of languoids in cache
  version: number; // Cache schema version for breaking changes
}

interface LanguoidCacheContextType {
  // Cache state
  cache: LanguoidCache | null;
  isLoading: boolean;
  error: string | null;
  
  // Cache operations
  getLanguoids: () => Promise<Languoid[]>;
  getByGlottocode: (glottocode: string) => Promise<Languoid | null>;
  getByName: (name: string) => Promise<Languoid | null>;
  invalidateCache: () => void;
  refreshCache: () => Promise<Languoid[]>;
}

const LanguoidCacheContext = createContext<LanguoidCacheContextType | undefined>(undefined);

const CACHE_KEY = 'languoid_list_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
const CACHE_VERSION = 2; // Increment this when Languoid interface changes (e.g., added item_count)

interface LanguoidCacheProviderProps {
  children: ReactNode;
}

export const LanguoidCacheProvider: React.FC<LanguoidCacheProviderProps> = ({ children }) => {
  const [cache, setCache] = useState<LanguoidCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cache from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsedCache = JSON.parse(stored) as LanguoidCache;
        
        // Check cache version first (invalidate if schema changed)
        if (parsedCache.version !== CACHE_VERSION) {
          console.log(`[LanguoidCache] Cache version mismatch (${parsedCache.version} vs ${CACHE_VERSION}), clearing`);
          sessionStorage.removeItem(CACHE_KEY);
          return;
        }
        
        // Check if cache is still valid (within TTL)
        const now = Date.now();
        const age = now - parsedCache.cachedAt;
        
        if (age < CACHE_TTL) {
          console.log(`[LanguoidCache] Loaded cache from sessionStorage (age: ${Math.round(age / 1000)}s)`);
          setCache(parsedCache);
        } else {
          console.log(`[LanguoidCache] Cache expired (age: ${Math.round(age / 1000)}s), clearing`);
          sessionStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (err) {
      console.error('[LanguoidCache] Failed to load cache from sessionStorage:', err);
      sessionStorage.removeItem(CACHE_KEY);
    }
  }, []);

  // Save cache to sessionStorage whenever it changes
  useEffect(() => {
    if (cache) {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        console.log(`[LanguoidCache] Saved cache to sessionStorage (${cache.count} languoids)`);
      } catch (err) {
        console.error('[LanguoidCache] Failed to save cache to sessionStorage:', err);
      }
    }
  }, [cache]);

  /**
   * Check if cache is still valid based on TTL and backend last-modified timestamp
   */
  const isCacheValid = useCallback(async (currentCache: LanguoidCache): Promise<boolean> => {
    // Check TTL first (client-side time-based invalidation)
    const now = Date.now();
    const age = now - currentCache.cachedAt;
    
    if (age >= CACHE_TTL) {
      console.log(`[LanguoidCache] Cache expired by TTL (age: ${Math.round(age / 1000)}s)`);
      return false;
    }

    try {
      // Check backend last-modified timestamp (smart invalidation)
      const { last_modified } = await languoidsAPI.getLastModified();
      
      if (last_modified !== currentCache.lastModified) {
        console.log(`[LanguoidCache] Cache invalidated by backend timestamp change`);
        console.log(`  Cached: ${currentCache.lastModified}`);
        console.log(`  Current: ${last_modified}`);
        return false;
      }

      console.log(`[LanguoidCache] Cache is valid (age: ${Math.round(age / 1000)}s)`);
      return true;
    } catch (err) {
      console.error('[LanguoidCache] Failed to check last-modified timestamp:', err);
      // On error, assume cache might be stale - safer to reload
      return false;
    }
  }, []);

  /**
   * Fetch fresh data from backend and update cache
   */
  const fetchAndCache = useCallback(async (): Promise<Languoid[]> => {
    console.log('[LanguoidCache] Fetching fresh data from backend...');
    setIsLoading(true);
    setError(null);

    try {
      // Fetch last-modified timestamp
      const { last_modified, count } = await languoidsAPI.getLastModified();
      
      // Fetch all languoids
      const params: Record<string, string> = {
        page_size: '10000',
        hierarchical: 'true',
      };
      const response = await languoidsAPI.list(params);
      
      const newCache: LanguoidCache = {
        languoids: response.results,
        lastModified: last_modified,
        cachedAt: Date.now(),
        count: count,
        version: CACHE_VERSION,
      };

      setCache(newCache);
      console.log(`[LanguoidCache] Cached ${response.results.length} languoids (backend count: ${count})`);
      
      return response.results;
    } catch (err) {
      console.error('[LanguoidCache] Failed to fetch languoids:', err);
      const errorMessage = 'Failed to load languoids. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get languoids from cache or fetch if invalid/missing
   */
  const getLanguoids = useCallback(async (): Promise<Languoid[]> => {
    // If no cache, fetch fresh data
    if (!cache) {
      console.log('[LanguoidCache] No cache found, fetching...');
      return fetchAndCache();
    }

    // Check if cache is still valid
    const valid = await isCacheValid(cache);
    
    if (valid) {
      console.log('[LanguoidCache] Using cached data');
      return cache.languoids;
    }

    // Cache invalid, fetch fresh data
    console.log('[LanguoidCache] Cache invalid, fetching fresh data...');
    return fetchAndCache();
  }, [cache, isCacheValid, fetchAndCache]);

  /**
   * Get languoid by glottocode from cache
   * Ensures cache is loaded before lookup
   */
  const getByGlottocode = useCallback(async (glottocode: string): Promise<Languoid | null> => {
    const languoids = await getLanguoids(); // Ensures cache is loaded
    return languoids.find(l => l.glottocode === glottocode) || null;
  }, [getLanguoids]);

  /**
   * Get languoid by name from cache (exact match, case-sensitive)
   * Ensures cache is loaded before lookup
   */
  const getByName = useCallback(async (name: string): Promise<Languoid | null> => {
    const languoids = await getLanguoids(); // Ensures cache is loaded
    return languoids.find(l => l.name === name) || null;
  }, [getLanguoids]);

  /**
   * Manually invalidate cache (clear it)
   */
  const invalidateCache = useCallback(() => {
    console.log('[LanguoidCache] Manually invalidating cache');
    setCache(null);
    sessionStorage.removeItem(CACHE_KEY);
  }, []);

  /**
   * Force refresh cache (fetch fresh data regardless of validity)
   */
  const refreshCache = useCallback(async (): Promise<Languoid[]> => {
    console.log('[LanguoidCache] Manually refreshing cache');
    invalidateCache();
    return fetchAndCache();
  }, [invalidateCache, fetchAndCache]);

  const value: LanguoidCacheContextType = {
    cache,
    isLoading,
    error,
    getLanguoids,
    getByGlottocode,
    getByName,
    invalidateCache,
    refreshCache,
  };

  return (
    <LanguoidCacheContext.Provider value={value}>
      {children}
    </LanguoidCacheContext.Provider>
  );
};

/**
 * Hook to use languoid cache context
 */
export const useLanguoidCache = (): LanguoidCacheContextType => {
  const context = useContext(LanguoidCacheContext);
  if (context === undefined) {
    throw new Error('useLanguoidCache must be used within a LanguoidCacheProvider');
  }
  return context;
};

