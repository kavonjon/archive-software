/**
 * StringArrayCell - Custom ReactGrid cell for JSONField string arrays
 * 
 * Used for fields like Languoid.alt_names, Collaborator.other_names, etc.
 * Provides tag/chip input UI for adding/removing plain text strings
 * 
 * Architecture parallels:
 * - Similar to MultiSelectCell (multi-action editing, static state)
 * - But for plain text strings instead of relationship IDs
 * - No API calls, no loading states
 * 
 * Key features:
 * - Type string → press Enter → chip appears
 * - Click X on chip → removes string
 * - Multiple add/remove actions before final commit
 * - Validation: trim whitespace, prevent empty strings, prevent duplicates
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Cell, CellTemplate, Compatible, Uncertain, UncertainCompatible } from '@silevis/reactgrid';
import { TextField, Chip, Box } from '@mui/material';

export interface StringArrayCell extends Cell {
  type: 'stringarray';
  value: string[]; // Array of strings
  text: string;    // Display text (comma-separated or count)
  // Validation and edit state for styling
  validationState?: 'valid' | 'invalid' | 'validating';
  validationError?: string;
  isEdited?: boolean;
}

export class StringArrayCellTemplate implements CellTemplate<StringArrayCell> {
  // Track which cells are in edit mode
  private static editingCells = new Set<string>();
  
  // Static storage for pending string arrays during multi-action editing
  // Key: cellKey (value_text), Value: array of strings
  private static pendingArrays = new Map<string, string[]>();
  
  private getCellKey(cell: Compatible<StringArrayCell>): string {
    return `${JSON.stringify(cell.value)}_${cell.text}`;
  }

  getCompatibleCell(uncertainCell: Uncertain<StringArrayCell>): Compatible<StringArrayCell> {
    const value = Array.isArray(uncertainCell.value) ? uncertainCell.value : [];
    const text = uncertainCell.text !== undefined ? uncertainCell.text : this.getDisplayText(value);
    const cell: StringArrayCell = {
      type: 'stringarray',
      value,
      text,
      validationState: (uncertainCell as any).validationState,
      validationError: (uncertainCell as any).validationError,
      isEdited: (uncertainCell as any).isEdited,
    };
    return cell as Compatible<StringArrayCell>;
  }
  
  private getDisplayText(value: string[]): string {
    if (!value || value.length === 0) return '';
    if (value.length <= 2) return value.join(', ');
    return `${value.length} items`;
  }
  
  isFocusable(cell: Compatible<StringArrayCell>): boolean {
    return true;
  }

  handleKeyDown(
    cell: Compatible<StringArrayCell>,
    keyCode: number,
    ctrl: boolean,
    shift: boolean,
    alt: boolean
  ): { cell: Compatible<StringArrayCell>; enableEditMode: boolean } {
    const ENTER = 13;
    const ESCAPE = 27;
    const DELETE = 46;
    const BACKSPACE = 8;
    const POINTER_EVENT = 1; // Double-click
    
    const cellKey = this.getCellKey(cell);
    
    // Delete or Backspace: clear the array
    if (!ctrl && !alt && (keyCode === DELETE || keyCode === BACKSPACE)) {
      const clearedCell: StringArrayCell = {
        type: 'stringarray',
        value: [],
        text: '',
      };
      StringArrayCellTemplate.editingCells.delete(cellKey);
      StringArrayCellTemplate.pendingArrays.delete(cellKey);
      return { cell: clearedCell as Compatible<StringArrayCell>, enableEditMode: false };
    }
    
    // If we're already editing this cell, don't re-enable edit mode on Enter
    if (keyCode === ENTER && StringArrayCellTemplate.editingCells.has(cellKey)) {
      // Remove from tracking since editor will close
      StringArrayCellTemplate.editingCells.delete(cellKey);
      StringArrayCellTemplate.pendingArrays.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    // Enter key or double-click: enable edit mode
    if (keyCode === ENTER || keyCode === POINTER_EVENT) {
      StringArrayCellTemplate.editingCells.add(cellKey);
      // Clear any stale pending data
      StringArrayCellTemplate.pendingArrays.delete(cellKey);
      return { cell, enableEditMode: true };
    }
    
    // Escape: exit edit mode without committing
    if (keyCode === ESCAPE) {
      StringArrayCellTemplate.editingCells.delete(cellKey);
      StringArrayCellTemplate.pendingArrays.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    return { cell, enableEditMode: false };
  }

  update(
    cell: Compatible<StringArrayCell>,
    cellToMerge: UncertainCompatible<StringArrayCell>
  ): Compatible<StringArrayCell> {
    return this.getCompatibleCell({
      ...cell,
      value: cellToMerge.value !== undefined ? cellToMerge.value : cell.value,
      text: cellToMerge.text !== undefined ? cellToMerge.text : cell.text,
      validationState: cellToMerge.validationState ?? cell.validationState,
      validationError: cellToMerge.validationError ?? cell.validationError,
      isEdited: cellToMerge.isEdited ?? cell.isEdited,
    });
  }

  render(
    cell: Compatible<StringArrayCell>,
    isInEditMode: boolean,
    onCellChanged: (cell: Compatible<StringArrayCell>, commit: boolean) => void
  ): React.ReactNode {
    return (
      <StringArrayCellView
        cell={cell}
        isInEditMode={isInEditMode}
        onCellChanged={onCellChanged}
      />
    );
  }
}

// Separate view component for better performance optimization
const StringArrayCellView: React.FC<{
  cell: Compatible<StringArrayCell>;
  isInEditMode: boolean;
  onCellChanged: (cell: Compatible<StringArrayCell>, commit: boolean) => void;
}> = React.memo(({ cell, isInEditMode, onCellChanged }) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [, forceUpdate] = useState(0); // Force re-render trigger
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const onCellChangedRef = useRef(onCellChanged);

  // Memoize cell key
  const cellKey = useMemo(
    () => `${JSON.stringify(cell.value)}_${cell.text}`,
    [cell.value, cell.text]
  );

  // Get current strings from static storage or cell value
  const getStrings = useCallback((): string[] => {
    if (isInEditMode && (StringArrayCellTemplate as any).pendingArrays.has(cellKey)) {
      return (StringArrayCellTemplate as any).pendingArrays.get(cellKey) || [];
    }
    return cell.value || [];
  }, [isInEditMode, cellKey, cell.value]);

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

  // Initialize pending array when entering edit mode
  useEffect(() => {
    if (isInEditMode) {
      setDropdownOpen(true);
      setInputValue('');
      
      // Initialize static storage with current cell value
      if (!(StringArrayCellTemplate as any).pendingArrays.has(cellKey)) {
        (StringArrayCellTemplate as any).pendingArrays.set(cellKey, [...(cell.value || [])]);
        forceUpdate(prev => prev + 1);
      }
    } else {
      setDropdownOpen(false);
    }
  }, [isInEditMode, cellKey, cell.value]);

  const handleAddString = () => {
    const trimmedValue = inputValue.trim();
    
    // Validation: prevent empty strings
    if (trimmedValue === '') {
      return;
    }
    
    const currentStrings = getStrings();
    
    // Validation: prevent duplicates (case-insensitive)
    if (currentStrings.some(s => s.toLowerCase() === trimmedValue.toLowerCase())) {
      return;
    }
    
    // Add to static storage
    const updatedStrings = [...currentStrings, trimmedValue];
    (StringArrayCellTemplate as any).pendingArrays.set(cellKey, updatedStrings);
    
    // Clear input and force re-render
    setInputValue('');
    forceUpdate(prev => prev + 1);
  };

  const handleRemoveString = (stringToRemove: string) => {
    const currentStrings = getStrings();
    const updatedStrings = currentStrings.filter(s => s !== stringToRemove);
    
    // Update static storage
    (StringArrayCellTemplate as any).pendingArrays.set(cellKey, updatedStrings);
    
    // Force re-render
    forceUpdate(prev => prev + 1);
  };

  const handleCommit = () => {
    const finalStrings = getStrings();
    
    // Create updated cell with final string array
    const updatedCell: StringArrayCell = {
      type: 'stringarray',
      value: finalStrings,
      text: finalStrings.length <= 2 ? finalStrings.join(', ') : `${finalStrings.length} items`,
    };
    
    setDropdownOpen(false);
    
    // Commit to ReactGrid
    onCellChangedRef.current(updatedCell as Compatible<StringArrayCell>, true);
    
    // Blur inputs
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Clean up static state
      (StringArrayCellTemplate as any).editingCells.delete(cellKey);
      (StringArrayCellTemplate as any).pendingArrays.delete(cellKey);
      
      setDropdownOpen(false);
      if (inputRef.current) {
        inputRef.current.blur();
      }
      if (textFieldRef.current) {
        textFieldRef.current.blur();
      }
      onCellChangedRef.current(cell, false);
    }
  };

  // Handle keyboard events from the TextField
  const handleTextFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      
      // If input has value, add it as a new string
      if (inputValue.trim()) {
        handleAddString();
      } else {
        // If input is empty, commit the changes
        handleCommit();
      }
    } else if (e.key === 'Escape') {
      // Clean up and blur
      (StringArrayCellTemplate as any).editingCells.delete(cellKey);
      (StringArrayCellTemplate as any).pendingArrays.delete(cellKey);
      setDropdownOpen(false);
      if (textFieldRef.current) {
        textFieldRef.current.blur();
      }
      // Don't preventDefault/stopPropagation - let it bubble to ReactGrid
    }
  };

  if (!isInEditMode) {
    // Display mode - show comma-separated or count
    const displayValue = cell.value && cell.value.length > 0 
      ? (cell.value.length <= 2 ? cell.value.join(', ') : `${cell.value.length} items`)
      : '';
    
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
        {displayValue}
      </div>
    );
  }

  // Edit mode - render chips + text input in dropdown
  const currentStrings = getStrings();
  
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
      {/* Transparent input to maintain ReactGrid focus */}
      <input
        ref={inputRef}
        type="text"
        value=""
        onChange={() => {}}
        autoFocus
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      
      {/* Dropdown panel with chips and input */}
      {dropdownOpen && (
        <div
          onPointerDownCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10000,
            maxHeight: 300,
            overflow: 'auto',
            border: '2px solid #1976d2',
            backgroundColor: 'white',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
            padding: '12px',
          }}
        >
          {/* Display current strings as chips */}
          {currentStrings.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                mb: 1.5,
                maxHeight: 120,
                overflow: 'auto',
              }}
              onPointerDownCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {currentStrings.map((str, index) => (
                <Chip
                  key={`${str}-${index}`}
                  label={str}
                  size="small"
                  onDelete={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveString(str);
                  }}
                  sx={{
                    backgroundColor: '#1976d2',
                    color: 'white',
                    '& .MuiChip-deleteIcon': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&:hover': {
                        color: 'white',
                      },
                    },
                  }}
                />
              ))}
            </Box>
          )}
          
          {/* Text input for adding new strings */}
          <TextField
            inputRef={textFieldRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleTextFieldKeyDown}
            placeholder="Type and press Enter to add..."
            autoFocus
            fullWidth
            size="small"
            variant="outlined"
            onPointerDownCapture={(e) => {
              e.stopPropagation();
            }}
            onClickCapture={(e) => {
              e.stopPropagation();
            }}
          />
          
          {/* Help text - matches MultiSelectCell styling */}
          <Box
            sx={{
              p: 0.5,
              borderTop: '1px solid #e0e0e0',
              backgroundColor: '#f5f5f5',
              fontSize: '11px',
              color: '#666',
              textAlign: 'center',
              mt: 1,
            }}
          >
            Press <strong>Enter</strong> to save • <strong>Esc</strong> to cancel
          </Box>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.isInEditMode === nextProps.isInEditMode &&
    JSON.stringify(prevProps.cell.value) === JSON.stringify(nextProps.cell.value) &&
    prevProps.cell.text === nextProps.cell.text &&
    prevProps.cell.validationState === nextProps.cell.validationState &&
    prevProps.cell.isEdited === nextProps.cell.isEdited
  );
});

StringArrayCellView.displayName = 'StringArrayCellView';

