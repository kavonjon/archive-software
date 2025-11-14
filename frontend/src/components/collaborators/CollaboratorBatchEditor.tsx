/**
 * Stage 1 Phase 2: Collaborator Batch Editor
 * 
 * Model-specific wrapper for batch editing Collaborators
 * Provides column configuration and collaborator-specific logic
 */

import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Box, 
  Alert, 
  Snackbar, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions, 
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { AdaptiveSpreadsheetGrid } from '../batch';
import { ColumnConfig, SpreadsheetRow, SpreadsheetCell } from '../../types/spreadsheet';
import { RootState } from '../../store/store';
import {
  initializeSpreadsheet,
  updateCell,
  batchUpdateCells,
  undo,
  redo,
  clearHistory,
  toggleRowSelection,
  toggleAllRowSelection,
  selectRowRange,
  clearAllSelections,
  setLoading,
  setError,
  setSuccessMessage,
  addDraftRow,
  resetSpreadsheet,
  setSaving,
  updateRowAfterSave,
} from '../../store/batchSpreadsheetSlice';
import { collaboratorsAPI, Collaborator, Languoid, languoidsAPI } from '../../services/api';
import { useCollaboratorCache } from '../../contexts/CollaboratorCacheContext';
import { useImportCollaboratorSpreadsheet } from '../../hooks/useImportCollaboratorSpreadsheet';
import { v4 as uuidv4 } from 'uuid';

// Column configuration for Collaborators (finalized order, no full_name)
const COLLABORATOR_COLUMNS: ColumnConfig[] = [
  {
    fieldName: 'collaborator_id',
    header: 'Collaborator ID',
    cellType: 'text',
    width: 150,
    required: false, // Optional on import, auto-generated for new rows
  },
  {
    fieldName: 'first_names',
    header: 'First and Middle Name(s)',
    cellType: 'text',
    width: 200,
    required: false,
  },
  {
    fieldName: 'last_names',
    header: 'Last Name(s)',
    cellType: 'text',
    width: 200,
    required: false,
  },
  {
    fieldName: 'name_suffix',
    header: 'Name Suffix',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'nickname',
    header: 'Nickname',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'other_names',
    header: 'Other Names',
    cellType: 'stringarray',
    width: 200,
  },
  {
    fieldName: 'anonymous',
    header: 'Anonymous',
    cellType: 'boolean',
    width: 120,
    choices: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
      { value: null, label: 'Not specified' },
    ],
  },
  {
    fieldName: 'native_languages',
    header: 'Native/First Languages',
    cellType: 'multiselect',
    width: 250,
    relationshipEndpoint: '/internal/v1/languoids/',
  },
  {
    fieldName: 'other_languages',
    header: 'Other Languages',
    cellType: 'multiselect',
    width: 250,
    relationshipEndpoint: '/internal/v1/languoids/',
  },
  {
    fieldName: 'birthdate',
    header: 'Birth Date',
    cellType: 'text',
    width: 120,
  },
  {
    fieldName: 'deathdate',
    header: 'Death Date',
    cellType: 'text',
    width: 120,
  },
  {
    fieldName: 'gender',
    header: 'Gender',
    cellType: 'text',
    width: 100,
  },
  {
    fieldName: 'tribal_affiliations',
    header: 'Tribal Affiliations',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'clan_society',
    header: 'Clan/Society',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'origin',
    header: 'Origin',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'other_info',
    header: 'Other Info',
    cellType: 'text',
    width: 300,
  },
];

/**
 * Helper to format languoid array display text
 */
const formatLanguoidArrayDisplay = (languoids: Languoid[]): string => {
  if (!languoids || languoids.length === 0) return '';
  return languoids.map(lang => lang.name).join(', ');
};

/**
 * Convert a Collaborator API object to a SpreadsheetRow
 */
const collaboratorToRow = (collaborator: Collaborator): SpreadsheetRow => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  COLLABORATOR_COLUMNS.forEach(col => {
    const fieldName = col.fieldName as keyof Collaborator;
    let value = collaborator[fieldName];
    
    let displayValue = value?.toString() || '';
    
    // For anonymous field, handle null/true/false
    if (fieldName === 'anonymous') {
      if (value === null || value === undefined) {
        displayValue = 'Not specified';
      } else {
        displayValue = value ? 'Yes' : 'No';
      }
    }
    
    // For multiselect languoid fields (M2M), store minimal data for editor
    if (fieldName === 'native_languages' || fieldName === 'other_languages') {
      if (Array.isArray(value)) {
        // Full Languoid objects from API - extract minimal data for editor
        const languoids = value as Languoid[];
        displayValue = formatLanguoidArrayDisplay(languoids);
        // Store objects with id, name, and glottocode for the multiselect editor
        value = languoids.map(lang => ({ 
          id: lang.id, 
          name: lang.name,
          glottocode: lang.glottocode 
        })) as any;
      } else {
        displayValue = '';
        value = [] as any;
      }
    }
    
    // For JSON array fields (other_names), display as comma-separated and store as string
    if (fieldName === 'other_names') {
      if (Array.isArray(value) && value.length > 0) {
        displayValue = value.join(', ');
        // Keep the array as-is for storage
      } else {
        displayValue = '';
        value = [];
      }
    }
    
    cells[col.fieldName] = {
      text: displayValue,
      value: value,
      type: col.cellType,
      isEdited: false,
      originalValue: value,
      validationState: 'valid',
      hasConflict: false,
      fieldName: col.fieldName,
      readOnly: col.readOnly,
    };
  });
  
  return {
    id: collaborator.id,
    cells,
    isDraft: false,
    hasChanges: false,
    hasErrors: false,
    version: 1,
    _updated: collaborator.updated, // Store DB timestamp for conflict detection
  };
};

/**
 * Create a new draft row with default values
 */
/**
 * Create a new draft row for adding a collaborator
 * Generates the next available collaborator_id by considering:
 * 1. The max collaborator_id from the database (via API)
 * 2. The max collaborator_id from unsaved draft rows in the current spreadsheet
 */
const createDraftRow = async (existingRows: SpreadsheetRow[]): Promise<SpreadsheetRow> => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  // Fetch next available collaborator_id from backend (database max)
  let nextCollaboratorId: number | null = null;
  try {
    const response = await collaboratorsAPI.getNextId();
    let dbMaxId = response.next_id;
    
    // Also check the max collaborator_id in existing rows (including unsaved drafts)
    const maxIdInSpreadsheet = existingRows.reduce((max, row) => {
      const cellValue = row.cells.collaborator_id?.value;
      const id = typeof cellValue === 'number' ? cellValue : null;
      return id && id > max ? id : max;
    }, 0);
    
    // Use whichever is higher: database max or spreadsheet max
    nextCollaboratorId = Math.max(dbMaxId, maxIdInSpreadsheet + 1);
    
    console.log('[CollaboratorBatchEditor] Generated collaborator_id:', nextCollaboratorId, 
                '(DB max:', dbMaxId, ', Spreadsheet max:', maxIdInSpreadsheet, ')');
  } catch (error) {
    console.error('[CollaboratorBatchEditor] Failed to fetch next collaborator_id:', error);
    // Will be null - user can manually set or backend will assign on save
  }
  
  COLLABORATOR_COLUMNS.forEach(col => {
    // Set default value for collaborator_id (calculated above)
    const defaultValue = col.fieldName === 'collaborator_id' ? nextCollaboratorId : null;
    
    const defaultText = defaultValue?.toString() || '';
    
    cells[col.fieldName] = {
      text: defaultText,
      value: defaultValue,
      type: col.cellType,
      isEdited: false,
      originalValue: null,  // DB has no value for this row yet
      validationState: 'valid',
      hasConflict: false,
      fieldName: col.fieldName,
      readOnly: col.readOnly,
    };
  });
  
  return {
    id: `draft-${uuidv4()}`,
    cells,
    isDraft: true,
    hasChanges: false,  // Don't count as changed until user actually edits (auto-generated collaborator_id doesn't count)
    hasErrors: false,
  };
};

export const CollaboratorBatchEditor: React.FC = () => {
  const dispatch = useDispatch();
  
  // Cache hook
  const { getCollaborators, cache, isLoading: cacheLoading, loadProgress, refreshCache } = useCollaboratorCache();
  
  // Import hook
  const collaboratorImportHook = useImportCollaboratorSpreadsheet();
  
  // Local state for refresh confirmation dialog
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  
  // Local state for save all confirmation dialog
  const [showSaveAllConfirm, setShowSaveAllConfirm] = useState(false);
  
  // Local state for validation error dialog
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [validationErrorRows, setValidationErrorRows] = useState<Array<{ rowNumber: number; name: string; errors: string[] }>>([]);
  
  // State to track newly added row for auto-scrolling
  const [scrollToRowId, setScrollToRowId] = useState<string | number | null>(null);
  
  // Local state for loading dialog
  // NOTE: Dialog is now shown on CollaboratorsList page, not here
  
  // Track if user has confirmed the large dataset warning
  // NOTE: Not needed anymore since dialog is on list page
  
  // Get spreadsheet state from Redux
  const {
    rows,
    loading,
    saving,
    error,
    successMessage,
    undoStack,
    redoStack,
  } = useSelector((state: RootState) => state.batchSpreadsheet);
  
  // Compute derived values
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const anyChanges = rows.some(r => r.hasChanges);
  const selectedRowIds: (string | number)[] = []; // TODO: Implement selection state
  
  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('info');
  
  // Track if initial load is done
  const initialLoadDone = useRef(false);
  
  // Track if we're in empty mode (started with no rows)
  const isEmptyMode = useRef(false);
  
  // Track the IDs that should be in this batch editing session
  // This gets updated when new rows are saved and is used on refresh
  const sessionIds = useRef<Set<number>>(new Set());
  
  // Ref to track current rows (for preserving drafts during reload without triggering re-renders)
  const rowsRef = useRef<SpreadsheetRow[]>([]);
  
  // Keep ref in sync with Redux rows
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  
  /**
   * Load collaborators from cache (filtered by IDs from session storage)
   * NOTE: Warning/loading dialog is now shown on CollaboratorsList, not here
   * @param preserveDrafts - Whether to preserve existing draft rows (default: true for auto-refresh, false for manual refresh)
   */
  const loadCollaborators = useCallback(async (preserveDrafts: boolean = true) => {
    try {
      dispatch(setLoading(true));
      
      // Check for new format config first
      const configStr = sessionStorage.getItem('collaborator-batch-config');
      
      if (configStr) {
        const config = JSON.parse(configStr);
        sessionStorage.removeItem('collaborator-batch-config'); // Clean up immediately
        
        // Handle empty mode
        if (config.mode === 'empty') {
          console.log('[CollaboratorBatchEditor] Empty mode - initializing with empty grid');
          isEmptyMode.current = true; // Mark that we're in empty mode
          sessionIds.current = new Set(); // Start with no IDs
          dispatch(initializeSpreadsheet({
            modelName: 'Collaborator',
            rows: [],
          }));
          dispatch(setLoading(false));
          initialLoadDone.current = true;
          return;
        }
        
        // Get collaborators from cache (cache should be ready - list page waits for it)
        console.log('[CollaboratorBatchEditor] Getting collaborators from cache...');
        let allCollaborators = await getCollaborators();
        console.log('[CollaboratorBatchEditor] Cache returned', allCollaborators.length, 'total collaborators');
        
        // Store the initial IDs in sessionIds (always initialize, even if empty)
        sessionIds.current = new Set(config.ids || []);
        console.log('[CollaboratorBatchEditor] Initialized sessionIds with', sessionIds.current.size, 'IDs');
        
        // Filter to just the IDs we want (client-side filtering)
        if (config.ids && config.ids.length > 0) {
          const idSet = new Set(config.ids);
          allCollaborators = allCollaborators.filter(c => idSet.has(c.id));
        }
        
        console.log('[CollaboratorBatchEditor] Filtered to', allCollaborators.length, 'collaborators');
        
        // Convert to rows - use setTimeout to yield to the browser for UI updates
        console.log('[CollaboratorBatchEditor] Converting to rows...');
        console.time('[CollaboratorBatchEditor] Row conversion');
        
        // Break into chunks to avoid freezing UI
        const CHUNK_SIZE = 1000;
        const newRows: SpreadsheetRow[] = [];
        
        for (let i = 0; i < allCollaborators.length; i += CHUNK_SIZE) {
          const chunk = allCollaborators.slice(i, i + CHUNK_SIZE);
          
          // Process chunk
          const chunkRows = chunk.map(collaboratorToRow);
          newRows.push(...chunkRows);
          
          console.log(`[CollaboratorBatchEditor] Converted ${newRows.length}/${allCollaborators.length} rows`);
          
          // Yield to browser every chunk to keep UI responsive
          if (i + CHUNK_SIZE < allCollaborators.length) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        
        console.timeEnd('[CollaboratorBatchEditor] Row conversion');
        console.log('[CollaboratorBatchEditor] Converted', newRows.length, 'rows');
        
        // Preserve any existing draft rows (add them at the end)
        if (preserveDrafts) {
          const existingDraftRows = rowsRef.current.filter(r => r.isDraft);
          console.log('[CollaboratorBatchEditor] Preserving', existingDraftRows.length, 'draft rows');
          newRows.push(...existingDraftRows);
        }
        
        // Initialize spreadsheet
        dispatch(initializeSpreadsheet({
          modelName: 'Collaborator',
          rows: newRows,
        }));
        
        initialLoadDone.current = true;
        
      } else {
        // No config in sessionStorage
        // This happens on refresh (config was already consumed on initial load)
        
        // Check if we have sessionIds from a previous load
        if (sessionIds.current.size > 0) {
          // Refresh: Reload the IDs from our session
          console.log('[CollaboratorBatchEditor] Refresh - reloading from sessionIds');
          console.log('[CollaboratorBatchEditor] Current sessionIds:', Array.from(sessionIds.current));
          
          // Get all collaborators from cache
          const allCollaborators = await getCollaborators();
          
          // Create a map of ID -> collaborator for quick lookup
          const collaboratorMap = new Map(allCollaborators.map(c => [c.id, c]));
          
          // Preserve current row order by iterating through existing rows
          // and updating with fresh data from cache
          const newRows: SpreadsheetRow[] = [];
          
          for (const currentRow of rowsRef.current) {
            if (currentRow.isDraft) {
              // Keep draft rows as-is (only if preserveDrafts is true)
              if (preserveDrafts) {
                newRows.push(currentRow);
              }
            } else if (typeof currentRow.id === 'number' && sessionIds.current.has(currentRow.id)) {
              // Row is in our session - update with fresh data
              const freshCollaborator = collaboratorMap.get(currentRow.id);
              if (freshCollaborator) {
                newRows.push(collaboratorToRow(freshCollaborator));
              }
            }
            // Skip rows not in sessionIds (shouldn't happen)
          }
          
          console.log('[CollaboratorBatchEditor] Preserved order with', newRows.length, 'rows');
          
          // Initialize spreadsheet with refreshed data
          dispatch(initializeSpreadsheet({
            modelName: 'Collaborator',
            rows: newRows,
          }));
        } else if (isEmptyMode.current) {
          // Empty mode refresh: Just keep existing rows (already in Redux state)
          console.log('[CollaboratorBatchEditor] Empty mode refresh - keeping existing rows');
          // Nothing to do - rows are already in state
        } else {
          // No config and no sessionIds - this shouldn't happen in normal flow
          // This would only occur if someone navigates directly to /collaborators/batch
          console.error('[CollaboratorBatchEditor] No config and no sessionIds');
          dispatch(setError('No collaborators selected for batch editing'));
          return;
        }
      }
      
    } catch (err) {
      console.error('[CollaboratorBatchEditor] Load error:', err);
      dispatch(setError(err instanceof Error ? err.message : 'Failed to load collaborators'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, getCollaborators]); // Don't include rows - use rowsRef.current instead to avoid re-creating this function
  
  /**
   * Initial data load and cleanup on unmount
   */
  useEffect(() => {
    if (!initialLoadDone.current) {
      loadCollaborators();
    }
    
    // Cleanup on unmount - reset spreadsheet state
    return () => {
      dispatch(resetSpreadsheet());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount/unmount, not when loadCollaborators changes
  
  /**
   * Validate a single field (async)
   */
  const validateField = useCallback(async (
    rowId: string | number,
    fieldName: string,
    newValue: any,
    originalValue: any
  ) => {
    try {
      // Skip validation for multiselect fields (already validated client-side)
      const column = COLLABORATOR_COLUMNS.find(col => col.fieldName === fieldName);
      if (column?.cellType === 'multiselect') {
        // Already validated - mark as valid
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            validationState: 'valid',
            validationError: undefined,
          },
        }));
        return;
      }
      
      // Special validation for collaborator_id
      if (fieldName === 'collaborator_id') {
        // Check if it's a valid integer
        const valueStr = String(newValue || '').trim();
        
        // Empty is allowed (will be auto-generated by backend)
        if (valueStr === '') {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              validationState: 'valid',
              validationError: undefined,
            },
          }));
          return;
        }
        
        // Must be a valid integer
        if (!/^\d+$/.test(valueStr)) {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              validationState: 'invalid',
              validationError: 'Collaborator ID must be a positive integer',
            },
          }));
          return;
        }
        
        const numericValue = parseInt(valueStr, 10);
        
        // Check if this ID is already in use (unless it's the current row's original value)
        const isOriginalValue = numericValue === originalValue;
        
        if (!isOriginalValue) {
          // Call backend to check uniqueness
          try {
            const response = await collaboratorsAPI.list({ collaborator_id: numericValue });
            
            if (response.results && response.results.length > 0) {
              // ID is already in use
              dispatch(updateCell({
                rowId,
                fieldName,
                cell: {
                  validationState: 'invalid',
                  validationError: `Collaborator ID ${numericValue} is already in use`,
                },
              }));
              return;
            }
          } catch (error) {
            console.error('[CollaboratorBatchEditor] Error checking collaborator_id uniqueness:', error);
            // On error, allow the value (backend will catch it on save)
          }
        }
        
        // Valid
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            validationState: 'valid',
            validationError: undefined,
          },
        }));
        return;
      }
      
      // For now, mark all other fields as valid (no backend validation endpoint yet)
      dispatch(updateCell({
        rowId,
        fieldName,
        cell: {
          validationState: 'valid',
          validationError: undefined,
        },
      }));
      
    } catch (error) {
      console.error('[CollaboratorBatchEditor] Validation error:', error);
      dispatch(updateCell({
        rowId,
        fieldName,
        cell: {
          validationState: 'invalid',
          validationError: error instanceof Error ? error.message : 'Validation failed',
        },
      }));
    }
  }, [dispatch]);
  
  /**
   * Handle cell change from the spreadsheet grid
   */
  const handleCellChange = useCallback((
    rowId: string | number,
    fieldName: string,
    newValue: any,
    text?: string
  ) => {
    // Use text or fallback to empty string
    let newText = text || '';
    
    // Debug logging for anonymous field
    if (fieldName === 'anonymous') {
      console.log('[CollaboratorBatchEditor] handleCellChange - anonymous field:');
      console.log('  newValue:', newValue, 'type:', typeof newValue);
      console.log('  text param:', text);
    }
    
    // Special handling for boolean fields (anonymous): convert value to display text
    if (fieldName === 'anonymous') {
      if (newValue === null || newValue === undefined) {
        newText = 'Not specified';
      } else if (newValue === true) {
        newText = 'Yes';
      } else if (newValue === false) {
        newText = 'No';
      }
      console.log('  computed newText:', newText);
    }
    
    // Get row and original value
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    
    if (fieldName === 'anonymous') {
      console.log('  originalValue:', row.cells[fieldName]?.originalValue, 'type:', typeof row.cells[fieldName]?.originalValue);
      console.log('  current cell.value:', row.cells[fieldName]?.value, 'type:', typeof row.cells[fieldName]?.value);
    }
    
    const originalValue = row.cells[fieldName]?.originalValue;
    const isDraftRow = row.isDraft === true;
    const rowHasAnyChanges = row.hasChanges === true;
    
    // Get column metadata
    const column = COLLABORATOR_COLUMNS.find(col => col.fieldName === fieldName);
    
    // Check required fields BEFORE short-circuit (only for draft rows with changes)
    if (column?.required && isDraftRow && rowHasAnyChanges) {
      const isEmpty = newValue === null || newValue === undefined || newValue === '' || 
                      (Array.isArray(newValue) && newValue.length === 0);
      
      if (isEmpty) {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: newValue,
            text: newText,
            validationState: 'invalid',
            validationError: `${column.header} is required.`,
            hasConflict: false, // Clear conflict flag - user reviewed the cell
          },
        }));
        return; // Don't call backend - we know it's invalid
      }
    }
    
    // Special handling for multiselect (M2M) fields BEFORE short-circuit
    if (column?.cellType === 'multiselect') {
      // Check if user pasted arbitrary text (value is null but text is not empty)
      if (newValue === null && newText && newText.trim() !== '') {
        // Invalid multiselect data (arbitrary text pasted)
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: newText,
            validationState: 'invalid',
            validationError: 'Invalid multiselect value. Please select from dropdown.',
            hasConflict: false, // Clear conflict flag - user reviewed the cell
          },
        }));
        return; // Don't call backend - we know it's invalid
      }
      
      // Check if value is not an array (should always be array or null)
      if (newValue !== null && !Array.isArray(newValue)) {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: newText,
            validationState: 'invalid',
            validationError: 'Invalid multiselect value format.',
            hasConflict: false, // Clear conflict flag - user reviewed the cell
          },
        }));
        return;
      }
    }
    
    // Special handling for stringarray fields BEFORE short-circuit
    if (column?.cellType === 'stringarray') {
      // Allow null or empty array for optional stringarray fields
      if (newValue === null || newValue === undefined || (Array.isArray(newValue) && newValue.length === 0)) {
        // Valid empty value - skip validation
      } else if (!Array.isArray(newValue)) {
        // Invalid: not null and not an array
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: [],
            text: '',
            validationState: 'invalid',
            validationError: 'Invalid string array format.',
            hasConflict: false, // Clear conflict flag - user reviewed the cell
          },
        }));
        return;
      } else {
        // Validate that all items are strings and non-empty
        const hasInvalidItems = newValue.some((item: any) => typeof item !== 'string' || item.trim() === '');
        if (hasInvalidItems) {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              value: newValue,
              text: newText,
              validationState: 'invalid',
              validationError: 'String array contains empty or invalid items.',
              hasConflict: false, // Clear conflict flag - user reviewed the cell
            },
          }));
          return;
        }
      }
    }
    
    // Short-circuit: If value equals DB value, it's automatically valid
    // This handles the case where user edits away and then back to original
    // For arrays (M2M fields, stringarray fields), need deep comparison
    let valuesAreEqual = false;
    
    if (Array.isArray(newValue) && Array.isArray(originalValue)) {
      // Compare arrays - for numeric arrays (M2M), sort numerically; for string arrays, sort alphabetically
      if (column?.cellType === 'stringarray') {
        // String array comparison
        const sortedNew = [...newValue].sort();
        const sortedOrig = [...originalValue].sort();
        valuesAreEqual = JSON.stringify(sortedNew) === JSON.stringify(sortedOrig);
      } else {
        // Numeric array comparison (M2M fields)
        const sortedNew = [...newValue].sort((a: number, b: number) => a - b);
        const sortedOrig = [...originalValue].sort((a: number, b: number) => a - b);
        valuesAreEqual = JSON.stringify(sortedNew) === JSON.stringify(sortedOrig);
      }
    } else {
      // Simple comparison for non-arrays
      // Special handling for numeric fields that might be string or number
      if (fieldName === 'collaborator_id') {
        // Normalize both to numbers for comparison (handle string "1234" vs number 1234)
        const newNum = newValue === null || newValue === undefined || newValue === '' ? null : Number(newValue);
        const origNum = originalValue === null || originalValue === undefined || originalValue === '' ? null : Number(originalValue);
        valuesAreEqual = newNum === origNum;
        
        console.log('[CollaboratorBatchEditor] collaborator_id comparison:');
        console.log('  newValue:', newValue, 'type:', typeof newValue);
        console.log('  originalValue:', originalValue, 'type:', typeof originalValue);
        console.log('  newNum:', newNum, 'type:', typeof newNum);
        console.log('  origNum:', origNum, 'type:', typeof origNum);
        console.log('  valuesAreEqual:', valuesAreEqual);
      } else {
        valuesAreEqual = newValue === originalValue;
      }
    }
    
    if (fieldName === 'anonymous') {
      console.log('  valuesAreEqual?', valuesAreEqual, '(newValue === originalValue)');
    }
    
    if (valuesAreEqual) {
      if (fieldName === 'anonymous') {
        console.log('  -> Values are equal, marking as valid (no change)');
      }
      dispatch(updateCell({
        rowId,
        fieldName,
        cell: {
          value: newValue,
          text: newText,
          validationState: 'valid',
          validationError: undefined,
          hasConflict: false, // Clear conflict flag - user reviewed the cell
        },
      }));
      return; // Don't call backend validation - it's the DB value so it's valid
    }
    
    if (fieldName === 'anonymous') {
      console.log('  -> Values differ, updating cell and validating');
    }
    
    // Value differs from DB - update cell and trigger validation
    dispatch(updateCell({
      rowId,
      fieldName,
      cell: {
        value: newValue,
        text: newText,
        hasConflict: false, // Clear conflict flag - user reviewed and changed the cell
      },
    }));
    
    // Trigger backend validation, passing originalValue for context
    validateField(rowId, fieldName, newValue, originalValue);
  }, [rows, dispatch, validateField]);
  
  /**
   * Handle adding a new draft row
   */
  const handleAddRow = useCallback(async () => {
    const newRow = await createDraftRow(rows);
    dispatch(addDraftRow(newRow));
    
    // Trigger scroll to the new row
    setScrollToRowId(newRow.id);
    // Clear after scrolling happens
    setTimeout(() => setScrollToRowId(null), 500);
  }, [dispatch, rows]);
  
  /**
   * Handle refresh confirm - actually performs the refresh from database
   */
  const handleRefreshConfirm = useCallback(async () => {
    setShowRefreshConfirm(false);
    
    // Clear undo/redo history and selections before reloading
    dispatch(clearHistory());
    dispatch(clearAllSelections());
    
    try {
      dispatch(setLoading(true));
      console.log('[CollaboratorBatchEditor] Setting loading to TRUE');
      
      // Check if we have sessionIds
      if (sessionIds.current.size === 0 && !isEmptyMode.current) {
        dispatch(setError('No collaborators selected for batch editing'));
        dispatch(setLoading(false));
        return;
      }
      
      // Get IDs from sessionIds
      const ids = Array.from(sessionIds.current);
      console.log('[CollaboratorBatchEditor] Refreshing', ids.length, 'collaborators from database...');
      
      // Force refresh cache from database (bypasses Redis cache)
      const freshCollaborators = await refreshCache();
      console.log('[CollaboratorBatchEditor] Got', freshCollaborators.length, 'fresh collaborators from database');
      
      // Filter to just the IDs we want (skip if empty mode)
      let filteredCollaborators: Collaborator[];
      if (ids.length > 0) {
        filteredCollaborators = freshCollaborators.filter(c => sessionIds.current.has(c.id));
        console.log('[CollaboratorBatchEditor] Filtered to', filteredCollaborators.length, 'collaborators');
      } else {
        // Empty mode - no rows to reload
        filteredCollaborators = [];
        console.log('[CollaboratorBatchEditor] Empty mode - no rows to reload');
      }
      
      // Convert to rows (no drafts preserved on manual refresh)
      const newRows: SpreadsheetRow[] = filteredCollaborators.map(collaboratorToRow);
      console.log('[CollaboratorBatchEditor] Converted to', newRows.length, 'rows');
      
      // Initialize spreadsheet with fresh data
      console.log('[CollaboratorBatchEditor] About to dispatch initializeSpreadsheet with', newRows.length, 'rows');
      dispatch(initializeSpreadsheet({
        modelName: 'Collaborator',
        rows: newRows,
      }));
      
      console.log('[CollaboratorBatchEditor] initializeSpreadsheet dispatched, setting loading to FALSE');
      dispatch(setLoading(false));
      console.log('[CollaboratorBatchEditor] Refresh complete with', newRows.length, 'rows');
      
    } catch (err) {
      console.error('[CollaboratorBatchEditor] Refresh error:', err);
      dispatch(setError(err instanceof Error ? err.message : 'Failed to refresh'));
      dispatch(setLoading(false));
    }
  }, [dispatch, refreshCache]);
  
  /**
   * Handle refresh (reload data from database)
   */
  const handleRefresh = useCallback(() => {
    if (anyChanges) {
      // Show confirmation if there are unsaved changes
      setShowRefreshConfirm(true);
    } else {
      // No unsaved changes, refresh directly (bypass confirmation)
      handleRefreshConfirm();
    }
  }, [anyChanges, handleRefreshConfirm]);
  
  /**
   * Handle save (respects row selection)
   */
  const handleSaveAll = useCallback(() => {
    // Determine which rows to save based on checkbox selection
    const selectedRows = rows.filter(row => row.isSelected);
    const changedRows = rows.filter(row => row.hasChanges);
    
    // If no rows are selected, we'll save all changed rows
    if (selectedRows.length === 0) {
      if (changedRows.length === 0) {
        setSnackbarMessage('No changes to save');
        setSnackbarSeverity('info');
        setSnackbarOpen(true);
        return;
      }
      
      // Show confirmation dialog to save all changed rows
      // (Validation errors will be checked AFTER user confirms)
      setShowSaveAllConfirm(true);
      return;
    }
    
    // Filter to only selected rows that also have changes
    const editedRows = selectedRows.filter(row => row.hasChanges);
    
    if (editedRows.length === 0) {
      setError('Selected rows have no changes to save');
      return;
    }
    
    // Check for validation errors in selected rows that have changes
    const rowsWithErrors = editedRows.filter(row => row.hasErrors);
    if (rowsWithErrors.length > 0) {
      // Show validation error dialog
      const errorInfo = rowsWithErrors.map((row) => {
        const rowNumber = rows.indexOf(row) + 1; // 1-indexed row number
        const name = row.cells.first_names?.text || row.cells.last_names?.text || `Row ${rowNumber}`;
        const errors = Object.values(row.cells)
          .filter(cell => cell.validationState === 'invalid')
          .map(cell => cell.validationError || 'Unknown error');
        return { rowNumber, name, errors };
      });
      setValidationErrorRows(errorInfo);
      setShowValidationErrors(true);
      return;
    }
    
    // Proceed with saving selected rows (skip confirmation dialog since rows are explicitly selected)
    handleSaveAllConfirm();
  }, [rows]);
  
  const handleSaveAllConfirm = useCallback(async () => {
    setShowSaveAllConfirm(false);
    
    // Determine which rows to save based on checkbox selection
    const selectedRows = rows.filter(row => row.isSelected);
    let editedRows: typeof rows;
    
    if (selectedRows.length === 0) {
      // If no rows are selected, save all changed rows
      editedRows = rows.filter(row => row.hasChanges && !row.hasErrors);
      
      // Check for validation errors in ALL changed rows (since no selection)
      const changedRows = rows.filter(row => row.hasChanges);
      const rowsWithErrors = changedRows.filter(row => row.hasErrors);
      if (rowsWithErrors.length > 0) {
        // Show validation error dialog
        const errorInfo = rowsWithErrors.map((row) => {
          const rowNumber = rows.indexOf(row) + 1; // 1-indexed row number
          const name = row.cells.first_names?.text || row.cells.last_names?.text || `Row ${rowNumber}`;
          const errors = Object.values(row.cells)
            .filter(cell => cell.validationState === 'invalid')
            .map(cell => cell.validationError || 'Unknown error');
          return { rowNumber, name, errors };
        });
        setValidationErrorRows(errorInfo);
        setShowValidationErrors(true);
        return;
      }
    } else {
      // If rows are selected, save only selected rows that have changes
      editedRows = selectedRows.filter(row => row.hasChanges && !row.hasErrors);
    }
    
    try {
      dispatch(setSaving(true));
      
      // Convert SpreadsheetRows to API format
      const rowsToSave = editedRows.map(row => {
        const rowData: any = { id: row.id };
        
        // Include timestamp for conflict detection (existing rows only)
        if (!row.isDraft && (row as any)._updated) {
          rowData._updated = (row as any)._updated;
          console.log('[CollaboratorBatchEditor] Sending _updated for row', row.id, ':', rowData._updated);
        }
        
        // For conflict detection: send original values of edited fields
        const originalValues: any = {};
          
          if (row.isDraft) {
          // NEW ROWS: Send all non-empty values
            COLLABORATOR_COLUMNS.forEach(col => {
              const cell = row.cells[col.fieldName];
              if (cell) {
                let cellValue = cell.value;
                
                // For M2M languoid fields, convert from {id, name}[] back to just IDs
                if ((col.fieldName === 'native_languages' || col.fieldName === 'other_languages') && Array.isArray(cellValue)) {
                cellValue = cellValue.map((item: any) => item.id || item);
                }
                
                // Include all fields with non-empty values
                if (cellValue !== null && cellValue !== '' && cellValue !== undefined) {
                rowData[col.fieldName] = cellValue;
                } else if (Array.isArray(cellValue)) {
                  // Include empty arrays (for M2M fields)
                rowData[col.fieldName] = cellValue;
                }
              }
            });
          } else {
            // EXISTING ROWS: Only send CHANGED fields
            COLLABORATOR_COLUMNS.forEach(col => {
              const cell = row.cells[col.fieldName];
              if (cell && cell.isEdited) {
                let cellValue = cell.value;
                
                // For M2M languoid fields, convert from {id, name}[] back to just IDs
                if ((col.fieldName === 'native_languages' || col.fieldName === 'other_languages') && Array.isArray(cellValue)) {
                cellValue = cellValue.map((item: any) => item.id || item);
              }
              
              rowData[col.fieldName] = cellValue ?? '';
              // Store original value for backend conflict detection
              originalValues[col.fieldName] = cell.originalValue;
              }
            });
          
          // Include original values for conflict detection
          if (Object.keys(originalValues).length > 0) {
            rowData._original_values = originalValues;
          }
        }
        
        return rowData;
      });
      
      // Call save-batch API
      const response = await collaboratorsAPI.saveBatch(rowsToSave);
      
      console.log('[CollaboratorBatchEditor] Save batch response:', {
        success: response.success,
        savedCount: response.saved?.length || 0,
        errorsCount: response.errors?.length || 0,
        errors: response.errors,
          });
          
      if (response.success) {
        // Check for conflicts (errors with type='conflict')
        const conflicts = response.errors?.filter((err: any) => err.type === 'conflict') || [];
        
        console.log('[CollaboratorBatchEditor] Conflicts detected:', conflicts.length);
        console.log('[CollaboratorBatchEditor] Current rowsRef.current length:', rowsRef.current.length);
        console.log('[CollaboratorBatchEditor] Current rows length:', rows.length);
        
        // Handle conflicts
        const conflictRowIds = new Set<number>();
        if (conflicts.length > 0) {
          // Handle conflicts: Mark ONLY conflicting fields with orange highlighting
          conflicts.forEach((conflict: any) => {
            const rowId = conflict.row_id;
            conflictRowIds.add(rowId); // Track conflict rows
            const currentData = conflict.current_data;
            const conflictingFields = conflict.conflicting_fields || []; // List of field names with conflicts
            
            // Update the row with conflict state
            if (currentData) {
              const updatedRow = collaboratorToRow(currentData);
              // Mark ONLY cells that have actual field-level conflicts
              const originalRow = editedRows.find(r => r.id === rowId);
              if (originalRow) {
                let hasAnyEdits = false; // Track if any cells are edited
                
                Object.keys(originalRow.cells).forEach(fieldName => {
                  const cell = originalRow.cells[fieldName];
                  
                  // Check if this field is in the conflicting_fields list
                  const hasFieldConflict = conflictingFields.includes(fieldName);
                  
                  if (cell.isEdited && hasFieldConflict) {
                    // TRUE CONFLICT: User edited this field AND another user also changed it
                    updatedRow.cells[fieldName].hasConflict = true;
                    updatedRow.cells[fieldName].isEdited = true;
                    // CRITICAL: Restore user's edited value (not DB value)
                    updatedRow.cells[fieldName].value = cell.value;
                    updatedRow.cells[fieldName].text = cell.text;
                    // originalValue remains the DB value (from collaboratorToRow)
                    
                    hasAnyEdits = true; // Row still has edits
                  } else if (cell.isEdited && !hasFieldConflict) {
                    // User edited this field but no conflict - it was saved successfully
                    // Keep the user's value (it's now in the DB)
                    updatedRow.cells[fieldName].isEdited = false; // No longer edited (saved!)
                    updatedRow.cells[fieldName].value = cell.value;
                    updatedRow.cells[fieldName].text = cell.text;
                    updatedRow.cells[fieldName].originalValue = cell.value; // Update originalValue to match
                  }
                  // Fields not edited by user: just use fresh DB values (from collaboratorToRow)
                });
                
                // CRITICAL: If any cells still have edits (conflicts), mark row as hasChanges
                if (hasAnyEdits) {
                  updatedRow.hasChanges = true;
                }
              }
              // DON'T use updateRowAfterSave here - it will reset originalValue and isEdited!
              // Instead, replace the entire rows array to preserve our conflict state
              // Use rowsRef.current to get the latest rows from Redux
              const currentRows = [...rowsRef.current];
              const rowIndex = currentRows.findIndex(r => r.id === rowId);
              if (rowIndex !== -1) {
                currentRows[rowIndex] = updatedRow;
                dispatch(initializeSpreadsheet({ modelName: 'collaborator', rows: currentRows }));
              }
            }
          });
          
          // Count how many fields have true conflicts
          const totalConflictingFields = conflicts.reduce((sum, c: any) => {
            return sum + (c.conflicting_fields?.length || 0);
          }, 0);
          
          dispatch(setError(
            `${conflicts.length} row(s) were modified by another user. ` +
            `${totalConflictingFields} field(s) have conflicts and were NOT saved (highlighted in orange). ` +
            `Please review and click Save again to overwrite.`
          ));
        }
        
        // Update successfully saved rows (but skip conflict rows)
        console.log('[CollaboratorBatchEditor] Starting to update saved rows. editedRows:', editedRows.length, 'response.saved:', response.saved.length);
        let savedIndex = 0;
        for (let i = 0; i < editedRows.length; i++) {
          const oldRow = editedRows[i];
          
          // Skip rows that weren't saved (had conflicts)
          const wasSaved = response.saved.some((saved: Collaborator) => {
            if (oldRow.isDraft) {
              // For drafts, check by collaborator_id (unique) or name
              return saved.collaborator_id === oldRow.cells.collaborator_id?.value || 
                     saved.full_name === oldRow.cells.full_name?.value;
            } else {
              // For existing rows, check by ID
              return saved.id === oldRow.id;
            }
          });
          
          console.log('[CollaboratorBatchEditor] Row', i, 'oldRow.id:', oldRow.id, 'wasSaved:', wasSaved);
          
          if (!wasSaved) {
            continue; // Skip this row - it wasn't saved (validation error or conflict)
          }
          
          // Get the corresponding saved collaborator
          const savedCollaborator = response.saved[savedIndex];
          savedIndex++;
          
          console.log('[CollaboratorBatchEditor] Saved collaborator:', savedCollaborator.id);
          
          // Skip conflict rows (already handled above)
          if (conflictRowIds.has(savedCollaborator.id)) {
            console.log('[CollaboratorBatchEditor] Skipping conflict row:', savedCollaborator.id);
            continue;
          }
          
          // Update the row with saved data
          const newRow = collaboratorToRow(savedCollaborator);
          console.log('[CollaboratorBatchEditor] New row after save - id:', newRow.id, '_updated:', (newRow as any)._updated);
          
          // If this was a draft (new row), add its ID to sessionIds
          if (oldRow.isDraft && typeof newRow.id === 'number') {
            sessionIds.current.add(newRow.id);
            console.log('[CollaboratorBatchEditor] Added new row ID to sessionIds:', newRow.id, '| Total sessionIds:', sessionIds.current.size);
          }
          
          dispatch(updateRowAfterSave({ oldId: oldRow.id, newRow }));
        }
        
        console.log('[CollaboratorBatchEditor] Finished updating rows. About to dispatch success message.');
        console.log('[CollaboratorBatchEditor] Current Redux rows count:', rowsRef.current.length);
        
        if (conflicts.length === 0) {
          dispatch(setSuccessMessage(`Successfully saved ${response.saved.length} collaborator(s)`));
          setSnackbarMessage(`Successfully saved ${response.saved.length} collaborator(s)`);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        
          // Clear undo/redo history after successful save
          dispatch(clearHistory());
          // Clear checkbox selections after successful save
          dispatch(clearAllSelections());
          
          // NOTE: Cache is invalidated automatically by the backend after save
          // We don't need to call invalidateCache() here as it would trigger a reload
        } else {
          dispatch(setSuccessMessage(
            `Successfully saved ${response.saved.length} collaborator(s). ` +
            `${conflicts.length} row(s) had conflicts.`
          ));
          // Note: Don't clear history when there are conflicts - user might want to undo conflict resolution
        }
      } else {
        dispatch(setError(`Save failed: ${response.errors.join(', ')}`));
      }
      
    } catch (err) {
      console.error('[CollaboratorBatchEditor] Save all error:', err);
      dispatch(setError(err instanceof Error ? err.message : 'Save failed'));
    } finally {
      dispatch(setSaving(false));
    }
  }, [rows, dispatch]);
  
  /**
   * Handle undo
   */
  const handleUndo = useCallback(() => {
    dispatch(undo());
  }, [dispatch]);
  
  /**
   * Handle redo
   */
  const handleRedo = useCallback(() => {
    dispatch(redo());
  }, [dispatch]);
  
  /**
   * Close snackbar
   */
  const handleSnackbarClose = useCallback(() => {
    setSnackbarOpen(false);
  }, []);
  
  /**
   * Row selection handlers
   */
  // Track last clicked row ID for shift+click range selection
  const lastClickedRowRef = useRef<string | number | null>(null);
  
  const handleToggleRowSelection = useCallback((rowId: string | number, shiftKey: boolean) => {
    if (shiftKey && lastClickedRowRef.current !== null) {
      // Shift+click: Select range
      dispatch(selectRowRange({ startId: lastClickedRowRef.current, endId: rowId }));
    } else {
      // Regular click: Toggle single row
      dispatch(toggleRowSelection(rowId));
      lastClickedRowRef.current = rowId;
    }
  }, [dispatch]);
  
  const handleToggleAllSelection = useCallback(() => {
    dispatch(toggleAllRowSelection());
  }, [dispatch]);
  
  return (
    <Box 
      sx={{ 
        height: 'calc(100vh - 64px)', 
        p: 2,
      }}
    >
      {/* Error Alert - displayed before spreadsheet */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(setError(null))}>
          {error}
        </Alert>
      )}
      
      {/* Main Spreadsheet Grid */}
      {loading && !initialLoadDone.current ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      ) : (
        <AdaptiveSpreadsheetGrid
          modelName="Collaborators"
          rows={rows}
          columns={COLLABORATOR_COLUMNS}
          loading={loading}
          saving={saving}
          onCellChange={handleCellChange}
          onToggleRowSelection={handleToggleRowSelection}
          onToggleAllSelection={handleToggleAllSelection}
          onAddRow={handleAddRow}
          onSave={handleSaveAll}
          onRefresh={handleRefresh}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          importHook={collaboratorImportHook}
          scrollToRowId={scrollToRowId}
        />
      )}
      
      {/* Refresh Confirmation Dialog */}
      <Dialog 
        open={showRefreshConfirm} 
        onClose={() => setShowRefreshConfirm(false)}
        aria-labelledby="refresh-dialog-title"
        aria-describedby="refresh-dialog-description"
      >
        <DialogTitle id="refresh-dialog-title">Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText id="refresh-dialog-description">
            You have unsaved changes. Refreshing will discard all changes. Are you sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRefreshConfirm(false)}>Cancel</Button>
          <Button onClick={handleRefreshConfirm} color="error" autoFocus>
            Discard & Refresh
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Save All Confirmation Dialog */}
      <Dialog 
        open={showSaveAllConfirm} 
        onClose={() => setShowSaveAllConfirm(false)}
        aria-labelledby="save-all-dialog-title"
        aria-describedby="save-all-dialog-description"
      >
        <DialogTitle id="save-all-dialog-title">Save All Changed Rows?</DialogTitle>
        <DialogContent>
          <DialogContentText id="save-all-dialog-description">
            No rows are currently selected. Do you want to save all {rows.filter(r => r.hasChanges).length} changed row(s)?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveAllConfirm(false)}>Cancel</Button>
          <Button onClick={handleSaveAllConfirm} variant="contained" color="primary" autoFocus>
            Save All
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Validation Errors Dialog */}
      <Dialog 
        open={showValidationErrors} 
        onClose={() => setShowValidationErrors(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="validation-error-dialog-title"
        aria-describedby="validation-error-dialog-description"
      >
        <DialogTitle id="validation-error-dialog-title">
          Validation Errors Prevent Saving
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="validation-error-dialog-description" sx={{ mb: 2 }}>
            The following row(s) have validation errors that must be fixed before saving:
          </DialogContentText>
          <List dense>
            {validationErrorRows.map((errorRow, idx) => (
              <ListItem 
                key={idx}
                sx={{ 
                  flexDirection: 'column', 
                  alignItems: 'flex-start',
                  borderLeft: 3,
                  borderColor: 'error.main',
                  mb: 2,
                  pl: 2,
                }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  Row {errorRow.rowNumber}: {errorRow.name.length > 50 ? `${errorRow.name.substring(0, 50)}...` : errorRow.name}
                </Typography>
                <List dense disablePadding sx={{ pl: 2 }}>
                  {errorRow.errors.map((error, errorIdx) => (
                    <ListItem key={errorIdx} disableGutters>
                      <ListItemText 
                        primary={`• ${error}`}
                        primaryTypographyProps={{
                          variant: 'body2',
                          color: 'error',
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </ListItem>
            ))}
          </List>
          <DialogContentText sx={{ mt: 2 }}>
            Please correct these errors (cells highlighted in red) and try saving again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowValidationErrors(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for success/info messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

