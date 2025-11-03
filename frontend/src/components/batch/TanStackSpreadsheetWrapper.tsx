/**
 * TanStackSpreadsheet Wrapper
 * 
 * Adapts TanStackSpreadsheet to match SpreadsheetGrid's interface for drop-in replacement.
 * Adds toolbar with buttons for save, refresh, add row, etc.
 */

import React, { useRef } from 'react';
import { Box, Paper, Toolbar, Button, Typography, CircularProgress, IconButton, Tooltip, Snackbar, Alert, Fade } from '@mui/material';
import { Add as AddIcon, Save as SaveIcon, Refresh as RefreshIcon, Undo as UndoIcon, Redo as RedoIcon, UploadFile as UploadFileIcon } from '@mui/icons-material';
import { TanStackSpreadsheet, TanStackSpreadsheetHandle } from './TanStackSpreadsheet';
import { SpreadsheetRow, ColumnConfig } from '../../types/spreadsheet';
import { useImportSpreadsheet } from '../../hooks/useImportSpreadsheet';
import { InfoIconLink } from '../common/InfoIconLink';

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
  // Import functionality
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spreadsheetRef = useRef<TanStackSpreadsheetHandle>(null);
  const { processFile, isImporting, importProgress, importError, clearImportError } = useImportSpreadsheet();
  const [showImportSuccess, setShowImportSuccess] = React.useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = React.useState('');
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const result = await processFile(file);
      
      if (result) {
        // Success!
        const totalAffected = result.newRows.length + result.modifiedRows.length + result.unchangedRows.length;
        setImportSuccessMessage(`Imported ${totalAffected} row${totalAffected !== 1 ? 's' : ''}`);
        setShowImportSuccess(true);
        
        // Phase 9: Auto-scroll to first affected row
        const firstAffectedId = result.modifiedRows[0]?.rowId || result.newRows[0]?.id;
        if (firstAffectedId && spreadsheetRef.current) {
          // Small delay to allow Redux state to update and rows to render
          setTimeout(() => {
            spreadsheetRef.current?.scrollToRow(firstAffectedId);
          }, 100);
        }
      }
      
      // Reset input so same file can be imported again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Handle drag-and-drop file
  const handleFileDrop = async (file: File) => {
    const result = await processFile(file);
    
    if (result) {
      // Success!
      const totalAffected = result.newRows.length + result.modifiedRows.length + result.unchangedRows.length;
      setImportSuccessMessage(`Imported ${totalAffected} row${totalAffected !== 1 ? 's' : ''}`);
      setShowImportSuccess(true);
      
      // Phase 9: Auto-scroll to first affected row
      const firstAffectedId = result.modifiedRows[0]?.rowId || result.newRows[0]?.id;
      if (firstAffectedId && spreadsheetRef.current) {
        // Small delay to allow Redux state to update and rows to render
        setTimeout(() => {
          spreadsheetRef.current?.scrollToRow(firstAffectedId);
        }, 100);
      }
    }
  };
  
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
            disabled={loading || saving || isImporting}
            variant="outlined"
            size="small"
          >
            Add Row
          </Button>
        )}
        
        {/* Import Spreadsheet Button */}
        <Button
          startIcon={<UploadFileIcon />}
          onClick={handleUploadClick}
          disabled={loading || saving || isImporting}
          variant="outlined"
          size="small"
        >
          Import Spreadsheet
        </Button>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        
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
          <>
            <Button
              startIcon={<SaveIcon />}
              onClick={onSave}
              disabled={loading || saving || !hasChanges}
              variant="contained"
              size="small"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <InfoIconLink anchor="languoid-batch" tooltip="Learn about batch editing languoids" />
          </>
        )}
      </Toolbar>
      
      {/* Spreadsheet */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        <TanStackSpreadsheet
          ref={spreadsheetRef}
          rows={rows}
          columns={columns}
          onCellChange={handleCellChange}
          onBatchCellChange={handleBatchCellChange}
          onToggleRowSelection={onToggleRowSelection}
          onToggleAllSelection={onToggleAllSelection}
          onFileDrop={handleFileDrop}
          modelName={modelName}
          height="100%"
        />
        
        {/* Import Loading Overlay */}
        {isImporting && importProgress && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={48} />
              {importProgress.message && (
                <Typography variant="body1" sx={{ mt: 2 }}>
                  {importProgress.message}
                </Typography>
              )}
              {importProgress.percentage !== undefined && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {importProgress.percentage}%
                </Typography>
              )}
            </Box>
          </Box>
        )}
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
      
      {/* Import Success Snackbar */}
      <Snackbar
        open={showImportSuccess}
        autoHideDuration={4000}
        onClose={() => setShowImportSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={Fade}
      >
        <Alert severity="success" variant="filled" onClose={() => setShowImportSuccess(false)}>
          {importSuccessMessage}
        </Alert>
      </Snackbar>
      
      {/* Import Error Snackbar */}
      <Snackbar
        open={!!importError}
        autoHideDuration={5000}
        onClose={clearImportError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={Fade}
      >
        <Alert severity="error" variant="filled" onClose={clearImportError}>
          {importError}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

