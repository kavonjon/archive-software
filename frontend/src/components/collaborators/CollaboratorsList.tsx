import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { debounce } from 'lodash';
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
  Link,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterListIcon,
  CheckBox as CheckBoxIcon,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { collaboratorsAPI, Collaborator, PaginatedResponse, APIError } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCollaboratorCache } from '../../contexts/CollaboratorCacheContext';
import { usePersistedListState } from '../../hooks/usePersistedListState';
import { hasEditAccess } from '../../utils/permissions';
import CollaboratorBatchEditButton, { BatchEditMode } from './CollaboratorBatchEditButton';
import CollaboratorExportButton, { ExportMode, ExportStatus } from './CollaboratorExportButton';
import CollaboratorBatchLoadingDialog, { LoadingDialogState } from './CollaboratorBatchLoadingDialog';

interface CollaboratorsListProps {
  showActions?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedCollaborators: Collaborator[]) => void;
}

interface FilterState {
  first_names_contains: string;
  last_names_contains: string;
  full_name_contains: string;
  collaborator_id_contains: string;
  tribal_affiliations_contains: string;
  native_languages_contains: string;
  other_languages_contains: string;
  anonymous: string;
  gender_contains: string;
  // Empty filters (isnull lookups)
  first_names_isnull?: boolean;
  nickname_isnull?: boolean;
  last_names_isnull?: boolean;
  name_suffix_isnull?: boolean;
  tribal_affiliations_isnull?: boolean;
  native_languages_isnull?: boolean;
  other_languages_isnull?: boolean;
  other_names_isnull?: boolean;
  gender_isnull?: boolean;
  birthdate_isnull?: boolean;
  deathdate_isnull?: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  first_names_contains: '',
  last_names_contains: '',
  full_name_contains: '',
  collaborator_id_contains: '',
  tribal_affiliations_contains: '',
  native_languages_contains: '',
  other_languages_contains: '',
  anonymous: '',
  gender_contains: '',
};

const CollaboratorsList: React.FC<CollaboratorsListProps> = ({
  showActions = true,
  selectable = false,
  onSelectionChange,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { state: authState } = useAuth();
  
  // Start cache loading on mount
  const { getCollaborators, cache, isLoading: cacheLoading, loadProgress } = useCollaboratorCache();
  
  useEffect(() => {
    // Trigger cache load in background when list page loads
    getCollaborators().catch(err => {
      console.error('[CollaboratorsList] Failed to pre-load cache:', err);
    });
  }, [getCollaborators]);
  
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
  } = usePersistedListState<FilterState, Collaborator>({
    storageKey: 'collaborator-list-state',
    defaultFilters: DEFAULT_FILTERS,
    defaultPagination: { page: 0, rowsPerPage: 25 },
  });
  
  // State management
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Batch edit state
  const [batchEditMode, setBatchEditMode] = useState<BatchEditMode>(() => {
    return (localStorage.getItem('collaborator-batch-edit-mode') as BatchEditMode) || 'filtered';
  });
  
  // Loading/warning dialog state for batch editor
  const [loadingDialogState, setLoadingDialogState] = useState<LoadingDialogState | null>(null);
  const [pendingBatchIds, setPendingBatchIds] = useState<number[] | null>(null);
  
  // Export state
  const [exportMode, setExportMode] = useState<ExportMode>(() => {
    return (localStorage.getItem('collaborator-export-mode') as ExportMode) || 'filtered';
  });
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');

  // Ref to track polling interval
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Active filters state - these are the filters actually applied to the API
  const [activeFilters, setActiveFilters] = useState<FilterState>(filters);

  // Load collaborators data
  const loadCollaborators = useCallback(async (resetPage = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const currentPage = resetPage ? 0 : page;
      
      // Build query parameters
      const params: Record<string, string | number | boolean> = {
        page: currentPage + 1, // API uses 1-based pagination
        page_size: rowsPerPage,
        // Ordering is handled by backend with locale-aware collation (Unicode sorting)
        // Do not override with explicit ordering parameter
      };
      
      // Add non-empty filters
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          // Add boolean filters (isnull lookups)
          params[key] = value;
        } else if (typeof value === 'string' && value.trim()) {
          // Add string filters (contains lookups)
          params[key] = value.trim();
        }
      });
      
      const response = await collaboratorsAPI.list(params);
      
      setCollaborators(response.results);
      setTotalCount(response.count);
      
      if (resetPage) {
        setPage(0);
      }
      
      setInitialLoadComplete(true);
      
    } catch (err) {
      const apiError = err as APIError;
      setError(apiError.message || 'Failed to load collaborators');
      console.error('Error loading collaborators:', err);
      setInitialLoadComplete(true);
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

  // Load data on component mount and when dependencies change
  useEffect(() => {
    loadCollaborators();
  }, [loadCollaborators]);

  // Handle page change
  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  // Handle filter changes with debounced API call
  const handleFilterChange = (field: keyof FilterState) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newFilters = {
      ...filters,
      [field]: event.target.value
    };
    setFilters(newFilters);
    
    // Debounced API call - waits 500ms after user stops typing
    debouncedApplyFilters(newFilters);
  };

  // Handle empty filter toggle (isnull lookups)
  const handleEmptyFilterToggle = (field: keyof FilterState) => {
    const currentValue = filters[field];
    const newValue = currentValue === true ? undefined : true;
    
    const newFilters = {
      ...filters,
      [field]: newValue
    };
    setFilters(newFilters);
    
    // Immediately apply (no need for debounce on button clicks)
    debouncedApplyFilters.cancel();
    setActiveFilters(newFilters);
    setPage(0);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    clearPersistedFilters();
    debouncedApplyFilters.cancel(); // Cancel any pending debounced calls
    setActiveFilters(DEFAULT_FILTERS); // Immediately apply cleared filters
    setPage(0);
  };

  // Handle collaborator selection
  const handleCollaboratorSelect = (collaborator: Collaborator, checked: boolean) => {
    toggleSelection(collaborator.id, checked);
    
    // If parent component needs full objects, convert IDs to objects
    if (onSelectionChange) {
      const selectedObjects = collaborators.filter(c => 
        checked ? (selectedIds.has(c.id) || c.id === collaborator.id) : (selectedIds.has(c.id) && c.id !== collaborator.id)
      );
      onSelectionChange(selectedObjects);
    }
  };

  // Handle "Deselect All" button
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    setAllSelections(collaborators, checked);
    
    // If parent component needs full objects
    if (onSelectionChange) {
      const selectedObjects = checked ? collaborators : [];
      onSelectionChange(selectedObjects);
    }
  };

  // Handle row click (navigate to detail)
  const handleRowClick = (collaborator: Collaborator) => {
    // Use collaborator_id for URL if available, otherwise fall back to database ID
    const identifier = collaborator.collaborator_id 
      ? `id-${collaborator.collaborator_id}` 
      : collaborator.id;
    navigate(`/collaborators/${identifier}`);
  };

  // Handle create new collaborator
  const handleCreateNew = () => {
    navigate('/collaborators/create');
  };
  
  // Handle batch edit mode execute
  const handleBatchEditExecute = useCallback(async (mode: BatchEditMode) => {
    console.log('[CollaboratorsList] Batch edit execute with mode:', mode);
    
    // Check cache status FIRST before doing anything else
    const cacheReady = cache && !cacheLoading && loadProgress >= 100;
    
    // Get IDs based on mode
    let ids: number[];
    
    if (mode === 'selected') {
      ids = Array.from(selectedIds);
    } else {
      // For 'filtered' mode, we need IDs from cache
      // If cache not ready, show dialog immediately and return
      if (!cacheReady) {
        console.log('[CollaboratorsList] Cache not ready, showing dialog');
        // We know the filtered count from the list view's API response
        const filteredRowCount = totalCount; // This is the filtered count from the current query
        
        // Check if any filters are active
        const hasActiveFilters = Object.entries(activeFilters).some(([key, value]) => {
          if (typeof value === 'boolean') return true; // Boolean filters (isnull) are active
          if (typeof value === 'string' && value.trim()) return true; // String filters are active
          return false;
        });
        
        // Only show warning if no filters are active (user is editing ALL rows)
        const shouldShowWarning = !hasActiveFilters;
        
        setLoadingDialogState({
          cacheLoading: true,
          cacheProgress: loadProgress,
          totalCount: cache?.count || 0,
          showLargeDatasetWarning: shouldShowWarning,
          rowCount: filteredRowCount,
          mode: mode,
        });
        // Store empty pending state - will be filled when cache loads
        setPendingBatchIds([]);
        return;
      }
      
      // Cache is ready, get filtered IDs
      try {
        const allCollaborators = await getCollaborators(); // Should return immediately from cache
        
        // Apply current filters to cache data (client-side filtering)
        const filteredCollaborators = allCollaborators.filter(c => {
          // Apply active filters
          if (activeFilters.first_names_contains && !c.first_names.toLowerCase().includes(activeFilters.first_names_contains.toLowerCase())) return false;
          if (activeFilters.last_names_contains && !c.last_names.toLowerCase().includes(activeFilters.last_names_contains.toLowerCase())) return false;
          if (activeFilters.full_name_contains && !c.full_name.toLowerCase().includes(activeFilters.full_name_contains.toLowerCase())) return false;
          if (activeFilters.collaborator_id_contains && !String(c.collaborator_id).includes(activeFilters.collaborator_id_contains)) return false;
          if (activeFilters.tribal_affiliations_contains && !c.tribal_affiliations.toLowerCase().includes(activeFilters.tribal_affiliations_contains.toLowerCase())) return false;
          if (activeFilters.gender_contains && !c.gender.toLowerCase().includes(activeFilters.gender_contains.toLowerCase())) return false;
          if (activeFilters.anonymous !== undefined && activeFilters.anonymous !== '' && c.anonymous !== (activeFilters.anonymous === 'yes')) return false;
          // TODO: Add other filter logic if needed
          return true;
        });
        
        ids = filteredCollaborators.map(c => c.id);
        console.log('[CollaboratorsList] Filtered cache to', ids.length, 'IDs');
      } catch (error) {
        console.error('[CollaboratorsList] Error filtering cache:', error);
        // Fallback to current page IDs
        ids = collaborators.map(c => c.id);
      }
    }
    
    console.log('[CollaboratorsList] Batch edit IDs:', ids.length, 'collaborators');
    
    // Check if any filters are active
    const hasActiveFilters = Object.entries(activeFilters).some(([key, value]) => {
      if (typeof value === 'boolean') return true; // Boolean filters (isnull) are active
      if (typeof value === 'string' && value.trim()) return true; // String filters are active
      return false;
    });
    
    console.log('[CollaboratorsList] Has active filters:', hasActiveFilters);
    
    // Only warn if no filters are applied (i.e., user is editing ALL rows)
    const largeDataset = !hasActiveFilters;
    
    console.log('[CollaboratorsList] Cache ready:', cacheReady, 'Large dataset warning:', largeDataset);
    
    // Show dialog if large dataset (cache is already ready at this point)
    if (largeDataset) {
      setLoadingDialogState({
        cacheLoading: false,
        cacheProgress: loadProgress,
        totalCount: cache?.count || 0,
        showLargeDatasetWarning: largeDataset,
        rowCount: ids.length,
        mode: mode,
      });
      setPendingBatchIds(ids);
      return; // Wait for user to confirm in dialog
    }
    
    // No dialog needed, proceed directly
    sessionStorage.setItem('batch_edit_ids', JSON.stringify(ids));
    console.log('[CollaboratorsList] Navigating to /collaborators/batch');
    navigate('/collaborators/batch');
  }, [selectedIds, collaborators, activeFilters, navigate, cache, cacheLoading, loadProgress, getCollaborators]);
  
  // Handle dialog continue (user confirmed)
  const handleDialogContinue = useCallback(async (suppressFuture: boolean) => {
    // TODO: Handle suppressFuture with localStorage if needed
    
    if (!pendingBatchIds) return;
    
    // If cache not ready, wait for it
    if (loadingDialogState && loadingDialogState.cacheLoading) {
      await getCollaborators();
    }
    
    // Close dialog
    setLoadingDialogState(null);
    
    // Store IDs and navigate
    sessionStorage.setItem('batch_edit_ids', JSON.stringify(pendingBatchIds));
    setPendingBatchIds(null);
    navigate('/collaborators/batch');
  }, [pendingBatchIds, loadingDialogState, getCollaborators, navigate]);
  
  // Handle dialog cancel
  const handleDialogCancel = useCallback(() => {
    setLoadingDialogState(null);
    setPendingBatchIds(null);
  }, []);
  
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
      console.log('[CollaboratorsList] Cache loading complete');
      
      // Now we can get the filtered IDs since cache is ready
      const getFilteredIds = async () => {
        try {
          const allCollaborators = await getCollaborators();
          
          // Apply current filters
          const filteredCollaborators = allCollaborators.filter(c => {
            if (activeFilters.first_names_contains && !c.first_names.toLowerCase().includes(activeFilters.first_names_contains.toLowerCase())) return false;
            if (activeFilters.last_names_contains && !c.last_names.toLowerCase().includes(activeFilters.last_names_contains.toLowerCase())) return false;
            if (activeFilters.full_name_contains && !c.full_name.toLowerCase().includes(activeFilters.full_name_contains.toLowerCase())) return false;
            if (activeFilters.collaborator_id_contains && !String(c.collaborator_id).includes(activeFilters.collaborator_id_contains)) return false;
            if (activeFilters.tribal_affiliations_contains && !c.tribal_affiliations.toLowerCase().includes(activeFilters.tribal_affiliations_contains.toLowerCase())) return false;
            if (activeFilters.gender_contains && !c.gender.toLowerCase().includes(activeFilters.gender_contains.toLowerCase())) return false;
            if (activeFilters.anonymous !== undefined && activeFilters.anonymous !== '' && c.anonymous !== (activeFilters.anonymous === 'yes')) return false;
            return true;
          });
          
          const ids = filteredCollaborators.map(c => c.id);
          
          // Check if large dataset (no filters = editing all rows)
          const hasActiveFilters = Object.entries(activeFilters).some(([key, value]) => {
            if (typeof value === 'boolean') return true;
            if (typeof value === 'string' && value.trim()) return true;
            return false;
          });
          const largeDataset = !hasActiveFilters;
          
          if (largeDataset) {
            // Update dialog to show warning instead of loading
            console.log('[CollaboratorsList] Large dataset detected, showing warning');
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
            console.log('[CollaboratorsList] Auto-proceeding to batch editor');
            setLoadingDialogState(null);
            sessionStorage.setItem('batch_edit_ids', JSON.stringify(ids));
            setPendingBatchIds(null);
            navigate('/collaborators/batch');
          }
        } catch (error) {
          console.error('[CollaboratorsList] Error getting filtered IDs:', error);
          setLoadingDialogState(null);
          setPendingBatchIds(null);
        }
      };
      
      getFilteredIds();
    }
  }, [loadingDialogState, cache, cacheLoading, loadProgress, getCollaborators, activeFilters, navigate]);
  
  // Handle export mode execute
  const handleExportExecute = useCallback(async (mode: ExportMode) => {
    console.log('[CollaboratorsList] Export execute with mode:', mode);
    
    // Get IDs based on mode
    let ids: number[];
    
    if (mode === 'selected') {
      ids = Array.from(selectedIds);
    } else {
      // For 'filtered' mode, use cache to get ALL filtered IDs (not just current page)
      try {
        const allCollaborators = await getCollaborators();
        
        // Apply current filters to cache data (client-side filtering)
        const filteredCollaborators = allCollaborators.filter(c => {
          // Apply active filters
          if (activeFilters.first_names_contains && !c.first_names.toLowerCase().includes(activeFilters.first_names_contains.toLowerCase())) return false;
          if (activeFilters.last_names_contains && !c.last_names.toLowerCase().includes(activeFilters.last_names_contains.toLowerCase())) return false;
          if (activeFilters.full_name_contains && !c.full_name.toLowerCase().includes(activeFilters.full_name_contains.toLowerCase())) return false;
          if (activeFilters.collaborator_id_contains && !String(c.collaborator_id).includes(activeFilters.collaborator_id_contains)) return false;
          if (activeFilters.tribal_affiliations_contains && !c.tribal_affiliations.toLowerCase().includes(activeFilters.tribal_affiliations_contains.toLowerCase())) return false;
          if (activeFilters.gender_contains && !c.gender.toLowerCase().includes(activeFilters.gender_contains.toLowerCase())) return false;
          if (activeFilters.anonymous !== undefined && activeFilters.anonymous !== '' && c.anonymous !== (activeFilters.anonymous === 'yes')) return false;
          // TODO: Add other filter logic if needed
          return true;
        });
        
        ids = filteredCollaborators.map(c => c.id);
        console.log('[CollaboratorsList] Filtered cache to', ids.length, 'IDs for export');
      } catch (error) {
        console.error('[CollaboratorsList] Error filtering cache for export:', error);
        // Fallback to current page IDs
        ids = collaborators.map(c => c.id);
      }
    }
    
    console.log('[CollaboratorsList] Export IDs count:', ids.length);
    
    try {
      setExportStatus('preparing');
      
      const result = await collaboratorsAPI.export(mode, ids);
      
      // Check if async or sync export
      if (typeof result === 'object' && 'async' in result) {
        // Async export - start polling
        const exportId = result.export_id;
        console.log('[CollaboratorsList] Async export started:', exportId);
        
        // Clear any existing polling interval
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
      }
        
        // Start polling with setInterval (ONE timer, not recursive)
        pollIntervalRef.current = setInterval(async () => {
      try {
        const statusResult = await collaboratorsAPI.exportStatus(exportId);
            console.log('[CollaboratorsList] Export status:', statusResult.status);
        
        if (statusResult.status === 'completed') {
              // Stop polling
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              
          // Download the file
          setExportStatus('ready');
          const blob = await collaboratorsAPI.exportDownload(exportId);
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = statusResult.filename || `collaborators_export_${exportId}.xlsx`;
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
            console.error('[CollaboratorsList] Export polling error:', pollErr);
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
            setError('Export timeout - The background task may not be running. Please check that Celery workers are active or try a smaller dataset.');
            setExportStatus('idle');
          }
        }, 120000); // 2 minutes
        } else {
        // Sync export - trigger download
        console.log('[CollaboratorsList] Sync export - triggering download');
        const blob = result as Blob;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `collaborators_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
          setExportStatus('idle');
        }
      } catch (err) {
      console.error('[CollaboratorsList] Export error:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
        setExportStatus('idle');
      }
  }, [selectedIds, collaborators, activeFilters, getCollaborators]);

  // Check if any filters are active
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (typeof value === 'boolean') return value === true;
    if (typeof value === 'string') return value.trim() !== '';
    return false;
  });

  // Count active filters for display
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (typeof value === 'boolean') return value === true;
    if (typeof value === 'string') return value.trim() !== '';
    return false;
  }).length;

  // Selection state
  const selectedCount = collaborators.filter(c => selectedIds.has(c.id)).length;
  const isAllSelected = collaborators.length > 0 && selectedCount === collaborators.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < collaborators.length;

  // Show full-page loading only on initial load, not on subsequent filter/pagination changes
  if (!initialLoadComplete) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading collaborators...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1">
            Collaborators
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
        {showActions && hasEditAccess(authState.user) && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <CollaboratorExportButton
              mode={exportMode}
              exportStatus={exportStatus}
              onModeChange={setExportMode}
              onExecute={handleExportExecute}
              selectedCount={selectedIds.size}
              filteredCount={totalCount}
            />
            <CollaboratorBatchEditButton
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
            onClick={handleCreateNew}
            sx={{ minWidth: 'auto' }}
          >
            {isMobile ? 'Add' : 'Add Collaborator'}
          </Button>
          </Box>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search and Filter Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowFilters(!showFilters)}
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
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Searching...
              </Typography>
            </Box>
          )}
        </Box>

        {/* Filter Fields */}
        <Collapse in={showFilters}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
            Filters apply automatically as you type
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            <TextField
              label="First Name Contains"
              value={filters.first_names_contains}
              onChange={handleFilterChange('first_names_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Last Name Contains"
              value={filters.last_names_contains}
              onChange={handleFilterChange('last_names_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Full Name Contains"
              value={filters.full_name_contains}
              onChange={handleFilterChange('full_name_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Collaborator ID"
              value={filters.collaborator_id_contains}
              onChange={handleFilterChange('collaborator_id_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Tribal Affiliations"
              value={filters.tribal_affiliations_contains}
              onChange={handleFilterChange('tribal_affiliations_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Native Languages"
              value={filters.native_languages_contains}
              onChange={handleFilterChange('native_languages_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Other Languages"
              value={filters.other_languages_contains}
              onChange={handleFilterChange('other_languages_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Gender"
              value={filters.gender_contains}
              onChange={handleFilterChange('gender_contains')}
              size="small"
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel id="anonymous-filter-label">Anonymous Status</InputLabel>
              <Select
                labelId="anonymous-filter-label"
                id="anonymous-filter"
                value={filters.anonymous}
                label="Anonymous Status"
                onChange={(e) => {
                  const newFilters = {
                    ...filters,
                    anonymous: e.target.value
                  };
                  setFilters(newFilters);
                  debouncedApplyFilters(newFilters);
                }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Anonymous Only</MenuItem>
                <MenuItem value="false">Non-Anonymous Only</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Empty Value Filters */}
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5 }}>
              Find Records With Empty Values:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant={filters.first_names_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.first_names_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('first_names_isnull')}
              >
                First Name(s): Empty
              </Button>
              <Button
                variant={filters.nickname_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.nickname_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('nickname_isnull')}
              >
                Nickname: Empty
              </Button>
              <Button
                variant={filters.last_names_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.last_names_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('last_names_isnull')}
              >
                Last Name(s): Empty
              </Button>
              <Button
                variant={filters.name_suffix_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.name_suffix_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('name_suffix_isnull')}
              >
                Suffix: Empty
              </Button>
              <Button
                variant={filters.other_names_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.other_names_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('other_names_isnull')}
              >
                Other Names: Empty
              </Button>
              <Button
                variant={filters.tribal_affiliations_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.tribal_affiliations_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('tribal_affiliations_isnull')}
              >
                Tribal Affiliations: Empty
              </Button>
              <Button
                variant={filters.native_languages_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.native_languages_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('native_languages_isnull')}
              >
                Native Languages: Empty
              </Button>
              <Button
                variant={filters.other_languages_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.other_languages_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('other_languages_isnull')}
              >
                Other Languages: Empty
              </Button>
              <Button
                variant={filters.gender_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.gender_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('gender_isnull')}
              >
                Gender: Empty
              </Button>
              <Button
                variant={filters.birthdate_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.birthdate_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('birthdate_isnull')}
              >
                Birth Date: Empty
              </Button>
              <Button
                variant={filters.deathdate_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.deathdate_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('deathdate_isnull')}
              >
                Death Date: Empty
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Results Count */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {loading ? 'Loading...' : `${totalCount} collaborator${totalCount !== 1 ? 's' : ''} found`}
      </Typography>

      {/* Mobile Card View */}
      {isMobile ? (
        <Stack spacing={2}>
          {collaborators.map((collaborator) => (
            <Card 
              key={collaborator.id} 
              sx={{ 
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
              onClick={() => handleRowClick(collaborator)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: 1 }}>
                    <Link
                      component={RouterLink}
                      to={`/collaborators/${collaborator.collaborator_id ? `id-${collaborator.collaborator_id}` : collaborator.id}`}
                      onClick={(e) => e.stopPropagation()}
                      variant="h6"
                      sx={{ 
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      {collaborator.display_name}
                    </Link>
                    <Typography variant="body2" color="text.secondary">
                      ID: {collaborator.collaborator_id}
                    </Typography>
                    {collaborator.tribal_affiliations && (
                      <Typography variant="body2" color="text.secondary">
                        Tribal Affiliations: {collaborator.tribal_affiliations}
                      </Typography>
                    )}
                    {collaborator.native_language_names.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Native Languages:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {collaborator.native_language_names.map((lang, index) => (
                            <Chip key={index} label={lang} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                  {selectable && (
                    <Box>
                      <Checkbox
                        checked={selectedIds.has(collaborator.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCollaboratorSelect(collaborator, !selectedIds.has(collaborator.id));
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        /* Desktop Table View */
        <TableContainer component={Paper}>
          <Table ref={tableRef} tabIndex={-1}>
            <TableHead>
              <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={isIndeterminate}
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableCell>
                <TableCell>Name</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Tribal Affiliations</TableCell>
                <TableCell>Native Languages</TableCell>
                <TableCell>Other Languages</TableCell>
                <TableCell>Items</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {collaborators.map((collaborator) => (
                <TableRow
                  key={collaborator.id}
                  hover
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' }
                  }}
                  onClick={() => handleRowClick(collaborator)}
                >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.has(collaborator.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCollaboratorSelect(collaborator, !selectedIds.has(collaborator.id));
                        }}
                      />
                    </TableCell>
                  <TableCell>
                    <Link
                      component={RouterLink}
                      to={`/collaborators/${collaborator.collaborator_id ? `id-${collaborator.collaborator_id}` : collaborator.id}`}
                      onClick={(e) => e.stopPropagation()}
                      variant="body2"
                      sx={{ 
                        fontWeight: 'medium',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      {collaborator.display_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {collaborator.collaborator_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {collaborator.tribal_affiliations || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {collaborator.native_language_names.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {collaborator.native_language_names.slice(0, 3).map((lang, index) => (
                          <Chip key={index} label={lang} size="small" variant="outlined" />
                        ))}
                        {collaborator.native_language_names.length > 3 && (
                          <Chip 
                            label={`+${collaborator.native_language_names.length - 3} more`} 
                            size="small" 
                            variant="outlined" 
                            color="secondary"
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {collaborator.other_language_names.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {collaborator.other_language_names.slice(0, 2).map((lang, index) => (
                          <Chip key={index} label={lang} size="small" variant="outlined" />
                        ))}
                        {collaborator.other_language_names.length > 2 && (
                          <Chip 
                            label={`+${collaborator.other_language_names.length - 2} more`} 
                            size="small" 
                            variant="outlined" 
                            color="secondary"
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {collaborator.associated_items.length}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={handlePageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        rowsPerPageOptions={[10, 25, 50, 100]}
        showFirstButton
        showLastButton
      />
      
      {/* Batch Edit Loading/Warning Dialog */}
      <CollaboratorBatchLoadingDialog
        open={!!loadingDialogState}
        state={loadingDialogState}
        onCancel={handleDialogCancel}
        onContinue={handleDialogContinue}
      />
    </Box>
  );
};

export default CollaboratorsList;
