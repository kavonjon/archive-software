/**
 * Stage 1 Phase 1: Languoid Batch Editor
 * 
 * Model-specific wrapper for batch editing Languoids
 * Provides column configuration and languoid-specific logic
 */

import React, { useEffect, useCallback, useState } from 'react';
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
  Button 
} from '@mui/material';
import { SpreadsheetGrid } from '../batch';
import { ColumnConfig, SpreadsheetRow, SpreadsheetCell } from '../../types/spreadsheet';
import { RootState } from '../../store/store';
import {
  initializeSpreadsheet,
  updateCell,
  setLoading,
  setError,
  setSuccessMessage,
  addDraftRow,
  resetSpreadsheet,
  setSaving,
  updateRowAfterSave,
} from '../../store/batchSpreadsheetSlice';
import { languoidsAPI, Languoid, LANGUOID_LEVEL_CHOICES } from '../../services/api';
import { validateLanguoidField } from '../../services/validationAPI';
import { useFieldValidation } from '../../hooks';
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
    fieldName: 'glottocode',
    header: 'Glottocode',
    cellType: 'text',
    width: 120,
  },
  {
    fieldName: 'iso',
    header: 'ISO 639-3',
    cellType: 'text',
    width: 100,
  },
  {
    fieldName: 'level_nal',
    header: 'Level',
    cellType: 'select',
    width: 120,
    choices: LANGUOID_LEVEL_CHOICES,
  },
  {
    fieldName: 'family_languoid',
    header: 'Family',
    cellType: 'relationship',
    width: 200,
    relationshipEndpoint: '/internal/v1/languoids/',
  },
  {
    fieldName: 'pri_subgroup_languoid',
    header: 'Primary Subgroup',
    cellType: 'relationship',
    width: 200,
    relationshipEndpoint: '/internal/v1/languoids/',
  },
  {
    fieldName: 'sec_subgroup_languoid',
    header: 'Secondary Subgroup',
    cellType: 'relationship',
    width: 200,
    relationshipEndpoint: '/internal/v1/languoids/',
  },
  {
    fieldName: 'parent_languoid',
    header: 'Parent Languoid',
    cellType: 'relationship',
    width: 200,
    relationshipEndpoint: '/internal/v1/languoids/',
  },
  {
    fieldName: 'language_languoid',
    header: 'Language (for dialects)',
    cellType: 'relationship',
    width: 200,
    relationshipEndpoint: '/internal/v1/languoids/',
  },
  {
    fieldName: 'dialects_languoids',
    header: 'Dialects (M2M)',
    cellType: 'multiselect',
    width: 300,
    relationshipEndpoint: '/internal/v1/languoids/',
  },
  {
    fieldName: 'description',
    header: 'Description',
    cellType: 'text',
    width: 300,
  },
  {
    fieldName: 'alt_name',
    header: 'Alternate Name',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'alt_names',
    header: 'Alternate Names',
    cellType: 'stringarray',
    width: 250,
  },
  {
    fieldName: 'longitude',
    header: 'Longitude',
    cellType: 'decimal',
    width: 150,
  },
  {
    fieldName: 'latitude',
    header: 'Latitude',
    cellType: 'decimal',
    width: 150,
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
    
    // For 'level_nal' field, use human-readable display value for text
    let displayValue = value?.toString() || '';
    if (fieldName === 'level_nal' && languoid.level_display) {
      displayValue = languoid.level_display;
    }
    
    // For FK languoid fields, format as "name (glottocode)"
    const relationshipFields: Record<string, { nameField: string; glottocodeField: string }> = {
      'family_languoid': { nameField: 'family_name', glottocodeField: 'family_glottocode' },
      'pri_subgroup_languoid': { nameField: 'pri_subgroup_name', glottocodeField: 'pri_subgroup_glottocode' },
      'sec_subgroup_languoid': { nameField: 'sec_subgroup_name', glottocodeField: 'sec_subgroup_glottocode' },
      'parent_languoid': { nameField: 'parent_name', glottocodeField: 'parent_glottocode' },
      'language_languoid': { nameField: 'language_name', glottocodeField: 'language_glottocode' },
    };
    
    if (relationshipFields[fieldName]) {
      const { nameField, glottocodeField } = relationshipFields[fieldName];
      const formatted = formatLanguoidDisplay(value, languoid, nameField, glottocodeField);
      displayValue = formatted.displayValue;
      value = formatted.actualValue;
    }
    
    // For M2M fields (dialects_languoids), handle array of IDs and display as comma-separated names
    if (fieldName === 'dialects_languoids') {
      if (Array.isArray(value) && value.length > 0) {
        // Value is array of IDs or objects
        const ids: number[] = [];
        const names: string[] = [];
        
        value.forEach((item: any) => {
          if (typeof item === 'object' && item !== null) {
            // Full object returned
            ids.push(item.id);
            const name = item.name || 'Unknown';
            const glottocode = item.glottocode;
            names.push(glottocode ? `${name} (${glottocode})` : name);
          } else if (typeof item === 'number') {
            // Just ID
            ids.push(item);
          }
        });
        
        value = ids;
        displayValue = names.length > 0 ? names.join(', ') : `${ids.length} selected`;
      } else {
        value = null;
        displayValue = '';
      }
    }
    
    // For StringArray fields (alt_names), ensure value is array and format display
    if (fieldName === 'alt_names') {
      if (Array.isArray(value) && value.length > 0) {
        // Keep value as string array
        // Display as comma-separated for short arrays, or count for long arrays
        displayValue = value.length <= 2 ? value.join(', ') : `${value.length} items`;
      } else {
        value = [];
        displayValue = '';
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
    isSelected: false,
  };
};

/**
 * Create a new draft row with default values
 */
const createDraftRow = (): SpreadsheetRow => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  LANGUOID_COLUMNS.forEach(col => {
    // Set default value for level (required field)
    const defaultValue = col.fieldName === 'level_nal' ? 'language' : null;
    
    // For level field, use human-readable text
    let defaultText = defaultValue?.toString() || '';
    if (col.fieldName === 'level_nal' && defaultValue) {
      const choice = LANGUOID_LEVEL_CHOICES.find(c => c.value === defaultValue);
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
    isSelected: false,
  };
};

export const LanguoidBatchEditor: React.FC = () => {
  const dispatch = useDispatch();
  
  // Local state for refresh confirmation dialog
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  
  const { rows, loading, saving, error, successMessage, isDirty } = useSelector(
    (state: RootState) => state.batchSpreadsheet
  );
  
  // Set up validation hook
  const { validateField, cleanup: cleanupValidation } = useFieldValidation({
    validateFn: validateLanguoidField,
    debounceMs: 500,
  });
  
  // Load languoids on mount
  useEffect(() => {
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
      
      // Fetch languoids from API
      const response = await languoidsAPI.list();
      const languoids = response.results;
      
      // Convert to spreadsheet rows
      const spreadsheetRows = languoids.map(languoidToRow);
      
      // Initialize spreadsheet
      dispatch(initializeSpreadsheet({
        modelName: 'Languoid',
        rows: spreadsheetRows,
      }));
    } catch (err: any) {
      dispatch(setError(err.response?.data?.detail || 'Failed to load languoids'));
    } finally {
      dispatch(setLoading(false));
    }
  };
  
  const handleCellChange = useCallback((
    rowId: string | number,
    fieldName: string,
    newValue: any,
    newText: string
  ) => {
    // CRITICAL: Extract originalValue BEFORE Redux update
    // originalValue represents the DB value and should never be mutated by cell edits
    const row = rows.find(r => r.id.toString() === rowId.toString());
    const originalValue = row?.cells[fieldName]?.originalValue;
    
    // Special handling for relationship fields BEFORE short-circuit
    const column = LANGUOID_COLUMNS.find(col => col.fieldName === fieldName);
    if (column?.cellType === 'relationship') {
      // Check if user pasted arbitrary text (value is null but text is not empty)
      if (newValue === null && newText && newText.trim() !== '') {
        // Invalid relationship data (arbitrary text pasted)
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: newText,
            validationState: 'invalid',
            validationError: 'Invalid relationship value. Please select from dropdown.',
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
          },
        }));
        return;
      }
    }
    
    // Special handling for stringarray fields BEFORE short-circuit
    if (column?.cellType === 'stringarray') {
      // Check if value is not an array (should always be array)
      if (!Array.isArray(newValue)) {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: [],
            text: '',
            validationState: 'invalid',
            validationError: 'Invalid string array format.',
          },
        }));
        return;
      }
      
      // Validate that all items are strings and non-empty
      const hasInvalidItems = newValue.some(item => typeof item !== 'string' || item.trim() === '');
      if (hasInvalidItems) {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: newValue,
            text: newText,
            validationState: 'invalid',
            validationError: 'String array contains empty or invalid items.',
          },
        }));
        return;
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
              text: newText,
              validationState: 'invalid',
              validationError: 'Invalid decimal format. Use numbers like: 42, -17.5, 122.419906',
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
          text: newText,
          validationState: 'valid',
          validationError: undefined,
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
      },
    }));
    
    // Trigger backend validation, passing originalValue for context
    validateField(rowId, fieldName, newValue, originalValue);
  }, [dispatch, validateField, rows]);
  
  const handleAddRow = useCallback(() => {
    const newRow = createDraftRow();
    dispatch(addDraftRow(newRow));
  }, [dispatch]);
  
  const handleSave = async () => {
    try {
      dispatch(setSaving(true));
      dispatch(setError(null));
      
      // Collect only edited rows (hasChanges = true)
      const editedRows = rows.filter(row => row.hasChanges);
      
      if (editedRows.length === 0) {
        dispatch(setSuccessMessage('No changes to save'));
        return;
      }
      
      // Check for validation errors
      const hasErrors = editedRows.some(row => row.hasErrors);
      if (hasErrors) {
        dispatch(setError('Cannot save: some rows have validation errors (red highlighting)'));
        return;
      }
      
      // Convert SpreadsheetRows to API format
      const rowsToSave = editedRows.map(row => {
        const rowData: any = { id: row.id };
        
        if (row.isDraft) {
          // NEW ROWS: Only send non-empty values (required fields always sent)
          Object.keys(row.cells).forEach(fieldName => {
            const cell = row.cells[fieldName];
            const value = cell.value;
            
            // Always include required fields (name, level_nal)
            if (fieldName === 'name' || fieldName === 'level_nal') {
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
            }
            // Unchanged fields → omitted entirely, preserves DB value
            // Columns not in spreadsheet → not in row.cells → not sent
          });
        }
        
        return rowData;
      });
      
      // Call save-batch API
      const response = await languoidsAPI.saveBatch(rowsToSave);
      
      if (response.success) {
        // Update rows with saved data
        response.saved.forEach((savedLanguoid) => {
          // Find the corresponding row in editedRows
          const oldRow = editedRows.find(row => {
            // Match by ID (for existing) or by finding draft row
            if (row.isDraft) {
              // For drafts, we need to match by data (since ID is draft-uuid)
              return row.cells.name?.value === savedLanguoid.name;
            } else {
              return row.id === savedLanguoid.id;
            }
          });
          
          if (oldRow) {
            const newRow = languoidToRow(savedLanguoid);
            dispatch(updateRowAfterSave({ oldId: oldRow.id, newRow }));
          }
        });
        
        dispatch(setSuccessMessage(`Successfully saved ${response.saved.length} languoid(s)`));
      } else {
        dispatch(setError(`Save failed: ${response.errors.join(', ')}`));
      }
    } catch (err: any) {
      console.error('Save error:', err);
      dispatch(setError(err.response?.data?.errors?.join(', ') || err.message || 'Failed to save changes'));
    } finally {
      dispatch(setSaving(false));
    }
  };
  
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
  
  return (
    <Box sx={{ height: 'calc(100vh - 64px)', p: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(setError(null))}>
          {error}
        </Alert>
      )}
      
      <SpreadsheetGrid
        rows={rows}
        columns={LANGUOID_COLUMNS}
        loading={loading}
        saving={saving}
        onCellChange={handleCellChange}
        onAddRow={handleAddRow}
        onSave={handleSave}
        onRefresh={handleRefresh}
        modelName="Languages"
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
            You have unsaved changes. Refreshing will lose these changes. Do you want to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRefreshCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleRefreshConfirm} color="primary" variant="contained" autoFocus>
            Refresh
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

