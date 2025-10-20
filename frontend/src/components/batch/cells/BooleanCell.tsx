/**
 * BooleanCell - Custom ReactGrid cell for three-state boolean fields
 * 
 * Provides Yes/No/Not specified options matching Stage 0 EditableBooleanField
 * Used for nullable boolean fields common in cultural archive metadata
 * 
 * Architecture parallels:
 * - Stage 0: EditableBooleanField with three-state Select dropdown
 * - Stage 1: SelectCell patterns (transparent input, static editingCells, dropdown)
 * 
 * Value mapping:
 * - true → "Yes"
 * - false → "No"
 * - null → "Not specified"
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Cell, CellTemplate, Compatible, Uncertain, UncertainCompatible } from '@silevis/reactgrid';
import { MenuItem, MenuList } from '@mui/material';

export interface BooleanCellChoice {
  value: boolean | null;
  label: string;
}

export interface BooleanCell extends Cell {
  type: 'boolean';
  value: string; // String representation: 'true', 'false', or '' (null)
  text: string;  // Display text: "Yes", "No", or "Not specified"
  booleanValue?: boolean | null; // Actual boolean value for API
  // Validation and edit state for styling
  validationState?: 'valid' | 'invalid' | 'validating';
  isEdited?: boolean;
}

// Standard three-state boolean choices
export const BOOLEAN_CHOICES: BooleanCellChoice[] = [
  { value: null, label: 'Not specified' },
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

export class BooleanCellTemplate implements CellTemplate<BooleanCell> {
  // Track if we're currently in edit mode with dropdown open
  // This prevents re-enabling edit mode when Enter is pressed to commit
  private static editingCells = new Set<string>();
  
  private getCellKey(cell: Compatible<BooleanCell>): string {
    return `${cell.value}_${cell.text}`;
  }

  getCompatibleCell(uncertainCell: Uncertain<BooleanCell>): Compatible<BooleanCell> {
    // Handle both string and boolean input values
    let stringValue = '';
    let booleanValue: boolean | null = null;
    
    if (typeof uncertainCell.value === 'boolean') {
      booleanValue = uncertainCell.value;
      stringValue = uncertainCell.value ? 'true' : 'false';
    } else if (uncertainCell.value === 'true' || uncertainCell.value === 'false') {
      stringValue = uncertainCell.value as string;
      booleanValue = uncertainCell.value === 'true';
    } else {
      stringValue = '';
      booleanValue = null;
    }
    
    const text = uncertainCell.text !== undefined ? uncertainCell.text : this.getDisplayText(booleanValue);
    const cell: BooleanCell = {
      type: 'boolean',
      value: stringValue,
      text,
      booleanValue,
      validationState: (uncertainCell as any).validationState,
      isEdited: (uncertainCell as any).isEdited,
    };
    return cell as Compatible<BooleanCell>;
  }
  
  private getDisplayText(value: boolean | null): string {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'Not specified';
  }
  
  private stringToBooleanValue(str: string): boolean | null {
    if (str === 'true') return true;
    if (str === 'false') return false;
    return null;
  }
  
  isFocusable(cell: Compatible<BooleanCell>): boolean {
    return true;
  }

  handleKeyDown(
    cell: Compatible<BooleanCell>,
    keyCode: number,
    ctrl: boolean,
    shift: boolean,
    alt: boolean
  ): { cell: Compatible<BooleanCell>; enableEditMode: boolean } {
    const ENTER = 13;
    const ESCAPE = 27;
    const DELETE = 46;
    const BACKSPACE = 8;
    const POINTER_EVENT = 1; // Double-click is represented as keyCode 1
    
    const cellKey = this.getCellKey(cell);
    
    // Delete or Backspace: clear to "Not specified" (null)
    if (!ctrl && !alt && (keyCode === DELETE || keyCode === BACKSPACE)) {
      const clearedCell: BooleanCell = {
        type: 'boolean',
        value: '',
        text: 'Not specified',
        booleanValue: null,
      };
      BooleanCellTemplate.editingCells.delete(cellKey);
      return { cell: clearedCell as Compatible<BooleanCell>, enableEditMode: false };
    }
    
    // If we're already editing this cell (dropdown is open), don't re-enable edit mode on Enter
    if (keyCode === ENTER && BooleanCellTemplate.editingCells.has(cellKey)) {
      // Remove from tracking since dropdown will close
      BooleanCellTemplate.editingCells.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    // Enter key or double-click: enable edit mode
    if (keyCode === ENTER || keyCode === POINTER_EVENT) {
      BooleanCellTemplate.editingCells.add(cellKey);
      return { cell, enableEditMode: true };
    }
    
    // Escape: exit edit mode without committing
    if (keyCode === ESCAPE) {
      BooleanCellTemplate.editingCells.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    return { cell, enableEditMode: false };
  }

  update(
    cell: Compatible<BooleanCell>,
    cellToMerge: UncertainCompatible<BooleanCell>
  ): Compatible<BooleanCell> {
    return this.getCompatibleCell({
      ...cell,
      value: cellToMerge.value !== undefined ? cellToMerge.value : cell.value,
      text: cellToMerge.text !== undefined ? cellToMerge.text : cell.text,
      validationState: cellToMerge.validationState ?? cell.validationState,
      isEdited: cellToMerge.isEdited ?? cell.isEdited,
    });
  }

  render(
    cell: Compatible<BooleanCell>,
    isInEditMode: boolean,
    onCellChanged: (cell: Compatible<BooleanCell>, commit: boolean) => void
  ): React.ReactNode {
    return (
      <BooleanCellView
        cell={cell}
        isInEditMode={isInEditMode}
        onCellChanged={onCellChanged}
      />
    );
  }
}

// Separate view component for better performance optimization
const BooleanCellView: React.FC<{
  cell: Compatible<BooleanCell>;
  isInEditMode: boolean;
  onCellChanged: (cell: Compatible<BooleanCell>, commit: boolean) => void;
}> = React.memo(({ cell, isInEditMode, onCellChanged }) => {
  const [selectedValue, setSelectedValue] = useState<boolean | null>(cell.booleanValue ?? null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCellChangedRef = useRef(onCellChanged);

  // Memoize cell key to avoid recalculation on every render
  const cellKey = useMemo(
    () => `${cell.value}_${cell.text}`,
    [cell.value, cell.text]
  );

  // Helper to get background color based on cell state
  const getCellBackgroundColor = (): string => {
    if (cell.validationState === 'invalid') {
      return '#ffebee'; // Light red
    }
    if (cell.validationState === 'validating') {
      return '#e3f2fd'; // Light blue
    }
    if (cell.isEdited) {
      return '#fff9c4'; // Light yellow
    }
    return 'transparent';
  };

  // Keep ref up to date
  useEffect(() => {
    onCellChangedRef.current = onCellChanged;
  }, [onCellChanged]);

  // Open dropdown when entering edit mode
  useEffect(() => {
    if (isInEditMode) {
      setSelectedValue(cell.booleanValue ?? null);
      setDropdownOpen(true);
    } else {
      setDropdownOpen(false);
    }
  }, [isInEditMode, cell.booleanValue]);

  const getDisplayText = (value: boolean | null): string => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'Not specified';
  };

  const handleSelect = (choice: BooleanCellChoice) => {
    setSelectedValue(choice.value);
    
    // Convert boolean value to string for ReactGrid
    let stringValue = '';
    if (choice.value === true) stringValue = 'true';
    else if (choice.value === false) stringValue = 'false';
    
    // Immediately commit the change
    const updatedCell: BooleanCell = {
      type: 'boolean',
      value: stringValue,
      text: choice.label,
      booleanValue: choice.value,
    };
    setDropdownOpen(false);
    
    // First commit the change to ReactGrid
    onCellChangedRef.current(updatedCell as Compatible<BooleanCell>, true);
    
    // Then blur the input in the next tick to ensure ReactGrid processes the commit first
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Manually remove from Set since ReactGrid's template handleKeyDown isn't being called
      (BooleanCellTemplate as any).editingCells.delete(cellKey);
      
      setDropdownOpen(false);
      if (inputRef.current) {
        inputRef.current.blur();
      }
      onCellChangedRef.current(cell, false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      // Navigate down in dropdown
      const currentIndex = BOOLEAN_CHOICES.findIndex(c => c.value === selectedValue);
      const nextIndex = currentIndex < BOOLEAN_CHOICES.length - 1 ? currentIndex + 1 : 0;
      setSelectedValue(BOOLEAN_CHOICES[nextIndex].value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      // Navigate up in dropdown
      const currentIndex = BOOLEAN_CHOICES.findIndex(c => c.value === selectedValue);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : BOOLEAN_CHOICES.length - 1;
      setSelectedValue(BOOLEAN_CHOICES[prevIndex].value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // DON'T stopPropagation - let ReactGrid know Enter was pressed
      // Commit the currently selected value
      const choice = BOOLEAN_CHOICES.find(c => c.value === selectedValue);
      if (choice) {
        handleSelect(choice);
      }
    }
  };

  if (!isInEditMode) {
    // Display mode - plain text
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'default',
          backgroundColor: getCellBackgroundColor(),
        }}
      >
        {cell.text || 'Not specified'}
      </div>
    );
  }

  // Edit mode - render dropdown inside cell with absolute positioning
  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: getCellBackgroundColor(),
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={getDisplayText(cell.booleanValue ?? null)}
        onChange={() => {
          // Ignore changes - this input is just to keep focus
        }}
        autoFocus
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          padding: '0 8px',
          fontSize: '14px',
          cursor: 'default',
          caretColor: 'transparent', // Hide the cursor
        }}
      />
      
      {/* Dropdown rendered inside cell but positioned absolutely */}
      {dropdownOpen && (
        <div
          onPointerDownCapture={(e) => {
            // Use capture phase to prevent ReactGrid from detecting focus loss
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10000,
            maxHeight: 150,
            overflow: 'auto',
            border: '2px solid #1976d2',
            backgroundColor: 'white',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
          }}
        >
          <MenuList dense>
            {BOOLEAN_CHOICES.map((choice) => (
              <MenuItem
                key={String(choice.value)}
                selected={choice.value === selectedValue}
                onPointerDownCapture={(e) => {
                  // Prevent focus loss from the input element
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClickCapture={(e) => {
                  // Use capture phase to handle click before ReactGrid
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(choice);
                }}
              >
                {choice.label}
              </MenuItem>
            ))}
          </MenuList>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if these props actually changed
  return (
    prevProps.isInEditMode === nextProps.isInEditMode &&
    prevProps.cell.value === nextProps.cell.value &&
    prevProps.cell.text === nextProps.cell.text &&
    prevProps.cell.validationState === nextProps.cell.validationState &&
    prevProps.cell.isEdited === nextProps.cell.isEdited
  );
});

BooleanCellView.displayName = 'BooleanCellView';

