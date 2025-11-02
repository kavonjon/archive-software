import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ButtonGroup,
  Container,
  useTheme,
  useMediaQuery,
  Pagination,
  Tooltip,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  IndeterminateCheckBox as IndeterminateCheckBoxIcon,
} from '@mui/icons-material';
import { languoidsAPI, type Languoid, LANGUOID_LEVEL_CHOICES } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguoidCache } from '../../contexts/LanguoidCacheContext';
import { hasEditAccess } from '../../utils/permissions';
import BatchEditButton, { type BatchEditMode } from './BatchEditButton';
import BatchEditWarningDialog, { type WarningConfig } from './BatchEditWarningDialog';
import ExportButton, { type ExportMode } from './ExportButton';

// Level filter presets
const LEVEL_FILTER_PRESETS = [
  { key: 'all', label: 'All Languoids', levels: [], useGlottolog: false },
  { key: 'languages', label: 'Languages Only', levels: ['language'], useGlottolog: false },
  { key: 'dialects', label: 'Dialects Only', levels: ['dialect'], useGlottolog: false },
  { key: 'languages_dialects', label: 'Languages & Dialects', levels: ['language', 'dialect'], useGlottolog: false },
  { key: 'families', label: 'Families Only', levels: ['family'], useGlottolog: true }, // Use level_glottolog
];

// Level badge colors
const LEVEL_COLORS = {
  family: 'primary',
  language: 'success', 
  dialect: 'warning'
} as const;

interface HierarchicalLanguoid extends Languoid {
  indentLevel: number;
}

const LanguoidsList: React.FC = () => {
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const { getLanguoids, refreshCache, isLoading: cacheLoading, error: cacheError } = useLanguoidCache();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Ref for scrolling to top of list
  const listTopRef = useRef<HTMLDivElement>(null);

  // Data state
  const [allLanguoids, setAllLanguoids] = useState<Languoid[]>([]); // Store ALL languoids (unfiltered)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  // Display pagination state (frontend only)
  const [displayPage, setDisplayPage] = useState(1);
  const minPageSize = 50; // Minimum items per page

  // Selection state (persists during session, cleared on tab close)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
    const saved = sessionStorage.getItem('languoid-selected-ids');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Persist selections to sessionStorage on every change
  useEffect(() => {
    sessionStorage.setItem('languoid-selected-ids', JSON.stringify(Array.from(selectedIds)));
  }, [selectedIds]);

  // Batch edit mode state (persists across sessions in localStorage)
  const [batchEditMode, setBatchEditMode] = useState<BatchEditMode>(() => {
    return (localStorage.getItem('languoid-batch-edit-mode') as BatchEditMode) || 'filtered';
  });

  // Warning dialog state
  const [showWarning, setShowWarning] = useState(false);
  const [warningConfig, setWarningConfig] = useState<WarningConfig | null>(null);
  const [pendingBatchConfig, setPendingBatchConfig] = useState<{ mode: BatchEditMode; ids: number[] } | null>(null);

  // Warning suppression (persists across sessions in localStorage)
  const [suppressWarning, setSuppressWarning] = useState<boolean>(() => {
    return localStorage.getItem('languoid-batch-suppress-warning') === 'true';
  });

  // Export state
  const [exportMode, setExportMode] = useState<ExportMode>(() => {
    return (localStorage.getItem('languoid-export-mode') as ExportMode) || 'filtered';
  });
  
  // Export status: 'idle' | 'preparing' | 'ready'
  const [exportStatus, setExportStatus] = useState<'idle' | 'preparing' | 'ready'>(() => {
    return (sessionStorage.getItem('languoid-export-status') as 'idle' | 'preparing' | 'ready') || 'idle';
  });
  
  // Store export ID and filename for async exports
  const [exportId, setExportId] = useState<string | null>(() => {
    return sessionStorage.getItem('languoid-export-id');
  });
  const [exportFilename, setExportFilename] = useState<string | null>(() => {
    return sessionStorage.getItem('languoid-export-filename');
  });
  
  // Poll interval ref for cleanup
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track if we've already started polling restoration (to avoid duplicate intervals)
  const hasStartedPollingRef = useRef<boolean>(false);

  // Load ALL languoids using cache
  const loadLanguoids = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use cache context to get languoids (will check validity automatically)
      const languoids = await getLanguoids();
      setAllLanguoids(languoids);
    } catch (err) {
      console.error('Error loading languoids:', err);
      setError(cacheError || 'Failed to load languoids. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getLanguoids, cacheError]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const languoids = await refreshCache();
      setAllLanguoids(languoids);
    } catch (err) {
      console.error('Error refreshing languoids:', err);
      setError('Failed to refresh languoids. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache]);

  // Apply filters on frontend (instant, no API call)
  const filteredLanguoids = useMemo(() => {
    // Safety check: ensure allLanguoids is defined
    if (!allLanguoids) {
      return [];
    }

    let filtered = allLanguoids;

    // Apply level preset filter
    const preset = LEVEL_FILTER_PRESETS.find(p => p.key === selectedLevelFilter);
    if (preset && preset.levels.length > 0) {
      // Use level_glottolog or level_nal based on preset configuration
      if (preset.useGlottolog) {
        filtered = filtered.filter(languoid => preset.levels.includes(languoid.level_glottolog));
      } else {
        filtered = filtered.filter(languoid => preset.levels.includes(languoid.level_nal));
      }
    }

    // Apply advanced level filter (if set)
    if (levelFilter) {
      filtered = filtered.filter(languoid => languoid.level_nal === levelFilter);
    }

    // Apply search term (searches name, ISO, glottocode, region, tribes)
    if (searchTerm.trim()) {
      const search = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(languoid => 
        languoid.name.toLowerCase().includes(search) ||
        (languoid.iso && languoid.iso.toLowerCase().includes(search)) ||
        (languoid.glottocode && languoid.glottocode.toLowerCase().includes(search)) ||
        (languoid.region && languoid.region.toLowerCase().includes(search)) ||
        (languoid.tribes && languoid.tribes.toLowerCase().includes(search))
      );
    }

    // Apply family filter
    if (familyFilter.trim()) {
      const familySearch = familyFilter.trim().toLowerCase();
      filtered = filtered.filter(languoid => 
        languoid.family_name && languoid.family_name.toLowerCase().includes(familySearch)
      );
    }

    // Apply region filter
    if (regionFilter.trim()) {
      const regionSearch = regionFilter.trim().toLowerCase();
      filtered = filtered.filter(languoid => 
        languoid.region && languoid.region.toLowerCase().includes(regionSearch)
      );
    }

    return filtered;
  }, [allLanguoids, selectedLevelFilter, levelFilter, searchTerm, familyFilter, regionFilter]);

  // Build hierarchical display with indentation
  const hierarchicalLanguoids = useMemo((): HierarchicalLanguoid[] => {
    // Safety check: ensure filteredLanguoids is defined
    if (!filteredLanguoids) {
      return [];
    }

    const result: HierarchicalLanguoid[] = [];
    const processed = new Set<number>();

    // Helper function to add languoid and its children recursively
    const addLanguoidWithChildren = (languoid: Languoid, indentLevel: number = 0) => {
      if (processed.has(languoid.id)) return;
      
      processed.add(languoid.id);
      result.push({ ...languoid, indentLevel });

      // Find and add direct children only (using parent_languoid relationship)
      // This ensures correct hierarchical sorting: parent → children → grandchildren
      const children = filteredLanguoids.filter(l => 
        !processed.has(l.id) && l.parent_languoid === languoid.id
      ).sort((a, b) => a.name.localeCompare(b.name));

      children.forEach(child => {
        addLanguoidWithChildren(child, indentLevel + 1);
      });
    };

    // Check if we're in "Languages & Dialects" mode
    const preset = LEVEL_FILTER_PRESETS.find(p => p.key === selectedLevelFilter);
    const isLanguagesAndDialects = preset?.key === 'languages_dialects';

    if (isLanguagesAndDialects) {
      // Special handling: Show languages as root nodes with their dialects nested
      const languages = filteredLanguoids.filter(l => l.level_nal === 'language').sort((a, b) => a.name.localeCompare(b.name));
      languages.forEach(language => addLanguoidWithChildren(language, 0));

      // Add any orphaned dialects (dialects without a language parent in the filtered set)
      const orphanDialects = filteredLanguoids.filter(l => 
        !processed.has(l.id) && l.level_nal === 'dialect'
      ).sort((a, b) => a.name.localeCompare(b.name));
      orphanDialects.forEach(dialect => addLanguoidWithChildren(dialect, 0));
    } else {
      // Normal hierarchical display: start with top-level items
      const topLevel = filteredLanguoids.filter(l => l.level_nal === 'family').sort((a, b) => a.name.localeCompare(b.name));
      topLevel.forEach(item => addLanguoidWithChildren(item, 0));

      // Add any orphaned languoids (those without proper parent relationships)
      const orphans = filteredLanguoids.filter(l => !processed.has(l.id)).sort((a, b) => a.name.localeCompare(b.name));
      orphans.forEach(orphan => addLanguoidWithChildren(orphan, 0));
    }

    return result;
  }, [filteredLanguoids, selectedLevelFilter]);

  // Helper: Get all descendant IDs for hierarchical selection
  const getDescendantIds = useCallback((languoidId: number, allLanguoidsArray: Languoid[]): number[] => {
    const children = allLanguoidsArray.filter(l => l.parent_languoid === languoidId);
    const descendantIds = children.map(c => c.id);
    
    children.forEach(child => {
      descendantIds.push(...getDescendantIds(child.id, allLanguoidsArray));
    });
    
    return descendantIds;
  }, []);

  // Handle checkbox click for individual languoid (with hierarchical auto-select)
  const handleCheckboxClick = useCallback((event: React.MouseEvent, languoid: HierarchicalLanguoid) => {
    event.stopPropagation(); // Prevent row click
    
    const isCurrentlySelected = selectedIds.has(languoid.id);
    const descendantIds = getDescendantIds(languoid.id, allLanguoids);
    const idsToToggle = [languoid.id, ...descendantIds];
    
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (isCurrentlySelected) {
        // Deselect this languoid and all its descendants
        idsToToggle.forEach(id => newSet.delete(id));
      } else {
        // Select this languoid and all its descendants
        idsToToggle.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  }, [selectedIds, allLanguoids, getDescendantIds]);

  // Handle "Select All Filtered" checkbox
  const handleSelectAllFiltered = useCallback(() => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      hierarchicalLanguoids.forEach(languoid => {
        newSet.add(languoid.id);
      });
      return newSet;
    });
  }, [hierarchicalLanguoids]);

  // Handle "Deselect All" button
  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
    sessionStorage.removeItem('languoid-selected-ids');
  }, []);

  // Calculate select-all checkbox state (checked, indeterminate, or unchecked)
  const selectAllCheckboxState = useMemo(() => {
    if (hierarchicalLanguoids.length === 0) return 'unchecked';
    
    const filteredIds = hierarchicalLanguoids.map(l => l.id);
    const selectedFilteredIds = filteredIds.filter(id => selectedIds.has(id));
    
    if (selectedFilteredIds.length === 0) return 'unchecked';
    if (selectedFilteredIds.length === filteredIds.length) return 'checked';
    return 'indeterminate';
  }, [hierarchicalLanguoids, selectedIds]);

  // Helper: Determine if advanced filters are applied (beyond just preset)
  const hasAdvancedFilters = useMemo(() => {
    return !!(searchTerm || levelFilter || familyFilter || regionFilter);
  }, [searchTerm, levelFilter, familyFilter, regionFilter]);

  // Helper: Get warning configuration if needed
  const getWarningConfig = useCallback((
    mode: BatchEditMode,
    count: number,
  ): WarningConfig | null => {
    // No warning for empty mode
    if (mode === 'empty') return null;
    
    // No warning for <= 100 items
    if (count <= 100) return null;
    
    // Large dataset warnings (>100) with advanced filters
    if (count > 100 && hasAdvancedFilters) {
      return { 
        type: mode === 'filtered' ? 'large-filtered' : 'large-selected', 
        count, 
        mode 
      };
    }
    
    // Preset-only warning (no advanced filters, >100 items)
    if (mode === 'filtered' && !hasAdvancedFilters && count > 100) {
      // Map preset key to warning preset type
      const presetMap: Record<string, 'all' | 'languages' | 'dialects' | 'languages_dialects' | 'families'> = {
        'all': 'all',
        'languages': 'languages',
        'dialects': 'dialects',
        'languages_dialects': 'languages_dialects',
        'families': 'families',
      };
      
      return { 
        type: 'all-preset', 
        count, 
        preset: presetMap[selectedLevelFilter] || 'all',
        mode 
      };
    }
    
    // Also show preset warning for large-selected if no advanced filters
    if (mode === 'selected' && !hasAdvancedFilters && count > 100) {
      return {
        type: 'large-selected',
        count,
        mode
      };
    }
    
    return null;
  }, [hasAdvancedFilters, selectedLevelFilter]);

  // Execute batch edit navigation
  const executeBatchEdit = useCallback((mode: BatchEditMode, ids: number[]) => {
    // Save batch configuration to sessionStorage
    const batchConfig = {
      mode,
      ids,
      timestamp: Date.now(),
    };
    
    console.log('[LanguoidsList] executeBatchEdit called with:', { mode, idsCount: ids.length });
    console.log('[LanguoidsList] Saving to sessionStorage:', batchConfig);
    
    sessionStorage.setItem('languoid-batch-config', JSON.stringify(batchConfig));
    
    // Verify it was saved
    const savedConfig = sessionStorage.getItem('languoid-batch-config');
    console.log('[LanguoidsList] Verified saved config:', savedConfig);
    
    // Save current list state for back button restoration
    sessionStorage.setItem('languoid-list-scroll', window.scrollY.toString());
    sessionStorage.setItem('languoid-list-filters', JSON.stringify({
      selectedLevelFilter,
      searchTerm,
      levelFilter,
      familyFilter,
      regionFilter,
      displayPage,
    }));
    
    console.log('[LanguoidsList] Navigating to /languoids/batch');
    // Navigate to batch editor
    navigate('/languoids/batch');
  }, [navigate, selectedLevelFilter, searchTerm, levelFilter, familyFilter, regionFilter, displayPage]);

  // Handle batch edit button execution
  const handleBatchEdit = useCallback((mode: BatchEditMode) => {
    // Determine count and IDs to load
    let count = 0;
    let idsToLoad: number[] = [];
    
    if (mode === 'filtered') {
      count = hierarchicalLanguoids.length;
      idsToLoad = hierarchicalLanguoids.map(l => l.id);
    } else if (mode === 'selected') {
      count = selectedIds.size;
      idsToLoad = Array.from(selectedIds);
    }
    
    // Check if we need to show warning
    const warningConfigToShow = getWarningConfig(mode, count);
    
    if (warningConfigToShow && !suppressWarning) {
      // Show warning dialog
      setWarningConfig(warningConfigToShow);
      setPendingBatchConfig({ mode, ids: idsToLoad });
      setShowWarning(true);
      return;
    }
    
    // No warning needed, proceed directly
    executeBatchEdit(mode, idsToLoad);
  }, [hierarchicalLanguoids, selectedIds, getWarningConfig, suppressWarning, executeBatchEdit]);

  // Handle warning dialog continue
  const handleWarningContinue = useCallback((suppressFuture: boolean) => {
    if (suppressFuture) {
      localStorage.setItem('languoid-batch-suppress-warning', 'true');
      setSuppressWarning(true);
    }
    
    setShowWarning(false);
    
    // Execute the pending batch edit
    if (pendingBatchConfig) {
      executeBatchEdit(pendingBatchConfig.mode, pendingBatchConfig.ids);
      setPendingBatchConfig(null);
    }
  }, [pendingBatchConfig, executeBatchEdit]);

  // Handle warning dialog cancel
  const handleWarningCancel = useCallback(() => {
    setShowWarning(false);
    setPendingBatchConfig(null);
  }, []);

  // Persist export mode to localStorage
  useEffect(() => {
    localStorage.setItem('languoid-export-mode', exportMode);
  }, [exportMode]);
  
  // Persist export status and ID to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('languoid-export-status', exportStatus);
    if (exportId) {
      sessionStorage.setItem('languoid-export-id', exportId);
    } else {
      sessionStorage.removeItem('languoid-export-id');
    }
    if (exportFilename) {
      sessionStorage.setItem('languoid-export-filename', exportFilename);
    } else {
      sessionStorage.removeItem('languoid-export-filename');
    }
  }, [exportStatus, exportId, exportFilename]);
  
  // Cleanup poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      // Reset the polling restoration flag on unmount
      hasStartedPollingRef.current = false;
    };
  }, []);
  
  // Restore polling on mount if export is in progress
  useEffect(() => {
    console.log('[EXPORT DEBUG] Restoration effect running', {
      hasStartedPolling: hasStartedPollingRef.current,
      exportStatus,
      exportId,
      hasInterval: !!pollIntervalRef.current
    });
    
    // Only run restoration logic once when component mounts
    if (hasStartedPollingRef.current) {
      console.log('[EXPORT DEBUG] Already started polling, skipping');
      return;
    }
    
    if (exportStatus === 'preparing' && exportId && !pollIntervalRef.current) {
      console.log('[EXPORT DEBUG] Starting polling restoration for export:', exportId);
      hasStartedPollingRef.current = true;
      
      // IMMEDIATELY check status first (in case export finished while we were away)
      const checkStatusImmediately = async () => {
        try {
          console.log('[EXPORT DEBUG] Checking status immediately on mount');
          const status = await languoidsAPI.exportStatus(exportId);
          console.log('[EXPORT DEBUG] Immediate status check result:', status);
          
          if (status.status === 'completed') {
            console.log('[EXPORT DEBUG] Export already completed! Updating to ready state');
            setExportStatus('ready');
            setExportFilename(status.filename || `languoids_export_${exportId}.xlsx`);
            return true; // Signal that export is complete
          }
          return false; // Export still in progress
        } catch (err) {
          console.error('[EXPORT DEBUG] Error checking status immediately:', err);
          return false;
        }
      };
      
      // Check immediately, then start polling if needed
      checkStatusImmediately().then((isComplete) => {
        if (isComplete) {
          console.log('[EXPORT DEBUG] Export complete, not starting polling');
          return; // Don't start polling if already complete
        }
        
        console.log('[EXPORT DEBUG] Export still in progress, starting polling interval');
        // Start polling interval for ongoing export
        pollIntervalRef.current = setInterval(async () => {
          console.log('[EXPORT DEBUG] Polling export status for:', exportId);
          try {
            const status = await languoidsAPI.exportStatus(exportId);
            console.log('[EXPORT DEBUG] Export status:', status);
            
            if (status.status === 'completed') {
              // Stop polling
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              
              console.log('[EXPORT DEBUG] Export completed, updating to ready state');
              // Update state to 'ready'
              setExportStatus('ready');
              setExportFilename(status.filename || `languoids_export_${exportId}.xlsx`);
            }
          } catch (pollErr) {
            console.error('[EXPORT DEBUG] Error polling export status:', pollErr);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setError('Failed to check export status. Please try again.');
            setExportStatus('idle');
            setExportId(null);
          }
        }, 2000);
      });
    } else {
      console.log('[EXPORT DEBUG] Not starting polling - conditions not met');
    }
  }, [exportStatus, exportId, exportFilename]); // Include dependencies so we get current values

  // Execute export (download file or start async export)
  const executeExport = useCallback(async (mode: ExportMode, ids: number[]) => {
    try {
      setExportStatus('preparing');
      setError(null);

      // Call export API
      const result = await languoidsAPI.export(mode, ids);

      // Check if result is async or synchronous
      if (typeof result === 'object' && 'async' in result && result.async) {
        // ASYNC EXPORT - Store ID and start polling
        const newExportId = result.export_id;
        setExportId(newExportId);
        
        // Start polling for completion
        const startPolling = () => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          
          pollIntervalRef.current = setInterval(async () => {
            try {
              const status = await languoidsAPI.exportStatus(newExportId);
              
              if (status.status === 'completed') {
                // Stop polling
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                
                // Update state to 'ready'
                setExportStatus('ready');
                setExportFilename(status.filename || `languoids_export_${newExportId}.xlsx`);
              }
            } catch (pollErr) {
              console.error('Error polling export status:', pollErr);
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              setError('Failed to check export status. Please try again.');
              setExportStatus('idle');
              setExportId(null);
            }
          }, 2000); // Poll every 2 seconds
          
          // Set timeout to stop polling after 5 minutes
          setTimeout(() => {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            if (exportStatus === 'preparing') {
              setError('Export took too long. Please try again with fewer items.');
              setExportStatus('idle');
              setExportId(null);
            }
          }, 300000); // 5 minutes
        };
        
        startPolling();
        
      } else {
        // SYNCHRONOUS EXPORT - Direct download
        const blob = result as Blob;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Generate filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/:/g, '-').substring(0, 19);
        link.download = `languoids_export_${timestamp}.xlsx`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setExportStatus('idle');
      }
      
    } catch (err: any) {
      console.error('Error exporting languoids:', err);
      setError(err.message || 'Failed to export languoids. Please try again.');
      setExportStatus('idle');
      setExportId(null);
    }
  }, [exportStatus]);

  // Handle downloading a ready export
  const handleDownloadReady = useCallback(async () => {
    if (!exportId || !exportFilename) return;
    
    try {
      // Download the completed export
      const blob = await languoidsAPI.exportDownload(exportId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFilename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // Reset export state after download
      setExportStatus('idle');
      setExportId(null);
      setExportFilename(null);
    } catch (err: any) {
      console.error('Error downloading export:', err);
      setError(err.message || 'Failed to download export. Please try again.');
      setExportStatus('idle');
      setExportId(null);
      setExportFilename(null);
    }
  }, [exportId, exportFilename]);

  // Handle export button execution
  const handleExport = useCallback((mode: ExportMode) => {
    // If export is ready, download it immediately
    if (exportStatus === 'ready' && exportId && exportFilename) {
      handleDownloadReady();
      return;
    }
    
    // Determine count and IDs to export
    let count = 0;
    let idsToExport: number[] = [];
    
    if (mode === 'filtered') {
      count = hierarchicalLanguoids.length;
      idsToExport = hierarchicalLanguoids.map(l => l.id);
    } else if (mode === 'selected') {
      count = selectedIds.size;
      idsToExport = Array.from(selectedIds);
    }
    
    // Start export directly (no warning)
    executeExport(mode, idsToExport);
  }, [hierarchicalLanguoids, selectedIds, exportStatus, exportId, exportFilename, executeExport, handleDownloadReady]);

  // Smart pagination: calculate page breaks at family boundaries
  const { paginatedLanguoids, pageBreaks, totalPages } = useMemo(() => {
    if (hierarchicalLanguoids.length === 0) {
      return { paginatedLanguoids: [], pageBreaks: [], totalPages: 0 };
    }

    // Calculate page breaks that respect top-level family boundaries
    const breaks: number[] = [0]; // Start of first page
    let currentIndex = 0;

    while (currentIndex < hierarchicalLanguoids.length) {
      // Find the next break point (minimum minPageSize items ahead)
      let breakPoint = currentIndex + minPageSize;

      // If we're past the end, we're done
      if (breakPoint >= hierarchicalLanguoids.length) {
        breaks.push(hierarchicalLanguoids.length);
        break;
      }

      // Find the next top-level item (indentLevel === 0) after the minimum page size
      // This ensures we don't split a family tree across pages
      let foundBreak = false;
      for (let i = breakPoint; i < hierarchicalLanguoids.length; i++) {
        if (hierarchicalLanguoids[i].indentLevel === 0) {
          // Found a top-level item - this is a natural break point
          breakPoint = i;
          foundBreak = true;
          break;
        }
      }

      // If we didn't find a top-level item, just use the rest of the list
      if (!foundBreak) {
        breakPoint = hierarchicalLanguoids.length;
      }

      breaks.push(breakPoint);
      currentIndex = breakPoint;
    }

    // Get the items for the current page
    const startIndex = breaks[displayPage - 1] || 0;
    const endIndex = breaks[displayPage] || hierarchicalLanguoids.length;
    const pageItems = hierarchicalLanguoids.slice(startIndex, endIndex);

    return {
      paginatedLanguoids: pageItems,
      pageBreaks: breaks,
      totalPages: breaks.length - 1
    };
  }, [hierarchicalLanguoids, displayPage, minPageSize]);

  // Load data on component mount and when filters change
  useEffect(() => {
    loadLanguoids();
  }, [loadLanguoids]);

  // Restore scroll position and filters when returning from batch editor
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('languoid-list-scroll');
    const savedFilters = sessionStorage.getItem('languoid-list-filters');
    
    if (savedScroll) {
      window.scrollTo(0, parseInt(savedScroll));
      sessionStorage.removeItem('languoid-list-scroll');
    }
    
    if (savedFilters) {
      const filters = JSON.parse(savedFilters);
      setSelectedLevelFilter(filters.selectedLevelFilter);
      setSearchTerm(filters.searchTerm);
      setLevelFilter(filters.levelFilter);
      setFamilyFilter(filters.familyFilter);
      setRegionFilter(filters.regionFilter);
      setDisplayPage(filters.displayPage);
      sessionStorage.removeItem('languoid-list-filters');
    }
  }, []);

  const handleRowClick = (languoid: Languoid) => {
    // Use glottocode for URL if available, otherwise fall back to ID
    const identifier = languoid.glottocode || languoid.id;
    navigate(`/languoids/${identifier}`);
  };

  const handleCreateClick = () => {
    navigate('/languoids/create');
  };

  const handleLevelFilterChange = (filterKey: string) => {
    setSelectedLevelFilter(filterKey);
    setDisplayPage(1); // Reset to first page
  };

  const clearFilters = () => {
    setSearchTerm('');
    setLevelFilter('');
    setFamilyFilter('');
    setRegionFilter('');
    setSelectedLevelFilter('all');
    setDisplayPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setDisplayPage(newPage);
  };

  // Scroll to top when page changes (after render completes)
  useEffect(() => {
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [displayPage]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress aria-label="Loading languoids" />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1">
            Languages
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
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh list data">
            <IconButton
              color="primary"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              sx={{ 
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              {isRefreshing ? <CircularProgress size={24} aria-label="Refreshing languoids" /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          {hasEditAccess(authState.user) && (
            <>
              <ExportButton
                mode={exportMode}
                exportStatus={exportStatus}
                onModeChange={setExportMode}
                onExecute={handleExport}
                selectedCount={selectedIds.size}
                filteredCount={hierarchicalLanguoids.length}
                disabled={loading}
              />
              <BatchEditButton
                mode={batchEditMode}
                onModeChange={setBatchEditMode}
                onExecute={handleBatchEdit}
                selectedCount={selectedIds.size}
                filteredCount={hierarchicalLanguoids.length}
                totalCount={allLanguoids.length}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateClick}
              >
                Add Languoid
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Batch Edit Warning Dialog */}
      <BatchEditWarningDialog
        open={showWarning}
        config={warningConfig}
        onCancel={handleWarningCancel}
        onContinue={handleWarningContinue}
      />

      {/* Prominent Level Filter Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Filter by Type
          </Typography>
          <ButtonGroup 
            variant="outlined" 
            sx={{ 
              flexWrap: 'wrap',
              '& .MuiButton-root': {
                mb: 1,
                mr: 1
              }
            }}
          >
            {LEVEL_FILTER_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant={selectedLevelFilter === preset.key ? 'contained' : 'outlined'}
                onClick={() => handleLevelFilterChange(preset.key)}
                size={isMobile ? 'small' : 'medium'}
              >
                {preset.label}
              </Button>
            ))}
          </ButtonGroup>
        </CardContent>
      </Card>

      {/* Collapsible Advanced Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Advanced Filters
            </Typography>
            <IconButton onClick={() => setFiltersOpen(!filtersOpen)}>
              {filtersOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={filtersOpen}>
            <Box sx={{ mt: 2 }}>
              <Stack spacing={2} direction={isMobile ? 'column' : 'row'}>
                <TextField
                  label="Search"
                  variant="outlined"
                  size="small"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                  sx={{ flex: 1 }}
                />
                
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Level</InputLabel>
                  <Select
                    value={levelFilter}
                    label="Level"
                    onChange={(e) => setLevelFilter(e.target.value)}
                  >
                    <MenuItem value="">All Levels</MenuItem>
                    {LANGUOID_LEVEL_CHOICES.map((choice) => (
                      <MenuItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Family"
                  variant="outlined"
                  size="small"
                  value={familyFilter}
                  onChange={(e) => setFamilyFilter(e.target.value)}
                  sx={{ flex: 1 }}
                />

                <TextField
                  label="Region"
                  variant="outlined"
                  size="small"
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  sx={{ flex: 1 }}
                />

                <Button
                  variant="outlined"
                  onClick={clearFilters}
                  size="small"
                >
                  Clear
                </Button>
              </Stack>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Results Count with scroll target */}
      <Box ref={listTopRef}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {pageBreaks[displayPage - 1] + 1}-{pageBreaks[displayPage]} of {hierarchicalLanguoids.length} languoids
          {paginatedLanguoids.length > minPageSize && ` (${paginatedLanguoids.length} on this page)`}
          {filteredLanguoids && allLanguoids && filteredLanguoids.length !== allLanguoids.length && ` • ${allLanguoids.length} total`}
        </Typography>
      </Box>

      {/* Hierarchical Table/List */}
      {isMobile ? (
        // Mobile: Card layout
        <Stack spacing={2}>
          {paginatedLanguoids.map((languoid) => (
            <Card 
              key={languoid.id}
              sx={{ 
                ml: languoid.indentLevel * 2, // Indent for hierarchy
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  {/* Checkbox */}
                  <Checkbox
                    checked={selectedIds.has(languoid.id)}
                    onClick={(e) => handleCheckboxClick(e, languoid)}
                    icon={<CheckBoxOutlineBlankIcon />}
                    checkedIcon={<CheckBoxIcon />}
                    sx={{ mt: -1, mr: 1 }}
                  />
                  {/* Card content - clickable */}
                  <Box 
                    sx={{ 
                      flex: 1, 
                      cursor: 'pointer',
                      '&:hover': { opacity: 0.8 }
                    }}
                    onClick={() => handleRowClick(languoid)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Chip
                        label={languoid.level_display}
                        color={LEVEL_COLORS[languoid.level_nal as keyof typeof LEVEL_COLORS]}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <Typography variant="h6" sx={{ flex: 1 }}>
                        {languoid.name}
                      </Typography>
                    </Box>
                    
                <Stack spacing={1}>
                  {languoid.iso && (
                    <Typography variant="body2" color="text.secondary">
                      ISO: {languoid.iso.length > 6 ? `${languoid.iso.substring(0, 6)}...` : languoid.iso}
                    </Typography>
                  )}
                  {languoid.glottocode && (
                    <Typography variant="body2" color="text.secondary">
                      Glottocode: {languoid.glottocode}
                    </Typography>
                  )}
                      {languoid.family_name && (
                        <Typography variant="body2" color="text.secondary">
                          Family: {languoid.family_name}
                        </Typography>
                      )}
                      {languoid.region && (
                        <Typography variant="body2" color="text.secondary">
                          Region: {languoid.region}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        // Desktop: Table layout
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Tooltip title={selectAllCheckboxState === 'checked' ? 'Deselect all filtered' : 'Select all filtered'}>
                    <Checkbox
                      checked={selectAllCheckboxState === 'checked'}
                      indeterminate={selectAllCheckboxState === 'indeterminate'}
                      onChange={() => {
                        if (selectAllCheckboxState === 'checked') {
                          handleDeselectAll();
                        } else {
                          handleSelectAllFiltered();
                        }
                      }}
                      disabled={hierarchicalLanguoids.length === 0}
                      icon={<CheckBoxOutlineBlankIcon />}
                      checkedIcon={<CheckBoxIcon />}
                      indeterminateIcon={<IndeterminateCheckBoxIcon />}
                    />
                  </Tooltip>
                </TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>ISO</TableCell>
                <TableCell>Glottocode</TableCell>
                <TableCell>Family</TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Children</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedLanguoids.map((languoid) => (
                <TableRow
                  key={languoid.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(languoid)}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(languoid.id)}
                      onClick={(e) => handleCheckboxClick(e, languoid)}
                      icon={<CheckBoxOutlineBlankIcon />}
                      checkedIcon={<CheckBoxIcon />}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {/* Hierarchical indentation */}
                      <Box sx={{ width: languoid.indentLevel * 24 }} />
                      <Typography variant="body1">
                        {languoid.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={languoid.level_display}
                      color={LEVEL_COLORS[languoid.level_nal as keyof typeof LEVEL_COLORS]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {languoid.iso 
                      ? (languoid.iso.length > 6 ? `${languoid.iso.substring(0, 6)}...` : languoid.iso)
                      : '—'}
                  </TableCell>
                  <TableCell>{languoid.glottocode || '—'}</TableCell>
                  <TableCell>{languoid.family_name || '—'}</TableCell>
                  <TableCell>{languoid.region || '—'}</TableCell>
                  <TableCell>
                    {languoid.child_count > 0 && (
                      <Chip
                        label={languoid.child_count}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Empty State */}
      {paginatedLanguoids.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 4 }}>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No languoids found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchTerm || levelFilter || familyFilter || regionFilter
                ? 'Try adjusting your search criteria.'
                : 'No languoids have been added yet.'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination 
            count={totalPages} 
            page={displayPage} 
            onChange={(_, page) => handlePageChange(page)}
            color="primary"
            size={isMobile ? 'small' : 'medium'}
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Container>
  );
};

export default LanguoidsList;
