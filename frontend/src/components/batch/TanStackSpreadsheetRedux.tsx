/**
 * TanStackSpreadsheet - Redux Connected Version
 * 
 * Wrapper that connects TanStackSpreadsheet to Redux state management
 * This is Phase 1.4: Integration with Redux State
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { updateCell } from '../../store/batchSpreadsheetSlice';
import { TanStackSpreadsheet } from './TanStackSpreadsheet';
import { ColumnConfig } from '../../types/spreadsheet';

export interface TanStackSpreadsheetReduxProps {
  /** Column configuration */
  columns: ColumnConfig[];
  
  /** Model name (for context/debugging) */
  modelName: string;
  
  /** Optional: Height of container (default: 600px) */
  height?: number | string;
  
  /** Optional: Enable debug logging */
  debug?: boolean;
}

/**
 * Redux-connected TanStackSpreadsheet
 * 
 * Reads rows from Redux state and dispatches updateCell actions
 */
export const TanStackSpreadsheetRedux: React.FC<TanStackSpreadsheetReduxProps> = ({
  columns,
  modelName,
  height,
  debug = false,
}) => {
  const dispatch = useDispatch();
  
  // Get rows from Redux state
  const rows = useSelector((state: RootState) => state.batchSpreadsheet.rows);
  
  // Handle cell changes by dispatching to Redux
  const handleCellChange = useCallback((rowId: string | number, fieldName: string, newValue: any) => {
    if (debug) {
      console.log(`[TanStackSpreadsheetRedux] Cell change: rowId=${rowId}, field=${fieldName}, value=`, newValue);
    }
    
    // Find the row to get current cell state
    const row = rows.find(r => r.id.toString() === rowId.toString());
    if (!row) {
      console.warn(`[TanStackSpreadsheetRedux] Row not found: ${rowId}`);
      return;
    }
    
    const currentCell = row.cells[fieldName];
    if (!currentCell) {
      console.warn(`[TanStackSpreadsheetRedux] Cell not found: ${fieldName} in row ${rowId}`);
      return;
    }
    
    // Compute text representation
    const text = typeof newValue === 'object' && newValue !== null
      ? (newValue.name || JSON.stringify(newValue))
      : String(newValue || '');
    
    // Dispatch updateCell action
    dispatch(updateCell({
      rowId,
      fieldName,
      cell: {
        value: newValue,
        text,
        isEdited: true, // Will be recomputed in reducer based on originalValue
      },
    }));
  }, [dispatch, rows, debug]);
  
  return (
    <TanStackSpreadsheet
      rows={rows}
      columns={columns}
      onCellChange={handleCellChange}
      modelName={modelName}
      height={height}
      debug={debug}
    />
  );
};

export default TanStackSpreadsheetRedux;

