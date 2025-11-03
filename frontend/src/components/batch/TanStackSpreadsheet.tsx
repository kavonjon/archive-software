/**
 * TanStackSpreadsheet Component
 * 
 * A high-performance spreadsheet component built on TanStack Table + React Virtual.
 * Replaces ReactGrid for handling 10,000+ row datasets with virtualization.
 * 
 * Phase 1.1: Base Component with Virtualization
 */

import React, { useRef, useMemo, useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
  Row as TableRow,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Box } from '@mui/material';
import { ColumnConfig, SpreadsheetRow, CellType, SpreadsheetCell } from '../../types/spreadsheet';
import { CellEditor } from './CellEditor';
import { MemoizedSpreadsheetCell } from './MemoizedSpreadsheetCell';
import styles from './TanStackSpreadsheet.module.css';

// ============================================================================
// Cell Serialization Helpers (Smart Copy/Paste)
// ============================================================================

/**
 * Serialize a cell for clipboard storage
 * For complex types (relationship, multiselect, stringarray), embeds machine-readable value AND display text
 * For simple types (text, decimal), uses plain text
 */
const serializeCellForClipboard = (cell: SpreadsheetCell | undefined): string => {
  if (!cell) return '';
  
  switch (cell.type) {
    case 'relationship':
    case 'multiselect':
    case 'stringarray':
      // Store BOTH machine value AND display text for rich types
      // Format: __CELL__<type>__<json>__<text>__
      try {
        const jsonValue = JSON.stringify(cell.value);
        const displayText = cell.text || '';
        return `__CELL__${cell.type}__${jsonValue}__${displayText}__`;
      } catch (e) {
        // Fallback to text if JSON serialization fails
        return cell.text || '';
      }
    
    case 'select':
      // For select, copy the machine value (not display text)
      // This allows pasting between columns with same choices
      return cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
    
    case 'boolean':
      // For boolean, store the machine value (true/false/null)
      return cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
    
    default:
      // For text, decimal, readonly: use text representation
      return cell.text || '';
  }
};

/**
 * Deserialize clipboard text back to a cell value (with optional text)
 * Detects internal serialization format and extracts machine-readable value AND display text
 * Falls back to plain text for external pastes
 * 
 * Returns either:
 * - { value: any, text: string } for complex types with embedded text
 * - any (plain value) for simple types
 */
const deserializeCellFromClipboard = (text: string, targetCellType?: CellType): any => {
  if (!text) return null;
  
  // Try to parse internal format: __CELL__<type>__<json>__<text>__
  const internalFormatMatch = text.match(/^__CELL__(\w+)__(.+?)__(.*)__$/);
  
  if (internalFormatMatch) {
    const [, sourceType, jsonValue, displayText] = internalFormatMatch;
    
    try {
      // Parse JSON value
      const parsedValue = JSON.parse(jsonValue);
      
      // Type compatibility check
      if (targetCellType) {
        // Allow pasting between compatible types
        if (sourceType === targetCellType) {
          // Return object with both value and text for complex types
          if (sourceType === 'relationship' || sourceType === 'multiselect' || sourceType === 'stringarray') {
            return { value: parsedValue, text: displayText };
          }
          return parsedValue;
        }
        
        // Special case: allow pasting arrays into compatible array types
        if (Array.isArray(parsedValue)) {
          if (targetCellType === 'multiselect' || targetCellType === 'stringarray') {
            return { value: parsedValue, text: displayText };
          }
        }
      }
      
      // Default: return object with value and text for complex types
      if (sourceType === 'relationship' || sourceType === 'multiselect' || sourceType === 'stringarray') {
        return { value: parsedValue, text: displayText };
      }
      return parsedValue;
      
    } catch (e) {
      // JSON parse failed, treat as plain text
      return text;
    }
  }
  
  // No internal format detected - treat as plain text
  // This handles external pastes (from Excel, Sheets, etc.)
  return text;
};

// ============================================================================
// Types
// ============================================================================

export interface TanStackSpreadsheetHandle {
  /** Scroll to a specific row by ID */
  scrollToRow: (rowId: string | number) => void;
}

export interface TanStackSpreadsheetProps {
  /** Array of rows to display */
  rows: SpreadsheetRow[];
  
  /** Column configuration */
  columns: ColumnConfig[];
  
  /** Callback when cell value changes */
  onCellChange: (rowId: string | number, fieldName: string, newValue: any) => void;
  
  /** Optional: Callback for batch cell changes (paste operations) */
  onBatchCellChange?: (changes: Array<{ rowId: string | number; fieldName: string; newValue: any }>, description: string) => void;
  
  /** Optional: Callback when row selection is toggled */
  onToggleRowSelection?: (rowId: string | number, shiftKey: boolean) => void;
  
  /** Optional: Callback when all rows selection is toggled */
  onToggleAllSelection?: () => void;
  
  /** Optional: Callback when file is dropped for import */
  onFileDrop?: (file: File) => void;
  
  /** Model name (for context/debugging) */
  modelName: string;
  
  /** Optional: Height of container (default: 600px) */
  height?: number | string;
  
  /** Optional: Enable debug logging */
  debug?: boolean;
}

interface CellPosition {
  rowIndex: number;
  columnId: string;
}

// ============================================================================
// TanStackSpreadsheet Component
// ============================================================================

export const TanStackSpreadsheet = forwardRef<TanStackSpreadsheetHandle, TanStackSpreadsheetProps>(({
  rows,
  columns,
  onCellChange,
  onBatchCellChange,
  onToggleRowSelection,
  onToggleAllSelection,
  onFileDrop,
  modelName,
  height = 600,
  debug = false,
}, ref) => {
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  // ============================================================================
  // Refs & State
  // ============================================================================
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef<{ rowIndex: number; columnId: string; time: number } | null>(null);
  const nextCellRef = useRef<{ rowIndex: number; columnId: string } | null>(null); // Track cell to select after blur
  const renderCountRef = useRef(0);
  const isDraggingRef = useRef(false); // Track if user is drag-selecting
  
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<CellPosition | null>(null); // Where Shift+selection started
  const [selectionRange, setSelectionRange] = useState<{ start: CellPosition; end: CellPosition } | null>(null);
  
  // Track renders for performance monitoring
  renderCountRef.current++;
  
  // ============================================================================
  // Helper Functions
  // ============================================================================
  
  // Check if a cell is within the selection range
  const isCellInRange = useCallback((rowIndex: number, columnId: string): boolean => {
    if (!selectionRange) return false;
    
    const colIndex = columns.findIndex(c => c.fieldName === columnId);
    if (colIndex === -1) return false;
    
    const startColIndex = columns.findIndex(c => c.fieldName === selectionRange.start.columnId);
    const endColIndex = columns.findIndex(c => c.fieldName === selectionRange.end.columnId);
    const startRowIndex = selectionRange.start.rowIndex;
    const endRowIndex = selectionRange.end.rowIndex;
    
    const minRow = Math.min(startRowIndex, endRowIndex);
    const maxRow = Math.max(startRowIndex, endRowIndex);
    const minCol = Math.min(startColIndex, endColIndex);
    const maxCol = Math.max(startColIndex, endColIndex);
    
    return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol;
  }, [selectionRange, columns]);
  
  // ============================================================================
  // Cell Interaction Handlers (defined early for use in column definitions)
  // ============================================================================
  
  const handleCellClick = useCallback((rowIndex: number, columnId: string, shiftKey: boolean = false) => {
    if (columnId === 'rowNumber') return; // Row numbers not selectable
    
    // Shift+Click: Extend selection from anchor
    if (shiftKey && selectionAnchor) {
      setSelectionRange({
        start: selectionAnchor,
        end: { rowIndex, columnId }
      });
      setSelectedCell({ rowIndex, columnId }); // Update active cell
      return;
    }
    
    const now = Date.now();
    const lastClick = lastClickRef.current;
    
    // Check for double-click (two clicks within 300ms on same cell)
    if (
      lastClick &&
      lastClick.rowIndex === rowIndex &&
      lastClick.columnId === columnId &&
      now - lastClick.time < 300
    ) {
      // Check if cell is readonly
      const col = columns.find(c => c.fieldName === columnId);
      if (col?.cellType === 'readonly') {
        return;
      }
      // This is a double-click - start editing
      setEditingCell({ rowIndex, columnId });
      setSelectedCell({ rowIndex, columnId });
      setSelectionAnchor({ rowIndex, columnId }); // Reset anchor
      setSelectionRange(null); // Clear range
      lastClickRef.current = null; // Reset
      return;
    }
    
    // Single click - set new selection and anchor, clear range
    lastClickRef.current = { rowIndex, columnId, time: now };
    setSelectedCell({ rowIndex, columnId });
    setSelectionAnchor({ rowIndex, columnId }); // Set new anchor for future Shift+clicks
    setSelectionRange(null); // Clear any existing range
  }, [selectionAnchor, columns]);
  
  const handleCellDoubleClick = useCallback((rowIndex: number, columnId: string) => {
    if (columnId === 'rowNumber') return; // Row numbers not editable
    
    setEditingCell({ rowIndex, columnId });
    setSelectedCell({ rowIndex, columnId });
  }, []);
  
  const handleCellCommit = useCallback((rowIndex: number, columnId: string, newValue: any, moveDown: boolean = false) => {
    const row = rows[rowIndex];
    if (!row) return;
    
    onCellChange(row.id, columnId, newValue);
    setEditingCell(null);
    
    // If Enter was pressed, move to next row (spreadsheet UX convention)
    if (moveDown && rowIndex < rows.length - 1) {
      setSelectedCell({ rowIndex: rowIndex + 1, columnId });
    }
  }, [rows, onCellChange]);
  
  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
  }, []);
  
  // ============================================================================
  // Column Definitions for TanStack Table (Phase 6.3: Optimized for Memoization)
  // ============================================================================
  
  // Memoized event handlers (passed to cells to avoid recreation)
  const handleMouseDown = useCallback((e: React.MouseEvent, rowIndex: number, columnId: string) => {
    // Track which cell we're about to click (fires BEFORE onBlur)
    // This allows blur handler to know where to move selection
    e.stopPropagation();
    nextCellRef.current = { rowIndex, columnId };
    
    // Prepare for potential drag - just set the flag, don't update state
    if (!editingCell) {
      isDraggingRef.current = false;
    }
  }, [editingCell]);
  
  const handleMouseEnter = useCallback((e: React.MouseEvent, rowIndex: number, columnId: string) => {
    // Start/extend drag selection
    if (e.buttons === 1 && !editingCell) { // Left mouse button is held
      // This is a drag operation
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        // Set anchor to the cell where mouse was pressed (from nextCellRef or current anchor)
        const dragAnchor = nextCellRef.current || selectionAnchor || { rowIndex, columnId };
        setSelectionAnchor(dragAnchor);
        setSelectedCell(dragAnchor);
      }
      
      const anchor = selectionAnchor || { rowIndex, columnId };
      setSelectionRange({
        start: anchor,
        end: { rowIndex, columnId }
      });
    }
  }, [editingCell, selectionAnchor]);
  
  const tableColumns = useMemo<ColumnDef<SpreadsheetRow>[]>(() => {
    // Add checkbox column (for row selection)
    const checkboxColumn: ColumnDef<SpreadsheetRow> = {
      id: 'checkbox',
      header: () => {
        if (!onToggleAllSelection) return null;
        
        const allSelected = rows.length > 0 && rows.every(r => r.isSelected);
        const someSelected = rows.some(r => r.isSelected);
        
        return (
          <div className={styles.checkboxCell}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = someSelected && !allSelected;
                }
              }}
              onChange={(e) => {
                e.stopPropagation();
                onToggleAllSelection();
              }}
              title={allSelected ? 'Deselect all' : 'Select all'}
            />
          </div>
        );
      },
      size: 40,
      enableResizing: false,
      cell: ({ row }) => {
        if (!onToggleRowSelection) return null;
        
        return (
          <div className={styles.checkboxCell}>
            <input
              type="checkbox"
              checked={row.original.isSelected || false}
              onChange={() => {
                // onChange doesn't have access to shiftKey, just toggle normally
                // The onClick handler below will handle shift+click
              }}
              onClick={(e) => {
                e.stopPropagation(); // Prevent row selection
                onToggleRowSelection(row.original.id, e.shiftKey);
              }}
            />
          </div>
        );
      },
    };
    
    // Add row number column
    const rowNumberColumn: ColumnDef<SpreadsheetRow> = {
      id: 'rowNumber',
      header: '#',
      size: 60,
      enableResizing: false,
      cell: ({ row }) => (
        <div className={styles.rowNumberCell}>
          {row.index + 1}
        </div>
      ),
    };
    
    // Convert ColumnConfig to TanStack ColumnDef
    // Phase 6.3: Cell function now pure - no closure over selection state
    const dataColumns: ColumnDef<SpreadsheetRow>[] = columns.map((col) => ({
      id: col.fieldName,
      header: col.header,
      size: col.width || 150,
      enableResizing: true,
      cell: ({ row }) => {
        const cell = row.original.cells[col.fieldName];
        // Calculate selection state inline (passed to memoized component as props)
        // The memoized component will only re-render if these specific props change
        const rowIdx = row.index;
        const colId = col.fieldName;
        
        return (
          <MemoizedSpreadsheetCell
            cell={cell}
            columnConfig={col}
            rowIndex={rowIdx}
            columnId={colId}
            // Selection state computed inline and passed as props
            // MemoizedSpreadsheetCell will skip re-render if these haven't changed
            isSelected={selectedCell?.rowIndex === rowIdx && selectedCell?.columnId === colId}
            isEditing={editingCell?.rowIndex === rowIdx && editingCell?.columnId === colId}
            isInRange={isCellInRange(rowIdx, colId)}
            isReadonly={col.cellType === 'readonly'}
            // Event handlers are memoized (stable references)
            onCellClick={handleCellClick}
            onCellDoubleClick={handleCellDoubleClick}
            onCellCommit={handleCellCommit}
            onCellCancel={handleCellCancel}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
            // Refs and state passed through
            nextCellRef={nextCellRef}
            setSelectedCell={setSelectedCell}
            editingCell={editingCell}
            debug={debug}
          />
        );
      },
    }));
    
    // Return columns: checkbox (if enabled), row number, then data columns
    const allColumns = [
      ...(onToggleRowSelection ? [checkboxColumn] : []),
      rowNumberColumn,
      ...dataColumns
    ];
    
    return allColumns;
  }, [rows, columns, editingCell, selectedCell, selectionRange, isCellInRange, handleCellClick, handleCellDoubleClick, handleCellCommit, handleCellCancel, handleMouseDown, handleMouseEnter, onToggleRowSelection, onToggleAllSelection]);
  
  // ============================================================================
  // TanStack Table Instance
  // ============================================================================
  
  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange', // Enable column resizing
    defaultColumn: {
      minSize: 60,
      maxSize: 800,
    },
    debugTable: debug,
  });
  
  // ============================================================================
  // Virtualization Setup
  // ============================================================================
  
  const { rows: tableRows } = table.getRowModel();
  
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40, // Row height in pixels
    overscan: 10, // Render 10 extra rows above/below viewport
  });
  
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0) : 0;
  
  // ============================================================================
  // Imperative Handle (for parent components to call methods)
  // ============================================================================
  
  useImperativeHandle(ref, () => ({
    scrollToRow: (rowId: string | number) => {
      const rowIndex = rows.findIndex(r => r.id.toString() === rowId.toString());
      if (rowIndex !== -1) {
        rowVirtualizer.scrollToIndex(rowIndex, {
          align: 'start',
          behavior: 'smooth',
        });
      }
    },
  }), [rows, rowVirtualizer]);
  
  // ============================================================================
  // Mouse Drag Selection Handler
  // ============================================================================
  
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
      }
    };
    
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);
  
  // ============================================================================
  // Auto-scroll to selected cell
  // ============================================================================
  
  useEffect(() => {
    if (!selectedCell || !tableContainerRef.current) return;
    
    // Scroll to selected row using virtualizer
    if (selectedCell.rowIndex >= 0 && selectedCell.rowIndex < rows.length) {
      rowVirtualizer.scrollToIndex(selectedCell.rowIndex, {
        align: 'auto',
        behavior: 'smooth',
      });
    }
  }, [selectedCell, rowVirtualizer, rows.length]);
  
  // ============================================================================
  // Copy/Paste (Phase 4.1 & 4.2)
  // ============================================================================
  
  const handleCopy = useCallback(async () => {
    if (!selectedCell) return;
    
    let textToCopy = '';
    
    // Phase 4.2: If there's a range selection, copy the entire range
    if (selectionRange) {
      const { start, end } = selectionRange;
      
      // Calculate bounds
      const minRow = Math.min(start.rowIndex, end.rowIndex);
      const maxRow = Math.max(start.rowIndex, end.rowIndex);
      
      const startColIndex = columns.findIndex(c => c.fieldName === start.columnId);
      const endColIndex = columns.findIndex(c => c.fieldName === end.columnId);
      const minCol = Math.min(startColIndex, endColIndex);
      const maxCol = Math.max(startColIndex, endColIndex);
      
      // Build TSV (Tab-Separated Values) format for range
      const tsvRows: string[] = [];
      
      for (let rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
        const row = rows[rowIdx];
        if (!row) continue;
        
        const tsvCells: string[] = [];
        for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
          const col = columns[colIdx];
          const cell = row.cells[col.fieldName];
          // Smart serialization: preserve machine values for complex types
          const serialized = serializeCellForClipboard(cell);
          // Escape tabs and newlines for TSV format
          const escaped = serialized.replace(/\t/g, ' ').replace(/\n/g, ' ');
          tsvCells.push(escaped);
        }
        tsvRows.push(tsvCells.join('\t'));
      }
      
      textToCopy = tsvRows.join('\n');
    } else {
      // Phase 4.1: Single cell copy
      const row = rows[selectedCell.rowIndex];
      if (!row) return;
      
      const cell = row.cells[selectedCell.columnId];
      if (!cell) return;
      
      // Smart serialization: preserve machine values for complex types
      textToCopy = serializeCellForClipboard(cell);
    }
    
    try {
      // Use Clipboard API for modern browsers
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error('[TanStackSpreadsheet] Copy failed:', error);
    }
  }, [selectedCell, selectionRange, rows, columns]);
  
  const handlePaste = useCallback(async () => {
    if (!selectedCell) return;
    
    try {
      let textToPaste = '';
      
      // Use Clipboard API for modern browsers
      if (navigator.clipboard && window.isSecureContext) {
        textToPaste = await navigator.clipboard.readText();
      } else {
        // Fallback: cannot read clipboard in older browsers without user interaction
        return;
      }
      
      if (!textToPaste) return;
      
      // Phase 4.2: Parse TSV format for multi-cell paste
      const tsvRows = textToPaste.split('\n').filter(row => row.length > 0);
      
      if (tsvRows.length === 0) return;
      
      const tsvCells = tsvRows.map(row => row.split('\t'));
      
      // Determine if this is a multi-cell paste
      const isSingleCell = tsvRows.length === 1 && tsvCells[0].length === 1;
      
      // Collect all changes for batch processing
      const batchChanges: Array<{ rowId: string | number; fieldName: string; newValue: any }> = [];
      
      if (isSingleCell) {
        // Single value paste: Check if we have a selection range
        if (selectionRange) {
          // Fill behavior: Apply single value to all cells in selected range
          const startRow = Math.min(selectionRange.start.rowIndex, selectionRange.end.rowIndex);
          const endRow = Math.max(selectionRange.start.rowIndex, selectionRange.end.rowIndex);
          const startColIndex = columns.findIndex(c => c.fieldName === selectionRange.start.columnId);
          const endColIndex = columns.findIndex(c => c.fieldName === selectionRange.end.columnId);
          
          if (startColIndex === -1 || endColIndex === -1) return;
          
          const minCol = Math.min(startColIndex, endColIndex);
          const maxCol = Math.max(startColIndex, endColIndex);
          
          // Apply value to all cells in range
          for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
            if (rowIndex >= rows.length) break;
            
            const row = rows[rowIndex];
            if (!row) continue;
            
            for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
              if (colIndex >= columns.length) break;
              
              const col = columns[colIndex];
              
              // Skip readonly cells
              if (col.cellType === 'readonly') {
                continue;
              }
              
              // Smart deserialization: extract machine values for complex types
              const deserializedValue = deserializeCellFromClipboard(textToPaste, col.cellType);
              batchChanges.push({ rowId: row.id, fieldName: col.fieldName, newValue: deserializedValue });
            }
          }
        } else {
          // Phase 4.1: Single cell paste (no range selected)
          const col = columns.find(c => c.fieldName === selectedCell.columnId);
          if (col?.cellType === 'readonly') {
            return;
          }
          
          const row = rows[selectedCell.rowIndex];
          if (!row) return;
          
          // Smart deserialization: extract machine values for complex types
          const deserializedValue = deserializeCellFromClipboard(textToPaste, col?.cellType);
          
          // Single cell paste - use onCellChange directly (no batch needed)
          onCellChange(row.id, selectedCell.columnId, deserializedValue);
          return; // Early return for single cell
        }
      } else {
        // Phase 4.2: Range paste (TSV data with multiple cells)
        const startRowIndex = selectedCell.rowIndex;
        const startColIndex = columns.findIndex(c => c.fieldName === selectedCell.columnId);
        
        if (startColIndex === -1) return;
        
        // Iterate through TSV data
        for (let rowOffset = 0; rowOffset < tsvRows.length; rowOffset++) {
          const targetRowIndex = startRowIndex + rowOffset;
          if (targetRowIndex >= rows.length) break; // Don't paste beyond available rows
          
          const row = rows[targetRowIndex];
          if (!row) continue;
          
          const cellsInRow = tsvCells[rowOffset];
          
          for (let colOffset = 0; colOffset < cellsInRow.length; colOffset++) {
            const targetColIndex = startColIndex + colOffset;
            if (targetColIndex >= columns.length) break; // Don't paste beyond available columns
            
            const col = columns[targetColIndex];
            
            // Skip readonly cells
            if (col.cellType === 'readonly') {
              continue;
            }
            
            const cellText = cellsInRow[colOffset];
            // Smart deserialization: extract machine values for complex types
            const deserializedValue = deserializeCellFromClipboard(cellText, col.cellType);
            batchChanges.push({ rowId: row.id, fieldName: col.fieldName, newValue: deserializedValue });
          }
        }
      }
      
      // Apply batch changes
      if (batchChanges.length > 0) {
        if (onBatchCellChange) {
          // Use batch callback for atomic undo
          const cellCount = batchChanges.length;
          onBatchCellChange(batchChanges, `Paste ${cellCount} cell${cellCount !== 1 ? 's' : ''}`);
        } else {
          // Fallback: Apply individually
          batchChanges.forEach(change => {
            onCellChange(change.rowId, change.fieldName, change.newValue);
          });
        }
      }
      
    } catch (error) {
      console.error('[TanStackSpreadsheet] Paste failed:', error);
    }
  }, [selectedCell, selectionRange, rows, columns, onCellChange, onBatchCellChange]);
  
  // ============================================================================
  // Keyboard Navigation
  // ============================================================================
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell) return;
      if (editingCell) return; // Don't handle if already editing
      
      const maxRowIndex = rows.length - 1;
      const maxColIndex = columns.length - 1;
      
      // Enter key starts editing
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        // Check if cell is readonly
        const col = columns.find(c => c.fieldName === selectedCell.columnId);
        if (col?.cellType === 'readonly') {
          return;
        }
        setEditingCell({ rowIndex: selectedCell.rowIndex, columnId: selectedCell.columnId });
        return;
      }
      
      // Copy: Ctrl+C / Cmd+C (Phase 4.1)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }
      
      // Paste: Ctrl+V / Cmd+V (Phase 4.1)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }
      
      // Delete key: Clear cell(s) without entering edit mode
      if (e.key === 'Delete') {
        e.preventDefault();
        
        // Get cells to clear (either range or single cell)
        const cellsToClear: Array<{ rowIndex: number; columnId: string }> = [];
        
        if (selectionRange) {
          // Clear all cells in range
          const startColIndex = columns.findIndex(c => c.fieldName === selectionRange.start.columnId);
          const endColIndex = columns.findIndex(c => c.fieldName === selectionRange.end.columnId);
          const minCol = Math.min(startColIndex, endColIndex);
          const maxCol = Math.max(startColIndex, endColIndex);
          const minRow = Math.min(selectionRange.start.rowIndex, selectionRange.end.rowIndex);
          const maxRow = Math.max(selectionRange.start.rowIndex, selectionRange.end.rowIndex);
          
          for (let rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
            for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
              cellsToClear.push({
                rowIndex: rowIdx,
                columnId: columns[colIdx].fieldName,
              });
            }
          }
        } else {
          // Clear single selected cell
          cellsToClear.push(selectedCell);
        }
        
        // Filter out readonly cells and clear the rest
        const changes: Array<{ rowId: string | number; fieldName: string; newValue: any; newText?: string }> = [];
        
        cellsToClear.forEach(cell => {
          const col = columns.find(c => c.fieldName === cell.columnId);
          const row = rows[cell.rowIndex];
          
          // Skip readonly cells
          if (col?.readOnly || col?.cellType === 'readonly') {
            return;
          }
          
          // Determine appropriate empty value based on cell type
          let emptyValue: any;
          let emptyText = '';
          
          switch (col?.cellType) {
            case 'multiselect':
            case 'stringarray':
              emptyValue = [];
              break;
            case 'boolean':
              emptyValue = null; // "Not specified" for boolean
              break;
            case 'relationship':
              emptyValue = null; // Foreign keys can be null
              break;
            case 'text':
            case 'decimal':
            case 'select':
              emptyValue = ''; // Django CharField expects empty string, not null
              break;
            default:
              emptyValue = '';
          }
          
          changes.push({
            rowId: row.id,
            fieldName: cell.columnId,
            newValue: emptyValue,
            newText: emptyText,
          });
        });
        
        // Apply changes
        if (changes.length > 0) {
          if (changes.length === 1) {
            // Single cell - use regular cell change
            const change = changes[0];
            onCellChange(change.rowId, change.fieldName, change.newValue);
          } else {
            // Multiple cells - use batch change for undo/redo
            onBatchCellChange?.(changes, `Clear ${changes.length} cells`);
          }
        }
        
        return;
      }
      
      // Backspace: Do nothing when not in edit mode
      // (Protection against accidental data clearing - users must use Delete key)
      if (e.key === 'Backspace') {
        // Explicitly do nothing - don't enter edit mode, don't clear cell
        e.preventDefault();
        return;
      }
      
      // Arrow key navigation
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newRowIndex = Math.max(0, selectedCell.rowIndex - 1);
        
        if (e.shiftKey) {
          // Shift+Arrow: Extend selection
          const anchor = selectionAnchor || selectedCell;
          setSelectionRange({
            start: anchor,
            end: { rowIndex: newRowIndex, columnId: selectedCell.columnId }
          });
          setSelectedCell({ ...selectedCell, rowIndex: newRowIndex });
          if (!selectionAnchor) setSelectionAnchor(selectedCell);
        } else {
          // Normal arrow: Move selection
          setSelectedCell({ ...selectedCell, rowIndex: newRowIndex });
          setSelectionAnchor({ ...selectedCell, rowIndex: newRowIndex });
          setSelectionRange(null);
        }
        return;
      }
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newRowIndex = Math.min(maxRowIndex, selectedCell.rowIndex + 1);
        
        if (e.shiftKey) {
          // Shift+Arrow: Extend selection
          const anchor = selectionAnchor || selectedCell;
          setSelectionRange({
            start: anchor,
            end: { rowIndex: newRowIndex, columnId: selectedCell.columnId }
          });
          setSelectedCell({ ...selectedCell, rowIndex: newRowIndex });
          if (!selectionAnchor) setSelectionAnchor(selectedCell);
        } else {
          // Normal arrow: Move selection
          setSelectedCell({ ...selectedCell, rowIndex: newRowIndex });
          setSelectionAnchor({ ...selectedCell, rowIndex: newRowIndex });
          setSelectionRange(null);
        }
        return;
      }
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentColIndex = columns.findIndex(c => c.fieldName === selectedCell.columnId);
        if (currentColIndex > 0) {
          const newColumnId = columns[currentColIndex - 1].fieldName;
          
          if (e.shiftKey) {
            // Shift+Arrow: Extend selection
            const anchor = selectionAnchor || selectedCell;
            setSelectionRange({
              start: anchor,
              end: { rowIndex: selectedCell.rowIndex, columnId: newColumnId }
            });
            setSelectedCell({ ...selectedCell, columnId: newColumnId });
            if (!selectionAnchor) setSelectionAnchor(selectedCell);
          } else {
            // Normal arrow: Move selection
            setSelectedCell({ ...selectedCell, columnId: newColumnId });
            setSelectionAnchor({ ...selectedCell, columnId: newColumnId });
            setSelectionRange(null);
          }
        }
        return;
      }
      
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const currentColIndex = columns.findIndex(c => c.fieldName === selectedCell.columnId);
        if (currentColIndex < maxColIndex) {
          const newColumnId = columns[currentColIndex + 1].fieldName;
          
          if (e.shiftKey) {
            // Shift+Arrow: Extend selection
            const anchor = selectionAnchor || selectedCell;
            setSelectionRange({
              start: anchor,
              end: { rowIndex: selectedCell.rowIndex, columnId: newColumnId }
            });
            setSelectedCell({ ...selectedCell, columnId: newColumnId });
            if (!selectionAnchor) setSelectionAnchor(selectedCell);
          } else {
            // Normal arrow: Move selection
            setSelectedCell({ ...selectedCell, columnId: newColumnId });
            setSelectionAnchor({ ...selectedCell, columnId: newColumnId });
            setSelectionRange(null);
          }
        }
        return;
      }
      
      // Tab key navigation (right, then wrap to next row)
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentColIndex = columns.findIndex(c => c.fieldName === selectedCell.columnId);
        
        // If there's a range selection, navigate within it
        if (selectionRange) {
          const startColIndex = columns.findIndex(c => c.fieldName === selectionRange.start.columnId);
          const endColIndex = columns.findIndex(c => c.fieldName === selectionRange.end.columnId);
          const minCol = Math.min(startColIndex, endColIndex);
          const maxCol = Math.max(startColIndex, endColIndex);
          const minRow = Math.min(selectionRange.start.rowIndex, selectionRange.end.rowIndex);
          const maxRow = Math.max(selectionRange.start.rowIndex, selectionRange.end.rowIndex);
          
          if (e.shiftKey) {
            // Shift+Tab within range: Move left, wrap to previous row
            if (currentColIndex > minCol) {
              const newColumnId = columns[currentColIndex - 1].fieldName;
              setSelectedCell({ ...selectedCell, columnId: newColumnId });
            } else if (selectedCell.rowIndex > minRow) {
              // Wrap to end of previous row in range
              const newColumnId = columns[maxCol].fieldName;
              setSelectedCell({ rowIndex: selectedCell.rowIndex - 1, columnId: newColumnId });
            }
            // Keep range selection active
          } else {
            // Tab within range: Move right, wrap to next row
            if (currentColIndex < maxCol) {
              const newColumnId = columns[currentColIndex + 1].fieldName;
              setSelectedCell({ ...selectedCell, columnId: newColumnId });
            } else if (selectedCell.rowIndex < maxRow) {
              // Wrap to start of next row in range
              const newColumnId = columns[minCol].fieldName;
              setSelectedCell({ rowIndex: selectedCell.rowIndex + 1, columnId: newColumnId });
            }
            // Keep range selection active
          }
        } else {
          // No range: normal Tab navigation (clears anchor, no range)
          if (e.shiftKey) {
            // Shift+Tab: Move left/up
            if (currentColIndex > 0) {
              const newColumnId = columns[currentColIndex - 1].fieldName;
              setSelectedCell({ ...selectedCell, columnId: newColumnId });
              setSelectionAnchor({ ...selectedCell, columnId: newColumnId });
            } else if (selectedCell.rowIndex > 0) {
              const newColumnId = columns[maxColIndex].fieldName;
              const newCell = { rowIndex: selectedCell.rowIndex - 1, columnId: newColumnId };
              setSelectedCell(newCell);
              setSelectionAnchor(newCell);
            }
          } else {
            // Tab: Move right/down
            if (currentColIndex < maxColIndex) {
              const newColumnId = columns[currentColIndex + 1].fieldName;
              setSelectedCell({ ...selectedCell, columnId: newColumnId });
              setSelectionAnchor({ ...selectedCell, columnId: newColumnId });
            } else if (selectedCell.rowIndex < maxRowIndex) {
              const newColumnId = columns[0].fieldName;
              const newCell = { rowIndex: selectedCell.rowIndex + 1, columnId: newColumnId };
              setSelectedCell(newCell);
              setSelectionAnchor(newCell);
            }
          }
        }
        return;
      }
      
      // Home key: Go to first column
      if (e.key === 'Home' && !(e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const newColumnId = columns[0].fieldName;
        setSelectedCell({ ...selectedCell, columnId: newColumnId });
        setSelectionAnchor({ ...selectedCell, columnId: newColumnId });
        setSelectionRange(null);
        return;
      }
      
      // End key: Go to last column
      if (e.key === 'End' && !(e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const newColumnId = columns[maxColIndex].fieldName;
        setSelectedCell({ ...selectedCell, columnId: newColumnId });
        setSelectionAnchor({ ...selectedCell, columnId: newColumnId });
        setSelectionRange(null);
        return;
      }
      
      // Ctrl/Cmd+Home: Go to first cell
      if (e.key === 'Home' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const newCell = { rowIndex: 0, columnId: columns[0].fieldName };
        setSelectedCell(newCell);
        setSelectionAnchor(newCell);
        setSelectionRange(null);
        return;
      }
      
      // Ctrl/Cmd+End: Go to last cell
      if (e.key === 'End' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const newCell = { rowIndex: maxRowIndex, columnId: columns[maxColIndex].fieldName };
        setSelectedCell(newCell);
        setSelectionAnchor(newCell);
        setSelectionRange(null);
        return;
      }
    };
    
    // Use capture phase to ensure we catch the event
    window.addEventListener('keydown', handleKeyDown, false);
    return () => window.removeEventListener('keydown', handleKeyDown, false);
  }, [selectedCell, editingCell, rows.length, columns, selectionAnchor, selectionRange, handleCopy, handlePaste]);
  
  // ============================================================================
  // Drag and Drop Handlers
  // ============================================================================
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only show overlay if dragging files
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only hide overlay if leaving the container (not child elements)
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExtension = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      // Let the parent handle the error
      return;
    }
    
    // Call the parent's file drop handler
    if (onFileDrop) {
      onFileDrop(file);
    }
  }, [onFileDrop]);
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <Box
      className={styles.spreadsheetContainer}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
      role="application"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label={`${modelName} spreadsheet with ${rows.length} rows`}
    >
      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      >
        {selectedCell && `Selected ${columns.find(c => c.fieldName === selectedCell.columnId)?.header || selectedCell.columnId} cell in row ${selectedCell.rowIndex + 1}`}
      </div>
      
      {/* Scrollable table container */}
      <div
        ref={tableContainerRef}
        className={styles.tableContainer}
        role="region"
        aria-label="Spreadsheet content"
      >
        <table className={styles.table} role="grid" aria-readonly="false">
          {/* Header */}
          <thead className={styles.thead}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className={styles.headerRow} role="row">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={styles.th}
                    role="columnheader"
                    scope="col"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          
          {/* Body (virtualized) */}
          <tbody className={styles.tbody}>
            {/* Top padding for virtualization */}
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} aria-hidden="true" />
              </tr>
            )}
            
            {/* Visible rows */}
            {virtualRows.map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              const isRowSelected = row.original.isSelected || false;
              
              return (
                <tr
                  key={row.id}
                  className={`${styles.row} ${isRowSelected ? styles.selected : ''}`}
                  style={{ height: 40 }}
                  role="row"
                  aria-rowindex={virtualRow.index + 2}
                  aria-selected={isRowSelected}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className={styles.td}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            
            {/* Bottom padding for virtualization */}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} aria-hidden="true" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Debug info */}
      {debug && (
        <div className={styles.debugInfo}>
          <small>
            Total Rows: {rows.length} | Virtual Rows: {virtualRows.length} | 
            Renders: {renderCountRef.current} |
            Selected: {selectedCell ? `${selectedCell.rowIndex},${selectedCell.columnId}` : 'None'} |
            Editing: {editingCell ? `${editingCell.rowIndex},${editingCell.columnId}` : 'None'}
          </small>
        </div>
      )}
      
      {/* Drag and Drop Overlay */}
      {isDragging && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(25, 118, 210, 0.08)',
            border: '4px dashed',
            borderColor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1500,
            pointerEvents: 'none',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <svg 
              width="80" 
              height="80" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ color: '#1976d2', marginBottom: '16px' }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <Box 
              component="div" 
              sx={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                color: 'primary.main',
                mb: 1 
              }}
            >
              Drop file to import
            </Box>
            <Box 
              component="div" 
              sx={{ 
                fontSize: '0.875rem', 
                color: 'text.secondary' 
              }}
            >
              Supports Excel (.xlsx, .xls) and CSV (.csv)
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
});

// Add display name for better debugging
TanStackSpreadsheet.displayName = 'TanStackSpreadsheet';

export default TanStackSpreadsheet;

