/**
 * Stage 1: Batch Editing - Reusable Spreadsheet Grid Component
 * 
 * Core component wrapping ReactGrid for batch editing functionality
 * This is model-agnostic and reused across all batch editors
 */

import React, { useCallback, useMemo } from 'react';
import { ReactGrid, Column, Row, CellChange, TextCell, HeaderCell, CheckboxCell, DefaultCellTypes } from '@silevis/reactgrid';
import '@silevis/reactgrid/styles.css';
import { Box, Paper, Toolbar, Button, Typography, CircularProgress } from '@mui/material';
import { Add as AddIcon, Save as SaveIcon, Refresh as RefreshIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { SpreadsheetRow, ColumnConfig } from '../../types/spreadsheet';
import { 
  SelectCell, SelectCellTemplate, 
  RelationshipCell, RelationshipCellTemplate, 
  MultiSelectCell, MultiSelectCellTemplate,
  DateCell, DateCellTemplate,
  BooleanCell, BooleanCellTemplate,
  StringArrayCell, StringArrayCellTemplate,
  DecimalCell, DecimalCellTemplate
} from './cells';

// Define custom cell types
type CustomCellTypes = DefaultCellTypes | SelectCell | RelationshipCell | MultiSelectCell | DateCell | BooleanCell | StringArrayCell | DecimalCell;

// Custom cell templates
const customCellTemplates = {
  select: new SelectCellTemplate(),
  relationship: new RelationshipCellTemplate(),
  multiselect: new MultiSelectCellTemplate(),
  date: new DateCellTemplate(),
  boolean: new BooleanCellTemplate(),
  stringarray: new StringArrayCellTemplate(),
  decimal: new DecimalCellTemplate(),
};

interface SpreadsheetGridProps {
  /** Rows of data */
  rows: SpreadsheetRow[];
  
  /** Column configuration */
  columns: ColumnConfig[];
  
  /** Loading state */
  loading?: boolean;
  
  /** Saving state */
  saving?: boolean;
  
  /** Callback when cell value changes */
  onCellChange: (rowId: string | number, fieldName: string, newValue: any, newText: string) => void;
  
  /** Callback to add new row */
  onAddRow?: () => void;
  
  /** Callback to delete selected rows */
  onDeleteRows?: () => void;
  
  /** Callback to save changes */
  onSave?: () => void;
  
  /** Callback to refresh data */
  onRefresh?: () => void;
  
  /** Model name for display */
  modelName: string;
}

const SpreadsheetGridComponent: React.FC<SpreadsheetGridProps> = ({
  rows,
  columns,
  loading = false,
  saving = false,
  onCellChange,
  onAddRow,
  onDeleteRows,
  onSave,
  onRefresh,
  modelName,
}) => {
  // Convert column configs to ReactGrid columns
  const gridColumns = useMemo((): Column[] => {
    return [
      // Selection checkbox column
      { columnId: 'select', width: 50 },
      // Data columns
      ...columns.map(col => ({
        columnId: col.fieldName,
        width: col.width || 150,
      })),
    ];
  }, [columns]);
  
  // Convert spreadsheet rows to ReactGrid rows
  const gridRows = useMemo((): Row<CustomCellTypes>[] => {
    return [
      // Header row
      {
        rowId: 'header',
        cells: [
          { type: 'header', text: '' } as HeaderCell, // Selection column header
          ...columns.map((col): HeaderCell => ({
            type: 'header',
            text: col.header,
          })),
        ],
      },
      // Data rows
      ...rows.map((row): Row<CustomCellTypes> => ({
        rowId: row.id.toString(),
        cells: [
          // Selection checkbox
          {
            type: 'checkbox',
            checked: row.isSelected || false,
          } as CheckboxCell,
          // Data cells
          ...columns.map((col): CustomCellTypes => {
            const cell = row.cells[col.fieldName];
            
            if (!cell) {
              return {
                type: 'text',
                text: '',
              } as TextCell;
            }
            
            // Check cell type from column config or cell
            const cellType = cell.type || col.cellType || 'text';
            
            // Create appropriate cell based on type
            if (cellType === 'select' && col.choices) {
              // SelectCell
              const selectCell: SelectCell = {
                type: 'select',
                value: cell.value || '',
                text: cell.text,
                choices: col.choices.map(c => ({
                  value: typeof c === 'string' ? c : c.value,
                  label: typeof c === 'string' ? c : c.label,
                })),
                validationState: cell.validationState,
                isEdited: cell.isEdited,
              };
              
              // Add styling classes
              const className: string[] = [];
              if (cell.isEdited) className.push('cell-edited');
              if (cell.validationState === 'invalid') className.push('cell-invalid');
              if (cell.validationState === 'validating') className.push('cell-validating');
              if (cell.hasConflict) className.push('cell-conflict');
              
              if (className.length > 0) {
                return {
                  ...selectCell,
                  className: className.join(' '),
                } as SelectCell;
              }
              
              return selectCell;
            }
            
            if (cellType === 'relationship' && col.relationshipEndpoint) {
              // RelationshipCell
              const relationshipCell: RelationshipCell = {
                type: 'relationship',
                value: cell.value !== undefined ? cell.value : null,
                text: cell.text,
                relationshipEndpoint: col.relationshipEndpoint,
                validationState: cell.validationState,
                isEdited: cell.isEdited,
              };
              
              // Add styling classes
              const className: string[] = [];
              if (cell.isEdited) className.push('cell-edited');
              if (cell.validationState === 'invalid') className.push('cell-invalid');
              if (cell.validationState === 'validating') className.push('cell-validating');
              if (cell.hasConflict) className.push('cell-conflict');
              
              if (className.length > 0) {
                return {
                  ...relationshipCell,
                  className: className.join(' '),
                } as RelationshipCell;
              }
              
              return relationshipCell;
            }
            
            if (cellType === 'multiselect' && col.relationshipEndpoint) {
              // MultiSelectCell
              const multiSelectCell: MultiSelectCell = {
                type: 'multiselect',
                value: Array.isArray(cell.value) ? cell.value : null,
                text: cell.text,
                relationshipEndpoint: col.relationshipEndpoint,
                validationState: cell.validationState,
                isEdited: cell.isEdited,
              };
              
              // Add styling classes
              const className: string[] = [];
              if (cell.isEdited) className.push('cell-edited');
              if (cell.validationState === 'invalid') className.push('cell-invalid');
              if (cell.validationState === 'validating') className.push('cell-validating');
              if (cell.hasConflict) className.push('cell-conflict');
              
              if (className.length > 0) {
                return {
                  ...multiSelectCell,
                  className: className.join(' '),
                } as MultiSelectCell;
              }
              
              return multiSelectCell;
            }
            
            if (cellType === 'date') {
              // DateCell
              const dateCell: DateCell = {
                type: 'date',
                value: cell.value || '',
                text: cell.text,
                validationState: cell.validationState,
                isEdited: cell.isEdited,
              };
              
              // Add styling classes
              const className: string[] = [];
              if (cell.isEdited) className.push('cell-edited');
              if (cell.validationState === 'invalid') className.push('cell-invalid');
              if (cell.validationState === 'validating') className.push('cell-validating');
              if (cell.hasConflict) className.push('cell-conflict');
              
              if (className.length > 0) {
                return {
                  ...dateCell,
                  className: className.join(' '),
                } as DateCell;
              }
              
              return dateCell;
            }
            
            if (cellType === 'boolean') {
              // BooleanCell
              const booleanCell: BooleanCell = {
                type: 'boolean',
                value: cell.value || '',
                text: cell.text,
                booleanValue: cell.value,
                validationState: cell.validationState,
                isEdited: cell.isEdited,
              };
              
              // Add styling classes
              const className: string[] = [];
              if (cell.isEdited) className.push('cell-edited');
              if (cell.validationState === 'invalid') className.push('cell-invalid');
              if (cell.validationState === 'validating') className.push('cell-validating');
              if (cell.hasConflict) className.push('cell-conflict');
              
              if (className.length > 0) {
                return {
                  ...booleanCell,
                  className: className.join(' '),
                } as BooleanCell;
              }
              
              return booleanCell;
            }
            
            if (cellType === 'stringarray') {
              // StringArrayCell
              const stringArrayCell: StringArrayCell = {
                type: 'stringarray',
                value: Array.isArray(cell.value) ? cell.value : [],
                text: cell.text,
                validationState: cell.validationState,
                isEdited: cell.isEdited,
              };
              
              // Add styling classes
              const className: string[] = [];
              if (cell.isEdited) className.push('cell-edited');
              if (cell.validationState === 'invalid') className.push('cell-invalid');
              if (cell.validationState === 'validating') className.push('cell-validating');
              if (cell.hasConflict) className.push('cell-conflict');
              
              if (className.length > 0) {
                return {
                  ...stringArrayCell,
                  className: className.join(' '),
                } as StringArrayCell;
              }
              
              return stringArrayCell;
            }
            
            if (cellType === 'decimal') {
              // DecimalCell
              const decimalCell: DecimalCell = {
                type: 'decimal',
                value: typeof cell.value === 'number' ? String(cell.value) : (cell.value || ''),
                text: cell.text,
                validationState: cell.validationState,
                isEdited: cell.isEdited,
              };
              
              // Add styling classes
              const className: string[] = [];
              if (cell.isEdited) className.push('cell-edited');
              if (cell.validationState === 'invalid') className.push('cell-invalid');
              if (cell.validationState === 'validating') className.push('cell-validating');
              if (cell.hasConflict) className.push('cell-conflict');
              
              if (className.length > 0) {
                return {
                  ...decimalCell,
                  className: className.join(' '),
                } as DecimalCell;
              }
              
              return decimalCell;
            }
            
            // Default: TextCell
            const textCell: TextCell = {
              type: 'text',
              text: cell.text,
              nonEditable: cell.readOnly || col.readOnly,
            };
            
            // Add styling based on cell state
            const className: string[] = [];
            if (cell.isEdited) className.push('cell-edited');
            if (cell.validationState === 'invalid') className.push('cell-invalid');
            if (cell.validationState === 'validating') className.push('cell-validating');
            if (cell.hasConflict) className.push('cell-conflict');
            
            if (className.length > 0) {
              return {
                ...textCell,
                className: className.join(' '),
              } as TextCell;
            }
            
            return textCell;
          }),
        ],
      })),
    ];
  }, [rows, columns]);
  
  // Handle cell changes
  const handleChanges = useCallback((changes: CellChange<CustomCellTypes>[]) => {
    changes.forEach(change => {
      // Skip header row
      if (change.rowId === 'header') return;
      
      // Handle selection checkbox
      if (change.columnId === 'select' && change.type === 'checkbox') {
        // TODO: Dispatch toggleRowSelection action
        return;
      }
      
      // Handle text cell changes
      if (change.type === 'text') {
        const fieldName = change.columnId as string;
        const rowId = change.rowId;
        const newText = change.newCell.text;
        
        // Check if this is actually a relationship column
        const column = columns.find(col => col.fieldName === fieldName);
        if (column && column.cellType === 'relationship') {
          // User pasted text into a relationship cell
          // Treat this as invalid data (arbitrary text is not a valid relationship ID)
          // Pass null as value (invalid), and the text for display/validation
          onCellChange(rowId, fieldName, null, newText);
        } else {
          // Call parent callback
          onCellChange(rowId, fieldName, newText, newText);
        }
      }
      
      // Handle select cell changes
      if (change.type === 'select') {
        const fieldName = change.columnId as string;
        const rowId = change.rowId;
        const newValue = change.newCell.value;
        const newText = change.newCell.text;
        
        // Call parent callback
        onCellChange(rowId, fieldName, newValue, newText);
      }
      
      // Handle relationship cell changes
      if (change.type === 'relationship') {
        const fieldName = change.columnId as string;
        const rowId = change.rowId;
        const newValue = change.newCell.value;
        const newText = change.newCell.text;
        
        // Check if user pasted arbitrary text (value is null but text is not empty)
        // This happens when text is pasted into a RelationshipCell
        // The validation will be handled in LanguoidBatchEditor.handleCellChange
        
        // Call parent callback
        onCellChange(rowId, fieldName, newValue, newText);
      }
      
      // Handle multiselect cell changes
      if (change.type === 'multiselect') {
        const fieldName = change.columnId as string;
        const rowId = change.rowId;
        const newValue = change.newCell.value; // Array of IDs or null
        const newText = change.newCell.text;
        
        // Call parent callback
        onCellChange(rowId, fieldName, newValue, newText);
      }
      
      // Handle date cell changes
      if (change.type === 'date') {
        const fieldName = change.columnId as string;
        const rowId = change.rowId;
        const dateCell = change.newCell as DateCell;
        const newValue = dateCell.value; // Date string
        const newText = dateCell.text;
        
        // Call parent callback
        onCellChange(rowId, fieldName, newValue, newText);
      }
      
      // Handle boolean cell changes
      if (change.type === 'boolean') {
        const fieldName = change.columnId as string;
        const rowId = change.rowId;
        const booleanCell = change.newCell as BooleanCell;
        const newValue = booleanCell.booleanValue; // true/false/null
        const newText = booleanCell.text;
        
        // Call parent callback
        onCellChange(rowId, fieldName, newValue, newText);
      }
      
      // Handle stringarray cell changes
      if (change.type === 'stringarray') {
        const fieldName = change.columnId as string;
        const rowId = change.rowId;
        const stringArrayCell = change.newCell as StringArrayCell;
        const newValue = stringArrayCell.value; // Array of strings
        const newText = stringArrayCell.text;
        
        // Call parent callback
        onCellChange(rowId, fieldName, newValue, newText);
      }
      
      if (change.type === 'decimal') {
        const fieldName = change.columnId as string;
        const rowId = change.rowId;
        const decimalCell = change.newCell as DecimalCell;
        const newValue = decimalCell.value; // String representation
        const newText = decimalCell.text;
        
        // Call parent callback
        onCellChange(rowId, fieldName, newValue, newText);
      }
    });
  }, [onCellChange, columns]);
  
  // Count edited and selected rows
  const editedCount = rows.filter(r => r.hasChanges).length;
  const selectedCount = rows.filter(r => r.isSelected).length;
  const errorCount = rows.filter(r => r.hasErrors).length;
  
  return (
    <Paper elevation={1} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Toolbar sx={{ borderBottom: 1, borderColor: 'divider', gap: 2 }}>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Batch Edit {modelName}
        </Typography>
        
        {/* Status indicators */}
        {editedCount > 0 && (
          <Typography variant="body2" color="warning.main">
            {editedCount} row{editedCount !== 1 ? 's' : ''} edited
          </Typography>
        )}
        {errorCount > 0 && (
          <Typography variant="body2" color="error.main">
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </Typography>
        )}
        
        {/* Action buttons */}
        {onAddRow && (
          <Button
            startIcon={<AddIcon />}
            onClick={onAddRow}
            disabled={loading || saving}
            size="small"
          >
            Add Row
          </Button>
        )}
        
        {onDeleteRows && selectedCount > 0 && (
          <Button
            startIcon={<DeleteIcon />}
            onClick={onDeleteRows}
            disabled={loading || saving}
            color="error"
            size="small"
          >
            Delete ({selectedCount})
          </Button>
        )}
        
        {onRefresh && (
          <Button
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={loading || saving}
            size="small"
          >
            Refresh
          </Button>
        )}
        
        {onSave && (
          <Button
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={onSave}
            disabled={loading || saving || editedCount === 0 || errorCount > 0}
            variant="contained"
            size="small"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </Toolbar>
      
      {/* Grid container */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', position: 'relative' }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <ReactGrid
            rows={gridRows}
            columns={gridColumns}
            onCellsChanged={handleChanges}
            customCellTemplates={customCellTemplates}
            enableRangeSelection
            enableFillHandle
            enableColumnSelection
            enableRowSelection
          />
        )}
      </Box>
      
      {/* Custom cell styling */}
      <style>{`
        .cell-edited {
          background-color: #fff9c4 !important;
        }
        .cell-invalid {
          background-color: #ffebee !important;
          border: 1px solid #f44336 !important;
        }
        .cell-validating {
          background-color: #e3f2fd !important;
        }
        .cell-conflict {
          background-color: #fff3e0 !important;
          border: 1px solid #ff9800 !important;
        }
      `}</style>
    </Paper>
  );
};

// Memoize the component to prevent unnecessary re-renders
// Only re-render when rows, columns, or callbacks actually change
export const SpreadsheetGrid = React.memo(SpreadsheetGridComponent);

