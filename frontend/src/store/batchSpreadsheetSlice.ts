/**
 * Stage 1: Batch Editing - Redux Slice
 * 
 * Manages state for the smart spreadsheet batch editing interface
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BatchSpreadsheetState, SpreadsheetRow, SpreadsheetCell, HistoryEntry, CellChange } from '../types/spreadsheet';

const initialState: BatchSpreadsheetState = {
  modelName: null,
  rows: [],
  loading: false,
  saving: false,
  error: null,
  successMessage: null,
  validatingCells: [],
  isDirty: false,
  undoStack: [],
  redoStack: [],
  maxHistorySize: 50,
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
      
      // Find row - handle both string and number IDs
      const row = state.rows.find(r => {
        // Compare as strings to handle both number IDs and draft-* IDs
        return r.id.toString() === rowId.toString();
      });
      
      if (row && row.cells[fieldName]) {
        const currentCell = row.cells[fieldName];
        
        // Record history BEFORE making changes
        const historyChange: CellChange = {
          rowId,
          fieldName,
          oldValue: currentCell.value,
          oldText: currentCell.text,
          newValue: cell.value !== undefined ? cell.value : currentCell.value,
          newText: cell.text !== undefined ? cell.text : currentCell.text,
          oldValidationState: currentCell.validationState,
          oldValidationError: currentCell.validationError,
        };
        
        // Only record if value actually changed
        if (historyChange.oldValue !== historyChange.newValue || 
            historyChange.oldText !== historyChange.newText) {
          state.undoStack.push({
            type: 'single',
            changes: [historyChange],
            timestamp: Date.now(),
            description: `Edit ${fieldName}`,
          });
          
          // Limit stack size
          if (state.undoStack.length > state.maxHistorySize) {
            state.undoStack.shift(); // Remove oldest
          }
          
          // Clear redo stack (new change invalidates redo)
          state.redoStack = [];
        }
        
        // Update cell properties
        row.cells[fieldName] = {
          ...currentCell,
          ...cell,
        };
        
        // Determine if cell is actually edited by comparing to originalValue
        const updatedCell = row.cells[fieldName];
        
        // Helper: Check if value is empty
        const isEmpty = (val: any): boolean => {
          if (val === null || val === undefined || val === '') return true;
          if (Array.isArray(val) && val.length === 0) return true;
          return false;
        };
        
        // For draft rows: isEdited = true only if value is non-empty
        // For existing rows: isEdited = true if value differs from original
        if (row.isDraft) {
          updatedCell.isEdited = !isEmpty(updatedCell.value);
        } else {
          updatedCell.isEdited = updatedCell.value !== updatedCell.originalValue;
        }
        
        // Update row's hasChanges based on whether ANY cell differs from original (or has non-empty value for drafts)
        if (row.isDraft) {
          row.hasChanges = Object.values(row.cells).some(c => !isEmpty(c.value));
        } else {
          row.hasChanges = Object.values(row.cells).some(c => c.value !== c.originalValue);
        }
        
        // NOTE: isDirty computation removed from hot path for performance
        // It will be computed on-demand when needed (e.g., before refresh)
        
        // Update row error state
        row.hasErrors = Object.values(row.cells).some(c => c.validationState === 'invalid');
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
      // Note: isDirty will be computed on-demand when needed
    },
    
    // Add multiple draft rows (for bulk import)
    addDraftRows: (state, action: PayloadAction<SpreadsheetRow[]>) => {
      state.rows.push(...action.payload);
      // Note: isDirty will be computed on-demand when needed
    },
    
    // Select a row (set isSelected = true)
    selectRow: (state, action: PayloadAction<string | number>) => {
      const row = state.rows.find(r => r.id.toString() === action.payload.toString());
      if (row) {
        row.isSelected = true;
      }
    },
    
    // Remove a row
    removeRow: (state, action: PayloadAction<string | number>) => {
      state.rows = state.rows.filter(r => r.id !== action.payload);
      // Note: isDirty will be computed on-demand when needed
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
        };
        
        // Update original values for all cells
        Object.values(state.rows[index].cells).forEach(cell => {
          cell.originalValue = cell.value;
          cell.isEdited = false;
        });
        
        // Note: isDirty will be computed on-demand when needed
      }
    },
    
    // Batch update multiple cells (for paste operations)
    batchUpdateCells: (state, action: PayloadAction<{ 
      changes: Array<{ rowId: string | number; fieldName: string; cell: Partial<SpreadsheetCell> }>;
      description: string;
    }>) => {
      const { changes, description } = action.payload;
      const historyChanges: CellChange[] = [];
      
      // Apply each change and record history
      changes.forEach(({ rowId, fieldName, cell }) => {
        const row = state.rows.find(r => r.id.toString() === rowId.toString());
        
        if (row && row.cells[fieldName]) {
          const currentCell = row.cells[fieldName];
          
          // Record history BEFORE making changes
          const historyChange: CellChange = {
            rowId,
            fieldName,
            oldValue: currentCell.value,
            oldText: currentCell.text,
            newValue: cell.value !== undefined ? cell.value : currentCell.value,
            newText: cell.text !== undefined ? cell.text : currentCell.text,
            oldValidationState: currentCell.validationState,
            oldValidationError: currentCell.validationError,
          };
          
          // Only record if value actually changed
          if (historyChange.oldValue !== historyChange.newValue || 
              historyChange.oldText !== historyChange.newText) {
            historyChanges.push(historyChange);
          }
          
          // Update cell properties
          row.cells[fieldName] = {
            ...currentCell,
            ...cell,
          };
          
          // Determine if cell is actually edited by comparing to originalValue
          const updatedCell = row.cells[fieldName];
          
          // Helper: Check if value is empty
          const isEmpty = (val: any): boolean => {
            if (val === null || val === undefined || val === '') return true;
            if (Array.isArray(val) && val.length === 0) return true;
            return false;
          };
          
          // For draft rows: isEdited = true only if value is non-empty
          // For existing rows: isEdited = true if value differs from original
          if (row.isDraft) {
            updatedCell.isEdited = !isEmpty(updatedCell.value);
          } else {
            updatedCell.isEdited = updatedCell.value !== updatedCell.originalValue;
          }
          
          // Update row's hasChanges based on whether ANY cell differs from original (or has non-empty value for drafts)
          if (row.isDraft) {
            row.hasChanges = Object.values(row.cells).some(c => !isEmpty(c.value));
          } else {
            row.hasChanges = Object.values(row.cells).some(c => c.value !== c.originalValue);
          }
          
          // Update row error state
          row.hasErrors = Object.values(row.cells).some(c => c.validationState === 'invalid');
        }
      });
      
      // Record batch history if any changes were made
      if (historyChanges.length > 0) {
        state.undoStack.push({
          type: 'batch',
          changes: historyChanges,
          timestamp: Date.now(),
          description,
        });
        
        // Limit stack size
        if (state.undoStack.length > state.maxHistorySize) {
          state.undoStack.shift(); // Remove oldest
        }
        
        // Clear redo stack (new change invalidates redo)
        state.redoStack = [];
      }
    },
    
    // Import spreadsheet changes (new rows + modified cells)
    // This creates a single undoable action for the entire import
    importSpreadsheetChanges: (state, action: PayloadAction<{
      newRows: SpreadsheetRow[];
      cellChanges: Array<{ rowId: string | number; fieldName: string; cell: Partial<SpreadsheetCell> }>;
      description: string;
    }>) => {
      const { newRows, cellChanges, description } = action.payload;
      const historyChanges: CellChange[] = [];
      const addedRowIds: Array<string | number> = [];
      
      // Add new draft rows
      if (newRows.length > 0) {
        state.rows.push(...newRows);
        addedRowIds.push(...newRows.map(r => r.id));
      }
      
      // Apply cell changes
      cellChanges.forEach(({ rowId, fieldName, cell }) => {
        const row = state.rows.find(r => r.id.toString() === rowId.toString());
        
        if (row && row.cells[fieldName]) {
          const currentCell = row.cells[fieldName];
          
          // Record history BEFORE making changes
          const historyChange: CellChange = {
            rowId,
            fieldName,
            oldValue: currentCell.value,
            oldText: currentCell.text,
            newValue: cell.value !== undefined ? cell.value : currentCell.value,
            newText: cell.text !== undefined ? cell.text : currentCell.text,
            oldValidationState: currentCell.validationState,
            oldValidationError: currentCell.validationError,
          };
          
          // Only record if value actually changed
          if (historyChange.oldValue !== historyChange.newValue || 
              historyChange.oldText !== historyChange.newText) {
            historyChanges.push(historyChange);
          }
          
          // Update cell properties
          row.cells[fieldName] = {
            ...currentCell,
            ...cell,
          };
          
          // Determine if cell is actually edited
          const updatedCell = row.cells[fieldName];
          
          // Helper: Check if value is empty
          const isEmpty = (val: any): boolean => {
            if (val === null || val === undefined || val === '') return true;
            if (Array.isArray(val) && val.length === 0) return true;
            return false;
          };
          
          // For draft rows: isEdited = true only if value is non-empty
          // For existing rows: isEdited = true if value differs from original
          if (row.isDraft) {
            updatedCell.isEdited = !isEmpty(updatedCell.value);
          } else {
            updatedCell.isEdited = updatedCell.value !== updatedCell.originalValue;
          }
          
          // Update row's hasChanges
          if (row.isDraft) {
            row.hasChanges = Object.values(row.cells).some(c => !isEmpty(c.value));
          } else {
            row.hasChanges = Object.values(row.cells).some(c => c.value !== c.originalValue);
          }
          
          // Update row error state
          row.hasErrors = Object.values(row.cells).some(c => c.validationState === 'invalid');
        }
      });
      
      // Estimate the size of this history entry (rough approximation)
      // Each change is ~200 bytes (row ID, field name, two values, two texts)
      // Adding ~100 bytes per added row ID
      const estimatedSize = (historyChanges.length * 200) + (addedRowIds.length * 100);
      const maxAllowedSize = state.maxHistorySize * 10000; // ~500KB for 50-entry history
      
      // Only add to history if it won't overflow the entire history
      // If import is too large, it simply won't be undoable (graceful degradation)
      if (estimatedSize < maxAllowedSize && (historyChanges.length > 0 || addedRowIds.length > 0)) {
        state.undoStack.push({
          type: 'import',
          changes: historyChanges,
          addedRowIds,
          timestamp: Date.now(),
          description,
        });
        
        // Limit stack size
        if (state.undoStack.length > state.maxHistorySize) {
          state.undoStack.shift();
        }
        
        // Clear redo stack
        state.redoStack = [];
      }
    },
    
    // Undo last action
    undo: (state) => {
      if (state.undoStack.length === 0) return;
      
      const entry = state.undoStack.pop()!;
      
      // Revert all changes in the entry
      entry.changes.forEach(change => {
        const row = state.rows.find(r => r.id.toString() === change.rowId.toString());
        
        if (row && row.cells[change.fieldName]) {
          const cell = row.cells[change.fieldName];
          
          // Revert to old values
          cell.value = change.oldValue;
          cell.text = change.oldText;
          cell.validationState = change.oldValidationState || 'valid';
          cell.validationError = change.oldValidationError;
          
          // Recalculate isEdited
          cell.isEdited = cell.value !== cell.originalValue;
          
          // Update row's hasChanges
          row.hasChanges = Object.values(row.cells).some(c => c.value !== c.originalValue);
          
          // Update row error state
          row.hasErrors = Object.values(row.cells).some(c => c.validationState === 'invalid');
        }
      });
      
      // For import operations: remove any rows that were added
      if (entry.type === 'import' && entry.addedRowIds) {
        const rowIdsToRemove = new Set(entry.addedRowIds.map(id => id.toString()));
        state.rows = state.rows.filter(row => !rowIdsToRemove.has(row.id.toString()));
      }
      
      // Push to redo stack
      state.redoStack.push(entry);
      
      // Limit redo stack size
      if (state.redoStack.length > state.maxHistorySize) {
        state.redoStack.shift();
      }
    },
    
    // Redo last undone action
    redo: (state) => {
      if (state.redoStack.length === 0) return;
      
      const entry = state.redoStack.pop()!;
      
      // For import operations: re-add any rows that were removed
      if (entry.type === 'import' && entry.addedRowIds) {
        // Note: We need to reconstruct the rows from the changes
        // This is a limitation - we can only redo cell changes, not full row additions
        // For now, we'll just reapply the cell changes
        // A more complete solution would store full row data in the history entry
      }
      
      // Reapply all changes in the entry
      entry.changes.forEach(change => {
        const row = state.rows.find(r => r.id.toString() === change.rowId.toString());
        
        if (row && row.cells[change.fieldName]) {
          const cell = row.cells[change.fieldName];
          
          // Reapply new values
          cell.value = change.newValue;
          cell.text = change.newText;
          
          // Recalculate isEdited
          cell.isEdited = cell.value !== cell.originalValue;
          
          // Note: We don't restore validation state on redo, 
          // it will be recomputed if needed
          
          // Update row's hasChanges
          row.hasChanges = Object.values(row.cells).some(c => c.value !== c.originalValue);
          
          // Update row error state
          row.hasErrors = Object.values(row.cells).some(c => c.validationState === 'invalid');
        }
      });
      
      // Push back to undo stack
      state.undoStack.push(entry);
      
      // Limit undo stack size
      if (state.undoStack.length > state.maxHistorySize) {
        state.undoStack.shift();
      }
    },
    
    // Clear history (called after save)
    clearHistory: (state) => {
      state.undoStack = [];
      state.redoStack = [];
    },
    
    // Toggle row selection (checkbox)
    toggleRowSelection: (state, action: PayloadAction<string | number>) => {
      const row = state.rows.find(r => r.id.toString() === action.payload.toString());
      if (row) {
        row.isSelected = !row.isSelected;
      }
    },
    
    // Toggle all row selection (select all / deselect all)
    toggleAllRowSelection: (state) => {
      const allSelected = state.rows.every(r => r.isSelected);
      state.rows.forEach(r => {
        r.isSelected = !allSelected;
      });
    },
    
    // Select range of rows (for Shift+click)
    selectRowRange: (state, action: PayloadAction<{ startId: string | number; endId: string | number }>) => {
      const { startId, endId } = action.payload;
      const startIndex = state.rows.findIndex(r => r.id.toString() === startId.toString());
      const endIndex = state.rows.findIndex(r => r.id.toString() === endId.toString());
      
      if (startIndex !== -1 && endIndex !== -1) {
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        
        for (let i = minIndex; i <= maxIndex; i++) {
          state.rows[i].isSelected = true;
        }
      }
    },
    
    // Clear all selections
    clearAllSelections: (state) => {
      state.rows.forEach(r => {
        r.isSelected = false;
      });
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
  batchUpdateCells,
  importSpreadsheetChanges,
  undo,
  redo,
  clearHistory,
  toggleRowSelection,
  toggleAllRowSelection,
  selectRowRange,
  clearAllSelections,
  addValidatingCell,
  removeValidatingCell,
  addDraftRow,
  addDraftRows,
  selectRow,
  removeRow,
  updateRowAfterSave,
  clearChanges,
  resetSpreadsheet,
} = batchSpreadsheetSlice.actions;

export default batchSpreadsheetSlice.reducer;

