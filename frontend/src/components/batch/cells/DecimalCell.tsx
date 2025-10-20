import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Cell, CellTemplate, Compatible, Uncertain, UncertainCompatible, isNavigationKey } from '@silevis/reactgrid';

/**
 * DecimalCell - Custom cell type for decimal number fields (longitude, latitude, measurements)
 * 
 * Architecture:
 * - Uses established custom cell patterns (like SelectCell, RelationshipCell)
 * - Visual appearance: Simple inline text input (no dropdown, no overlay UI)
 * - Validation happens on commit
 * - Supports positive/negative decimals, integers, empty values
 */

export interface DecimalCell extends Cell {
  type: 'decimal';
  value: string; // String representation of the number (e.g., '42.5', '-122.419906', '')
  text: string;  // Display text (same as value)
  validationState?: 'valid' | 'invalid' | 'validating';
  validationError?: string;
  isEdited?: boolean;
}

export class DecimalCellTemplate implements CellTemplate<DecimalCell> {
  // Static Set to track which cells are currently in edit mode
  private static editingCells = new Set<string>();

  private getCellKey(cell: Compatible<DecimalCell>): string {
    return `${cell.value}_${cell.text}`;
  }

  getCompatibleCell(uncertainCell: Uncertain<DecimalCell>): Compatible<DecimalCell> {
    let value: string;
    
    // Handle different input types
    if (typeof uncertainCell.value === 'number') {
      value = String(uncertainCell.value);
    } else if (typeof uncertainCell.value === 'string') {
      value = uncertainCell.value;
    } else if (uncertainCell.value === null || uncertainCell.value === undefined) {
      value = '';
    } else {
      value = String(uncertainCell.value);
    }

    const text = value; // Display exactly what's stored
    
    const decimalCell: DecimalCell = {
      ...uncertainCell,
      type: 'decimal',
      value,
      text,
      validationState: uncertainCell.validationState,
      validationError: uncertainCell.validationError,
      isEdited: uncertainCell.isEdited,
    };

    return decimalCell as Compatible<DecimalCell>;
  }

  handleKeyDown(
    cell: Compatible<DecimalCell>,
    keyCode: number,
    ctrl: boolean,
    shift: boolean,
    alt: boolean
  ): { cell: Compatible<DecimalCell>; enableEditMode: boolean } {
    const ENTER = 13;
    const ESCAPE = 27;
    const DELETE = 46;
    const BACKSPACE = 8;
    const POINTER_EVENT = 1; // Double-click is represented as keyCode 1
    
    const cellKey = this.getCellKey(cell);
    
    // If we're already editing this cell, don't re-enable edit mode on Enter
    // This allows the commit to happen and close the editor
    if (keyCode === ENTER && DecimalCellTemplate.editingCells.has(cellKey)) {
      DecimalCellTemplate.editingCells.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    // Enter key or double-click: enable edit mode
    if (keyCode === ENTER || keyCode === POINTER_EVENT) {
      DecimalCellTemplate.editingCells.add(cellKey);
      return { cell, enableEditMode: true };
    }
    
    // Escape: exit edit mode without committing
    if (keyCode === ESCAPE) {
      DecimalCellTemplate.editingCells.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    // Delete/Backspace when NOT in edit mode: clear cell
    if ((keyCode === DELETE || keyCode === BACKSPACE) && !DecimalCellTemplate.editingCells.has(cellKey)) {
      DecimalCellTemplate.editingCells.delete(cellKey);
      return {
        cell: this.getCompatibleCell({ ...cell, value: '' }),
        enableEditMode: false,
      };
    }
    
    // Navigation keys: don't change mode
    if (isNavigationKey(keyCode)) {
      return { cell, enableEditMode: false };
    }
    
    // For all other keys, don't change the cell
    return { cell, enableEditMode: false };
  }

  update(cell: Compatible<DecimalCell>, cellToMerge: UncertainCompatible<DecimalCell>): Compatible<DecimalCell> {
    return this.getCompatibleCell({ ...cell, ...cellToMerge });
  }

  render(
    cell: Compatible<DecimalCell>,
    isInEditMode: boolean,
    onCellChanged: (cell: Compatible<DecimalCell>, commit: boolean) => void
  ): React.ReactNode {
    return (
      <DecimalCellView
        cell={cell}
        isInEditMode={isInEditMode}
        onCellChanged={onCellChanged}
      />
    );
  }
}

interface DecimalCellViewProps {
  cell: Compatible<DecimalCell>;
  isInEditMode: boolean;
  onCellChanged: (cell: Compatible<DecimalCell>, commit: boolean) => void;
}

const DecimalCellViewComponent: React.FC<DecimalCellViewProps> = ({
  cell,
  isInEditMode,
  onCellChanged,
}) => {
  const [currentValue, setCurrentValue] = useState<string>(cell.value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textFieldRef = useRef<HTMLInputElement>(null);

  // Memoize cellKey for performance
  const cellKey = useMemo(() => `${cell.value}_${cell.text}`, [cell.value, cell.text]);

  // Sync value when cell changes
  useEffect(() => {
    setCurrentValue(cell.value);
  }, [cell.value]);

  // Check if value is a complete valid number
  const isCompleteNumber = useCallback((value: string): boolean => {
    if (value === '') return true; // Empty is valid for nullable fields
    const completeRegex = /^-?\d+\.?\d*$|^-?\d*\.\d+$/;
    return completeRegex.test(value);
  }, []);

  const getCellBackgroundColor = (): string => {
    if (cell.validationState === 'invalid') {
      return '#ffebee'; // Light red
    }
    if (cell.validationState === 'validating') {
      return '#e3f2fd'; // Light blue
    }
    if (cell.isEdited) {
      return '#fff9c4'; // Yellow
    }
    return '#ffffff'; // White
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentValue(e.target.value);
  };

  const handleCommit = useCallback(() => {
    // Validate the value
    const isValid = isCompleteNumber(currentValue);
    
    // Always commit (both valid and invalid values)
    const finalCell: DecimalCell = {
      ...cell,
      value: currentValue,
      text: currentValue,
      isEdited: currentValue !== cell.value,
      validationState: isValid ? 'valid' : 'invalid',
      validationError: isValid ? undefined : 'Invalid decimal format',
    };
    
    (DecimalCellTemplate as any).editingCells.delete(cellKey);
    onCellChanged(finalCell as Compatible<DecimalCell>, true);
    
    // Blur the input
    if (textFieldRef.current) {
      textFieldRef.current.blur();
    }
  }, [currentValue, cell, cellKey, onCellChanged, isCompleteNumber]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleCommit();
    } else if (e.key === 'Escape') {
      // Revert to original value
      setCurrentValue(cell.value);
      (DecimalCellTemplate as any).editingCells.delete(cellKey);
      
      // Blur to exit edit mode
      if (textFieldRef.current) {
        textFieldRef.current.blur();
      }
      // Let Escape propagate to ReactGrid
    } else if (e.key === 'Tab') {
      // Commit and allow navigation
      handleCommit();
    }
  };

  // Display mode: show the number as plain text
  if (!isInEditMode) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: getCellBackgroundColor(),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={cell.validationError}
      >
        {cell.text}
      </div>
    );
  }

  // Edit mode: Simple text input (styled to look like plain text cell)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: getCellBackgroundColor(),
        position: 'relative',
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Transparent input to maintain ReactGrid focus */}
      <input
        ref={inputRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          pointerEvents: 'none',
        }}
        onKeyDown={handleKeyDown}
      />

      {/* Actual editable input - directly in cell, not wrapped */}
      <input
        ref={textFieldRef}
        type="text"
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder="Enter a number"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          padding: '0 8px',
          fontSize: '14px',
          fontFamily: 'inherit',
          margin: 0,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
const DecimalCellView = React.memo(DecimalCellViewComponent, (prevProps, nextProps) => {
  return (
    prevProps.isInEditMode === nextProps.isInEditMode &&
    prevProps.cell.value === nextProps.cell.value &&
    prevProps.cell.text === nextProps.cell.text &&
    prevProps.cell.validationState === nextProps.cell.validationState &&
    prevProps.cell.isEdited === nextProps.cell.isEdited
  );
});

DecimalCellView.displayName = 'DecimalCellView';

