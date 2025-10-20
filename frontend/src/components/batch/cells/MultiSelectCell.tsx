/**
 * MultiSelectCell: Custom ReactGrid cell for M2M relationship fields
 * 
 * Builds on RelationshipCell patterns with multi-selection support:
 * - API-driven autocomplete with search
 * - Chip display for selected items
 * - Click X on chip to remove
 * - Consistent styling with RelationshipCell
 * 
 * Key Implementation Pattern (from contextual memory stage1_031):
 * - Uses STATIC CLASS MEMBER (pendingSelections Map) to store selections during editing
 * - NO React useState for selections to avoid re-render focus loss
 * - Force re-render with dummy state counter when static Map updates
 * - Only commits to Redux on Enter key (final commit)
 * - This prevents ReactGrid from exiting edit mode during chip add/remove
 * 
 * Why this pattern?
 * From contextual memory: "The template system is stateless - any state tracking 
 * must be done via static class members or external stores" and "ReactGrid's 
 * architecture is event-driven and focus-based, not state-based - work with 
 * its patterns, not against them"
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Cell, 
  CellTemplate, 
  Compatible, 
  getCellProperty,
} from '@silevis/reactgrid';
import {
  TextField,
  MenuList,
  MenuItem,
  CircularProgress,
  Chip,
  Box,
} from '@mui/material';

// Key codes
const ENTER = 13;
const ESCAPE = 27;
const DELETE = 46;
const BACKSPACE = 8;

export interface MultiSelectCell extends Cell {
  type: 'multiselect';
  value: number[] | null; // Array of IDs
  text: string; // Display text (comma-separated names or "X selected")
  relationshipEndpoint: string; // API endpoint for fetching options
  validationState?: 'valid' | 'invalid' | 'validating';
  isEdited?: boolean;
}

interface MultiSelectOption {
  value: number;
  label: string;
}

class MultiSelectCellTemplate implements CellTemplate<MultiSelectCell> {
  private static editingCells = new Set<string>();
  // Static storage for selected options during multi-selection (before commit)
  // Key: cellKey (value_text_endpoint), Value: array of selected options
  private static pendingSelections = new Map<string, MultiSelectOption[]>();

  getCompatibleCell(uncertainCell: Compatible<MultiSelectCell>): Compatible<MultiSelectCell> {
    // Extract value directly - getCellProperty doesn't support array types
    const rawValue = (uncertainCell as any).value;
    const value: number[] | null = Array.isArray(rawValue) ? rawValue : null;
    const text = getCellProperty(uncertainCell, 'text', 'string');
    const relationshipEndpoint = getCellProperty(uncertainCell, 'relationshipEndpoint', 'string');
    
    // Preserve validation and edit state
    const validationState = (uncertainCell as any).validationState;
    const isEdited = (uncertainCell as any).isEdited;
    
    const cell: MultiSelectCell = {
      type: 'multiselect',
      value,
      text,
      relationshipEndpoint,
      validationState,
      isEdited,
    };
    
    return cell as Compatible<MultiSelectCell>;
  }

  isFocusable(cell: Compatible<MultiSelectCell>): boolean {
    return true;
  }

  handleKeyDown(
    cell: Compatible<MultiSelectCell>,
    keyCode: number,
    ctrl: boolean,
    shift: boolean,
    alt: boolean
  ): { cell: Compatible<MultiSelectCell>; enableEditMode: boolean } {
    const cellKey = `${cell.value}_${cell.text}_${cell.relationshipEndpoint}`;
    
    // Enter key: toggle edit mode
    if (keyCode === ENTER || keyCode === 1) {
      const isEditing = MultiSelectCellTemplate.editingCells.has(cellKey);
      if (!isEditing) {
        // Entering edit mode - initialize pending selections from current cell value
        MultiSelectCellTemplate.editingCells.add(cellKey);
        MultiSelectCellTemplate.pendingSelections.delete(cellKey); // Clear any stale data
        return { cell, enableEditMode: true };
      } else {
        // Exiting edit mode - clean up
        MultiSelectCellTemplate.editingCells.delete(cellKey);
        MultiSelectCellTemplate.pendingSelections.delete(cellKey);
        return { cell, enableEditMode: false };
      }
    }
    
    // Escape key: exit edit mode without committing
    if (keyCode === ESCAPE) {
      MultiSelectCellTemplate.editingCells.delete(cellKey);
      MultiSelectCellTemplate.pendingSelections.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    // Delete/Backspace: clear all selections
    if (keyCode === DELETE || keyCode === BACKSPACE) {
      MultiSelectCellTemplate.editingCells.delete(cellKey);
      MultiSelectCellTemplate.pendingSelections.delete(cellKey);
      const clearedCell: MultiSelectCell = {
        type: 'multiselect',
        value: null,
        text: '',
        relationshipEndpoint: cell.relationshipEndpoint,
        validationState: cell.validationState,
        isEdited: cell.isEdited,
      };
      return { cell: clearedCell as Compatible<MultiSelectCell>, enableEditMode: false };
    }
    
    return { cell, enableEditMode: false };
  }

  update(
    cell: Compatible<MultiSelectCell>,
    cellToMerge: Compatible<MultiSelectCell>
  ): Compatible<MultiSelectCell> {
    return this.getCompatibleCell({ ...cell, ...cellToMerge });
  }

  render(
    cell: Compatible<MultiSelectCell>,
    isInEditMode: boolean,
    onCellChanged: (cell: Compatible<MultiSelectCell>, commit: boolean) => void
  ): React.ReactNode {
    return (
      <MultiSelectCellView
        cell={cell}
        isInEditMode={isInEditMode}
        onCellChanged={onCellChanged}
      />
    );
  }
}

interface MultiSelectCellViewProps {
  cell: Compatible<MultiSelectCell>;
  isInEditMode: boolean;
  onCellChanged: (cell: Compatible<MultiSelectCell>, commit: boolean) => void;
}

const MultiSelectCellView: React.FC<MultiSelectCellViewProps> = React.memo(({
  cell,
  isInEditMode,
  onCellChanged,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<MultiSelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  // Force update trigger - increment to re-render when static pendingSelections changes
  const [, forceUpdate] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null); // Transparent input for focus
  const searchInputRef = useRef<HTMLInputElement>(null); // Search TextField
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize cell key to avoid recalculation on every render
  const cellKey = useMemo(
    () => `${cell.value}_${cell.text}_${cell.relationshipEndpoint}`,
    [cell.value, cell.text, cell.relationshipEndpoint]
  );

  // Get current selected options from static Map (if editing) or from cell value (if not)
  const getSelectedOptions = useCallback((): MultiSelectOption[] => {
    if (isInEditMode && MultiSelectCellTemplate['pendingSelections'].has(cellKey)) {
      return MultiSelectCellTemplate['pendingSelections'].get(cellKey) || [];
    }
    // Not editing or no pending selections - derive from cell.value and options
    if (cell.value && Array.isArray(cell.value) && options.length > 0) {
      return options.filter(opt => cell.value!.includes(opt.value));
    }
    return [];
  }, [isInEditMode, cellKey, cell.value, options]);

  // Helper to get cell background color based on validation state
  const getCellBackgroundColor = () => {
    if (cell.validationState === 'invalid') return '#ffebee'; // red
    if (cell.validationState === 'validating') return '#e3f2fd'; // blue
    if (cell.isEdited) return '#fff9c4'; // yellow
    return 'transparent';
  };

  // Load options from API with search
  const loadOptions = useCallback(async (query: string = '') => {
    if (!cell.relationshipEndpoint) return;
    
    setLoading(true);
    try {
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
      const url = new URL(cell.relationshipEndpoint, baseUrl || window.location.origin);
      if (query) {
        url.searchParams.append('search', query);
      }
      url.searchParams.append('page_size', '50');
      
      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      const mappedOptions: MultiSelectOption[] = (data.results || data).map((item: any) => {
        let label = item.name || item.title || item.display_name || `ID: ${item.id}`;
        if (item.glottocode) {
          label = `${label} (${item.glottocode})`;
        }
        return { value: item.id, label: label };
      });
      
      setOptions(mappedOptions);
    } catch (error) {
      console.error('Error loading multiselect options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [cell.relationshipEndpoint]);

  // Initialize selected options from cell value when entering edit mode
  useEffect(() => {
    if (!isInEditMode) return;
    
    // Load initial options
    loadOptions('');
    
    // Initialize pending selections in static Map from current cell value
    if (cell.value && Array.isArray(cell.value) && cell.value.length > 0) {
      // We need to wait for options to load to get the labels
      // This will be handled in the options useEffect below
    } else {
      // No existing values - start with empty selection
      MultiSelectCellTemplate['pendingSelections'].set(cellKey, []);
      forceUpdate(prev => prev + 1);
    }
  }, [isInEditMode, cellKey, cell.value, loadOptions]);

  // Update pending selections when options load and we have existing cell values
  useEffect(() => {
    if (!isInEditMode) return;
    if (!cell.value || !Array.isArray(cell.value) || cell.value.length === 0) return;
    if (options.length === 0) return;
    
    // Only initialize if we haven't set pending selections yet
    if (!MultiSelectCellTemplate['pendingSelections'].has(cellKey)) {
      const selected = options.filter(opt => cell.value!.includes(opt.value));
      MultiSelectCellTemplate['pendingSelections'].set(cellKey, selected);
      forceUpdate(prev => prev + 1);
    }
  }, [options, cell.value, isInEditMode, cellKey]);

  // Debounced search
  useEffect(() => {
    if (!isInEditMode) return;
    
    const timer = setTimeout(() => {
      loadOptions(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, isInEditMode, loadOptions]);

  const handleSelect = (option: MultiSelectOption) => {
    // Get current selections from static Map
    const currentSelected = MultiSelectCellTemplate['pendingSelections'].get(cellKey) || [];
    
    // Add to selected if not already selected
    if (!currentSelected.find(opt => opt.value === option.value)) {
      const newSelected = [...currentSelected, option];
      
      // Update static Map - NO React state update, NO Redux commit
      MultiSelectCellTemplate['pendingSelections'].set(cellKey, newSelected);
      
      // Force re-render to show the new chip
      forceUpdate(prev => prev + 1);
      
      setSearchQuery(''); // Clear search after selection
      
      // Refocus search input for continued selection
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 0);
    }
  };

  const handleRemove = (optionToRemove: MultiSelectOption) => {
    // Get current selections from static Map
    const currentSelected = MultiSelectCellTemplate['pendingSelections'].get(cellKey) || [];
    
    const newSelected = currentSelected.filter(opt => opt.value !== optionToRemove.value);
    
    // Update static Map - NO React state update, NO Redux commit
    MultiSelectCellTemplate['pendingSelections'].set(cellKey, newSelected);
    
    // Force re-render to show chip removal
    forceUpdate(prev => prev + 1);
    
    // Refocus search input
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Exit edit mode without committing
      const cellKey = `${cell.value}_${cell.text}_${cell.relationshipEndpoint}`;
      
      MultiSelectCellTemplate['editingCells'].delete(cellKey);
      MultiSelectCellTemplate['pendingSelections'].delete(cellKey);
      
      // Blur BOTH inputs to ensure focus is lost
      if (searchInputRef.current) {
        searchInputRef.current.blur();
      }
      if (inputRef.current) {
        inputRef.current.blur();
      }
      
      onCellChanged(cell, false);
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      // Commit changes from static Map and exit edit mode
      const cellKey = `${cell.value}_${cell.text}_${cell.relationshipEndpoint}`;
      const currentSelected = MultiSelectCellTemplate['pendingSelections'].get(cellKey) || [];
      
      MultiSelectCellTemplate['editingCells'].delete(cellKey);
      MultiSelectCellTemplate['pendingSelections'].delete(cellKey);
      
      // Create final cell with current selections
      const finalCell: MultiSelectCell = {
        ...cell,
        type: 'multiselect',
        value: currentSelected.length > 0 ? currentSelected.map(opt => opt.value) : null,
        text: currentSelected.length > 0 ? currentSelected.map(opt => opt.label).join(', ') : '',
        relationshipEndpoint: cell.relationshipEndpoint,
        validationState: cell.validationState,
        isEdited: cell.isEdited,
      };
      
      if (inputRef.current) {
        inputRef.current.blur();
      }
      
      // Commit with true to save changes to Redux
      onCellChanged(finalCell as Compatible<MultiSelectCell>, true);
      return;
    }
    
    // Navigation keys for dropdown
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      // Let the browser handle arrow navigation in MenuList
    }
  };

  // Display mode
  if (!isInEditMode) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          backgroundColor: getCellBackgroundColor(),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {cell.text || ''}
      </div>
    );
  }

  // Edit mode
  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: getCellBackgroundColor(),
      }}
    >
      {/* Transparent input for focus management */}
      <input
        ref={inputRef}
        autoFocus
        value=""
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          caretColor: 'transparent',
          cursor: 'default',
          zIndex: 1,
        }}
      />
      
      {/* Dropdown UI - styled to match RelationshipCell */}
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
          maxHeight: 400, // Slightly taller than RelationshipCell to accommodate chips
          overflow: 'hidden',
          border: '2px solid #1976d2',
          backgroundColor: 'white',
          boxShadow: '0px 5px 15px rgba(0,0,0,0.3)',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Selected chips at top */}
        {getSelectedOptions().length > 0 && (
          <Box
            sx={{
              p: 1,
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.5,
            }}
            onPointerDownCapture={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {getSelectedOptions().map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                size="small"
                onDelete={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemove(option);
                }}
                sx={{
                  backgroundColor: '#1976d2',
                  color: '#fff',
                  '& .MuiChip-deleteIcon': {
                    color: '#fff',
                  },
                }}
              />
            ))}
          </Box>
        )}
        
        {/* Search field - wrapped in Box to match RelationshipCell */}
        <Box sx={{ p: 1, borderBottom: '1px solid #e0e0e0' }}>
          <TextField
            inputRef={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            size="small"
            fullWidth
            autoFocus
            onKeyDown={(e) => {
              // Handle Enter - commit and close
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                // Manually trigger the parent handleKeyDown logic
                handleKeyDown(e as any);
                return;
              }
              
              // Handle Escape - clean up and let it propagate to ReactGrid
              if (e.key === 'Escape') {
                // Clean up our static state
                const cellKey = `${cell.value}_${cell.text}_${cell.relationshipEndpoint}`;
                MultiSelectCellTemplate['editingCells'].delete(cellKey);
                MultiSelectCellTemplate['pendingSelections'].delete(cellKey);
                
                // Blur the search input
                if (searchInputRef.current) {
                  searchInputRef.current.blur();
                }
                
                // DON'T preventDefault or stopPropagation - let it bubble to ReactGrid
                // ReactGrid's template handleKeyDown will see Escape and exit edit mode
                return;
              }
              
              // For typing keys (not navigation keys), stop propagation
              // so they work in the search field
              const isNavigationKey = [
                'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
              ].includes(e.key);
              
              if (!isNavigationKey) {
                e.stopPropagation();
              }
            }}
            InputProps={{
              endAdornment: loading ? <CircularProgress size={20} /> : null,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#fff',
              },
            }}
          />
        </Box>
        
        {/* Options list - scrolling moved to MenuList like RelationshipCell */}
        <MenuList dense sx={{ maxHeight: 250, overflow: 'auto' }}>
          {options.length === 0 && !loading && (
            <MenuItem disabled>
              <em>{searchQuery ? 'No options found' : 'Start typing to search...'}</em>
            </MenuItem>
          )}
          {options
            .filter(opt => !getSelectedOptions().find(sel => sel.value === opt.value))
            .map((option) => (
              <MenuItem
                key={option.value}
                onPointerDownCapture={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClickCapture={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(option);
                }}
              >
                {option.label}
              </MenuItem>
            ))}
        </MenuList>
        
        {/* Help text */}
        <Box
          sx={{
            p: 0.5,
            borderTop: '1px solid #e0e0e0',
            backgroundColor: '#f5f5f5',
            fontSize: '11px',
            color: '#666',
            textAlign: 'center',
          }}
        >
          Press <strong>Enter</strong> to save • <strong>Esc</strong> to cancel
        </Box>
      </div>
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
    prevProps.cell.isEdited === nextProps.cell.isEdited &&
    prevProps.cell.relationshipEndpoint === nextProps.cell.relationshipEndpoint
  );
});

// Export template (interface already exported above)
export { MultiSelectCellTemplate };

