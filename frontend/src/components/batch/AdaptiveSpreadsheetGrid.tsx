/**
 * Adaptive Spreadsheet Grid
 * 
 * Now uses TanStack Table implementation exclusively.
 * Kept as a thin wrapper for compatibility with existing code.
 */

import React from 'react';
import { TanStackSpreadsheetWrapper } from './TanStackSpreadsheetWrapper';
import { SpreadsheetRow, ColumnConfig } from '../../types/spreadsheet';

interface AdaptiveSpreadsheetGridProps {
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

/**
 * Wrapper component for TanStack-based spreadsheet.
 * Previously switched between ReactGrid and TanStack based on feature flag,
 * now exclusively uses TanStack after successful migration.
 */
export const AdaptiveSpreadsheetGrid: React.FC<AdaptiveSpreadsheetGridProps> = (props) => {
  return <TanStackSpreadsheetWrapper {...props} />;
};

