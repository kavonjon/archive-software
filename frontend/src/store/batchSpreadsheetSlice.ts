/**
 * Stage 1: Batch Editing - Redux Slice
 * 
 * Manages state for the smart spreadsheet batch editing interface
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BatchSpreadsheetState, SpreadsheetRow, SpreadsheetCell } from '../types/spreadsheet';

const initialState: BatchSpreadsheetState = {
  modelName: null,
  rows: [],
  loading: false,
  saving: false,
  error: null,
  successMessage: null,
  validatingCells: [],
  isDirty: false,
};

const batchSpreadsheetSlice = createSlice({
  name: 'batchSpreadsheet',
  initialState,
  reducers: {
    // Initialize spreadsheet with model data
    initializeSpreadsheet: (state, action: PayloadAction<{ modelName: string; rows: SpreadsheetRow[] }>) => {
      state.modelName = action.payload.modelName;
      state.rows = action.payload.rows;
      state.isDirty = false;
      state.error = null;
      state.successMessage = null;
    },
    
    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    // Set saving state
    setSaving: (state, action: PayloadAction<boolean>) => {
      state.saving = action.payload;
    },
    
    // Set error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    // Set success message
    setSuccessMessage: (state, action: PayloadAction<string | null>) => {
      state.successMessage = action.payload;
    },
    
    // Update a single cell
    updateCell: (state, action: PayloadAction<{ rowId: string | number; fieldName: string; cell: Partial<SpreadsheetCell> }>) => {
      const { rowId, fieldName, cell } = action.payload;
      console.log('Redux updateCell:', { rowId, fieldName, cell });
      
      // Find row - handle both string and number IDs
      const row = state.rows.find(r => {
        // Compare as strings to handle both number IDs and draft-* IDs
        return r.id.toString() === rowId.toString();
      });
      
      if (row && row.cells[fieldName]) {
        console.log('Before update:', row.cells[fieldName]);
        const currentCell = row.cells[fieldName];
        
        // Update cell properties
        row.cells[fieldName] = {
          ...currentCell,
          ...cell,
        };
        
        // Determine if cell is actually edited by comparing to originalValue
        const updatedCell = row.cells[fieldName];
        const valueChanged = updatedCell.value !== updatedCell.originalValue;
        
        // Set isEdited based on comparison with original
        updatedCell.isEdited = valueChanged;
        
        console.log('After update:', {
          cell: updatedCell,
          valueChanged,
          currentValue: updatedCell.value,
          originalValue: updatedCell.originalValue
        });
        
        // Update row's hasChanges based on whether ANY cell differs from original
        row.hasChanges = Object.values(row.cells).some(c => c.value !== c.originalValue);
        
        // Update global isDirty state
        state.isDirty = state.rows.some(r => r.hasChanges);
        
        // Update row error state
        row.hasErrors = Object.values(row.cells).some(c => c.validationState === 'invalid');
      } else {
        console.log('Row or cell not found!', { rowExists: !!row, cellExists: row?.cells[fieldName] });
      }
    },
    
    // Add validating cell
    addValidatingCell: (state, action: PayloadAction<{ rowId: string | number; fieldName: string }>) => {
      const key = `${action.payload.rowId}-${action.payload.fieldName}`;
      if (!state.validatingCells.includes(key)) {
        state.validatingCells.push(key);
      }
    },
    
    // Remove validating cell
    removeValidatingCell: (state, action: PayloadAction<{ rowId: string | number; fieldName: string }>) => {
      const key = `${action.payload.rowId}-${action.payload.fieldName}`;
      state.validatingCells = state.validatingCells.filter(k => k !== key);
    },
    
    // Add a new draft row
    addDraftRow: (state, action: PayloadAction<SpreadsheetRow>) => {
      state.rows.push(action.payload);
      state.isDirty = true;
    },
    
    // Remove a row
    removeRow: (state, action: PayloadAction<string | number>) => {
      state.rows = state.rows.filter(r => r.id !== action.payload);
      state.isDirty = state.rows.some(r => r.hasChanges);
    },
    
    // Toggle row selection
    toggleRowSelection: (state, action: PayloadAction<string | number>) => {
      const row = state.rows.find(r => r.id === action.payload);
      if (row) {
        row.isSelected = !row.isSelected;
      }
    },
    
    // Select all rows
    selectAllRows: (state) => {
      state.rows.forEach(row => {
        row.isSelected = true;
      });
    },
    
    // Deselect all rows
    deselectAllRows: (state) => {
      state.rows.forEach(row => {
        row.isSelected = false;
      });
    },
    
    // Update row after successful save
    updateRowAfterSave: (state, action: PayloadAction<{ oldId: string | number; newRow: SpreadsheetRow }>) => {
      const { oldId, newRow } = action.payload;
      const index = state.rows.findIndex(r => r.id === oldId);
      
      if (index !== -1) {
        // Replace with saved row
        state.rows[index] = {
          ...newRow,
          hasChanges: false,
          isSelected: false,
        };
        
        // Update original values for all cells
        Object.values(state.rows[index].cells).forEach(cell => {
          cell.originalValue = cell.value;
          cell.isEdited = false;
        });
        
        // Recalculate global isDirty state
        state.isDirty = state.rows.some(r => r.hasChanges);
      }
    },
    
    // Clear all changes (reset to original)
    clearChanges: (state) => {
      state.rows.forEach(row => {
        if (!row.isDraft) {
          // Reset cells to original values
          Object.values(row.cells).forEach(cell => {
            if (cell.isEdited) {
              cell.value = cell.originalValue;
              cell.text = cell.value?.toString() || '';
              cell.isEdited = false;
              cell.validationState = 'valid';
              cell.validationError = undefined;
              cell.hasConflict = false;
            }
          });
          row.hasChanges = false;
          row.hasErrors = false;
        }
      });
      
      // Remove all draft rows
      state.rows = state.rows.filter(r => !r.isDraft);
      
      state.isDirty = false;
      state.error = null;
      state.successMessage = null;
    },
    
    // Reset spreadsheet state
    resetSpreadsheet: () => initialState,
  },
});

export const {
  initializeSpreadsheet,
  setLoading,
  setSaving,
  setError,
  setSuccessMessage,
  updateCell,
  addValidatingCell,
  removeValidatingCell,
  addDraftRow,
  removeRow,
  toggleRowSelection,
  selectAllRows,
  deselectAllRows,
  updateRowAfterSave,
  clearChanges,
  resetSpreadsheet,
} = batchSpreadsheetSlice.actions;

export default batchSpreadsheetSlice.reducer;

