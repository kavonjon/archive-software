/**
 * Stage 1 Phase 1: Languoid Batch Editor
 * 
 * Model-specific wrapper for batch editing Languoids
 * Provides column configuration and languoid-specific logic
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
import { languoidsAPI, Languoid, LANGUOID_LEVEL_GLOTTOLOG_CHOICES } from '../../services/api';
import { validateLanguoidField } from '../../services/validationAPI';
import { useFieldValidation } from '../../hooks';
import { useLanguoidCache } from '../../contexts/LanguoidCacheContext';
import { v4 as uuidv4 } from 'uuid';

// Column configuration for Languoids
const LANGUOID_COLUMNS: ColumnConfig[] = [
  {
    fieldName: 'name',
    header: 'Name',
    cellType: 'text',
    width: 200,
    required: true,
  },
  {
    fieldName: 'name_abbrev',
    header: 'Name Abbreviation',
    cellType: 'text',
    width: 180,
  },
  {
    fieldName: 'glottocode',
    header: 'Glottocode',
    cellType: 'text',
    width: 120,
    required: true,
  },
  {
    fieldName: 'iso',
    header: 'ISO 639-3',
    cellType: 'text',
    width: 100,
  },
  {
    fieldName: 'level_glottolog',
    header: 'Level',
    cellType: 'select',
    width: 120,
    choices: LANGUOID_LEVEL_GLOTTOLOG_CHOICES,
  },
  {
    fieldName: 'parent_languoid',
    header: 'Parent Languoid',
    cellType: 'relationship',
    width: 200,
    relationshipEndpoint: '/internal/v1/languoids/',
  },
  {
    fieldName: 'alt_names',
    header: 'Alternate Names',
    cellType: 'stringarray',
    width: 250,
  },
  {
    fieldName: 'region',
    header: 'Region',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'latitude',
    header: 'Latitude',
    cellType: 'decimal',
    width: 150,
  },
  {
    fieldName: 'longitude',
    header: 'Longitude',
    cellType: 'decimal',
    width: 150,
  },
  {
    fieldName: 'tribes',
    header: 'Tribes',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'notes',
    header: 'Notes',
    cellType: 'text',
    width: 300,
  },
];

/**
 * Helper to format FK languoid display text
 */
const formatLanguoidDisplay = (
  value: any, 
  languoid: Languoid, 
  nameField: string, 
  glottocodeField: string
): { displayValue: string; actualValue: any } => {
  let displayValue = '';
  let actualValue = value;
  
  if (typeof value === 'object' && value !== null) {
    // API returned full object
    const name = (value as any).name || 'Unknown';
    const glottocode = (value as any).glottocode;
    displayValue = glottocode ? `${name} (${glottocode})` : name;
    actualValue = (value as any).id;
  } else if (value) {
    // We have the ID, check if we also have the display fields
    const name = (languoid as any)[nameField];
    const glottocode = (languoid as any)[glottocodeField];
    if (name && glottocode) {
      displayValue = `${name} (${glottocode})`;
    } else if (name) {
      displayValue = name;
    } else {
      displayValue = `ID: ${value}`;
    }
  } else {
    displayValue = '';
    actualValue = null;
  }
  
  return { displayValue, actualValue };
};

/**
 * Convert a Languoid API object to a SpreadsheetRow
 */
const languoidToRow = (languoid: Languoid): SpreadsheetRow => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  LANGUOID_COLUMNS.forEach(col => {
    const fieldName = col.fieldName as keyof Languoid;
    let value = languoid[fieldName];
    
    // For 'level_glottolog' field, use human-readable display value for text
    let displayValue = value?.toString() || '';
    if (fieldName === 'level_glottolog') {
      // Find the label from choices
      const choice = LANGUOID_LEVEL_GLOTTOLOG_CHOICES.find(c => c.value === value);
      displayValue = choice ? choice.label : (value?.toString() || '');
    }
    
    // For FK languoid fields, format as "name (glottocode)"
    const relationshipFields: Record<string, { nameField: string; glottocodeField: string }> = {
      'parent_languoid': { nameField: 'parent_name', glottocodeField: 'parent_glottocode' },
    };
    
    if (relationshipFields[fieldName]) {
      const { nameField, glottocodeField } = relationshipFields[fieldName];
      const formatted = formatLanguoidDisplay(value, languoid, nameField, glottocodeField);
      displayValue = formatted.displayValue;
      value = formatted.actualValue;
    }
    
    // For JSON array fields (alt_names), display as comma-separated and store as string
    if (fieldName === 'alt_names') {
      if (Array.isArray(value) && value.length > 0) {
        displayValue = value.join(', ');
        // Keep the array as-is for storage
      } else {
        displayValue = '';
        value = [];
      }
    }
    
    // For Decimal fields (longitude, latitude), ensure value is string
    if (col.cellType === 'decimal') {
      if (value !== null && value !== undefined && value !== '') {
        // Convert number to string
        value = String(value);
        displayValue = String(value);
      } else {
        value = '';
        displayValue = '';
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
    id: languoid.id,
    cells,
    isDraft: false,
    hasChanges: false,
    hasErrors: false,
    version: 1,
    _updated: languoid.updated, // Store DB timestamp for conflict detection
  };
};

/**
 * Create a new draft row with default values
 */
const createDraftRow = (): SpreadsheetRow => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  LANGUOID_COLUMNS.forEach(col => {
    // Set default value for level_glottolog (required field)
    const defaultValue = col.fieldName === 'level_glottolog' ? 'language' : null;
    
    // For level field, use human-readable text
    let defaultText = defaultValue?.toString() || '';
    if (col.fieldName === 'level_glottolog' && defaultValue) {
      const choice = LANGUOID_LEVEL_GLOTTOLOG_CHOICES.find(c => c.value === defaultValue);
      defaultText = choice?.label || defaultValue;
    }
    
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
    hasChanges: false,
    hasErrors: false,
  };
};

export const LanguoidBatchEditor: React.FC = () => {
  const dispatch = useDispatch();
  const { getLanguoids } = useLanguoidCache();
  
  // Local state for refresh confirmation dialog
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  
  // Local state for save all confirmation dialog
  const [showSaveAllConfirm, setShowSaveAllConfirm] = useState(false);
  
  // Local state for validation error dialog
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [validationErrorRows, setValidationErrorRows] = useState<Array<{ rowNumber: number; name: string; errors: string[] }>>([]);
  
  // State to track newly added row for auto-scrolling
  const [scrollToRowId, setScrollToRowId] = useState<string | number | null>(null);
  
  const { rows, loading, saving, error, successMessage, validatingCells, undoStack, redoStack } = useSelector(
    (state: RootState) => state.batchSpreadsheet
  );
  
  // Compute isDirty on-demand (not stored in Redux for performance)
  const isDirty = useMemo(() => {
    return rows.some(r => r.hasChanges);
  }, [rows]);
  
  // Store rows in a ref to avoid recreating handleCellChange on every edit
  // We only need to read originalValue, which doesn't change during editing
  const rowsRef = useRef(rows);
  
  // Update ref on every render to keep it current
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  
  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z (undo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
      }
      // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z (redo)
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch(redo());
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);
  
  // Set up validation hook
  const { validateField, cleanup: cleanupValidation } = useFieldValidation({
    validateFn: validateLanguoidField,
    debounceMs: 500,
  });
  
  // Track if we've already loaded (prevents double-load in React Strict Mode)
  const hasLoadedRef = React.useRef(false);
  
  // Load languoids on mount
  useEffect(() => {
    // Prevent double-load in React Strict Mode (development)
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;
    
    loadLanguoids();
    
    // Cleanup on unmount
    return () => {
      dispatch(resetSpreadsheet());
      cleanupValidation();
    };
  }, []);
  
  const loadLanguoids = async () => {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));
      
      // Check for batch configuration in sessionStorage
      const configStr = sessionStorage.getItem('languoid-batch-config');
      
      if (configStr) {
        const config = JSON.parse(configStr);
        sessionStorage.removeItem('languoid-batch-config'); // Clean up immediately
        
        // Handle empty mode
        if (config.mode === 'empty') {
          dispatch(initializeSpreadsheet({
            modelName: 'Languoid',
            rows: [],
          }));
          dispatch(setLoading(false));
          return;
        }
        
        // Fetch ALL languoids from cache (not paginated API)
        let languoids = await getLanguoids();
        
        // Filter to just the IDs we want (client-side filtering)
        if (config.ids && config.ids.length > 0) {
          const idSet = new Set(config.ids);
          languoids = languoids.filter(l => idSet.has(l.id));
        }
        
        // Convert to spreadsheet rows
        const spreadsheetRows = languoids.map(languoidToRow);
        
        // Preserve any existing draft rows (they have IDs starting with 'draft-')
        const existingDraftRows = rowsRef.current.filter(r => r.isDraft);
        spreadsheetRows.push(...existingDraftRows);
        
        // Initialize spreadsheet
        dispatch(initializeSpreadsheet({
          modelName: 'Languoid',
          rows: spreadsheetRows,
        }));
        
      } else {
        // No configuration (direct navigation) - load all from cache (existing behavior)
        const languoids = await getLanguoids();
        const spreadsheetRows = languoids.map(languoidToRow);
        
        // Preserve any existing draft rows
        const existingDraftRows = rowsRef.current.filter(r => r.isDraft);
        spreadsheetRows.push(...existingDraftRows);
        
        dispatch(initializeSpreadsheet({
          modelName: 'Languoid',
          rows: spreadsheetRows,
        }));
      }
    } catch (err: any) {
      console.error('[LanguoidBatchEditor] Error loading languoids:', err);
      dispatch(setError(err.response?.data?.detail || 'Failed to load languoids'));
    } finally {
      dispatch(setLoading(false));
    }
  };
  
  const handleCellChange = useCallback((
    rowId: string | number,
    fieldName: string,
    newValue: any,
    newText?: string
  ) => {
    // Provide fallback for newText if not provided (e.g., from TanStack implementation)
    const text = newText ?? (typeof newValue === 'string' ? newValue : String(newValue || ''));
    
    // CRITICAL: Extract originalValue BEFORE Redux update
    // originalValue represents the DB value and should never be mutated by cell edits
    // Read from ref to avoid recreating this callback on every edit
    const row = rowsRef.current.find(r => r.id.toString() === rowId.toString());
    const originalValue = row?.cells[fieldName]?.originalValue;
    
    // Get column config for validation
    const column = LANGUOID_COLUMNS.find(col => col.fieldName === fieldName);
    
    // ============================================================================
    // REQUIRED FIELD VALIDATION (name, glottocode)
    // ============================================================================
    // Special case: For draft rows with NO changes yet, allow empty required fields
    // (row will be excluded from save anyway)
    const isDraftRow = row?.isDraft;
    const rowHasAnyChanges = row?.hasChanges;
    
    if (column?.required && !isDraftRow) {
      // Existing rows: enforce required immediately
      const isEmpty = newValue === null || newValue === undefined || newValue === '' || 
                      (Array.isArray(newValue) && newValue.length === 0);
      
      if (isEmpty) {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: newValue,
            text: text,
            validationState: 'invalid',
            validationError: `${column.header} is required.`,
            hasConflict: false, // Clear conflict flag - user reviewed the cell
          },
        }));
        return; // Don't call backend - we know it's invalid
      }
    } else if (column?.required && isDraftRow && rowHasAnyChanges) {
      // Draft rows with changes: enforce required
      const isEmpty = newValue === null || newValue === undefined || newValue === '' || 
                      (Array.isArray(newValue) && newValue.length === 0);
      
      if (isEmpty) {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: newValue,
            text: text,
            validationState: 'invalid',
            validationError: `${column.header} is required.`,
            hasConflict: false, // Clear conflict flag - user reviewed the cell
          },
        }));
        return; // Don't call backend - we know it's invalid
      }
    }
    // If draft row with NO changes: allow empty (validation will happen when they start editing)
    
    // Special handling for relationship fields BEFORE short-circuit
    if (column?.cellType === 'relationship') {
      // Check if user pasted arbitrary text (value is null but text is not empty)
      if (newValue === null && text && text.trim() !== '') {
        // Invalid relationship data (arbitrary text pasted)
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: text,
            validationState: 'invalid',
            validationError: 'Invalid relationship value. Please select from dropdown.',
            hasConflict: false, // Clear conflict flag - user reviewed the cell
          },
        }));
        return; // Don't call backend - we know it's invalid
      }
      
      // Check for self-reference in parent_languoid field
      if (fieldName === 'parent_languoid' && newValue !== null) {
        // Compare IDs (handle both string and number types)
        const languoidId = row?.id;
        const parentId = newValue;
        
        if (languoidId !== undefined && languoidId.toString() === parentId.toString()) {
          // Self-reference detected - invalid!
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              value: newValue,
              text: text,
              validationState: 'invalid',
              validationError: 'A languoid cannot be its own parent.',
              hasConflict: false, // Clear conflict flag - user reviewed the cell
            },
          }));
          return; // Don't call backend - we know it's invalid
        }
      }
    }
    
    // Special handling for multiselect (M2M) fields BEFORE short-circuit
    if (column?.cellType === 'multiselect') {
      // Check if user pasted arbitrary text (value is null but text is not empty)
      if (newValue === null && text && text.trim() !== '') {
        // Invalid multiselect data (arbitrary text pasted)
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: text,
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
            text: text,
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
      const hasInvalidItems = newValue.some(item => typeof item !== 'string' || item.trim() === '');
      if (hasInvalidItems) {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: newValue,
              text: text,
            validationState: 'invalid',
            validationError: 'String array contains empty or invalid items.',
            hasConflict: false, // Clear conflict flag - user reviewed the cell
          },
        }));
        return;
        }
      }
    }
    
    // Special handling for decimal fields BEFORE short-circuit
    if (column?.cellType === 'decimal') {
      // Validate decimal format (empty string is valid for nullable fields)
      if (newValue !== '' && newValue !== null && newValue !== undefined) {
        const decimalRegex = /^-?\d+\.?\d*$|^-?\d*\.\d+$/;
        if (!decimalRegex.test(String(newValue))) {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              value: newValue,
              text: text,
              validationState: 'invalid',
              validationError: 'Invalid decimal format. Use numbers like: 42, -17.5, 122.419906',
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
        const sortedNew = [...newValue].sort((a, b) => a - b);
        const sortedOrig = [...originalValue].sort((a, b) => a - b);
        valuesAreEqual = JSON.stringify(sortedNew) === JSON.stringify(sortedOrig);
      }
    } else {
      // Simple comparison for non-arrays
      valuesAreEqual = newValue === originalValue;
    }
    
    if (valuesAreEqual) {
      dispatch(updateCell({
        rowId,
        fieldName,
        cell: {
          value: newValue,
          text: text,
          validationState: 'valid',
          validationError: undefined,
          hasConflict: false, // Clear conflict flag - user reviewed the cell
        },
      }));
      return; // Don't call backend validation - it's the DB value so it's valid
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
    
    // Special case: If this is a draft row that just got its first edit,
    // validate ALL required fields now (since hasChanges will become true)
    if (isDraftRow && !rowHasAnyChanges) {
      // This edit will make hasChanges = true, so validate all required fields
      const requiredColumns = LANGUOID_COLUMNS.filter(col => col.required);
      requiredColumns.forEach(reqCol => {
        if (reqCol.fieldName === fieldName) {
          // Skip current field - already validated above
          return;
        }
        
        const cellValue = row?.cells[reqCol.fieldName]?.value;
        const isEmpty = cellValue === null || cellValue === undefined || cellValue === '' || 
                        (Array.isArray(cellValue) && cellValue.length === 0);
        
        if (isEmpty) {
          // Mark other required fields as invalid
          dispatch(updateCell({
            rowId,
            fieldName: reqCol.fieldName,
            cell: {
              validationState: 'invalid',
              validationError: `${reqCol.header} is required.`,
            },
          }));
        }
      });
    }
    
    // Trigger backend validation, passing originalValue for context
    validateField(rowId, fieldName, newValue, originalValue);
  }, [dispatch, validateField]);
  
  const handleAddRow = useCallback(() => {
    const newRow = createDraftRow();
    dispatch(addDraftRow(newRow));
    // Trigger scroll to the new row
    setScrollToRowId(newRow.id);
    // Clear after scrolling happens
    setTimeout(() => setScrollToRowId(null), 500);
  }, [dispatch]);
  
  // Handle batch cell changes (paste operations) - uses batchUpdateCells for atomic undo
  const handleBatchCellChange = useCallback((
    changes: Array<{ rowId: string | number; fieldName: string; newValue: any; newText?: string }>,
    description: string
  ) => {
    // Transform changes to Redux format with validation
    const reduxChanges = changes.map(({ rowId, fieldName, newValue, newText }) => {
      const text = newText ?? (typeof newValue === 'string' ? newValue : String(newValue || ''));
      const column = LANGUOID_COLUMNS.find(col => col.fieldName === fieldName);
      
      // Apply same validation logic as handleCellChange
      let cell: Partial<SpreadsheetCell> = {
        value: newValue,
        text: text,
        validationState: 'valid' as const,
      };
      
      // Relationship field validation
      if (column?.cellType === 'relationship') {
        if (newValue === null && text && text.trim() !== '') {
          cell = {
            value: null,
            text: text,
            validationState: 'invalid',
            validationError: 'Invalid relationship value. Please select from dropdown.',
          };
        }
      }
      
      // Multiselect field validation
      if (column?.cellType === 'multiselect') {
        if (newValue === null && text && text.trim() !== '') {
          cell = {
            value: null,
            text: text,
            validationState: 'invalid',
            validationError: 'Invalid multiselect value. Please select from dropdown.',
          };
        } else if (newValue !== null && !Array.isArray(newValue)) {
          cell = {
            value: null,
            text: text,
            validationState: 'invalid',
            validationError: 'Invalid multiselect value format.',
          };
        }
      }
      
      // Boolean field parsing
      if (column?.cellType === 'boolean') {
        const lowerText = text.toLowerCase().trim();
        if (lowerText === 'true' || lowerText === '1' || lowerText === 'yes') {
          cell.value = true;
          cell.text = 'Yes';
        } else if (lowerText === 'false' || lowerText === '0' || lowerText === 'no') {
          cell.value = false;
          cell.text = 'No';
        } else if (lowerText === '' || lowerText === 'null') {
          cell.value = null;
          cell.text = 'Not specified';
        }
      }
      
      // StringArray field parsing
      if (column?.cellType === 'stringarray') {
        if (text.trim() === '') {
          cell.value = [];
          cell.text = '';
        } else {
          // Parse comma-separated values
          const items = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
          cell.value = items;
          cell.text = items.join(', ');
        }
      }
      
      return { rowId, fieldName, cell };
    });
    
    // Dispatch batch update
    dispatch(batchUpdateCells({ changes: reduxChanges, description }));
    
    // Trigger backend validation for all changed cells
    // Get originalValue for each cell to pass to validation
    changes.forEach(({ rowId, fieldName, newValue }) => {
      const row = rowsRef.current.find(r => r.id.toString() === rowId.toString());
      const originalValue = row?.cells[fieldName]?.originalValue;
      
      // Only validate if the cell isn't already marked as invalid by client-side validation
      const reduxChange = reduxChanges.find(rc => rc.rowId === rowId && rc.fieldName === fieldName);
      if (reduxChange?.cell.validationState !== 'invalid') {
        validateField(rowId, fieldName, newValue, originalValue);
      }
    });
  }, [dispatch, validateField]);
  
  const handleSave = async () => {
    try {
      dispatch(setSaving(true));
      dispatch(setError(null));
      
      // Determine which rows to save based on checkbox selection
      const selectedRows = rows.filter(row => row.isSelected);
      const changedRows = rows.filter(row => row.hasChanges);
      
      // If no rows are selected, check if there are any changed rows
      if (selectedRows.length === 0) {
        if (changedRows.length === 0) {
        dispatch(setSuccessMessage('No changes to save'));
          dispatch(setSaving(false));
        return;
      }
        
        // Show confirmation dialog to save all changed rows
        setShowSaveAllConfirm(true);
        dispatch(setSaving(false));
        return;
      }
      
      // Filter to only selected rows that also have changes
      const editedRows = selectedRows.filter(row => row.hasChanges);
      
      if (editedRows.length === 0) {
        dispatch(setError('Selected rows have no changes to save'));
        dispatch(setSaving(false));
        return;
      }
      
      // Check for validation errors in selected rows
      const hasErrors = editedRows.some(row => row.hasErrors);
      if (hasErrors) {
        // Build detailed error list
        const errorDetails = editedRows
          .filter(row => row.hasErrors)
          .map((row, index) => {
            const rowNumber = rows.indexOf(row) + 1; // 1-indexed row number
            const name = row.cells.name?.text || '(unnamed)';
            const errors = Object.entries(row.cells)
              .filter(([_, cell]) => cell.validationState === 'invalid')
              .map(([fieldName, cell]) => cell.validationError || `${fieldName} is invalid`)
              .filter((msg, idx, arr) => arr.indexOf(msg) === idx); // Remove duplicates
            
            return { rowNumber, name, errors };
          });
        
        setValidationErrorRows(errorDetails);
        setShowValidationErrors(true);
        dispatch(setSaving(false));
        return;
      }
      
      // Proceed with saving (actual save logic moved to handleSaveConfirmed)
      await performSave(editedRows);
      
    } catch (err: any) {
      console.error('Save error:', err);
      dispatch(setError(err.response?.data?.errors?.join(', ') || err.message || 'Failed to save changes'));
    } finally {
      dispatch(setSaving(false));
    }
  };
  
  const handleSaveAllConfirmed = async () => {
    setShowSaveAllConfirm(false);
    
    try {
      dispatch(setSaving(true));
      dispatch(setError(null));
      
      const editedRows = rows.filter(row => row.hasChanges);
      
      // Check for validation errors
      const hasErrors = editedRows.some(row => row.hasErrors);
      if (hasErrors) {
        // Build detailed error list
        const errorDetails = editedRows
          .filter(row => row.hasErrors)
          .map((row, index) => {
            const rowNumber = rows.indexOf(row) + 1; // 1-indexed row number
            const name = row.cells.name?.text || '(unnamed)';
            const errors = Object.entries(row.cells)
              .filter(([_, cell]) => cell.validationState === 'invalid')
              .map(([fieldName, cell]) => cell.validationError || `${fieldName} is invalid`)
              .filter((msg, idx, arr) => arr.indexOf(msg) === idx); // Remove duplicates
            
            return { rowNumber, name, errors };
          });
        
        setValidationErrorRows(errorDetails);
        setShowValidationErrors(true);
        return;
      }
      
      await performSave(editedRows);
      
    } catch (err: any) {
      console.error('Save error:', err);
      dispatch(setError(err.response?.data?.errors?.join(', ') || err.message || 'Failed to save changes'));
    } finally {
      dispatch(setSaving(false));
    }
  };
  
  const performSave = async (editedRows: SpreadsheetRow[]) => {
      
      // Convert SpreadsheetRows to API format
      const rowsToSave = editedRows.map(row => {
        const rowData: any = { id: row.id };
        
        // Include timestamp for conflict detection (existing rows only)
        if (!row.isDraft && (row as any)._updated) {
          rowData._updated = (row as any)._updated;
        }
        
        // For conflict detection: send original values of edited fields
        const originalValues: any = {};
        
        if (row.isDraft) {
          // NEW ROWS: Only send non-empty values (required fields always sent)
          Object.keys(row.cells).forEach(fieldName => {
            const cell = row.cells[fieldName];
            const value = cell.value;
            
            // Always include required fields (name, level_glottolog)
            if (fieldName === 'name' || fieldName === 'level_glottolog') {
              rowData[fieldName] = value;
            }
            // For optional fields, only include if not null/empty
            else if (value !== null && value !== '' && value !== undefined) {
              rowData[fieldName] = value;
            }
            // Empty optional fields → omitted entirely, backend uses defaults
          });
        } else {
          // EXISTING ROWS: Only send CHANGED fields
          Object.keys(row.cells).forEach(fieldName => {
            const cell = row.cells[fieldName];
            
            // Only include if value differs from DB (originalValue)
            if (cell.value !== cell.originalValue) {
              // User explicitly changed this field
              // Convert null to empty string for Django char fields
              rowData[fieldName] = cell.value ?? '';
              // Store original value for backend conflict detection
              originalValues[fieldName] = cell.originalValue;
            }
            // Unchanged fields → omitted entirely, preserves DB value
            // Columns not in spreadsheet → not in row.cells → not sent
          });
          
          // Include original values for conflict detection
          if (Object.keys(originalValues).length > 0) {
            rowData._original_values = originalValues;
          }
        }
        
        return rowData;
      });
      
      // Call save-batch API
      const response = await languoidsAPI.saveBatch(rowsToSave);
      
      if (response.success) {
        // Check for conflicts (errors with type='conflict')
        const conflicts = response.errors?.filter((err: any) => err.type === 'conflict') || [];
        
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
              const updatedRow = languoidToRow(currentData);
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
                    // originalValue remains the DB value (from languoidToRow)
                    
                    hasAnyEdits = true; // Row still has edits
                  } else if (cell.isEdited && !hasFieldConflict) {
                    // User edited this field but no conflict - it was saved successfully
                    // Keep the user's value (it's now in the DB)
                    updatedRow.cells[fieldName].isEdited = false; // No longer edited (saved!)
                    updatedRow.cells[fieldName].value = cell.value;
                    updatedRow.cells[fieldName].text = cell.text;
                    updatedRow.cells[fieldName].originalValue = cell.value; // Update originalValue to match
                  }
                  // Fields not edited by user: just use fresh DB values (from languoidToRow)
                });
                
                // CRITICAL: If any cells still have edits (conflicts), mark row as hasChanges
                if (hasAnyEdits) {
                  updatedRow.hasChanges = true;
                }
              }
              // DON'T use updateRowAfterSave here - it will reset originalValue and isEdited!
              // Instead, replace the entire rows array to preserve our conflict state
              const currentRows = [...rows]; // Get current rows from Redux state
              const rowIndex = currentRows.findIndex(r => r.id === rowId);
              if (rowIndex !== -1) {
                currentRows[rowIndex] = updatedRow;
                dispatch(initializeSpreadsheet({ modelName: 'languoid', rows: currentRows }));
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
        // CRITICAL: Match saved languoids back to editedRows by order
        // The backend processes rows sequentially, so response.saved[i] corresponds to editedRows[i]
        // (excluding any rows that had validation errors and weren't saved)
        
        let savedIndex = 0;
        for (let i = 0; i < editedRows.length; i++) {
          const oldRow = editedRows[i];
          
          // Skip rows that weren't saved (had conflicts)
          // We need to check if this row's ID (for existing) or name (for draft) is in the saved list
          const wasSaved = response.saved.some((saved: Languoid) => {
            if (oldRow.isDraft) {
              // For drafts, check by glottocode (unique) or name
              return saved.glottocode === oldRow.cells.glottocode?.value || 
                     saved.name === oldRow.cells.name?.value;
            } else {
              // For existing rows, check by ID
              return saved.id === oldRow.id;
            }
          });
          
          if (!wasSaved) {
            continue; // Skip this row - it wasn't saved (validation error or conflict)
          }
          
          // Get the corresponding saved languoid
          const savedLanguoid = response.saved[savedIndex];
          savedIndex++;
          
          // Skip conflict rows (already handled above)
          if (conflictRowIds.has(savedLanguoid.id)) {
            continue;
          }
          
          // Update the row with saved data
          const newRow = languoidToRow(savedLanguoid);
          dispatch(updateRowAfterSave({ oldId: oldRow.id, newRow }));
        }
        
        if (conflicts.length === 0) {
        dispatch(setSuccessMessage(`Successfully saved ${response.saved.length} languoid(s)`));
          // Clear undo/redo history after successful save
          dispatch(clearHistory());
          // Clear checkbox selections after successful save
          dispatch(clearAllSelections());
        } else {
          dispatch(setSuccessMessage(
            `Successfully saved ${response.saved.length} languoid(s). ` +
            `${conflicts.length} row(s) had conflicts.`
          ));
          // Note: Don't clear history when there are conflicts - user might want to undo conflict resolution
        }
      } else {
        dispatch(setError(`Save failed: ${response.errors.join(', ')}`));
      }
  };
  
  const handleUndo = useCallback(() => {
    // Show spinner cursor for large undo operations
    document.body.style.cursor = 'wait';
    
    // Use setTimeout to allow cursor to update before Redux state change
    setTimeout(() => {
      dispatch(undo());
      document.body.style.cursor = '';
    }, 0);
  }, [dispatch]);
  
  const handleRedo = useCallback(() => {
    // Show spinner cursor for large redo operations
    document.body.style.cursor = 'wait';
    
    // Use setTimeout to allow cursor to update before Redux state change
    setTimeout(() => {
      dispatch(redo());
      document.body.style.cursor = '';
    }, 0);
  }, [dispatch]);
  
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
  
  const handleRefresh = () => {
    if (isDirty) {
      // Show confirmation dialog if there are unsaved changes
      setShowRefreshConfirm(true);
    } else {
      // No unsaved changes, refresh immediately
      loadLanguoids();
    }
  };
  
  const handleRefreshConfirm = () => {
    setShowRefreshConfirm(false);
    loadLanguoids();
  };
  
  const handleRefreshCancel = () => {
    setShowRefreshConfirm(false);
  };
  
  const handleCloseSnackbar = () => {
    dispatch(setSuccessMessage(null));
  };
  
  // Check if validation is in progress
  const isValidating = validatingCells.length > 0;
  
  return (
    <Box 
      sx={{ 
        height: 'calc(100vh - 64px)', 
        p: 2,
        // Apply wait cursor when validation is in progress
        cursor: isValidating ? 'wait' : 'default',
        '& *': {
          cursor: isValidating ? 'wait !important' : undefined,
        },
      }}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(setError(null))}>
          {error}
        </Alert>
      )}
      
      <AdaptiveSpreadsheetGrid
        rows={rows}
        columns={LANGUOID_COLUMNS}
        loading={loading}
        saving={saving}
        onCellChange={handleCellChange}
        onBatchCellChange={handleBatchCellChange}
        onToggleRowSelection={handleToggleRowSelection}
        onToggleAllSelection={handleToggleAllSelection}
        onAddRow={handleAddRow}
        onSave={handleSave}
        onRefresh={handleRefresh}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        modelName="Languages"
        scrollToRowId={scrollToRowId}
      />
      
      {/* Success message snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        message={successMessage}
      />
      
      {/* Refresh confirmation dialog */}
      <Dialog
        open={showRefreshConfirm}
        onClose={handleRefreshCancel}
        aria-labelledby="refresh-dialog-title"
        aria-describedby="refresh-dialog-description"
      >
        <DialogTitle id="refresh-dialog-title">
          Unsaved Changes
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="refresh-dialog-description">
            You have unsaved changes. Refreshing will discard all changes. Are you sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRefreshCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleRefreshConfirm} color="error" autoFocus>
            Discard & Refresh
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Save all confirmation dialog */}
      <Dialog
        open={showSaveAllConfirm}
        onClose={() => setShowSaveAllConfirm(false)}
        aria-labelledby="save-all-dialog-title"
        aria-describedby="save-all-dialog-description"
      >
        <DialogTitle id="save-all-dialog-title">
          Save All Changed Rows?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="save-all-dialog-description">
            No rows are currently selected. Do you want to save all {rows.filter(r => r.hasChanges).length} changed row(s)?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveAllConfirm(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleSaveAllConfirmed} color="primary" variant="contained" autoFocus>
            Save All
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Validation error dialog */}
      <Dialog
        open={showValidationErrors}
        onClose={() => setShowValidationErrors(false)}
        aria-labelledby="validation-error-dialog-title"
        aria-describedby="validation-error-dialog-description"
        maxWidth="md"
        fullWidth
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
                          color: 'error'
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
          <Button onClick={() => setShowValidationErrors(false)} color="primary" variant="contained" autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

