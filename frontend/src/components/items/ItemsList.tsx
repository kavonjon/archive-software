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
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import { itemsAPI, Item, PaginatedResponse, APIError, ACCESS_LEVEL_CHOICES, RESOURCE_TYPE_CHOICES, GENRE_CHOICES, LANGUAGE_DESCRIPTION_TYPE_CHOICES, FORMAT_CHOICES } from '../../services/api';
import { ariaLabels, focusUtils, tableUtils, formUtils } from '../../utils/accessibility';
import { touchTargets } from '../../utils/responsive';
import { useAuth } from '../../contexts/AuthContext';
import { useItemCache } from '../../contexts/ItemCacheContext';
import { usePersistedListState } from '../../hooks/usePersistedListState';
import { hasEditAccess } from '../../utils/permissions';
import { getAccessLevelChipProps } from '../../utils/accessLevelChip';
import ItemBatchEditButton, { BatchEditMode } from './ItemBatchEditButton';
import ItemExportButton, { ExportMode, ExportStatus } from './ItemExportButton';
import ItemBatchLoadingDialog, { LoadingDialogState } from './ItemBatchLoadingDialog';
import ColumnVisibilityMenu from '../list/ColumnVisibilityMenu';
import { ITEM_LIST_COLUMNS, ITEM_LIST_COLUMN_GROUPS, ITEM_LIST_DETAIL_FIELD_ORDER, ItemListColumnId } from './itemListColumns';
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility';
import { sortItemIdsByCatalogNumber } from '../../utils/itemBatchOrder';

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
  accession_number_contains: string;
  titles_contains: string;
  resource_type: string[];  // Multi-select array
  language_contains: string;
  creation_date_min: string;
  creation_date_max: string;
  genre: string[];
  language_description_type: string[];
  collection_contains: string;
  original_format_medium: string[];
  collaborator_contains: string;
  
  // Empty field filters (isnull)
  accession_number_isnull?: boolean;
  call_number_isnull?: boolean;
  collaborator_isnull?: boolean;
  genre_isnull?: boolean;
  item_access_level_isnull?: boolean;
  language_isnull?: boolean;
  resource_type_isnull?: boolean;
  original_format_medium_isnull?: boolean;
  publisher_isnull?: boolean;
}

const isBlankText = (value: string | null | undefined): boolean =>
  !value || !value.trim();

function countItemFilters(filterState: FilterState, excludeKeyword = false): number {
  return Object.entries(filterState).filter(([key, value]) => {
    if (excludeKeyword && key === 'keyword_contains') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value === true;
    if (typeof value === 'string') return value.trim() !== '';
    return false;
  }).length;
}

const DEFAULT_FILTERS: FilterState = {
  keyword_contains: '',
  catalog_number_contains: '',
  access_level: [],
  call_number_contains: '',
  accession_number_contains: '',
  titles_contains: '',
  resource_type: [],
  language_contains: '',
  creation_date_min: '',
  creation_date_max: '',
  genre: [],
  language_description_type: [],
  collection_contains: '',
  original_format_medium: [],
  collaborator_contains: '',
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

  const {
    visibleColumnIds,
    toggleColumn,
    resetToDefaults,
    isVisible,
  } = usePersistedColumnVisibility({
    storageKey: 'item-list-visible-columns',
    version: 2,
    columns: ITEM_LIST_COLUMNS,
  });

  const columnMenuOptions = useMemo(() => {
    const detailOrder = new Map(
      ITEM_LIST_DETAIL_FIELD_ORDER.map((columnId, index) => [columnId, index])
    );
    const groupOrder = new Map<string, number>(
      ITEM_LIST_COLUMN_GROUPS.map((groupName, index) => [groupName, index])
    );

    return ITEM_LIST_COLUMNS.filter((column) => column.hideable)
      .sort((left, right) => {
        const leftGroup = groupOrder.get(left.group) ?? Number.MAX_SAFE_INTEGER;
        const rightGroup = groupOrder.get(right.group) ?? Number.MAX_SAFE_INTEGER;
        if (leftGroup !== rightGroup) {
          return leftGroup - rightGroup;
        }

        const leftDetail = detailOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightDetail = detailOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        return leftDetail - rightDetail;
      })
      .map((column) => ({
        id: column.id,
        label: column.label,
        group: column.group,
      }));
  }, []);

  const visibleColumns = useMemo(
    () => ITEM_LIST_COLUMNS.filter((column) => isVisible(column.id)),
    [isVisible]
  );

  const tableColSpan = 1 + visibleColumns.length;

  const handleColumnVisibilityChange = useCallback(
    (columnId: ItemListColumnId, visible: boolean) => {
      const column = ITEM_LIST_COLUMNS.find((entry) => entry.id === columnId);
      if (!column) {
        return;
      }

      focusUtils.announce(
        visible ? `${column.label} column shown` : `${column.label} column hidden`,
        'polite'
      );
    },
    []
  );

  const handleResetColumnVisibility = useCallback(() => {
    resetToDefaults();
    focusUtils.announce('Column visibility reset to default', 'polite');
  }, [resetToDefaults]);

  // Load items from API
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params: Record<string, string | number | boolean> = {
        page: page + 1, // Django pagination is 1-based
        page_size: rowsPerPage,
      };

      // Add non-empty filters to params
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            const joined = value.join(',');
            // django-filter skips empty CharFilter values; comma-only encodes "Not specified"
            params[key] = key === 'access_level' && joined === '' ? ',' : joined;
          }
        } else if (typeof value === 'boolean') {
          if (value === true) {
            params[key] = value;
          }
        } else if (typeof value === 'string' && value.trim()) {
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
  const hasActiveFilters = countItemFilters(activeFilters) > 0;
  const advancedFilterCount = countItemFilters(activeFilters, true);

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
          !activeFilters.access_level.includes(item.item_access_level ?? '')) {
        return false;
      }
      
      if (activeFilters.call_number_contains && 
          !item.call_number?.toLowerCase().includes(activeFilters.call_number_contains.toLowerCase())) {
        return false;
      }
      
      if (activeFilters.accession_number_contains &&
          !item.accession_number?.toLowerCase().includes(activeFilters.accession_number_contains.toLowerCase())) {
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
          !activeFilters.resource_type.includes(item.resource_type ?? '')) {
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
      
      if (activeFilters.genre.length > 0) {
        const itemGenres = item.genre || [];
        const genreMatch = activeFilters.genre.some((selectedGenre) =>
          itemGenres.includes(selectedGenre)
        );
        if (!genreMatch) return false;
      }

      if (activeFilters.language_description_type.length > 0) {
        const itemTypes = item.language_description_type || [];
        const typeMatch = activeFilters.language_description_type.some((selectedType) =>
          itemTypes.includes(selectedType)
        );
        if (!typeMatch) return false;
      }

      if (activeFilters.collection_contains) {
        if (!item.collection) {
          return false;
        }
        const collectionQuery = activeFilters.collection_contains.toLowerCase();
        const abbrMatch = item.collection_abbr?.toLowerCase().includes(collectionQuery);
        const nameMatch = item.collection_name?.toLowerCase().includes(collectionQuery);
        if (!abbrMatch && !nameMatch) {
          return false;
        }
      }

      if (activeFilters.original_format_medium.length > 0 &&
          !activeFilters.original_format_medium.includes(item.original_format_medium ?? '')) {
        return false;
      }
      
      if (activeFilters.collaborator_contains) {
        const collaboratorsMatch = item.collaborators?.some((collab) =>
          collab.name?.toLowerCase().includes(activeFilters.collaborator_contains.toLowerCase())
        );
        if (!collaboratorsMatch) return false;
      }

      if (activeFilters.accession_number_isnull === true &&
          !isBlankText(item.accession_number)) {
        return false;
      }

      if (activeFilters.call_number_isnull === true &&
          !isBlankText(item.call_number)) {
        return false;
      }

      if (activeFilters.collaborator_isnull === true &&
          item.collaborators && item.collaborators.length > 0) {
        return false;
      }

      if (activeFilters.genre_isnull === true &&
          item.genre && item.genre.length > 0) {
        return false;
      }

      if (activeFilters.item_access_level_isnull === true &&
          !isBlankText(item.item_access_level)) {
        return false;
      }

      if (activeFilters.language_isnull === true &&
          item.language && item.language.length > 0) {
        return false;
      }

      if (activeFilters.resource_type_isnull === true &&
          !isBlankText(item.resource_type)) {
        return false;
      }

      if (activeFilters.original_format_medium_isnull === true &&
          !isBlankText(item.original_format_medium)) {
        return false;
      }

      if (activeFilters.publisher_isnull === true &&
          !isBlankText(item.publisher)) {
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
    console.log('[ItemsList] hasActiveFilters:', hasActiveFilters);
    
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
      if (ids.length > 0) {
        const allItems = await getItems();
        ids = sortItemIdsByCatalogNumber(ids, allItems);
      }
    } else {
      // For 'filtered' mode, we need IDs from cache
      if (!cacheReady) {
        const filteredRowCount = totalCount;
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
  }, [selectedIds, items, hasActiveFilters, totalCount, navigate, cache, cacheLoading, loadProgress, getItems, applyFiltersToCache]);
  
  // Handle dialog continue
  const handleDialogContinue = useCallback(async (suppressFuture: boolean) => {
    if (!pendingBatchIds) return;

    const mode = loadingDialogState?.mode || 'filtered';
    setLoadingDialogState(null);

    const allItems = await getItems();
    const orderedIds = sortItemIdsByCatalogNumber(pendingBatchIds, allItems);

    const batchConfig = {
      mode,
      ids: orderedIds,
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
  }, [cacheLoading, loadingDialogState, loadProgress, cache, hasActiveFilters, pendingBatchIds]);
  
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
          const filteredItems = hasActiveFilters
            ? applyFiltersToCache(allItems)
            : allItems;
          const ids = sortItemIdsByCatalogNumber(
            filteredItems.map((item) => item.id),
            allItems
          );
          
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
              ids,
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
  }, [loadingDialogState, cache, cacheLoading, loadProgress, getItems, hasActiveFilters, navigate, applyFiltersToCache]);
  
  // Export handler
  const handleExportExecute = useCallback(async (mode: ExportMode) => {
    console.log('[ItemsList] Export execute with mode:', mode);
    console.log('[ItemsList] hasActiveFilters:', hasActiveFilters);
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
        const filteredItems = hasActiveFilters
          ? applyFiltersToCache(allCachedItems)
          : allCachedItems;
        
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
  }, [selectedIds, items, getItems, applyFiltersToCache, hasActiveFilters]);

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
            {...getAccessLevelChipProps(item.item_access_level)}
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
          <TextField
            {...formUtils.generateFieldProps('keyword_contains', 'Keywords')}
            label="Keywords"
            value={filters.keyword_contains}
            onChange={(e) => handleFilterChange('keyword_contains', e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
            fullWidth
          />
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
          
          {hasActiveFilters && (
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
              {advancedFilterCount > 0 && (
              <Chip 
                icon={<FilterListIcon />}
                label={`${advancedFilterCount} active filter${advancedFilterCount !== 1 ? 's' : ''}`}
                color="primary"
                variant="outlined"
              />
              )}
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
                value={filters.access_level ?? []}
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
                    <Checkbox checked={(filters.access_level ?? []).indexOf(choice.value) > -1} />
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

            {/* Accession Number */}
            <TextField
              {...formUtils.generateFieldProps('accession_number_contains', 'Accession Number')}
              label="Accession Number"
              value={filters.accession_number_contains}
              onChange={(e) => handleFilterChange('accession_number_contains', e.target.value)}
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
                value={filters.resource_type ?? []}
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
                    <Checkbox checked={(filters.resource_type ?? []).indexOf(choice.value) > -1} />
                    {choice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Genre - Multi-select */}
            <FormControl size="small" fullWidth>
              <InputLabel id="genre-label">Genre</InputLabel>
              <Select
                labelId="genre-label"
                multiple
                value={filters.genre ?? []}
                onChange={(e) => handleFilterChange('genre', e.target.value as string[])}
                input={<OutlinedInput label="Genre" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const choice = GENRE_CHOICES.find(c => c.value === value);
                      return <Chip key={value} label={choice?.label || value} size="small" />;
                    })}
                  </Box>
                )}
                MenuProps={{
                  PaperProps: {
                    style: { maxHeight: 360 },
                  },
                }}
              >
                {GENRE_CHOICES.map((choice) => (
                  <MenuItem key={choice.value} value={choice.value}>
                    <Checkbox checked={(filters.genre ?? []).indexOf(choice.value) > -1} />
                    {choice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Language Description Type - Multi-select */}
            <FormControl size="small" fullWidth>
              <InputLabel id="language-description-type-label">Language Description Type</InputLabel>
              <Select
                labelId="language-description-type-label"
                multiple
                value={filters.language_description_type ?? []}
                onChange={(e) => handleFilterChange('language_description_type', e.target.value as string[])}
                input={<OutlinedInput label="Language Description Type" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const choice = LANGUAGE_DESCRIPTION_TYPE_CHOICES.find(c => c.value === value);
                      return <Chip key={value} label={choice?.label || value} size="small" />;
                    })}
                  </Box>
                )}
                MenuProps={{
                  PaperProps: {
                    style: { maxHeight: 360 },
                  },
                }}
              >
                {LANGUAGE_DESCRIPTION_TYPE_CHOICES.map((choice) => (
                  <MenuItem key={choice.value} value={choice.value}>
                    <Checkbox checked={(filters.language_description_type ?? []).indexOf(choice.value) > -1} />
                    {choice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Collection (FK only — abbr or name partial match) */}
            <TextField
              {...formUtils.generateFieldProps('collection_contains', 'Collection')}
              label="Collection"
              value={filters.collection_contains}
              onChange={(e) => handleFilterChange('collection_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Original Format Medium - Multi-select */}
            <FormControl size="small" fullWidth>
              <InputLabel id="original-format-medium-label">Original Format Medium</InputLabel>
              <Select
                labelId="original-format-medium-label"
                multiple
                value={filters.original_format_medium ?? []}
                onChange={(e) => handleFilterChange('original_format_medium', e.target.value as string[])}
                input={<OutlinedInput label="Original Format Medium" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const choice = FORMAT_CHOICES.find(c => c.value === value);
                      return <Chip key={value} label={choice?.label || value} size="small" />;
                    })}
                  </Box>
                )}
                MenuProps={{
                  PaperProps: {
                    style: { maxHeight: 360 },
                  },
                }}
              >
                {FORMAT_CHOICES.map((choice) => (
                  <MenuItem key={choice.value} value={choice.value}>
                    <Checkbox checked={(filters.original_format_medium ?? []).indexOf(choice.value) > -1} />
                    {choice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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

            {/* Date filters */}
            {Object.entries({
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

          {/* Empty Field Filters */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" gutterBottom>
              Find Records With Empty Values:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
                variant={filters.genre_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.genre_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('genre_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Genre: Empty
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
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Results Count + column picker */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          gap: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {loading ? 'Loading...' : `${totalCount.toLocaleString()} item${totalCount !== 1 ? 's' : ''} found`}
        </Typography>
        {!isMobile && (
          <ColumnVisibilityMenu
            columns={columnMenuOptions}
            groupOrder={ITEM_LIST_COLUMN_GROUPS}
            visibleColumnIds={visibleColumnIds}
            onToggle={toggleColumn}
            onReset={handleResetColumnVisibility}
            onChange={handleColumnVisibilityChange}
          />
        )}
      </Box>

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
                {visibleColumns.map((column) => (
                  <TableCell key={column.id} {...tableUtils.generateHeaderProps(column.id)}>
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={tableColSpan} 
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
                    colSpan={tableColSpan} 
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

                    {visibleColumns.map((column) => column.renderCell(item, index))}
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