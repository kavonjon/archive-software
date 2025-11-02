/**
 * Stage 1: Batch Editing - Checkbox Column Component (Option B)
 * 
 * Standalone checkbox column rendered as overlay, completely independent of ReactGrid.
 * This prevents the performance issues caused by including checkboxes in ReactGrid's state.
 * 
 * Key Design:
 * - Checkboxes are NOT ReactGrid cells
 * - State managed via ref (no re-render on toggle)
 * - Positioned as overlay synchronized with grid scroll
 * - Multi-selection support via shift+click
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Box, Checkbox } from '@mui/material';
import { SpreadsheetRow } from '../../types/spreadsheet';

interface CheckboxColumnProps {
  /** All rows in the spreadsheet */
  rows: SpreadsheetRow[];
  
  /** Height of header row (pixels) */
  headerHeight?: number;
  
  /** Height of each data row (pixels) */
  rowHeight?: number;
  
  /** Width of checkbox column (pixels) */
  columnWidth?: number;
  
  /** Callback when selection changes (for external components like delete button) */
  onSelectionChange?: (selectedIds: Set<string | number>) => void;
}

export const CheckboxColumn: React.FC<CheckboxColumnProps> = ({
  rows,
  headerHeight = 40,
  rowHeight = 32,
  columnWidth = 50,
  onSelectionChange,
}) => {
  // Store checkbox selection in ref to avoid re-render storm
  const selectedRowIdsRef = useRef<Set<string | number>>(
    (() => {
      const saved = sessionStorage.getItem('batch-checkbox-selection');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    })()
  );
  
  // Track last clicked row for shift+click multi-select
  const lastClickedIndexRef = useRef<number | null>(null);
  
  // Force update mechanism for checkbox-only changes
  const [, forceUpdate] = useState({});
  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);
  
  // Persist selection to sessionStorage (throttled)
  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const persistSelection = useCallback(() => {
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = setTimeout(() => {
      sessionStorage.setItem(
        'batch-checkbox-selection',
        JSON.stringify(Array.from(selectedRowIdsRef.current))
      );
    }, 500);
  }, []);
  
  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedRowIdsRef.current);
    }
  }, [onSelectionChange]);
  
  // Clear selection on unmount
  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
      sessionStorage.removeItem('batch-checkbox-selection');
    };
  }, []);
  
  // Handle master "Select All" checkbox
  const handleMasterCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    const allSelected = selectedRowIdsRef.current.size === rows.length && rows.length > 0;
    
    if (allSelected) {
      // Deselect all
      selectedRowIdsRef.current.clear();
    } else {
      // Select all
      selectedRowIdsRef.current = new Set(rows.map(r => r.id));
    }
    
    lastClickedIndexRef.current = null;
    persistSelection();
    triggerUpdate();
  }, [rows, persistSelection, triggerUpdate]);
  
  // Handle individual row checkbox
  const handleRowCheckboxClick = useCallback((
    e: React.MouseEvent,
    rowId: string | number,
    rowIndex: number
  ) => {
    e.stopPropagation();
    
    const shiftKey = e.shiftKey;
    const isCurrentlySelected = selectedRowIdsRef.current.has(rowId);
    
    if (shiftKey && lastClickedIndexRef.current !== null) {
      // Shift+click: select range
      const start = Math.min(lastClickedIndexRef.current, rowIndex);
      const end = Math.max(lastClickedIndexRef.current, rowIndex);
      
      // Determine the action based on the clicked checkbox's current state
      const newState = !isCurrentlySelected;
      
      // Apply to all rows in range
      for (let i = start; i <= end; i++) {
        const targetRowId = rows[i].id;
        if (newState) {
          selectedRowIdsRef.current.add(targetRowId);
        } else {
          selectedRowIdsRef.current.delete(targetRowId);
        }
      }
    } else {
      // Normal click: toggle single checkbox
      if (isCurrentlySelected) {
        selectedRowIdsRef.current.delete(rowId);
      } else {
        selectedRowIdsRef.current.add(rowId);
      }
    }
    
    lastClickedIndexRef.current = rowIndex;
    persistSelection();
    triggerUpdate();
  }, [rows, persistSelection, triggerUpdate]);
  
  // Calculate master checkbox state
  const allSelected = selectedRowIdsRef.current.size === rows.length && rows.length > 0;
  const someSelected = selectedRowIdsRef.current.size > 0 && !allSelected;
  
  return (
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: columnWidth,
        zIndex: 10,
        backgroundColor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        pointerEvents: 'auto',
      }}
    >
      {/* Header checkbox */}
      <Box
        sx={{
          height: headerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'grey.50',
        }}
      >
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onClick={handleMasterCheckboxClick}
          sx={{ padding: 0.5 }}
        />
      </Box>
      
      {/* Row checkboxes */}
      {rows.map((row, index) => (
        <Box
          key={row.id}
          sx={{
            height: rowHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Checkbox
            checked={selectedRowIdsRef.current.has(row.id)}
            onClick={(e) => handleRowCheckboxClick(e, row.id, index)}
            sx={{ padding: 0.5 }}
          />
        </Box>
      ))}
    </Box>
  );
};

