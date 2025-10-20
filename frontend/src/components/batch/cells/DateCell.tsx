/**
 * DateCell - Custom ReactGrid cell for flexible date input
 * 
 * Integrates Stage 0 date handling patterns with Stage 1 batch editing:
 * - Plain text input (no date picker) for maximum flexibility
 * - Real-time date interpretation feedback (mirrors backend logic)
 * - Format help guidance shown in dropdown panel
 * - Supports approximate/uncertain dates for cultural archives
 * - Backend standardization on save (MM/DD/YYYY → YYYY/MM/DD)
 * 
 * Architecture parallels:
 * - Stage 0: EditableTextField + DateInterpretationFeedback + DateFormatHelp
 * - Stage 1: Transparent input + dropdown panel + validation states
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Cell, CellTemplate, Compatible, Uncertain, UncertainCompatible } from '@silevis/reactgrid';
import { TextField, Box, Typography, Chip, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { interpretDateInput } from '../../../utils/dateStandardization';

export interface DateCell extends Cell {
  type: 'date';
  value: string; // Raw date string (flexible format)
  text: string;  // Display text (same as value)
  validationState?: 'valid' | 'invalid' | 'validating';
  validationError?: string;
  isEdited?: boolean;
}

export type DateCellType = DateCell;

export class DateCellTemplate implements CellTemplate<DateCell> {
  // Track which cells are in edit mode to prevent stuck-in-edit-mode bugs
  private static editingCells = new Set<string>();
  
  private getCellKey(cell: Compatible<DateCell>): string {
    return `${cell.value}_${cell.text}`;
  }

  getCompatibleCell(uncertainCell: Uncertain<DateCell>): Compatible<DateCell> {
    const value = uncertainCell.value ?? '';
    const text = uncertainCell.text !== undefined ? uncertainCell.text : value;
    const cell: DateCell = {
      type: 'date',
      value,
      text,
      validationState: (uncertainCell as any).validationState,
      validationError: (uncertainCell as any).validationError,
      isEdited: (uncertainCell as any).isEdited,
    };
    return cell as Compatible<DateCell>;
  }

  update(cell: Compatible<DateCell>, cellToMerge: UncertainCompatible<DateCell>): Compatible<DateCell> {
    return this.getCompatibleCell({
      ...cell,
      value: cellToMerge.value ?? cell.value,
      text: cellToMerge.text ?? cellToMerge.value ?? cell.text,
      validationState: cellToMerge.validationState ?? cell.validationState,
      validationError: cellToMerge.validationError ?? cell.validationError,
      isEdited: cellToMerge.isEdited ?? cell.isEdited,
    });
  }

  handleKeyDown(
    cell: Compatible<DateCell>,
    keyCode: number,
    ctrl: boolean,
    shift: boolean,
    alt: boolean
  ): { cell: Compatible<DateCell>; enableEditMode: boolean } {
    const ENTER = 13;
    const ESCAPE = 27;
    const DELETE = 46;
    const BACKSPACE = 8;
    const POINTER_EVENT = 1; // Double-click is represented as keyCode 1
    
    const cellKey = this.getCellKey(cell);
    
    // Delete or Backspace: clear the cell value
    if (!ctrl && !alt && (keyCode === DELETE || keyCode === BACKSPACE)) {
      const clearedCell: DateCell = {
        type: 'date',
        value: '',
        text: '',
      };
      return { cell: clearedCell as Compatible<DateCell>, enableEditMode: false };
    }
    
    // If we're already editing this cell (dropdown is open), don't re-enable edit mode on Enter
    if (keyCode === ENTER && DateCellTemplate.editingCells.has(cellKey)) {
      // Remove from tracking since dropdown will close
      DateCellTemplate.editingCells.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    // Enter key or double-click: enable edit mode
    if (keyCode === ENTER || keyCode === POINTER_EVENT) {
      DateCellTemplate.editingCells.add(cellKey);
      return { cell, enableEditMode: true };
    }
    
    // Escape: exit edit mode without committing
    if (keyCode === ESCAPE) {
      DateCellTemplate.editingCells.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    return { cell, enableEditMode: false };
  }

  render(
    cell: Compatible<DateCell>,
    isInEditMode: boolean,
    onCellChanged: (cell: Compatible<DateCell>, commit: boolean) => void
  ): React.ReactNode {
    return (
      <DateCellView
        cell={cell}
        isInEditMode={isInEditMode}
        onCellChanged={onCellChanged}
      />
    );
  }
}

// Separate view component for better performance optimization
const DateCellView: React.FC<{
  cell: Compatible<DateCell>;
  isInEditMode: boolean;
  onCellChanged: (cell: Compatible<DateCell>, commit: boolean) => void;
}> = React.memo(({ cell, isInEditMode, onCellChanged }) => {
  const [inputValue, setInputValue] = useState<string>(cell.value);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const onCellChangedRef = useRef(onCellChanged);

  // Memoize cell key to avoid recalculation on every render
  const cellKey = useMemo(
    () => `${cell.value}_${cell.text}`,
    [cell.value, cell.text]
  );

  // Get real-time date interpretation
  const interpretation = useMemo(
    () => interpretDateInput(inputValue),
    [inputValue]
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

  // Open dropdown and set input value when entering edit mode
  useEffect(() => {
    if (isInEditMode) {
      setInputValue(cell.value);
      setDropdownOpen(true);
    } else {
      setDropdownOpen(false);
    }
  }, [isInEditMode, cell.value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
  };

  const handleCommit = () => {
    const updatedCell: DateCell = {
      type: 'date',
      value: inputValue,
      text: inputValue,
    };
    
    setDropdownOpen(false);
    
    // First commit the change to ReactGrid
    onCellChangedRef.current(updatedCell as Compatible<DateCell>, true);
    
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
      (DateCellTemplate as any).editingCells.delete(cellKey);
      
      setDropdownOpen(false);
      if (inputRef.current) {
        inputRef.current.blur();
      }
      onCellChangedRef.current(cell, false);
    }
  };

  // Handle keyboard events from the TextField (where focus actually is)
  const handleTextFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleCommit();
    } else if (e.key === 'Escape') {
      // Clean up static state and blur
      (DateCellTemplate as any).editingCells.delete(cellKey);
      setDropdownOpen(false);
      if (textFieldRef.current) {
        textFieldRef.current.blur();
      }
      // Don't preventDefault/stopPropagation - let it bubble to ReactGrid
    }
  };

  // Get feedback icon based on interpretation status
  const getFeedbackIcon = () => {
    switch (interpretation.status) {
      case 'preferred':
        return <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'convertible':
        return <ArrowForwardIcon sx={{ fontSize: 16, color: 'info.main' }} />;
      case 'unrecognized':
        return <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
      default:
        return null;
    }
  };

  const getFeedbackColor = () => {
    switch (interpretation.status) {
      case 'preferred':
        return 'success.main';
      case 'convertible':
        return 'info.main';
      case 'unrecognized':
        return 'text.secondary';
      default:
        return 'text.secondary';
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
        {cell.text || ''}
      </div>
    );
  }

  // Edit mode - render text field with dropdown feedback panel
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
        value={inputValue}
        onChange={() => {
          // Ignore changes - actual input happens in TextField below
        }}
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
          padding: '0 8px',
          fontSize: '14px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      
      {/* Actual text input (Material-UI TextField for better UX) */}
      <TextField
        inputRef={textFieldRef}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleTextFieldKeyDown}
        autoFocus
        fullWidth
        variant="standard"
        placeholder="e.g., 2023, 2023/03/15, circa 1950"
        InputProps={{
          disableUnderline: true,
          style: {
            fontSize: '14px',
            padding: '0 8px',
            height: '100%',
          },
        }}
        sx={{
          '& .MuiInput-root': {
            height: '100%',
          },
        }}
        onPointerDownCapture={(e) => {
          // Prevent ReactGrid from detecting focus loss
          e.stopPropagation();
        }}
        onClickCapture={(e) => {
          e.stopPropagation();
        }}
      />
      
      {/* Dropdown panel with date interpretation feedback and format help */}
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
            maxHeight: 300,
            overflow: 'auto',
            border: '2px solid #1976d2',
            backgroundColor: 'white',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
            padding: '12px',
          }}
        >
          {/* Date Interpretation Feedback */}
          {interpretation.status !== 'empty' && (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                mb: 2,
                p: 1,
                bgcolor: interpretation.status === 'preferred' ? 'success.light' : 
                         interpretation.status === 'convertible' ? 'info.light' : 'grey.100',
                borderRadius: 1,
              }}
            >
              {getFeedbackIcon()}
              <Typography 
                variant="caption" 
                sx={{ 
                  color: getFeedbackColor(),
                  fontSize: '0.75rem',
                  fontWeight: 'medium',
                }}
              >
                {interpretation.message}
              </Typography>
            </Box>
          )}
          
          {/* Date Format Help */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'medium', display: 'block', mb: 1 }}>
              Accepted date formats:
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <Chip label="2023" size="small" variant="outlined" />
              <Chip label="2023/03" size="small" variant="outlined" />
              <Chip label="2023/03/15" size="small" variant="outlined" />
              <Chip label="03/15/2023" size="small" variant="outlined" />
              <Chip label="2020-2023" size="small" variant="outlined" />
              <Chip label="2023/03-2024/05" size="small" variant="outlined" />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
              American format (MM/DD/YYYY) will be converted to standard format (YYYY/MM/DD) when saved.
              Approximate dates (e.g., "circa 1950", "1990s?") are also accepted.
            </Typography>
          </Box>
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

DateCellView.displayName = 'DateCellView';


