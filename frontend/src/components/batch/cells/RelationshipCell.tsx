/**
 * Stage 1 Phase 4.2: Custom RelationshipCell for ReactGrid
 * 
 * Autocomplete/search cell for foreign key relationships (e.g., parent_languoid, family_languoid)
 * 
 * Key Implementation Details (learned from SelectCell):
 * - Uses capture phase event handlers (onPointerDownCapture, onClickCapture) to prevent
 *   ReactGrid from detecting focus loss and exiting edit mode prematurely
 * - Renders search/autocomplete dropdown inside the cell with absolute positioning
 * - Maintains focus on a transparent input element to keep ReactGrid in edit mode
 * - Uses static Set to track editing state and prevent stuck-in-edit-mode bugs
 * - Preserves validationState and isEdited for color highlighting
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Cell, CellTemplate, Compatible, Uncertain, UncertainCompatible } from '@silevis/reactgrid';
import { MenuItem, MenuList, TextField, CircularProgress, Box } from '@mui/material';

export interface RelationshipOption {
  value: number | string; // ID of the related object
  label: string; // Display name of the related object
}

export interface RelationshipCell extends Cell {
  type: 'relationship';
  value: number | string | null; // FK ID
  text: string; // Display name of the related object
  relationshipEndpoint: string; // API endpoint to fetch options
  // Validation and edit state for styling
  validationState?: 'valid' | 'invalid' | 'validating';
  isEdited?: boolean;
}

class RelationshipCellTemplate implements CellTemplate<RelationshipCell> {
  // Track if we're currently in edit mode with dropdown open
  // This prevents re-enabling edit mode when Enter is pressed to commit
  private static editingCells = new Set<string>();
  
  private getCellKey(cell: Compatible<RelationshipCell>): string {
    return `${cell.value}_${cell.text}_${cell.relationshipEndpoint}`;
  }

  getCompatibleCell(uncertainCell: Uncertain<RelationshipCell>): Compatible<RelationshipCell> {
    const value = uncertainCell.value !== undefined ? uncertainCell.value : null;
    const text = uncertainCell.text !== undefined ? uncertainCell.text : '';
    const cell: RelationshipCell = {
      type: 'relationship',
      value,
      text,
      relationshipEndpoint: (uncertainCell as any).relationshipEndpoint || '',
      validationState: (uncertainCell as any).validationState,
      isEdited: (uncertainCell as any).isEdited,
    };
    return cell as Compatible<RelationshipCell>;
  }
  
  isFocusable(cell: Compatible<RelationshipCell>): boolean {
    return true;
  }

  handleKeyDown(
    cell: Compatible<RelationshipCell>,
    keyCode: number,
    ctrl: boolean,
    shift: boolean,
    alt: boolean
  ): { cell: Compatible<RelationshipCell>; enableEditMode: boolean } {
    const ENTER = 13;
    const ESCAPE = 27;
    const BACKSPACE = 8;
    const DELETE = 46;
    const POINTER_EVENT = 1; // Double-click is represented as keyCode 1
    
    const cellKey = this.getCellKey(cell);
    
    // Delete or Backspace: clear the cell value
    if (keyCode === DELETE || keyCode === BACKSPACE) {
      const clearedCell: RelationshipCell = {
        type: 'relationship',
        value: null,
        text: '',
        relationshipEndpoint: cell.relationshipEndpoint,
        validationState: cell.validationState,
        isEdited: cell.isEdited,
      };
      return { cell: clearedCell as Compatible<RelationshipCell>, enableEditMode: false };
    }
    
    // If we're already editing this cell (dropdown is open), don't re-enable edit mode on Enter
    if (keyCode === ENTER && RelationshipCellTemplate.editingCells.has(cellKey)) {
      // Remove from tracking since dropdown will close
      RelationshipCellTemplate.editingCells.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    // Enter key or double-click: enable edit mode
    if (keyCode === ENTER || keyCode === POINTER_EVENT) {
      RelationshipCellTemplate.editingCells.add(cellKey);
      return { cell, enableEditMode: true };
    }
    
    // Escape: exit edit mode without committing
    if (keyCode === ESCAPE) {
      RelationshipCellTemplate.editingCells.delete(cellKey);
      return { cell, enableEditMode: false };
    }
    
    // For all other keys (including arrow keys), don't change the cell value
    // Arrow keys should navigate between cells, not change the value
    return { cell, enableEditMode: false };
  }

  update(cell: Compatible<RelationshipCell>, cellToMerge: UncertainCompatible<RelationshipCell>): Compatible<RelationshipCell> {
    return this.getCompatibleCell({ ...cell, ...cellToMerge });
  }

  render(
    cell: Compatible<RelationshipCell>,
    isInEditMode: boolean,
    onCellChanged: (cell: Compatible<RelationshipCell>, commit: boolean) => void
  ): React.ReactNode {
    return (
      <RelationshipCellView
        cell={cell}
        isInEditMode={isInEditMode}
        onCellChanged={onCellChanged}
      />
    );
  }
}

// Custom autocomplete/search component
const RelationshipCellView: React.FC<{
  cell: Compatible<RelationshipCell>;
  isInEditMode: boolean;
  onCellChanged: (cell: Compatible<RelationshipCell>, commit: boolean) => void;
}> = React.memo(({ cell, isInEditMode, onCellChanged }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [options, setOptions] = useState<RelationshipOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const onCellChangedRef = useRef(onCellChanged);

  // Memoize cell key to avoid recalculation on every render
  const cellKey = useMemo(
    () => `${cell.value}_${cell.text}_${cell.relationshipEndpoint}`,
    [cell.value, cell.text, cell.relationshipEndpoint]
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

  // Load options from API
  const loadOptions = useCallback(async (query: string) => {
    if (!cell.relationshipEndpoint) {
      console.error('No relationshipEndpoint provided for RelationshipCell');
      return;
    }

    setLoading(true);
    try {
      // Build URL with search query
      // Use Django backend base URL (port 8000), not React dev server (port 3000)
      const baseUrl = 'http://localhost:8000';
      const url = new URL(cell.relationshipEndpoint, baseUrl);
      if (query) {
        url.searchParams.append('search', query);
      }
      // Limit results for performance
      url.searchParams.append('page_size', '50');
      
      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch options: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON response received:', responseText.substring(0, 200));
        throw new Error(`Expected JSON but received ${contentType}`);
      }

      const data = await response.json();
      
      // Map API response to RelationshipOption format
      // For languoids: "name (glottocode)" format
      const mappedOptions: RelationshipOption[] = (data.results || data).map((item: any) => {
        let label = item.name || item.title || item.display_name || `ID: ${item.id}`;
        
        // If this is a languoid with a glottocode, append it
        if (item.glottocode) {
          label = `${label} (${item.glottocode})`;
        }
        
        return {
          value: item.id,
          label: label,
        };
      });

      setOptions(mappedOptions);
    } catch (error) {
      console.error('Error loading relationship options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [cell.relationshipEndpoint]);

  // Open dropdown and load initial options when entering edit mode
  useEffect(() => {
    if (isInEditMode) {
      setSearchQuery('');
      setDropdownOpen(true);
      setSelectedIndex(-1);
      loadOptions('');
    } else {
      setDropdownOpen(false);
      setOptions([]);
    }
  }, [isInEditMode, loadOptions]);

  // Debounced search
  useEffect(() => {
    if (!isInEditMode) return;

    const timeoutId = setTimeout(() => {
      loadOptions(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isInEditMode, loadOptions]);

  const handleSelect = (option: RelationshipOption) => {
    // Calculate OLD cell key BEFORE updating (this is what's in the Set)
    const oldCellKey = `${cell.value}_${cell.text}_${cell.relationshipEndpoint}`;
    
    // Immediately commit the change
    const updatedCell: RelationshipCell = {
      type: 'relationship',
      value: option.value,
      text: option.label,
      relationshipEndpoint: cell.relationshipEndpoint,
    };
    setDropdownOpen(false);
    
    // Manually remove from editingCells Set using OLD key to allow immediate next keypress
    (RelationshipCellTemplate as any).editingCells.delete(oldCellKey);
    
    // First commit the change to ReactGrid
    onCellChangedRef.current(updatedCell as Compatible<RelationshipCell>, true);
    
    // Then blur the input in the next tick to ensure ReactGrid processes the commit first
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }, 0);
  };

  const handleClear = () => {
    // Calculate OLD cell key BEFORE updating (this is what's in the Set)
    const oldCellKey = `${cell.value}_${cell.text}_${cell.relationshipEndpoint}`;
    
    // Clear the relationship (set to null)
    const updatedCell: RelationshipCell = {
      type: 'relationship',
      value: null,
      text: '',
      relationshipEndpoint: cell.relationshipEndpoint,
    };
    setDropdownOpen(false);
    
    // Manually remove from editingCells Set using OLD key to allow immediate next keypress
    (RelationshipCellTemplate as any).editingCells.delete(oldCellKey);
    
    onCellChangedRef.current(updatedCell as Compatible<RelationshipCell>, true);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Manually remove from Set since ReactGrid's template handleKeyDown isn't being called
      (RelationshipCellTemplate as any).editingCells.delete(cellKey);
      
      setDropdownOpen(false);
      if (inputRef.current) {
        inputRef.current.blur();
      }
      onCellChangedRef.current(cell, false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      // Navigate down in dropdown
      setSelectedIndex(prev => prev < options.length - 1 ? prev + 1 : prev);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      // Navigate up in dropdown
      setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // DON'T stopPropagation - let ReactGrid know Enter was pressed
      // If an option is selected, commit it
      if (selectedIndex >= 0 && selectedIndex < options.length) {
        handleSelect(options[selectedIndex]);
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

  // Edit mode - render search/autocomplete inside cell with absolute positioning
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
      {/* Transparent input to maintain focus */}
      <input
        ref={inputRef}
        type="text"
        value={cell.text || ''}
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
      
      {/* Search/autocomplete dropdown rendered inside cell but positioned absolutely */}
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
            overflow: 'hidden',
            border: '2px solid #1976d2',
            backgroundColor: 'white',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search input */}
          <Box sx={{ p: 1, borderBottom: '1px solid #e0e0e0' }}>
            <TextField
              inputRef={searchInputRef}
              size="small"
              fullWidth
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPointerDownCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClickCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onKeyDownCapture={(e) => {
                // Allow navigation keys (Escape, Enter, arrows) to propagate to parent handlers
                // But stop typing keys (backspace, letters, etc.) from reaching ReactGrid
                const isNavigationKey = [
                  'Escape',
                  'Enter',
                  'ArrowUp',
                  'ArrowDown',
                  'ArrowLeft',
                  'ArrowRight',
                  'Tab',
                ].includes(e.key);
                
                if (!isNavigationKey) {
                  // Typing keys, backspace, delete, etc. - stop propagation
                  e.stopPropagation();
                }
                // Navigation keys are allowed to propagate to parent handlers
              }}
              autoFocus
              InputProps={{
                endAdornment: loading ? <CircularProgress size={20} /> : null,
              }}
            />
          </Box>

          {/* Options list */}
          <div style={{ overflow: 'auto', maxHeight: 250 }}>
            <MenuList dense>
              {/* Clear option */}
              <MenuItem
                selected={selectedIndex === -1}
                onPointerDownCapture={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClickCapture={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClear();
                }}
                sx={{ fontStyle: 'italic', color: 'text.secondary' }}
              >
                (Clear selection)
              </MenuItem>

              {/* Loaded options */}
              {options.map((option, index) => (
                <MenuItem
                  key={option.value}
                  selected={index === selectedIndex}
                  onPointerDownCapture={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClickCapture={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {option.label}
                </MenuItem>
              ))}

              {/* No results message */}
              {!loading && options.length === 0 && (
                <MenuItem disabled>
                  No results found
                </MenuItem>
              )}
            </MenuList>
          </div>
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
    prevProps.cell.isEdited === nextProps.cell.isEdited &&
    prevProps.cell.relationshipEndpoint === nextProps.cell.relationshipEndpoint
  );
});

export { RelationshipCellTemplate, RelationshipCellView };

