/**
 * MemoizedSpreadsheetCell Component
 * Phase 6.3: Row-Level Memoization Optimization
 * 
 * A heavily memoized cell component that only re-renders when:
 * 1. The cell's data changes
 * 2. The cell's selection state changes
 * 3. The cell's editing state changes
 * 
 * This prevents unnecessary re-renders of 10K rows when only 1-2 cells change.
 */

import React from 'react';
import { SpreadsheetCell, ColumnConfig } from '../../types/spreadsheet';
import { CellEditor } from './CellEditor';
import styles from './TanStackSpreadsheet.module.css';

interface MemoizedSpreadsheetCellProps {
  /** The cell data (may be undefined during row updates) */
  cell: SpreadsheetCell | undefined;
  
  /** Column configuration */
  columnConfig: ColumnConfig;
  
  /** Row index */
  rowIndex: number;
  
  /** Column ID */
  columnId: string;
  
  /** Is this cell currently selected? */
  isSelected: boolean;
  
  /** Is this cell currently being edited? */
  isEditing: boolean;
  
  /** Is this cell in a selection range? */
  isInRange: boolean;
  
  /** Is this cell readonly? */
  isReadonly: boolean;
  
  /** Cell click handler */
  onCellClick: (rowIndex: number, columnId: string, shiftKey: boolean) => void;
  
  /** Cell double-click handler */
  onCellDoubleClick: (rowIndex: number, columnId: string) => void;
  
  /** Cell commit handler */
  onCellCommit: (rowIndex: number, columnId: string, newValue: any, moveDown: boolean) => void;
  
  /** Cell cancel handler */
  onCellCancel: () => void;
  
  /** Mouse down handler */
  onMouseDown: (e: React.MouseEvent, rowIndex: number, columnId: string) => void;
  
  /** Mouse enter handler */
  onMouseEnter: (e: React.MouseEvent, rowIndex: number, columnId: string) => void;
  
  /** Next cell ref for blur handling */
  nextCellRef: React.MutableRefObject<{ rowIndex: number; columnId: string } | null>;
  
  /** Set selected cell (for blur handling) */
  setSelectedCell: (cell: { rowIndex: number; columnId: string }) => void;
  
  /** Editing cell state */
  editingCell: { rowIndex: number; columnId: string } | null;
  
  /** Debug mode */
  debug?: boolean;
}

/**
 * Custom equality function for React.memo
 * Only re-render if:
 * - Cell data changed
 * - Selection state changed
 * - Editing state changed
 * - Range state changed
 */
function arePropsEqual(
  prevProps: MemoizedSpreadsheetCellProps,
  nextProps: MemoizedSpreadsheetCellProps
): boolean {
  // If either cell is undefined, check if they're both undefined
  if (!prevProps.cell || !nextProps.cell) {
    return prevProps.cell === nextProps.cell; // Only skip if both are undefined
  }
  
  // Check if cell data changed (most important check)
  // We need to do a deep comparison for cell changes
  const cellChanged = 
    prevProps.cell.value !== nextProps.cell.value ||
    prevProps.cell.text !== nextProps.cell.text ||
    prevProps.cell.validationState !== nextProps.cell.validationState ||
    prevProps.cell.isEdited !== nextProps.cell.isEdited ||
    prevProps.cell.hasConflict !== nextProps.cell.hasConflict;
  
  if (cellChanged) {
    return false; // Data changed, must re-render
  }
  
  // Check if selection state changed
  if (prevProps.isSelected !== nextProps.isSelected) {
    return false; // Selection changed, must re-render
  }
  
  // Check if editing state changed
  if (prevProps.isEditing !== nextProps.isEditing) {
    return false; // Editing changed, must re-render
  }
  
  // Check if range state changed
  if (prevProps.isInRange !== nextProps.isInRange) {
    return false; // Range changed, must re-render
  }
  
  // All relevant props are equal, skip re-render
  return true;
}

const MemoizedSpreadsheetCellComponent: React.FC<MemoizedSpreadsheetCellProps> = ({
  cell,
  columnConfig,
  rowIndex,
  columnId,
  isSelected,
  isEditing,
  isInRange,
  isReadonly,
  onCellClick,
  onCellDoubleClick,
  onCellCommit,
  onCellCancel,
  onMouseDown,
  onMouseEnter,
  nextCellRef,
  setSelectedCell,
  editingCell,
  debug = false,
}) => {
  // Handle undefined cell (can happen during row updates)
  if (!cell) {
    return (
      <div 
        role="gridcell"
        className={styles.dataCell}
        aria-label="Loading..."
      >
        <div className={styles.cellDisplay}></div>
      </div>
    );
  }
  
  // Phase 5: Validation and dirty state
  const isInvalid = cell.validationState === 'invalid';
  const isValidating = cell.validationState === 'validating';
  const isEdited = cell.isEdited === true;
  const hasConflict = cell.hasConflict === true;
  const hasError = isInvalid && cell.validationError;
  
  // Build tooltip text
  let tooltipText: string | undefined;
  if (hasConflict) {
    tooltipText = 'This cell was modified by another user. Your changes have been preserved. Click Save to overwrite.';
  } else if (hasError) {
    tooltipText = cell.validationError;
  }
  
  return (
    <div 
      role="gridcell"
      aria-label={`${columnConfig.header}: ${cell.text || 'empty'}`}
      aria-selected={isSelected}
      aria-readonly={isReadonly}
      aria-invalid={isInvalid}
      aria-busy={isValidating}
      aria-describedby={hasError ? `error-${rowIndex}-${columnId}` : undefined}
      tabIndex={isSelected ? 0 : -1}
      className={`${styles.dataCell} ${isSelected ? styles.selected : ''} ${isInRange ? styles.inRange : ''} ${isEditing ? styles.editing : ''} ${isReadonly ? styles.readonly : ''} ${hasConflict ? styles.conflict : ''} ${isInvalid ? styles.invalid : ''} ${isValidating ? styles.validating : ''} ${isEdited ? styles.edited : ''}`}
      data-changed={isEdited ? 'true' : 'false'}
      data-error={isInvalid ? 'true' : 'false'}
      data-readonly={isReadonly ? 'true' : 'false'}
      title={tooltipText}
      onMouseDown={(e) => onMouseDown(e, rowIndex, columnId)}
      onMouseEnter={(e) => onMouseEnter(e, rowIndex, columnId)}
      onClick={(e) => {
        e.stopPropagation();
        onCellClick(rowIndex, columnId, e.shiftKey);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onCellDoubleClick(rowIndex, columnId);
      }}
    >
      {isEditing ? (
        <div className={styles.cellEditor}>
          <CellEditor
            cell={cell}
            columnConfig={columnConfig}
            onCommit={(newValue, moveDown = false) => {
              onCellCommit(rowIndex, columnId, newValue, moveDown);
              
              // If user clicked on another cell, select it now
              if (nextCellRef.current) {
                const nextCell = nextCellRef.current;
                nextCellRef.current = null;
                setSelectedCell(nextCell);
              }
            }}
            onCancel={() => {
              onCellCancel();
            }}
            debug={debug}
          />
        </div>
      ) : (
        <div 
          className={styles.cellDisplay}
          title={cell.text || ''} // Show full text on hover
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onCellDoubleClick(rowIndex, columnId);
          }}
        >
          {cell.text || ''}
        </div>
      )}
    </div>
  );
};

/**
 * Memoized cell component export
 * Uses custom equality check to minimize re-renders
 */
export const MemoizedSpreadsheetCell = React.memo(
  MemoizedSpreadsheetCellComponent,
  arePropsEqual
);

