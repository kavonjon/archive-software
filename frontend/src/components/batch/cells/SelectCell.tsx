/**
 * Stage 1 Phase 4: Custom SelectCell for ReactGrid
 * 
 * Dropdown select cell for choice fields (e.g., level: Family/Language/Dialect)
 * 
 * Key Implementation Details:
 * - Uses capture phase event handlers (onPointerDownCapture, onClickCapture) to prevent
 *   ReactGrid from detecting focus loss and exiting edit mode prematurely
 * - Renders dropdown inside the cell with absolute positioning to escape cell bounds
 * - Maintains focus on a transparent input element to keep ReactGrid in edit mode
 */

import React, { useState, useRef, useEffect } from 'react';
import { Cell, CellTemplate, Compatible, Uncertain, UncertainCompatible } from '@silevis/reactgrid';
import { MenuItem, MenuList } from '@mui/material';

export interface SelectCellChoice {
  value: string;
  label: string;
}

export interface SelectCell extends Cell {
  type: 'select';
  value: string;
  text: string;
  choices: SelectCellChoice[];
  // Validation and edit state for styling
  validationState?: 'valid' | 'invalid' | 'validating';
  isEdited?: boolean;
}

class SelectCellTemplate implements CellTemplate<SelectCell> {
  // Track if we're currently in edit mode with dropdown open
  // This prevents re-enabling edit mode when Enter is pressed to commit
  private static editingCells = new Set<string>();
  
  private getCellKey(cell: Compatible<SelectCell>): string {
    return `${cell.value}_${cell.text}`;
  }

  getCompatibleCell(uncertainCell: Uncertain<SelectCell>): Compatible<SelectCell> {
    const value = uncertainCell.value || '';
    const text = uncertainCell.text !== undefined ? uncertainCell.text : value;
    const cell: SelectCell = {
      type: 'select',
      value,
      text,
      choices: uncertainCell.choices || [],
      validationState: (uncertainCell as any).validationState,
      isEdited: (uncertainCell as any).isEdited,
    };
    return cell as Compatible<SelectCell>;
  }
  
  isFocusable(cell: Compatible<SelectCell>): boolean {
    return true;
  }

  handleKeyDown(
    cell: Compatible<SelectCell>,
    keyCode: number,
    ctrl: boolean,
    shift: boolean,
    alt: boolean
  ): { cell: Compatible<SelectCell>; enableEditMode: boolean } {
    const ENTER = 13;
    const ESCAPE = 27;
    const POINTER_EVENT = 1; // Double-click is represented as keyCode 1
    
    const cellKey = this.getCellKey(cell);
    
    // If we're already editing this cell (dropdown is open), don't re-enable edit mode on Enter
    if (keyCode === ENTER && SelectCellTemplate.editingCells.has(cellKey)) {
      // Remove from tracking since dropdown will close
      SelectCellTemplate.editingCells.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    // Enter key or double-click: enable edit mode
    if (keyCode === ENTER || keyCode === POINTER_EVENT) {
      SelectCellTemplate.editingCells.add(cellKey);
      return { cell, enableEditMode: true };
    }
    
    // Escape: exit edit mode without committing
    if (keyCode === ESCAPE) {
      SelectCellTemplate.editingCells.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    // For all other keys (including arrow keys), don't change the cell value
    // Arrow keys should navigate between cells, not change the value
    return { cell, enableEditMode: false };
  }

  update(cell: Compatible<SelectCell>, cellToMerge: UncertainCompatible<SelectCell>): Compatible<SelectCell> {
    return this.getCompatibleCell({ ...cell, ...cellToMerge });
  }

  render(
    cell: Compatible<SelectCell>,
    isInEditMode: boolean,
    onCellChanged: (cell: Compatible<SelectCell>, commit: boolean) => void
  ): React.ReactNode {
    return (
      <SelectCellView
        cell={cell}
        isInEditMode={isInEditMode}
        onCellChanged={onCellChanged}
      />
    );
  }
}

// Custom dropdown component
const SelectCellView: React.FC<{
  cell: Compatible<SelectCell>;
  isInEditMode: boolean;
  onCellChanged: (cell: Compatible<SelectCell>, commit: boolean) => void;
}> = React.memo(({ cell, isInEditMode, onCellChanged }) => {
  const [selectedValue, setSelectedValue] = useState<string>(cell.value);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCellChangedRef = useRef(onCellChanged);

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
      setSelectedValue(cell.value);
      setDropdownOpen(true);
    } else {
      setDropdownOpen(false);
    }
  }, [isInEditMode, cell.value]);

  const handleSelect = (choice: SelectCellChoice) => {
    setSelectedValue(choice.value);
    
    // Immediately commit the change
    const updatedCell: SelectCell = {
      type: 'select',
      value: choice.value,
      text: choice.label,
      choices: cell.choices,
    };
    setDropdownOpen(false);
    
    // First commit the change to ReactGrid
    onCellChangedRef.current(updatedCell as Compatible<SelectCell>, true);
    
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
      const cellKey = `${cell.value}_${cell.text}`;
      (SelectCellTemplate as any).editingCells.delete(cellKey);
      
      setDropdownOpen(false);
      if (inputRef.current) {
        inputRef.current.blur();
      }
      onCellChangedRef.current(cell, false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      // Navigate down in dropdown
      const currentIndex = cell.choices.findIndex(c => c.value === selectedValue);
      const nextIndex = currentIndex < cell.choices.length - 1 ? currentIndex + 1 : 0;
      setSelectedValue(cell.choices[nextIndex].value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      // Navigate up in dropdown
      const currentIndex = cell.choices.findIndex(c => c.value === selectedValue);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : cell.choices.length - 1;
      setSelectedValue(cell.choices[prevIndex].value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // DON'T stopPropagation - let ReactGrid know Enter was pressed
      // Commit the currently selected value
      const choice = cell.choices.find(c => c.value === selectedValue);
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
        {cell.text || cell.value || ''}
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
        value={cell.text || cell.value || ''}
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
            maxHeight: 200,
            overflow: 'auto',
            border: '2px solid #1976d2',
            backgroundColor: 'white',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
          }}
        >
          <MenuList dense>
            {cell.choices.map((choice) => (
              <MenuItem
                key={choice.value}
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

export { SelectCellTemplate };

