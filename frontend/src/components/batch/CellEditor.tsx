/**
 * CellEditor Component
 * Phase 3: Cell Editing Framework
 * 
 * Renders the appropriate editor based on cell type.
 * Integrates with existing cell editor components from ReactGrid implementation.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Select, MenuItem, SelectChangeEvent, TextField, CircularProgress, Box, MenuList, Chip } from '@mui/material';
import { SpreadsheetCell, ColumnConfig } from '../../types/spreadsheet';

interface RelationshipOption {
  value: number | string;
  label: string;
}

interface MultiSelectOption {
  value: number | string;
  label: string;
}

interface CellEditorProps {
  cell: SpreadsheetCell;
  columnConfig: ColumnConfig;
  onCommit: (value: any, moveDown?: boolean) => void;
  onCancel: () => void;
  debug?: boolean;
}

export const CellEditor: React.FC<CellEditorProps> = ({
  cell,
  columnConfig,
  onCommit,
  onCancel,
  debug = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const multiSelectInitializedRef = useRef(false);
  const selectCommittedRef = useRef(false); // Track if select value was committed
  const booleanCommittedRef = useRef(false); // Track if boolean value was committed
  
  // State for select editor (used conditionally but declared at top level)
  const [selectValue, setSelectValue] = useState(cell.value || '');
  const [isSelectOpen, setIsSelectOpen] = useState(true);
  
  // State for relationship editor (declared at top level)
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<RelationshipOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // State for multiselect editor (declared at top level)
  const [multiSelectSearchQuery, setMultiSelectSearchQuery] = useState('');
  const [multiSelectOptions, setMultiSelectOptions] = useState<MultiSelectOption[]>([]);
  const [multiSelectLoading, setMultiSelectLoading] = useState(false);
  const [selectedMultiSelectOptions, setSelectedMultiSelectOptions] = useState<MultiSelectOption[]>([]);
  
  // State for stringarray editor (declared at top level)
  const [stringArrayInput, setStringArrayInput] = useState('');
  const [stringArrayItems, setStringArrayItems] = useState<string[]>(
    cell.type === 'stringarray' && Array.isArray(cell.value) ? cell.value : []
  );

  // Load options from API (for relationship editor)
  const loadOptions = useCallback(async (query: string) => {
    if (!columnConfig.relationshipEndpoint) {
      console.error('[CellEditor] No relationshipEndpoint provided for relationship cell');
      return;
    }

    setLoading(true);
    try {
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
      const url = new URL(columnConfig.relationshipEndpoint, baseUrl || window.location.origin);
      if (query) {
        url.searchParams.append('search', query);
      }
      url.searchParams.append('page_size', '200');

      const response = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch options: ${response.status}`);
      }

      const data = await response.json();
      const mappedOptions: RelationshipOption[] = (data.results || data).map((item: any) => {
        let label = item.name || item.title || item.display_name || `ID: ${item.id}`;
        if (item.glottocode) {
          label = `${label} (${item.glottocode})`;
        }
        return { value: item.id, label };
      });

      setOptions(mappedOptions);
    } catch (error) {
      console.error('[CellEditor] Error loading relationship options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [columnConfig.relationshipEndpoint]);

  // Load options from API (for multiselect editor)
  const loadMultiSelectOptions = useCallback(async (query: string) => {
    if (!columnConfig.relationshipEndpoint) {
      console.error('[CellEditor] No relationshipEndpoint provided for multiselect cell');
      return;
    }

    setMultiSelectLoading(true);
    try {
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
      const url = new URL(columnConfig.relationshipEndpoint, baseUrl || window.location.origin);
      if (query) {
        url.searchParams.append('search', query);
      }
      url.searchParams.append('page_size', '200');

      const response = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch options: ${response.status}`);
      }

      const data = await response.json();
      const mappedOptions: MultiSelectOption[] = (data.results || data).map((item: any) => {
        let label = item.name || item.title || item.display_name || `ID: ${item.id}`;
        if (item.glottocode) {
          label = `${label} (${item.glottocode})`;
        }
        // Return option with full item data for later use
        return { 
          value: item.id, 
          label,
          // Store raw data for preserving after commit
          itemData: {
            id: item.id,
            name: item.name,
            glottocode: item.glottocode,
          }
        } as any;  // Cast to any to allow extra itemData property
      });

      setMultiSelectOptions(mappedOptions);
    } catch (error) {
      console.error('[CellEditor] Error loading multiselect options:', error);
      setMultiSelectOptions([]);
    } finally {
      setMultiSelectLoading(false);
    }
  }, [columnConfig.relationshipEndpoint]);

  // Auto-focus on mount for text input, move cursor to end (don't select all)
  useEffect(() => {
    if (cell.type === 'text' || cell.type === 'decimal' || cell.type === 'stringarray') {
      if (inputRef.current) {
        inputRef.current.focus();
        // Move cursor to end instead of selecting all text
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }
  }, [cell.type]);

  // Load initial options for relationship editor
  useEffect(() => {
    if (cell.type === 'relationship') {
      loadOptions('');
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [cell.type, loadOptions]);

  // Debounced search for relationship editor
  useEffect(() => {
    if (cell.type === 'relationship') {
      const timeoutId = setTimeout(() => {
        loadOptions(searchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, cell.type, loadOptions]);

  // Load initial options for multiselect editor
  useEffect(() => {
    if (cell.type === 'multiselect') {
      loadMultiSelectOptions('');
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [cell.type, loadMultiSelectOptions]);

  // Update selectedMultiSelectOptions when options load (for multiselect)
  // Only run once when options first load, not on every options change
  useEffect(() => {
    if (cell.type === 'multiselect' && multiSelectOptions.length > 0) {
      // Only initialize once per editor mount, using ref to track
      if (!multiSelectInitializedRef.current && cell.value && Array.isArray(cell.value) && cell.value.length > 0) {
        // cell.value should be an array of objects with {id, name, glottocode} from collaboratorToRow
        const selected = cell.value.map((item: any) => {
          // Format label as "name (glottocode)" if glottocode exists
          const label = item.glottocode 
            ? `${item.name} (${item.glottocode})`
            : item.name || String(item.id || item);
          
          return {
            value: item.id || item,
            label: label,
            // Attach itemData so it's preserved when committing
            itemData: {
              id: item.id,
              name: item.name,
              glottocode: item.glottocode,
            }
          } as any;
        });
        
        setSelectedMultiSelectOptions(selected);
        multiSelectInitializedRef.current = true; // Mark as initialized
      }
    }
  }, [cell.type, multiSelectOptions, cell.value]);

  // Debounced search for multiselect editor
  useEffect(() => {
    if (cell.type === 'multiselect') {
      const timeoutId = setTimeout(() => {
        loadMultiSelectOptions(multiSelectSearchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [multiSelectSearchQuery, cell.type, loadMultiSelectOptions]);

  // Phase 3.1 & 3.5: Text and StringArray editors
  if (cell.type === 'text' || cell.type === 'decimal') {
    // Simple text input for text/decimal types
    return (
      <input
        ref={inputRef}
        type="text"
        defaultValue={cell.text}
        aria-label={`Edit ${columnConfig.header}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const value = (e.target as HTMLInputElement).value;
            onCommit(value, true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if (e.key === 'Tab') {
            const value = (e.target as HTMLInputElement).value;
            onCommit(value, false);
          }
        }}
        onBlur={(e) => {
          const value = e.target.value;
          onCommit(value, false);
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          height: '100%',
          padding: '8px 12px',
          border: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          backgroundColor: '#ffffff',
        }}
      />
    );
  }

  // Phase 3.5: StringArray editor (chip-based, like MultiSelect but for plain strings)
  if (cell.type === 'stringarray') {
    const handleStringArrayAdd = () => {
      const trimmed = stringArrayInput.trim();
      if (!trimmed) return;
      
      // Prevent duplicates (case-insensitive)
      if (stringArrayItems.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
        setStringArrayInput('');
        return;
      }
      
      setStringArrayItems([...stringArrayItems, trimmed]);
      setStringArrayInput('');
      
      // Refocus input
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 0);
    };

    const handleStringArrayRemove = (item: string) => {
      setStringArrayItems(stringArrayItems.filter(s => s !== item));
      
      // Refocus input
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 0);
    };

    const handleStringArrayCommit = () => {
      const text = stringArrayItems.join(', ');
      onCommit({ value: stringArrayItems.length > 0 ? stringArrayItems : null, text }, true);
    };

    const handleStringArrayBlur = () => {
      // When focus leaves, commit current items
      setTimeout(() => {
        handleStringArrayCommit();
      }, 200);
    };

    const handleStringArrayKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        
        // If input has text, add it as chip
        if (stringArrayInput.trim()) {
          handleStringArrayAdd();
        } else {
          // If input is empty, commit and close
          handleStringArrayCommit();
        }
      }
    };

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          backgroundColor: '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input field */}
        <Box sx={{ p: 1, borderBottom: '1px solid #e0e0e0', height: '100%', display: 'flex', alignItems: 'center' }}>
          <TextField
            inputRef={searchInputRef}
            size="small"
            fullWidth
            placeholder="Type and press Enter to add..."
            value={stringArrayInput}
            onChange={(e) => setStringArrayInput(e.target.value)}
            onKeyDown={handleStringArrayKeyDown}
            onBlur={handleStringArrayBlur}
            autoFocus
            inputProps={{
              'aria-label': `Add item to ${columnConfig.header}`,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: 'inherit',
                fontFamily: 'inherit',
              },
            }}
          />
        </Box>

        {/* Chips dropdown */}
        {stringArrayItems.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 9999,
              maxHeight: 200,
              overflow: 'auto',
              backgroundColor: 'white',
              border: '2px solid #1976d2',
              borderTop: '1px solid #e0e0e0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <Box
              sx={{
                p: 1,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {stringArrayItems.map((item, index) => (
                <Chip
                  key={index}
                  label={item}
                  size="small"
                  onDelete={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStringArrayRemove(item);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  sx={{
                    backgroundColor: '#1976d2',
                    color: '#fff',
                    '& .MuiChip-deleteIcon': {
                      color: '#fff',
                      '&:hover': {
                        color: '#ffcccc',
                      },
                    },
                  }}
                />
              ))}
            </Box>
          </div>
        )}
      </div>
    );
  }

  // Phase 3.6: Boolean editor (three-state dropdown: Yes/No/Not specified)
  if (cell.type === 'boolean') {
    // Map cell value to boolean
    let booleanValue: boolean | null = null;
    if (cell.value === 'true' || cell.value === true) {
      booleanValue = true;
    } else if (cell.value === 'false' || cell.value === false) {
      booleanValue = false;
    }
    
    const handleBooleanChange = (event: SelectChangeEvent<string>) => {
      const newValue = event.target.value;
      let boolValue: boolean | null = null;
      let displayText = 'Not specified';
      
      if (newValue === 'true') {
        boolValue = true;
        displayText = 'Yes';
      } else if (newValue === 'false') {
        boolValue = false;
        displayText = 'No';
      }
      
      // Mark as committed and close dropdown
      booleanCommittedRef.current = true;
      setIsSelectOpen(false);
      setTimeout(() => {
        onCommit({ value: boolValue, text: displayText }, true);
      }, 0);
    };

    const handleBooleanKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsSelectOpen(false);
        setTimeout(() => {
          onCancel();
        }, 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        booleanCommittedRef.current = true;
        setIsSelectOpen(false);
        
        // Get current boolean value (not string)
        const displayText = booleanValue === true ? 'Yes' : booleanValue === false ? 'No' : 'Not specified';
        
        setTimeout(() => {
          onCommit({ value: booleanValue, text: displayText }, true);
        }, 0);
      }
    };

    const handleBooleanClose = () => {
      setIsSelectOpen(false);
      
      // Only commit if we haven't already committed (prevents double-commit)
      if (!booleanCommittedRef.current) {
        // User clicked away without selecting - commit current value
      const displayText = booleanValue === true ? 'Yes' : booleanValue === false ? 'No' : 'Not specified';
      
      setTimeout(() => {
          onCommit({ value: booleanValue, text: displayText }, false);
      }, 0);
      }
      // Reset the flag for next time
      booleanCommittedRef.current = false;
    };

    return (
      <Select
        value={booleanValue === true ? 'true' : booleanValue === false ? 'false' : ''}
        onChange={handleBooleanChange}
        onKeyDown={handleBooleanKeyDown}
        onClose={handleBooleanClose}
        open={isSelectOpen}
        onOpen={() => setIsSelectOpen(true)}
        autoFocus
        size="small"
        fullWidth
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        inputProps={{
          'aria-label': `Edit ${columnConfig.header}`,
        }}
        sx={{
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '& .MuiSelect-select': {
            padding: '8px 12px',
            fontSize: 'inherit',
            fontFamily: 'inherit',
          },
        }}
      >
        <MenuItem value="">Not specified</MenuItem>
        <MenuItem value="true">Yes</MenuItem>
        <MenuItem value="false">No</MenuItem>
      </Select>
    );
  }

  // Phase 3.2: Select editor (dropdown)
  if (cell.type === 'select') {
    const handleSelectChange = (event: SelectChangeEvent<string>) => {
      const newValue = event.target.value;
      setSelectValue(newValue);
      selectCommittedRef.current = true; // Mark that we're committing
      // Close dropdown first
      setIsSelectOpen(false);
      // Then commit immediately when selection changes
      setTimeout(() => {
        onCommit(newValue, true); // Move down after selecting
      }, 0);
    };

    const handleSelectKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsSelectOpen(false);
        // Delay cancel to let dropdown close first
        setTimeout(() => {
          onCancel();
        }, 0);
      } else if (e.key === 'Enter') {
        // Enter commits current value
        e.preventDefault();
        e.stopPropagation();
        selectCommittedRef.current = true; // Mark that we're committing
        setIsSelectOpen(false);
        setTimeout(() => {
          onCommit(selectValue, true);
        }, 0);
      }
    };

    const handleSelectClose = () => {
      // When dropdown closes, check if we already committed
      setIsSelectOpen(false);
      setTimeout(() => {
        if (!selectCommittedRef.current) {
          // User clicked away without selecting - cancel
          onCancel();
        }
        // Reset for next time
        selectCommittedRef.current = false;
      }, 10); // Small delay to let commit finish first
    };

    return (
      <Select
        value={selectValue}
        onChange={handleSelectChange}
        onKeyDown={handleSelectKeyDown}
        onClose={handleSelectClose}
        open={isSelectOpen}
        onOpen={() => setIsSelectOpen(true)}
        autoFocus
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        inputProps={{
          'aria-label': `Edit ${columnConfig.header}`,
        }}
        sx={{
          width: '100%',
          height: '100%',
          '& .MuiSelect-select': {
            padding: '8px 12px',
            fontSize: 'inherit',
            fontFamily: 'inherit',
          },
          '& fieldset': {
            border: 'none',
          },
        }}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight: 300,
            },
          },
        }}
      >
        {columnConfig.choices?.map((choice) => (
          <MenuItem key={choice.value} value={choice.value}>
            {choice.label}
          </MenuItem>
        ))}
      </Select>
    );
  }

  // Phase 3.3: Relationship editor (autocomplete with API search)
  if (cell.type === 'relationship') {
    const handleSelect = (option: RelationshipOption) => {
      onCommit({ value: option.value, text: option.label }, true);
    };

    const handleClear = () => {
      onCommit({ value: null, text: '' }, true);
    };

    const handleRelationshipBlur = () => {
      // When focus leaves the search input, cancel the editor
      // Use setTimeout to allow click events on menu items to fire first
      setTimeout(() => {
        onCancel();
      }, 200);
    };

    const handleRelationshipKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.min(prev + 1, options.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (selectedIndex === -1) {
          handleClear();
        } else if (selectedIndex >= 0 && selectedIndex < options.length) {
          handleSelect(options[selectedIndex]);
        }
      }
    };

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          backgroundColor: '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <Box sx={{ p: 1, borderBottom: '1px solid #e0e0e0', height: '100%', display: 'flex', alignItems: 'center' }}>
          <TextField
            inputRef={searchInputRef}
            size="small"
            fullWidth
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleRelationshipKeyDown}
            onBlur={handleRelationshipBlur}
            autoFocus
            InputProps={{
              endAdornment: loading ? <CircularProgress size={20} /> : null,
            }}
            inputProps={{
              'aria-label': `Search ${columnConfig.header}`,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: 'inherit',
                fontFamily: 'inherit',
              },
            }}
          />
        </Box>

        {/* Options dropdown */}
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 9999, // Very high z-index to appear above everything
            maxHeight: 300,
            overflow: 'auto',
            backgroundColor: 'white',
            border: '2px solid #1976d2',
            borderTop: '1px solid #e0e0e0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <MenuList dense>
            {/* Clear option */}
            <MenuItem
              selected={selectedIndex === -1}
              onClick={handleClear}
              onMouseEnter={() => setSelectedIndex(-1)}
              sx={{ fontStyle: 'italic', color: 'text.secondary' }}
            >
              (Clear selection)
            </MenuItem>

            {/* Loaded options */}
            {options.map((option, index) => (
              <MenuItem
                key={option.value}
                selected={index === selectedIndex}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {option.label}
              </MenuItem>
            ))}

            {/* No results */}
            {!loading && options.length === 0 && (
              <MenuItem disabled>No results found</MenuItem>
            )}
          </MenuList>
        </div>
      </div>
    );
  }

  // Phase 3.4: MultiSelect editor (chip-based multi-selection)
  if (cell.type === 'multiselect') {
    const handleMultiSelectAdd = (option: MultiSelectOption) => {
      // Check if not already selected
      if (!selectedMultiSelectOptions.find(opt => opt.value === option.value)) {
        const newSelected = [...selectedMultiSelectOptions, option];
        setSelectedMultiSelectOptions(newSelected);
        setMultiSelectSearchQuery(''); // Clear search after adding
        // Refocus search input to keep editor open
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 0);
      }
    };

    const handleMultiSelectRemove = (optionToRemove: MultiSelectOption) => {
      const newSelected = selectedMultiSelectOptions.filter(opt => opt.value !== optionToRemove.value);
      setSelectedMultiSelectOptions(newSelected);
      // Refocus search input to keep editor open
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 0);
    };

    const handleMultiSelectCommit = () => {
      // Preserve full item data (id, name, glottocode) not just IDs
      const itemsWithData = selectedMultiSelectOptions.map(opt => {
        // If option has itemData from API, use that
        if ((opt as any).itemData) {
          return (opt as any).itemData;
        }
        // Otherwise, reconstruct from what we have (for pre-loaded values)
        return {
          id: typeof opt.value === 'number' ? opt.value : parseInt(String(opt.value)),
          name: opt.label.replace(/\s*\([^)]*\)$/, ''),  // Remove (glottocode) suffix
          glottocode: opt.label.match(/\(([^)]+)\)$/)?.[1],  // Extract glottocode from label
        };
      });
      
      const text = selectedMultiSelectOptions.map(opt => opt.label).join(', ');
      onCommit({ value: itemsWithData.length > 0 ? itemsWithData : null, text }, true);
    };

    const handleMultiSelectBlur = () => {
      // When focus leaves the search input, commit current selections
      // Use setTimeout to allow click events on chips/menu items to fire first
      setTimeout(() => {
        handleMultiSelectCommit();
      }, 200);
    };

    const handleMultiSelectKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleMultiSelectCommit();
      }
    };

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          backgroundColor: '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <Box sx={{ p: 1, borderBottom: '1px solid #e0e0e0', height: '100%', display: 'flex', alignItems: 'center' }}>
          <TextField
            inputRef={searchInputRef}
            size="small"
            fullWidth
            placeholder="Search..."
            value={multiSelectSearchQuery}
            onChange={(e) => setMultiSelectSearchQuery(e.target.value)}
            onKeyDown={handleMultiSelectKeyDown}
            onBlur={handleMultiSelectBlur}
            autoFocus
            InputProps={{
              endAdornment: multiSelectLoading ? <CircularProgress size={20} /> : null,
            }}
            inputProps={{
              'aria-label': `Search ${columnConfig.header}`,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: 'inherit',
                fontFamily: 'inherit',
              },
            }}
          />
        </Box>

        {/* Dropdown with chips and options */}
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 9999,
            maxHeight: 400,
            overflow: 'hidden',
            backgroundColor: 'white',
            border: '2px solid #1976d2',
            borderTop: '1px solid #e0e0e0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Selected chips at top */}
          {selectedMultiSelectOptions.length > 0 && (
            <Box
              sx={{
                p: 1,
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                maxHeight: 120,
                overflow: 'auto',
              }}
              onMouseDown={(e) => {
                // Prevent blur when clicking chips
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {selectedMultiSelectOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  size="small"
                  onDelete={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMultiSelectRemove(option);
                  }}
                  onMouseDown={(e) => {
                    // Prevent blur when clicking chip or X
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  sx={{
                    backgroundColor: '#1976d2',
                    color: '#fff',
                    '& .MuiChip-deleteIcon': {
                      color: '#fff',
                      '&:hover': {
                        color: '#ffcccc',
                      },
                    },
                  }}
                />
              ))}
            </Box>
          )}

          {/* Options list */}
          <div style={{ overflow: 'auto', maxHeight: 250 }}>
            <MenuList dense>
              {multiSelectOptions
                .filter(opt => !selectedMultiSelectOptions.find(selected => selected.value === opt.value))
                .map((option) => (
                  <MenuItem
                    key={option.value}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleMultiSelectAdd(option);
                    }}
                    onMouseDown={(e) => {
                      // Prevent blur when clicking option
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}

              {/* No results */}
              {!multiSelectLoading && multiSelectOptions.length === 0 && (
                <MenuItem disabled>No results found</MenuItem>
              )}
            </MenuList>
          </div>
        </div>
      </div>
    );
  }

  // Phase 3.7: Readonly editor (display-only, should never be called)
  // If we reach here with a readonly cell, just show the text
  if (cell.type === 'readonly') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          padding: '8px 12px',
          backgroundColor: '#f5f5f5',
          color: '#666',
          cursor: 'not-allowed',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {cell.text}
      </div>
    );
  }

  // Fallback for unknown cell types
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '8px 12px',
        backgroundColor: '#fff3cd',
        color: '#856404',
      }}
    >
      Unknown cell type: {cell.type}
    </div>
  );
};

