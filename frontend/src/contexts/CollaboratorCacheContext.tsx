/**
 * CollaboratorCacheContext - Caches collaborator list data with smart invalidation
 * 
 * Features:
 * - In-memory cache with sessionStorage persistence
 * - 10-minute TTL (time-to-live)
 * - Smart invalidation based on backend last-modified timestamp
 * - Manual refresh capability
 * - Progress tracking for batch editor loading states
 * 
 * Architecture matches LanguoidCacheContext for consistency.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Collaborator, collaboratorsAPI } from '../services/api';

interface CollaboratorCache {
  collaborators: Collaborator[];
  lastModified: string;
  cachedAt: number; // Timestamp when data was cached
  count: number; // Number of collaborators in cache
}

interface CollaboratorCacheContextType {
  // Cache state
  cache: CollaboratorCache | null;
  isLoading: boolean;
  loadProgress: number; // 0-100 percentage for UI
  error: string | null;
  
  // Cache operations
  getCollaborators: () => Promise<Collaborator[]>;
  getById: (id: number) => Promise<Collaborator | null>;
  getByCollaboratorId: (collaboratorId: number) => Promise<Collaborator | null>;
  getByName: (firstName: string, lastName: string, suffix: string) => Promise<Collaborator | null>;
  invalidateCache: () => void;
  refreshCache: () => Promise<Collaborator[]>;
}

const CollaboratorCacheContext = createContext<CollaboratorCacheContextType | undefined>(undefined);

const CACHE_KEY = 'collaborator_list_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

interface CollaboratorCacheProviderProps {
  children: ReactNode;
}

export const CollaboratorCacheProvider: React.FC<CollaboratorCacheProviderProps> = ({ children }) => {
  const [cache, setCache] = useState<CollaboratorCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load cache from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsedCache = JSON.parse(stored) as CollaboratorCache;
        
        // Check if cache is still valid (within TTL)
        const now = Date.now();
        const age = now - parsedCache.cachedAt;
        
        if (age < CACHE_TTL) {
          console.log(`[CollaboratorCache] Loaded cache from sessionStorage (age: ${Math.round(age / 1000)}s)`);
          setCache(parsedCache);
          setLoadProgress(100); // Cache is ready
        } else {
          console.log(`[CollaboratorCache] Cache expired (age: ${Math.round(age / 1000)}s), clearing`);
          sessionStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (err) {
      console.error('[CollaboratorCache] Failed to load cache from sessionStorage:', err);
      sessionStorage.removeItem(CACHE_KEY);
    }
  }, []);

  // Save cache to sessionStorage whenever it changes
  useEffect(() => {
    if (cache) {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        console.log(`[CollaboratorCache] Saved cache to sessionStorage (${cache.count} collaborators)`);
      } catch (err) {
        console.error('[CollaboratorCache] Failed to save cache to sessionStorage:', err);
      }
    }
  }, [cache]);

  /**
   * Check if cache is still valid based on TTL
   * Note: Unlike Languoids, Collaborators don't have a getLastModified() endpoint,
   * so we rely solely on TTL for cache invalidation
   */
  const isCacheValid = useCallback(async (currentCache: CollaboratorCache): Promise<boolean> => {
    // Check TTL (client-side time-based invalidation)
    const now = Date.now();
    const age = now - currentCache.cachedAt;
    
    if (age >= CACHE_TTL) {
      console.log(`[CollaboratorCache] Cache expired by TTL (age: ${Math.round(age / 1000)}s)`);
      return false;
    }

    console.log(`[CollaboratorCache] Cache is valid (age: ${Math.round(age / 1000)}s)`);
    return true;
  }, []);

  /**
   * Fetch fresh data from backend and update cache
   * Uses chunked loading to avoid timeouts with large datasets
   */
  const fetchAndCache = useCallback(async (): Promise<Collaborator[]> => {
    console.log('[CollaboratorCache] Fetching fresh data from backend...');
    setIsLoading(true);
    setLoadProgress(0);
    setError(null);

    try {
      // Fetch ALL collaborators in a single request (no pagination)
      // Backend will return them sorted with proper Unicode collation
      console.log('[CollaboratorCache] Requesting all collaborators (no pagination)...');
      setLoadProgress(10);
      
        const response = await collaboratorsAPI.list({
          batch: true, // Use lightweight batch serializer for faster loading
        // No page or page_size params = fetch all at once
      });
      
      const allCollaborators = response.results;
      const totalCount = response.count;
        
      console.log(`[CollaboratorCache] Loaded ${allCollaborators.length} collaborators (total: ${totalCount})`);
      setLoadProgress(95); // Fetching complete, building cache
      
      // Use current timestamp as lastModified since we don't have backend tracking
      const lastModified = new Date().toISOString();

      const newCache: CollaboratorCache = {
        collaborators: allCollaborators,
        lastModified,
        cachedAt: Date.now(),
        count: totalCount,
      };

      setCache(newCache);
      setLoadProgress(100); // Complete
      console.log(`[CollaboratorCache] Cached ${allCollaborators.length} collaborators with proper backend sorting`);
      
      return allCollaborators;
    } catch (err) {
      console.error('[CollaboratorCache] Failed to fetch collaborators:', err);
      const errorMessage = 'Failed to load collaborators. Please try again.';
      setError(errorMessage);
      setLoadProgress(0);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get collaborators from cache or fetch if invalid/missing
   */
  const getCollaborators = useCallback(async (): Promise<Collaborator[]> => {
    // If no cache, fetch fresh data
    if (!cache) {
      console.log('[CollaboratorCache] No cache found, fetching...');
      return fetchAndCache();
    }

    // Check if cache is still valid
    const valid = await isCacheValid(cache);
    
    if (valid) {
      console.log('[CollaboratorCache] Using cached data');
      setLoadProgress(100);
      return cache.collaborators;
    }

    // Cache invalid, fetch fresh data
    console.log('[CollaboratorCache] Cache invalid, fetching fresh data...');
    return fetchAndCache();
  }, [cache, isCacheValid, fetchAndCache]);

  /**
   * Get collaborator by database ID from cache
   * Ensures cache is loaded before lookup
   */
  const getById = useCallback(async (id: number): Promise<Collaborator | null> => {
    const collaborators = await getCollaborators(); // Ensures cache is loaded
    return collaborators.find(c => c.id === id) || null;
  }, [getCollaborators]);

  /**
   * Get collaborator by collaborator_id from cache
   * Ensures cache is loaded before lookup
   */
  const getByCollaboratorId = useCallback(async (collaboratorId: number): Promise<Collaborator | null> => {
    const collaborators = await getCollaborators(); // Ensures cache is loaded
    return collaborators.find(c => c.collaborator_id === collaboratorId) || null;
  }, [getCollaborators]);

  /**
   * Get collaborator by exact name match from cache
   * Ensures cache is loaded before lookup
   */
  const getByName = useCallback(async (
    firstName: string,
    lastName: string,
    suffix: string
  ): Promise<Collaborator | null> => {
    const collaborators = await getCollaborators(); // Ensures cache is loaded
    
    // Normalize for comparison (trim, lowercase)
    const normalizedFirst = firstName.trim().toLowerCase();
    const normalizedLast = lastName.trim().toLowerCase();
    const normalizedSuffix = suffix.trim().toLowerCase();
    
    return collaborators.find(c => 
      (c.first_names || '').trim().toLowerCase() === normalizedFirst &&
      (c.last_names || '').trim().toLowerCase() === normalizedLast &&
      (c.name_suffix || '').trim().toLowerCase() === normalizedSuffix
    ) || null;
  }, [getCollaborators]);

  /**
   * Manually invalidate cache (clear it)
   */
  const invalidateCache = useCallback(() => {
    console.log('[CollaboratorCache] Manually invalidating cache');
    setCache(null);
    setLoadProgress(0);
    sessionStorage.removeItem(CACHE_KEY);
  }, []);

  /**
   * Force refresh cache (fetch fresh data regardless of validity)
   * This bypasses the Redis cache by using pagination, forcing a DB query
   */
  const refreshCache = useCallback(async (): Promise<Collaborator[]> => {
    console.log('[CollaboratorCache] Forcing cache refresh from database (bypassing Redis)');
    setIsLoading(true);
    setLoadProgress(0);
    setError(null);

    try {
      // Fetch ALL collaborators with pagination to bypass Redis cache
      // Backend only uses Redis cache for non-paginated requests
      setLoadProgress(10);
      
      const response = await collaboratorsAPI.list({
        batch: true,
        page: 1,         // Add pagination to bypass cache
        page_size: 99999 // Large page size to get all in one request
      });
      
      const allCollaborators = response.results;
      const totalCount = response.count;
      
      console.log(`[CollaboratorCache] Loaded ${allCollaborators.length} fresh collaborators from database`);
      setLoadProgress(95);
      
      // Use current timestamp as lastModified
      const lastModified = new Date().toISOString();

      const newCache: CollaboratorCache = {
        collaborators: allCollaborators,
        lastModified,
        cachedAt: Date.now(),
        count: totalCount,
      };

      setCache(newCache);
      // Don't save to sessionStorage on manual refresh (to avoid quota exceeded)
      // The next automatic fetch will save to sessionStorage
      setLoadProgress(100);
      
      return allCollaborators;
    } catch (err) {
      console.error('[CollaboratorCache] Failed to refresh cache:', err);
      const errorMessage = 'Failed to refresh collaborators. Please try again.';
      setError(errorMessage);
      setLoadProgress(0);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty deps is fine - we're not reading cache, just setting it

  const value: CollaboratorCacheContextType = {
    cache,
    isLoading,
    loadProgress,
    error,
    getCollaborators,
    getById,
    getByCollaboratorId,
    getByName,
    invalidateCache,
    refreshCache,
  };

  return (
    <CollaboratorCacheContext.Provider value={value}>
      {children}
    </CollaboratorCacheContext.Provider>
  );
};

/**
 * Hook to use collaborator cache context
 */
export const useCollaboratorCache = (): CollaboratorCacheContextType => {
  const context = useContext(CollaboratorCacheContext);
  if (context === undefined) {
    throw new Error('useCollaboratorCache must be used within a CollaboratorCacheProvider');
  }
  return context;
};

