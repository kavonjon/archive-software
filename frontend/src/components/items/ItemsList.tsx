import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  Typography,
  Chip,
  Collapse,
  Alert,
  CircularProgress,
  Checkbox,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Link,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { debounce } from 'lodash';
import { itemsAPI, Item, PaginatedResponse, APIError, ACCESS_LEVEL_CHOICES, RESOURCE_TYPE_CHOICES } from '../../services/api';
import { ariaLabels, focusUtils, tableUtils, formUtils } from '../../utils/accessibility';
import { touchTargets } from '../../utils/responsive';
import { useAuth } from '../../contexts/AuthContext';
import { useItemCache } from '../../contexts/ItemCacheContext';
import { usePersistedListState } from '../../hooks/usePersistedListState';
import { hasEditAccess } from '../../utils/permissions';
import ItemBatchEditButton, { BatchEditMode } from './ItemBatchEditButton';
import ItemExportButton, { ExportMode, ExportStatus } from './ItemExportButton';
import ItemBatchLoadingDialog, { LoadingDialogState } from './ItemBatchLoadingDialog';

interface ItemsListProps {
  showActions?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedItems: Item[]) => void;
}

interface FilterState {
  keyword_contains: string;
  catalog_number_contains: string;
  access_level: string[];  // Multi-select array
  call_number_contains: string;
  accession_date_min: string;
  accession_date_max: string;
  titles_contains: string;
  resource_type: string[];  // Multi-select array
  language_contains: string;
  creation_date_min: string;
  creation_date_max: string;
  description_scope_and_content_contains: string;
  genre_contains: string;
  collaborator_contains: string;
  depositor_name_contains: string;
  
  // Empty field filters (isnull)
  collection_isnull?: boolean;
  access_level_restrictions_isnull?: boolean;
  accession_date_isnull?: boolean;
  accession_number_isnull?: boolean;
  call_number_isnull?: boolean;
  collaborator_isnull?: boolean;
  creation_date_isnull?: boolean;
  depositor_name_isnull?: boolean;
  description_scope_and_content_isnull?: boolean;
  genre_isnull?: boolean;
  indigenous_title_isnull?: boolean;
  english_title_isnull?: boolean;
  item_access_level_isnull?: boolean;
  language_isnull?: boolean;
  resource_type_isnull?: boolean;
  original_format_medium_isnull?: boolean;
  publisher_isnull?: boolean;
  recording_context_isnull?: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  keyword_contains: '',
  catalog_number_contains: '',
  access_level: [],
  call_number_contains: '',
  accession_date_min: '',
  accession_date_max: '',
  titles_contains: '',
  resource_type: [],
  language_contains: '',
  creation_date_min: '',
  creation_date_max: '',
  description_scope_and_content_contains: '',
  genre_contains: '',
  collaborator_contains: '',
  depositor_name_contains: '',
};

const ItemsList: React.FC<ItemsListProps> = ({
  showActions = true,
  selectable = false,
  onSelectionChange,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { state: authState } = useAuth();
  
  // Start cache loading on mount
  const { getItems, cache, isLoading: cacheLoading, loadProgress } = useItemCache();
  
  useEffect(() => {
    // Trigger cache load in background when list page loads
    getItems().catch(err => {
      console.error('[ItemsList] Failed to pre-load cache:', err);
    });
  }, [getItems]);
  
  // Refs for focus management
  const tableRef = useRef<HTMLTableElement>(null);
  
  // Persisted state (filters, selections, pagination)
  const {
    filters,
    setFilters,
    selectedIds,
    setSelectedIds,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    toggleSelection,
    setAllSelections,
    clearFilters: clearPersistedFilters,
  } = usePersistedListState<FilterState, Item>({
    storageKey: 'item-list-state',
    defaultFilters: DEFAULT_FILTERS,
    defaultPagination: { page: 0, rowsPerPage: 25 },
  });
  
  // State management
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Active filters state - these are the filters actually applied to the API
  const [activeFilters, setActiveFilters] = useState<FilterState>(filters);
  
  // Batch edit state
  const [batchEditMode, setBatchEditMode] = useState<BatchEditMode>(() => {
    return (localStorage.getItem('item-batch-edit-mode') as BatchEditMode) || 'filtered';
  });
  
  // Loading/warning dialog state for batch editor
  const [loadingDialogState, setLoadingDialogState] = useState<LoadingDialogState | null>(null);
  const [pendingBatchIds, setPendingBatchIds] = useState<number[] | null>(null);
  
  // Export state
  const [exportMode, setExportMode] = useState<ExportMode>(() => {
    return (localStorage.getItem('item-export-mode') as ExportMode) || 'filtered';
  });
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  
  // Ref to track polling interval
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load items from API
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params: Record<string, string | number> = {
        page: page + 1, // Django pagination is 1-based
        page_size: rowsPerPage,
      };

      // Add non-empty filters to params
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          // For multi-select fields, send comma-separated values if not empty
          if (value.length > 0) {
            params[key] = value.join(',');
          }
        } else if (typeof value === 'boolean') {
          // For boolean filters (isnull), add if true
          if (value === true) {
            params[key] = 'true';
          }
        } else if (value && value.trim()) {
          // For text fields, add if not empty
          params[key] = value.trim();
        }
      });

      const response: PaginatedResponse<Item> = await itemsAPI.list(params);
      
      setItems(response.results);
      setTotalCount(response.count);
      setInitialLoadComplete(true);

      // Announce results to screen readers
      focusUtils.announce(
        `Loaded ${response.results.length} items of ${response.count} total`,
        'polite'
      );
    } catch (err) {
      console.error('Error loading items:', err);
      const errorMessage = err instanceof APIError 
        ? `Failed to load items: ${err.message}` 
        : 'Failed to load items. Please try again.';
      
      setError(errorMessage);
      focusUtils.announce(errorMessage, 'assertive');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, activeFilters]);

  // Debounced filter application - automatically applies filters after user stops typing
  const debouncedApplyFilters = useMemo(
    () => debounce((newFilters: FilterState) => {
      setActiveFilters(newFilters);
      setPage(0); // Reset to first page when filters change
    }, 500),
    []
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedApplyFilters.cancel();
    };
  }, [debouncedApplyFilters]);

  // Load items on component mount and when dependencies change
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Handle filter changes
  const handleFilterChange = (field: keyof FilterState, value: string | string[]) => {
    const newFilters = {
      ...filters,
      [field]: value,
    };
    setFilters(newFilters);
    
    // Debounced API call - waits 500ms after user stops typing
    debouncedApplyFilters(newFilters);
  };

  // Handle empty filter toggle
  const handleEmptyFilterToggle = (field: keyof FilterState) => {
    const currentValue = filters[field] as boolean | undefined;
    const newValue = currentValue === true ? undefined : true;
    
    const newFilters = {
      ...filters,
      [field]: newValue,
    };
    setFilters(newFilters);
    
    // Immediately apply (no need for debounce on button clicks)
    debouncedApplyFilters.cancel();
    setActiveFilters(newFilters);
    setPage(0);
  };

  // Clear all filters
  const handleClearFilters = () => {
    clearPersistedFilters();
    debouncedApplyFilters.cancel(); // Cancel any pending debounced calls
    setActiveFilters(DEFAULT_FILTERS); // Immediately apply cleared filters
    setPage(0);
    focusUtils.announce('All filters cleared', 'polite');
  };

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    focusUtils.announce(`Navigated to page ${newPage + 1}`, 'polite');
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    focusUtils.announce(`Changed to ${newRowsPerPage} items per page`, 'polite');
  };

  // Handle item selection
  // Handle individual item selection
  const handleItemSelection = useCallback((item: Item, checked: boolean) => {
    toggleSelection(item.id, checked);
    
    focusUtils.announce(
      checked 
        ? `Selected item ${item.catalog_number}` 
        : `Deselected item ${item.catalog_number}`,
      'polite'
    );
  }, [toggleSelection]);

  // Handle "Deselect All" button
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  };

  // Handle select all on current page
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setAllSelections(items, checked);
    
    // If parent component needs full objects
    if (onSelectionChange) {
      onSelectionChange(checked ? items : []);
    }
    
    focusUtils.announce(
      checked ? `Selected all ${items.length} items on this page` : 'Deselected all items', 
      'polite'
    );
  };

  // Get active filter count (needed by batch edit handler)
  // Uses activeFilters (not filters) to ensure we count filters that have been applied
  const activeFilterCount = Object.values(activeFilters).filter(value => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'boolean') {
      return value === true;
    }
    return value && value.trim();
  }).length;

  // Helper function to apply client-side filters to cached items
  const applyFiltersToCache = useCallback((allItems: Item[]) => {
    console.log('[ItemsList] applyFiltersToCache called with', allItems.length, 'items');
    console.log('[ItemsList] applyFiltersToCache activeFilters:', activeFilters);
    
    // Sample first few items to see their structure
    if (allItems.length > 0) {
      console.log('[ItemsList] Sample item structure:', {
        catalog_number: allItems[0].catalog_number,
        description_scope_and_content: allItems[0].description_scope_and_content,
        call_number: allItems[0].call_number,
        titles_count: allItems[0].titles?.length,
        collaborators_count: allItems[0].collaborators?.length,
        hasDescription: !!allItems[0].description_scope_and_content,
        hasCatalogNumber: !!allItems[0].catalog_number,
        hasCallNumber: !!allItems[0].call_number,
      });
    }
    
    const filtered = allItems.filter(item => {
      // Apply active filters (matching the backend filter logic)
      if (activeFilters.keyword_contains) {
        const keyword = activeFilters.keyword_contains.toLowerCase();
        const catalogMatch = item.catalog_number?.toLowerCase().includes(keyword);
        const descMatch = item.description_scope_and_content?.toLowerCase().includes(keyword);
        const callMatch = item.call_number?.toLowerCase().includes(keyword);
        
        // Also check titles (matching backend behavior)
        const titlesMatch = item.titles?.some((title: any) => 
          title.title?.toLowerCase().includes(keyword)
        );
        
        // Check collaborators (matching backend behavior)  
        const collaboratorsMatch = item.collaborators?.some((collab: any) =>
          collab.name?.toLowerCase().includes(keyword)
        );
        
        const matches = catalogMatch || descMatch || callMatch || titlesMatch || collaboratorsMatch;
        
        // Debug first non-matching item
        if (!matches && allItems.indexOf(item) === 0) {
          console.log('[ItemsList] First item does NOT match keyword filter:', {
            keyword,
            catalog_number: item.catalog_number,
            description_scope_and_content: item.description_scope_and_content,
            call_number: item.call_number,
            catalogMatch,
            descMatch,
            callMatch,
            titlesMatch,
            collaboratorsMatch,
          });
        }
        
        if (!matches) {
          return false;
        }
      }
      
      if (activeFilters.catalog_number_contains && 
          !item.catalog_number?.toLowerCase().includes(activeFilters.catalog_number_contains.toLowerCase())) {
        return false;
      }
      
      if (activeFilters.access_level.length > 0 && 
          !activeFilters.access_level.includes(item.item_access_level)) {
        return false;
      }
      
      if (activeFilters.call_number_contains && 
          !item.call_number?.toLowerCase().includes(activeFilters.call_number_contains.toLowerCase())) {
        return false;
      }
      
      // Date range filters - checking if item's date range overlaps with filter range
      // Backend logic: accession_date_min filter uses gte on item.accession_date_min
      //               accession_date_max filter uses lte on item.accession_date_max
      // This finds items whose date range falls within the filter range
      if (activeFilters.accession_date_min && item.accession_date_min && 
          item.accession_date_min < activeFilters.accession_date_min) {
        return false;
      }
      
      if (activeFilters.accession_date_max && item.accession_date_max && 
          item.accession_date_max > activeFilters.accession_date_max) {
        return false;
      }
      
      if (activeFilters.creation_date_min && item.creation_date_min && 
          item.creation_date_min < activeFilters.creation_date_min) {
        return false;
      }
      
      if (activeFilters.creation_date_max && item.creation_date_max && 
          item.creation_date_max > activeFilters.creation_date_max) {
        return false;
      }
      
      if (activeFilters.titles_contains) {
        // Check if any title contains the search string
        const titlesMatch = (item as any).title_item?.some((title: any) => 
          title.title?.toLowerCase().includes(activeFilters.titles_contains.toLowerCase())
        );
        if (!titlesMatch) return false;
      }
      
      if (activeFilters.resource_type.length > 0 && 
          !activeFilters.resource_type.includes(item.resource_type)) {
        return false;
      }
      
      if (activeFilters.language_contains) {
        // Check if any language name or glottocode contains the search string
        const languagesMatch = item.language?.some((lang: any) =>
          lang.name?.toLowerCase().includes(activeFilters.language_contains.toLowerCase()) ||
          lang.glottocode?.toLowerCase().includes(activeFilters.language_contains.toLowerCase())
        );
        if (!languagesMatch) return false;
      }
      
      if (activeFilters.description_scope_and_content_contains && 
          !item.description_scope_and_content?.toLowerCase().includes(activeFilters.description_scope_and_content_contains.toLowerCase())) {
        return false;
      }
      
      if (activeFilters.genre_contains) {
        // Check if any genre contains the search string
        const genreMatch = item.genre?.some((g: string) => 
          g.toLowerCase().includes(activeFilters.genre_contains.toLowerCase())
        );
        if (!genreMatch) return false;
      }
      
      if (activeFilters.collaborator_contains) {
        // Check if any collaborator name contains the search string
        const collaboratorsMatch = (item as any).item_collaboratorroles?.some((cr: any) =>
          cr.collaborator?.full_name?.toLowerCase().includes(activeFilters.collaborator_contains.toLowerCase())
        );
        if (!collaboratorsMatch) return false;
      }
      
      if (activeFilters.depositor_name_contains && 
          !item.depositor_name?.toLowerCase().includes(activeFilters.depositor_name_contains.toLowerCase())) {
        return false;
      }
      
      return true;
    });
    
    console.log('[ItemsList] applyFiltersToCache filtered to', filtered.length, 'items');
    return filtered;
  }, [activeFilters]);

  // Navigation handlers
  const handleViewItem = useCallback((item: Item) => {
    navigate(`/items/${item.id}`);
  }, [navigate]);

  const handleAddItem = () => {
    navigate('/items/create');
  };

  // Batch edit handler
  const handleBatchEditExecute = useCallback(async (mode: BatchEditMode) => {
    console.log('[ItemsList] Batch edit execute with mode:', mode);
    console.log('[ItemsList] filters:', filters);
    console.log('[ItemsList] activeFilters:', activeFilters);
    console.log('[ItemsList] activeFilterCount:', activeFilterCount);
    
    // Handle 'empty' mode - no IDs, just navigate
    if (mode === 'empty') {
      const batchConfig = {
        mode: 'empty',
        ids: [],
        timestamp: Date.now(),
      };
      sessionStorage.setItem('item-batch-config', JSON.stringify(batchConfig));
      navigate('/items/batch');
      return;
    }
    
    // Check cache status
    const cacheReady = cache && !cacheLoading && loadProgress >= 100;
    
    // Get IDs based on mode
    let ids: number[];
    
    if (mode === 'selected') {
      ids = Array.from(selectedIds);
    } else {
      // For 'filtered' mode, we need IDs from cache
      if (!cacheReady) {
        const filteredRowCount = totalCount;
        const hasActiveFilters = activeFilterCount > 0;
        const shouldShowWarning = !hasActiveFilters;
        
        setLoadingDialogState({
          cacheLoading: true,
          cacheProgress: loadProgress,
          totalCount: cache?.count || 0,
          showLargeDatasetWarning: shouldShowWarning,
          rowCount: filteredRowCount,
          mode: mode,
        });
        setPendingBatchIds([]);
        return;
      }
      
      // Cache is ready, but we need to force refresh from backend to get authoritative cache state
      // This will trigger polling if backend cache is rebuilding (202 response)
      console.log('[ItemsList] Force refreshing cache from backend for batch edit...');
      
      // Check if we should show warning (no active filters = large dataset)
      const hasActiveFilters = activeFilterCount > 0;
      const shouldShowWarning = !hasActiveFilters;
      
      // Show dialog immediately with loading state to provide instant feedback
      // This prevents the UI from freezing while waiting for cache data
      setLoadingDialogState({
        cacheLoading: true,
        cacheProgress: loadProgress,
        totalCount: cache?.count || 0,
        showLargeDatasetWarning: shouldShowWarning,
        rowCount: totalCount,
        mode: mode,
      });
      
      // Set pending batch IDs to empty array to indicate batch operation in progress
      // This signals to the useEffect that monitors cacheLoading
      setPendingBatchIds([]);
      
      // Trigger the cache refresh - if it returns 202, ItemCacheContext will handle polling
      // The auto-proceed useEffect will handle completion
      getItems(true).catch(error => {
        console.error('[ItemsList] Error refreshing cache:', error);
        setLoadingDialogState(null);
        setPendingBatchIds(null);
      });
      
      // Return here immediately
      return;
    }
    
    // At this point, mode must be 'selected' and we have the IDs
    console.log('[ItemsList] Batch edit IDs:', ids.length, 'items');
    
    // For selected mode, proceed directly (no warning needed)
    const batchConfig = {
      mode: mode,
      ids: ids,
      timestamp: Date.now(),
    };
    sessionStorage.setItem('item-batch-config', JSON.stringify(batchConfig));
    navigate('/items/batch');
  }, [selectedIds, items, activeFilterCount, totalCount, navigate, cache, cacheLoading, loadProgress, getItems, applyFiltersToCache]);
  
  // Handle dialog continue
  const handleDialogContinue = useCallback(async (suppressFuture: boolean) => {
    if (!pendingBatchIds) return;
    
    if (loadingDialogState && loadingDialogState.cacheLoading) {
      await getItems();
    }
    
    setLoadingDialogState(null);
    
    const batchConfig = {
      mode: loadingDialogState?.mode || 'filtered',
      ids: pendingBatchIds,
      timestamp: Date.now(),
    };
    sessionStorage.setItem('item-batch-config', JSON.stringify(batchConfig));
    setPendingBatchIds(null);
    navigate('/items/batch');
  }, [pendingBatchIds, loadingDialogState, getItems, navigate]);
  
  // Handle dialog cancel
  const handleDialogCancel = useCallback(() => {
    setLoadingDialogState(null);
    setPendingBatchIds(null);
  }, []);
  
  // Watch for cacheLoading state and show dialog if polling starts
  // This triggers when getItems(true) encounters a 202 response
  // BUT only if we're in the middle of a batch edit operation (have pendingBatchIds)
  useEffect(() => {
    // Only show dialog if:
    // 1. Cache loading just started (cacheLoading is true)
    // 2. We don't already have a dialog open (loadingDialogState is null)
    // 3. We have pending batch IDs (meaning user clicked batch edit button)
    if (cacheLoading && !loadingDialogState && pendingBatchIds !== null) {
      console.log('[ItemsList] Cache loading detected during batch edit operation, showing loading dialog');
      
      // Determine if warning is needed based on current filter state
      const hasActiveFilters = activeFilterCount > 0;
      const shouldShowWarning = !hasActiveFilters;
      
      setLoadingDialogState({
        cacheLoading: true,
        cacheProgress: loadProgress,
        totalCount: cache?.count || 0,
        showLargeDatasetWarning: shouldShowWarning,
        rowCount: cache?.count || 0,
        mode: 'filtered',
      });
    }
  }, [cacheLoading, loadingDialogState, loadProgress, cache, activeFilterCount, pendingBatchIds]);
  
  // Auto-proceed when cache finishes loading (for Scenario B: loading only, no warning)
  useEffect(() => {
    // Only proceed if:
    // 1. Dialog is open and showing loading state
    // 2. Cache just finished loading
    // 3. There's no large dataset warning (otherwise user needs to confirm)
    if (
      loadingDialogState &&
      loadingDialogState.cacheLoading && // Dialog was showing loading
      cache &&
      !cacheLoading &&
      loadProgress >= 100 // Cache is now ready
    ) {
      console.log('[ItemsList] Cache loading complete');
      
      // Now we can get the filtered IDs since cache is ready
      const getFilteredIds = async () => {
        try {
          const allItems = await getItems();
          
          // Apply filters to get actual filtered IDs
          const filteredItems = activeFilterCount === 0 
            ? allItems 
            : applyFiltersToCache(allItems);
          const ids = filteredItems.map(item => item.id);
          
          // Check if large dataset (no filters = editing all rows)
          const hasActiveFilters = activeFilterCount > 0;
          const largeDataset = !hasActiveFilters;
          
          if (largeDataset) {
            // Update dialog to show warning instead of loading
            console.log('[ItemsList] Large dataset detected, showing warning');
            setLoadingDialogState({
              cacheLoading: false,
              cacheProgress: loadProgress,
              totalCount: cache?.count || 0,
              showLargeDatasetWarning: true,
              rowCount: ids.length,
              mode: loadingDialogState.mode,
            });
            setPendingBatchIds(ids);
          } else {
            // No warning needed, proceed automatically
            console.log('[ItemsList] Auto-proceeding to batch editor');
            setLoadingDialogState(null);
            const batchConfig = {
              mode: loadingDialogState.mode,
              ids: ids,
              timestamp: Date.now(),
            };
            sessionStorage.setItem('item-batch-config', JSON.stringify(batchConfig));
            setPendingBatchIds(null);
            navigate('/items/batch');
          }
        } catch (error) {
          console.error('[ItemsList] Error getting filtered IDs:', error);
          setLoadingDialogState(null);
          setPendingBatchIds(null);
        }
      };
      
      getFilteredIds();
    }
  }, [loadingDialogState, cache, cacheLoading, loadProgress, getItems, activeFilterCount, navigate, applyFiltersToCache]);
  
  // Export handler
  const handleExportExecute = useCallback(async (mode: ExportMode) => {
    console.log('[ItemsList] Export execute with mode:', mode);
    console.log('[ItemsList] activeFilterCount:', activeFilterCount);
    console.log('[ItemsList] activeFilters:', activeFilters);
    
    let ids: number[];
    
    if (mode === 'selected') {
      ids = Array.from(selectedIds);
      if (ids.length === 0) {
        setError('No items selected for export');
        return;
      }
    } else {
      // For 'filtered' mode, use cache to get ALL filtered IDs (not just current page)
      try {
        const allCachedItems = await getItems();
        console.log('[ItemsList] Got cached items:', allCachedItems.length);
        
        // Apply current filters to cache data (client-side filtering)
        // If no filters, use all items; otherwise apply filters
        const filteredItems = activeFilterCount === 0 
          ? allCachedItems 
          : applyFiltersToCache(allCachedItems);
        
        ids = filteredItems.map(i => i.id);
        console.log('[ItemsList] Filtered cache from', allCachedItems.length, 'to', ids.length, 'items for export');
        console.log('[ItemsList] Sample of first 10 filtered IDs:', ids.slice(0, 10));
        console.log('[ItemsList] Sending IDs to export:', ids.length, 'items');
      } catch (error) {
        console.error('[ItemsList] Error filtering cache for export:', error);
        // Fallback to current page IDs
        ids = items.map(i => i.id);
        console.log('[ItemsList] Fallback to current page IDs:', ids.length);
      }
    }
    
    try {
      setExportStatus('preparing');
      
      const response = await itemsAPI.exportItems({ mode, ids });
      
      if (response.async) {
        // Async export - poll for completion
        const exportId = response.export_id;
        console.log('[ItemsList] Async export started:', exportId);
        
        // Start polling with setInterval
        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusResult = await itemsAPI.getExportStatus(exportId);
            console.log('[ItemsList] Export status:', statusResult.status);
            
            if (statusResult.status === 'completed') {
              // Stop polling
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
    }
              
              // Download the file
              setExportStatus('ready');
              const blob = await itemsAPI.downloadExport(exportId);
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              // Generate timestamp-based filename (YYYY-MM-DD_HHMMSS)
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              const hours = String(now.getHours()).padStart(2, '0');
              const minutes = String(now.getMinutes()).padStart(2, '0');
              const seconds = String(now.getSeconds()).padStart(2, '0');
              const timestamp = `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
              link.download = `items_export_${timestamp}.xlsx`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              
              setExportStatus('idle');
            } else if (statusResult.status === 'failed') {
              // Stop polling on failure
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              setError('Export failed');
              setExportStatus('idle');
            }
          } catch (pollErr) {
            console.error('[ItemsList] Export polling error:', pollErr);
            // Stop polling on error
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setError('Failed to check export status');
            setExportStatus('idle');
          }
        }, 2000); // Poll every 2 seconds
        
        // Set timeout to stop polling after 2 minutes
        setTimeout(() => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setError('Export timeout - please try again');
            setExportStatus('idle');
          }
        }, 120000); // 2 minutes
      } else {
        // Synchronous export - file download already handled by exportItems
        setExportStatus('ready');
        setTimeout(() => setExportStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('[ItemsList] Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
      setExportStatus('idle');
    }
  }, [selectedIds, items, getItems, applyFiltersToCache]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Selection state calculations
  const selectedCount = items.filter(item => selectedIds.has(item.id)).length;
  const isAllSelected = items.length > 0 && selectedCount === items.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < items.length;

  // Mobile card view for items - memoized to prevent recreating on every render
  const renderMobileCard = useCallback((item: Item) => (
    <Card 
      key={item.id}
      sx={{ 
        mb: 2,
        cursor: 'pointer',
        '&:hover': {
          boxShadow: 2,
        },
      }}
      role="article"
      aria-labelledby={`item-${item.id}-title`}
      onClick={() => handleViewItem(item)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography 
            id={`item-${item.id}-title`}
            variant="h6" 
            component="h3"
            sx={{ fontWeight: 'medium' }}
          >
            {item.catalog_number}
          </Typography>
          <Box onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedIds.has(item.id)}
              onChange={(e) => handleItemSelection(item, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select item ${item.catalog_number}`}
              sx={{ p: 1 }}
            />
          </Box>
        </Box>

        {item.call_number && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Call Number: {item.call_number}
          </Typography>
        )}

        {item.titles && item.titles.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Title(s):</Typography>
            {item.titles.map((title, index) => (
              <Typography
                key={index}
                variant="body2"
                sx={{
                  fontWeight: title.default ? 'medium' : 'normal',
                  fontStyle: title.default ? 'normal' : 'italic',
                  ml: 1,
                }}
              >
                {title.title}
                {title.language_name && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {' '}({title.language_name})
                  </Typography>
                )}
              </Typography>
            ))}
          </Box>
        )}

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Chip 
            label={item.resource_type_display || 'Unknown'} 
            size="small" 
            variant="outlined"
          />
          <Chip 
            label={item.item_access_level_display || 'Unknown'} 
            size="small"
            color={item.item_access_level === '1' ? 'success' : 'default'}
          />
        </Stack>

        {item.language_names && item.language_names.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Languages:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {item.language_names.map((lang, index) => (
                <Chip key={index} label={lang} size="small" />
              ))}
            </Box>
          </Box>
        )}

        {item.collaborator_names && item.collaborator_names.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Collaborators:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {item.collaborator_names.slice(0, 3).map((collab, index) => (
                <Chip key={index} label={collab} size="small" />
              ))}
              {item.collaborator_names.length > 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  +{item.collaborator_names.length - 3} more
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {item.description && (
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ 
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.description}
          </Typography>
        )}
      </CardContent>
    </Card>
  ), [selectedIds, handleViewItem, handleItemSelection]);

  // Show full-page loading only on initial load, not on subsequent filter/pagination changes
  if (!initialLoadComplete) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="400px"
        role="status"
        aria-live="polite"
        aria-label="Loading items"
      >
        <CircularProgress aria-label="Loading items list" />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading items...
        </Typography>
      </Box>
    );
  }

  return (
    <Box role="region" aria-labelledby="items-heading">
      {/* Header */}
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center" 
        mb={2}
        flexDirection={{ xs: 'column', sm: 'row' }}
        gap={2}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography 
            id="items-heading"
            variant="h4" 
            component="h1"
            sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
          >
            Items
          </Typography>
          {/* Selection indicator */}
          {selectedIds.size > 0 && (
            <Chip
              label={`${selectedIds.size} selected`}
              color="primary"
              size="medium"
              onDelete={handleDeselectAll}
              deleteIcon={<CheckBoxIcon />}
            />
          )}
        </Box>
        {showActions && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <ItemExportButton
              mode={exportMode}
              exportStatus={exportStatus}
              onModeChange={setExportMode}
              onExecute={handleExportExecute}
              selectedCount={selectedIds.size}
              filteredCount={totalCount}
            />
            <ItemBatchEditButton
              mode={batchEditMode}
              onModeChange={setBatchEditMode}
              onExecute={handleBatchEditExecute}
              selectedCount={selectedIds.size}
              filteredCount={totalCount}
              totalCount={totalCount}
              cacheLoading={cacheLoading}
              cacheProgress={loadProgress}
            />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
            sx={{ minHeight: touchTargets.minSize }}
            aria-label={ariaLabels.add}
          >
              {isMobile ? 'Add' : 'Add Item'}
          </Button>
          </Box>
        )}
      </Box>

      {/* Filter Controls */}
      <Paper sx={{ mb: 2, p: 2 }} role="search" aria-labelledby="filter-heading">
        <Typography 
          id="filter-heading" 
          variant="h6" 
          component="h2"
          sx={{ 
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          Filter Items
        </Typography>
        
        <Box 
          display="flex" 
          alignItems="center" 
          gap={2} 
          mb={showFilters ? 2 : 0}
          flexWrap="wrap"
        >
          <Button
            variant="outlined"
            startIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="filter-panel"
            sx={{ minHeight: touchTargets.minSize }}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          
          {activeFilterCount > 0 && (
            <>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                color="secondary"
                size="small"
                sx={{ minHeight: touchTargets.minSize }}
              >
                Clear Filters
              </Button>
              <Chip 
                icon={<FilterListIcon />}
                label={`${activeFilterCount} active filter${activeFilterCount !== 1 ? 's' : ''}`}
                color="primary"
                variant="outlined"
              />
            </>
          )}
        </Box>

        <Collapse in={showFilters}>
          <Box 
            id="filter-panel"
            sx={{ 
              display: 'grid', 
              gridTemplateColumns: { 
                xs: '1fr', 
                sm: 'repeat(2, 1fr)', 
                md: 'repeat(3, 1fr)' 
              }, 
              gap: 2 
            }}
            role="group"
            aria-labelledby="filter-heading"
          >
            {/* Keyword Search - First */}
            <TextField
              {...formUtils.generateFieldProps('keyword_contains', 'Keywords')}
              label="Keywords"
              value={filters.keyword_contains}
              onChange={(e) => handleFilterChange('keyword_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Catalog Number */}
            <TextField
              {...formUtils.generateFieldProps('catalog_number_contains', 'Catalog Number')}
              label="Catalog Number"
              value={filters.catalog_number_contains}
              onChange={(e) => handleFilterChange('catalog_number_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Access Level - Multi-select */}
            <FormControl size="small" fullWidth>
              <InputLabel id="access-level-label">Access Level</InputLabel>
              <Select
                labelId="access-level-label"
                multiple
                value={filters.access_level}
                onChange={(e) => handleFilterChange('access_level', e.target.value as string[])}
                input={<OutlinedInput label="Access Level" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const choice = ACCESS_LEVEL_CHOICES.find(c => c.value === value);
                      return <Chip key={value} label={choice?.label || value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {ACCESS_LEVEL_CHOICES.map((choice) => (
                  <MenuItem key={choice.value} value={choice.value}>
                    <Checkbox checked={filters.access_level.indexOf(choice.value) > -1} />
                    {choice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Call Number */}
            <TextField
              {...formUtils.generateFieldProps('call_number_contains', 'Call Number')}
              label="Call Number"
              value={filters.call_number_contains}
              onChange={(e) => handleFilterChange('call_number_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Titles (renamed from "Any Title") */}
            <TextField
              {...formUtils.generateFieldProps('titles_contains', 'Titles')}
              label="Titles"
              value={filters.titles_contains}
              onChange={(e) => handleFilterChange('titles_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Resource Type - Multi-select */}
            <FormControl size="small" fullWidth>
              <InputLabel id="resource-type-label">Resource Type</InputLabel>
              <Select
                labelId="resource-type-label"
                multiple
                value={filters.resource_type}
                onChange={(e) => handleFilterChange('resource_type', e.target.value as string[])}
                input={<OutlinedInput label="Resource Type" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const choice = RESOURCE_TYPE_CHOICES.find(c => c.value === value);
                      return <Chip key={value} label={choice?.label || value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {RESOURCE_TYPE_CHOICES.map((choice) => (
                  <MenuItem key={choice.value} value={choice.value}>
                    <Checkbox checked={filters.resource_type.indexOf(choice.value) > -1} />
                    {choice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Genre */}
            <TextField
              {...formUtils.generateFieldProps('genre_contains', 'Genre')}
              label="Genre"
              value={filters.genre_contains}
              onChange={(e) => handleFilterChange('genre_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Language */}
            <TextField
              {...formUtils.generateFieldProps('language_contains', 'Language')}
              label="Language"
              value={filters.language_contains}
              onChange={(e) => handleFilterChange('language_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Collaborator */}
            <TextField
              {...formUtils.generateFieldProps('collaborator_contains', 'Collaborator')}
              label="Collaborator"
              value={filters.collaborator_contains}
              onChange={(e) => handleFilterChange('collaborator_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Depositor Name */}
            <TextField
              {...formUtils.generateFieldProps('depositor_name_contains', 'Depositor Name')}
              label="Depositor Name"
              value={filters.depositor_name_contains}
              onChange={(e) => handleFilterChange('depositor_name_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Date filters */}
            {Object.entries({
              accession_date_min: 'Accession Date (From)',
              accession_date_max: 'Accession Date (To)',
              creation_date_min: 'Creation Date (From)',
              creation_date_max: 'Creation Date (To)',
            }).map(([field, label]) => (
              <TextField
                key={field}
                {...formUtils.generateFieldProps(field, label)}
                label={label}
                type="date"
                value={filters[field as keyof FilterState]}
                onChange={(e) => handleFilterChange(field as keyof FilterState, e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                fullWidth
              />
            ))}
          </Box>
          
          {/* Description Filter - Full Width */}
          <Box sx={{ mt: 2 }}>
            <TextField
              {...formUtils.generateFieldProps('description_scope_and_content_contains', 'Description/Scope and Content')}
              label="Description/Scope and Content"
              value={filters.description_scope_and_content_contains}
              onChange={(e) => handleFilterChange('description_scope_and_content_contains', e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={2}
            />
          </Box>

          {/* Empty Field Filters */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" gutterBottom>
              Find Records With Empty Values:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant={filters.collection_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.collection_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('collection_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Collection: Empty
              </Button>
              <Button
                variant={filters.access_level_restrictions_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.access_level_restrictions_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('access_level_restrictions_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Access Level Restrictions: Empty
              </Button>
              <Button
                variant={filters.accession_date_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.accession_date_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('accession_date_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Accession Date: Empty
              </Button>
              <Button
                variant={filters.accession_number_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.accession_number_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('accession_number_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Accession Number: Empty
              </Button>
              <Button
                variant={filters.call_number_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.call_number_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('call_number_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Call Number: Empty
              </Button>
              <Button
                variant={filters.collaborator_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.collaborator_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('collaborator_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Collaborator: Empty
              </Button>
              <Button
                variant={filters.creation_date_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.creation_date_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('creation_date_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Creation Date: Empty
              </Button>
              <Button
                variant={filters.depositor_name_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.depositor_name_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('depositor_name_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Depositor Name: Empty
              </Button>
              <Button
                variant={filters.description_scope_and_content_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.description_scope_and_content_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('description_scope_and_content_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Description: Empty
              </Button>
              <Button
                variant={filters.genre_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.genre_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('genre_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Genre: Empty
              </Button>
              <Button
                variant={filters.indigenous_title_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.indigenous_title_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('indigenous_title_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Indigenous Title: Empty
              </Button>
              <Button
                variant={filters.english_title_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.english_title_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('english_title_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                English Title: Empty
              </Button>
              <Button
                variant={filters.item_access_level_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.item_access_level_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('item_access_level_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Access Level: Empty
              </Button>
              <Button
                variant={filters.language_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.language_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('language_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Language: Empty
              </Button>
              <Button
                variant={filters.resource_type_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.resource_type_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('resource_type_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Resource Type: Empty
              </Button>
              <Button
                variant={filters.original_format_medium_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.original_format_medium_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('original_format_medium_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Original Format/Medium: Empty
              </Button>
              <Button
                variant={filters.publisher_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.publisher_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('publisher_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Publisher: Empty
              </Button>
              <Button
                variant={filters.recording_context_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.recording_context_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('recording_context_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Recording Context: Empty
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Results Count */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {loading ? 'Loading...' : `${totalCount.toLocaleString()} item${totalCount !== 1 ? 's' : ''} found`}
      </Typography>

      {/* Error Display */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          role="alert"
          aria-live="assertive"
        >
          {error}
        </Alert>
      )}

      {/* Items Display - Mobile Cards or Desktop Table */}
      {isMobile ? (
        // Mobile card view
        <Box role="list" aria-label="Items list">
          {items.length === 0 ? (
            <Typography 
              variant="body1" 
              color="text.secondary" 
              textAlign="center" 
              py={4}
              role="status"
            >
              No items found
            </Typography>
          ) : (
            items.map((item) => renderMobileCard(item))
          )}
        </Box>
      ) : (
        // Desktop table view
        <TableContainer component={Paper}>
          <Table 
            ref={tableRef}
            tabIndex={-1}
            role="table"
            aria-label="Items table"
            aria-rowcount={totalCount}
            aria-describedby="table-description"
          >
            <caption 
              id="table-description"
              {...tableUtils.generateCaptionProps(totalCount, items.length)}
            />
            
            <TableHead>
              <TableRow role="row">
                <TableCell 
                  padding="checkbox"
                  {...tableUtils.generateHeaderProps('select')}
                >
                  <Checkbox
                    indeterminate={isIndeterminate}
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    icon={<CheckBoxOutlineBlankIcon />}
                    checkedIcon={<CheckBoxIcon />}
                    aria-label={
                      isAllSelected 
                        ? ariaLabels.selectAllRows
                        : 'Select all items on this page'
                    }
                  />
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('catalog')}>
                  Catalog #
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('title')}>
                  Title
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('type')}>
                  Resource Type
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('languages')}>
                  Languages
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('collaborators')}>
                  Collaborators
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('access')}>
                  Access Level
                </TableCell>
              </TableRow>
            </TableHead>
            
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={7} 
                    align="center"
                    role="status"
                    aria-live="polite"
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <CircularProgress size={24} aria-label="Loading more items" />
                      <Typography>Loading items...</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={7} 
                    align="center"
                    role="status"
                  >
                    No items found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow 
                    key={item.id} 
                    hover
                    onClick={() => handleViewItem(item)}
                    role="row"
                    aria-rowindex={page * rowsPerPage + index + 1}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      }
                    }}
                    aria-label={`View details for item ${item.catalog_number}`}
                  >
                    <TableCell 
                      padding="checkbox"
                      {...tableUtils.generateCellProps('select', index)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onChange={(e) => handleItemSelection(item, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        icon={<CheckBoxOutlineBlankIcon />}
                        checkedIcon={<CheckBoxIcon />}
                        aria-label={ariaLabels.selectRow}
                      />
                    </TableCell>
                    
                    <TableCell {...tableUtils.generateCellProps('catalog', index)}>
                      <Link
                        component={RouterLink}
                        to={`/items/${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        variant="body2"
                        sx={{ 
                          fontWeight: 'medium',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                      >
                        {item.catalog_number}
                      </Link>
                      {item.call_number && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Call: {item.call_number}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell {...tableUtils.generateCellProps('title', index)}>
                      {item.titles && item.titles.length > 0 ? (
                        <Box>
                          {item.titles.map((title, titleIndex) => (
                            <Typography
                              key={titleIndex}
                              variant="body2"
                              sx={{ 
                                fontWeight: title.default ? 'medium' : 'normal',
                                fontStyle: title.default ? 'normal' : 'italic'
                              }}
                            >
                              {title.title}
                              {title.language_name && (
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {' '}({title.language_name})
                                </Typography>
                              )}
                            </Typography>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No title
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell {...tableUtils.generateCellProps('type', index)}>
                      <Chip 
                        label={item.resource_type_display || 'Unknown'} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>

                    <TableCell {...tableUtils.generateCellProps('languages', index)}>
                      {item.language_names && item.language_names.length > 0 ? (
                        <Box>
                          {item.language_names.map((lang, langIndex) => (
                            <Chip 
                              key={langIndex}
                              label={lang} 
                              size="small" 
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell {...tableUtils.generateCellProps('collaborators', index)}>
                      {item.collaborator_names && item.collaborator_names.length > 0 ? (
                        <Box>
                          {item.collaborator_names.slice(0, 2).map((collab, collabIndex) => (
                            <Chip 
                              key={collabIndex}
                              label={collab} 
                              size="small" 
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          ))}
                          {item.collaborator_names.length > 2 && (
                            <Typography variant="caption" color="text.secondary">
                              +{item.collaborator_names.length - 2} more
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell {...tableUtils.generateCellProps('access', index)}>
                      <Chip 
                        label={item.item_access_level_display || 'Unknown'} 
                        size="small"
                        color={item.item_access_level === '1' ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            aria-label={ariaLabels.pagination}
            labelRowsPerPage="Items per page:"
            labelDisplayedRows={({ from, to, count }) => 
              `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`
            }
          />
        </TableContainer>
      )}
      
      {/* Batch Edit Loading/Warning Dialog */}
      <ItemBatchLoadingDialog
        open={loadingDialogState !== null}
        state={loadingDialogState}
        onCancel={handleDialogCancel}
        onContinue={handleDialogContinue}
      />
    </Box>
  );
};

export default ItemsList;