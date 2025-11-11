/**
 * usePersistedListState
 * 
 * Reusable hook for persisting list page state (filters, selections, pagination)
 * across navigation using sessionStorage.
 * 
 * State persists during the browser session (survives navigation) but is cleared
 * when the tab/browser is closed.
 */

import { useState, useEffect, useCallback } from 'react';

interface PersistedListStateOptions<F, T> {
  /**
   * Unique key for this list page's state in sessionStorage
   * e.g., 'languoid-list-state', 'collaborator-list-state'
   */
  storageKey: string;
  
  /**
   * Default filter state (used on first load or when storage is empty)
   */
  defaultFilters: F;
  
  /**
   * Default pagination state
   */
  defaultPagination?: {
    page?: number;
    rowsPerPage?: number;
  };
  
  /**
   * Optional: Custom serializer for selections
   * Default: stores array of IDs as numbers
   */
  serializeSelection?: (selected: T[]) => string;
  deserializeSelection?: (stored: string) => number[];
}

interface PersistedListState<F> {
  filters: F;
  selectedIds: Set<number>;
  page: number;
  rowsPerPage: number;
}

export function usePersistedListState<F extends Record<string, any>, T extends { id: number }>(
  options: PersistedListStateOptions<F, T>
) {
  const {
    storageKey,
    defaultFilters,
    defaultPagination = { page: 0, rowsPerPage: 25 },
  } = options;

  // Load initial state from sessionStorage or use defaults
  const loadInitialState = (): PersistedListState<F> => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          filters: parsed.filters || defaultFilters,
          selectedIds: new Set(parsed.selectedIds || []),
          page: parsed.page ?? defaultPagination.page ?? 0,
          rowsPerPage: parsed.rowsPerPage ?? defaultPagination.rowsPerPage ?? 25,
        };
      }
    } catch (error) {
      console.warn(`Failed to load persisted state for ${storageKey}:`, error);
    }
    
    return {
      filters: defaultFilters,
      selectedIds: new Set(),
      page: defaultPagination.page ?? 0,
      rowsPerPage: defaultPagination.rowsPerPage ?? 25,
    };
  };

  const [filters, setFilters] = useState<F>(loadInitialState().filters);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(loadInitialState().selectedIds);
  const [page, setPage] = useState<number>(loadInitialState().page);
  const [rowsPerPage, setRowsPerPage] = useState<number>(loadInitialState().rowsPerPage);

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    const state = {
      filters,
      selectedIds: Array.from(selectedIds),
      page,
      rowsPerPage,
    };
    
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn(`Failed to persist state for ${storageKey}:`, error);
    }
  }, [filters, selectedIds, page, rowsPerPage, storageKey]);

  // Helper: Update filters and reset page to 0
  const updateFilters = useCallback((newFilters: Partial<F>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(0); // Reset to first page when filters change
  }, []);

  // Helper: Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setPage(0);
  }, [defaultFilters]);

  // Helper: Toggle selection for a single item
  const toggleSelection = useCallback((id: number, selected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  // Helper: Select/deselect all items from provided list
  const setAllSelections = useCallback((items: T[], selected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      items.forEach(item => {
        if (selected) {
          newSet.add(item.id);
        } else {
          newSet.delete(item.id);
        }
      });
      return newSet;
    });
  }, []);

  // Helper: Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Helper: Clear ALL persisted state (filters, selections, pagination)
  const clearAllState = useCallback(() => {
    setFilters(defaultFilters);
    setSelectedIds(new Set());
    setPage(defaultPagination.page ?? 0);
    setRowsPerPage(defaultPagination.rowsPerPage ?? 25);
    try {
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.warn(`Failed to clear persisted state for ${storageKey}:`, error);
    }
  }, [defaultFilters, defaultPagination, storageKey]);

  return {
    // State
    filters,
    selectedIds,
    page,
    rowsPerPage,
    
    // Setters
    setFilters,
    setSelectedIds,
    setPage,
    setRowsPerPage,
    
    // Helpers
    updateFilters,
    clearFilters,
    toggleSelection,
    setAllSelections,
    clearSelections,
    clearAllState,
  };
}

