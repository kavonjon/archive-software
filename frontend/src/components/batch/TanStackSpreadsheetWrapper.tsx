/**
 * TanStackSpreadsheet Wrapper
 * 
 * Adapts TanStackSpreadsheet to match SpreadsheetGrid's interface for drop-in replacement.
 * Adds toolbar with buttons for save, refresh, add row, etc.
 */

import React from 'react';
import { Box, Paper, Toolbar, Button, Typography, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { Add as AddIcon, Save as SaveIcon, Refresh as RefreshIcon, Undo as UndoIcon, Redo as RedoIcon } from '@mui/icons-material';
import { TanStackSpreadsheet } from './TanStackSpreadsheet';
import { SpreadsheetRow, ColumnConfig } from '../../types/spreadsheet';

interface TanStackSpreadsheetWrapperProps {
  /** Rows of data */
  rows: SpreadsheetRow[];
  
  /** Column configuration */
  columns: ColumnConfig[];
  
  /** Loading state */
  loading?: boolean;
  
  /** Saving state */
  saving?: boolean;
  
  /** Callback when cell value changes */
  onCellChange: (rowId: string | number, fieldName: string, newValue: any, newText?: string) => void;
  
  /** Optional: Callback for batch cell changes (paste operations) */
  onBatchCellChange?: (changes: Array<{ rowId: string | number; fieldName: string; newValue: any; newText?: string }>, description: string) => void;
  
  /** Optional: Callback when row selection is toggled */
  onToggleRowSelection?: (rowId: string | number, shiftKey: boolean) => void;
  
  /** Optional: Callback when all rows selection is toggled */
  onToggleAllSelection?: () => void;
  
  /** Callback to add new row */
  onAddRow?: () => void;
  
  /** Callback to delete selected rows */
  onDeleteRows?: () => void;
  
  /** Callback to save changes */
  onSave?: () => void;
  
  /** Callback to refresh data */
  onRefresh?: () => void;
  
  /** Callback for undo */
  onUndo?: () => void;
  
  /** Callback for redo */
  onRedo?: () => void;
  
  /** Can undo? (disable button if false) */
  canUndo?: boolean;
  
  /** Can redo? (disable button if false) */
  canRedo?: boolean;
  
  /** Model name for display */
  modelName: string;
}

export const TanStackSpreadsheetWrapper: React.FC<TanStackSpreadsheetWrapperProps> = ({
  rows,
  columns,
  loading = false,
  saving = false,
  onCellChange,
  onBatchCellChange,
  onToggleRowSelection,
  onToggleAllSelection,
  onAddRow,
  onDeleteRows,
  onSave,
  onRefresh,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  modelName,
}) => {
  // Count rows with changes
  const changedRowsCount = rows.filter(row => row.hasChanges).length;
  const hasChanges = changedRowsCount > 0;
  
  // Count selected rows
  const selectedRowsCount = rows.filter(row => row.isSelected).length;
  const selectedChangedRowsCount = rows.filter(row => row.isSelected && row.hasChanges).length;

  // Adapter: SpreadsheetGrid passes (rowId, fieldName, newValue, newText)
  // TanStackSpreadsheet passes (rowId, fieldName, newValue)
  // We need to extract text from newValue if it's an object
  const handleCellChange = (rowId: string | number, fieldName: string, newValue: any) => {
    let text = '';
    
    if (typeof newValue === 'object' && newValue !== null && 'text' in newValue) {
      // Complex cell type (relationship, multiselect, etc.)
      text = newValue.text;
      onCellChange(rowId, fieldName, newValue.value, text);
    } else {
      // Simple value - need to derive text
      const column = columns.find(c => c.fieldName === fieldName);
      
      // For select type, look up the label from choices
      if (column?.cellType === 'select' && column.choices) {
        const choice = column.choices.find(c => c.value === newValue);
        text = choice ? choice.label : String(newValue || '');
      } else {
        text = String(newValue || '');
      }
      
      onCellChange(rowId, fieldName, newValue, text);
    }
  };

  // Adapter for batch cell changes
  const handleBatchCellChange = onBatchCellChange ? (
    (changes: Array<{ rowId: string | number; fieldName: string; newValue: any }>, description: string) => {
      // Transform changes to include text
      const transformedChanges = changes.map(change => {
        let text = '';
        
        if (typeof change.newValue === 'object' && change.newValue !== null && 'text' in change.newValue) {
          text = change.newValue.text;
          return { ...change, newValue: change.newValue.value, newText: text };
        } else {
          const column = columns.find(c => c.fieldName === change.fieldName);
          
          if (column?.cellType === 'select' && column.choices) {
            const choice = column.choices.find(c => c.value === change.newValue);
            text = choice ? choice.label : String(change.newValue || '');
          } else {
            text = String(change.newValue || '');
          }
          
          return { ...change, newText: text };
        }
      });
      
      onBatchCellChange(transformedChanges, description);
    }
  ) : undefined;

  return (
    <Paper elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Toolbar sx={{ borderBottom: 1, borderColor: 'divider', gap: 1 }}>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {modelName}
          {loading && <CircularProgress size={20} sx={{ ml: 2 }} />}
          {hasChanges && !loading && (
            <Typography component="span" variant="body2" sx={{ ml: 2, color: 'warning.main' }}>
              ({changedRowsCount} unsaved change{changedRowsCount !== 1 ? 's' : ''})
            </Typography>
          )}
          {selectedRowsCount > 0 && (
            <Typography component="span" variant="body2" sx={{ ml: 2, color: 'info.main', fontWeight: 'medium' }}>
              {selectedRowsCount} selected
              {selectedChangedRowsCount > 0 && ` (${selectedChangedRowsCount} with changes)`}
            </Typography>
          )}
        </Typography>
        
        {/* Undo/Redo buttons */}
        {onUndo && (
          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <IconButton
                onClick={onUndo}
                disabled={!canUndo || loading || saving}
                size="small"
                color="default"
              >
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        
        {onRedo && (
          <Tooltip title="Redo (Ctrl+Y)">
            <span>
              <IconButton
                onClick={onRedo}
                disabled={!canRedo || loading || saving}
                size="small"
                color="default"
              >
                <RedoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        
        {onAddRow && (
          <Button
            startIcon={<AddIcon />}
            onClick={onAddRow}
            disabled={loading || saving}
            variant="outlined"
            size="small"
          >
            Add Row
          </Button>
        )}
        
        {onRefresh && (
          <Button
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={loading || saving}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
        )}
        
        {onSave && (
          <Button
            startIcon={<SaveIcon />}
            onClick={onSave}
            disabled={loading || saving || !hasChanges}
            variant="contained"
            size="small"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </Toolbar>
      
      {/* Spreadsheet */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <TanStackSpreadsheet
          rows={rows}
          columns={columns}
          onCellChange={handleCellChange}
          onBatchCellChange={handleBatchCellChange}
          onToggleRowSelection={onToggleRowSelection}
          onToggleAllSelection={onToggleAllSelection}
          modelName={modelName}
          height="100%"
        />
      </Box>
      
      {/* Loading overlay */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 1000,
          }}
        >
          <CircularProgress size={60} />
        </Box>
      )}
    </Paper>
  );
};

