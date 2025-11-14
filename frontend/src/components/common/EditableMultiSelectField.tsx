import React, { useState, useEffect, useCallback } from 'react';
import { Autocomplete, TextField, Chip, Box, CircularProgress } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { EditableField, EditableFieldProps } from './EditableField';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface EditableMultiSelectFieldProps extends Omit<EditableFieldProps, 'children' | 'value'> {
  value: (string | number)[]; // Array of selected values (IDs for API-driven, strings for static)
  options?: SelectOption[]; // Static options (backward compatible)
  apiEndpoint?: string; // API endpoint for dynamic options (new feature)
  getOptionLabel?: (option: any) => string; // Custom label formatting for API responses
  maxDisplayChips?: number; // Maximum chips to display before showing "+N more"
  displayLabels?: string[]; // Optional: Pre-formatted display labels for view mode (e.g., from genre_display)
}

/**
 * EditableMultiSelectField - Multi-select dropdown field with inline editing
 * 
 * Supports two modes:
 * 1. Static options (original): Pass `options` prop with predefined choices
 * 2. API-driven options (new): Pass `apiEndpoint` to load options dynamically
 * 
 * Displays selected values as chips and supports multiple selection
 */
export const EditableMultiSelectField: React.FC<EditableMultiSelectFieldProps> = ({
  fieldName,
  label,
  value = [],
  options = [],
  apiEndpoint,
  getOptionLabel = (option) => option.name || option.title || option.display_name || `ID: ${option.id}`,
  maxDisplayChips = 3,
  displayLabels,
  isEditing = false,
  isSaving = false,
  editValue = '',
  validationState,
  startEditing,
  saveField,
  cancelEditing,
  updateEditValue,
  onValueChange,
}) => {
  // API-driven options state
  const [apiOptions, setApiOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Determine which options to use (API or static)
  const effectiveOptions = apiEndpoint ? apiOptions : options;

  // For multi-select, we need to handle the value differently
  // editValue should be a JSON string of the array when editing
  let currentValue: (string | number)[] = [];
  
  if (isEditing) {
    try {
      currentValue = editValue ? JSON.parse(editValue) : [];
    } catch {
      currentValue = [];
    }
  } else {
    currentValue = Array.isArray(value) ? value : [];
  }

  // Load options from API (leveraging MultiSelectCell patterns)
  const loadOptions = useCallback(async () => {
    if (!apiEndpoint) return;

    setLoading(true);
    try {
      // Use Django backend base URL for development, relative path for production
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
      const url = new URL(apiEndpoint, baseUrl || window.location.origin);
      
      // Limit results for performance (increase for better search experience)
      url.searchParams.append('page_size', '500');
      
      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch options: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Map API response to SelectOption format
      const mappedOptions: SelectOption[] = (data.results || data).map((item: any) => {
        // If the item already has value and label properties (simple choices API), use them directly
        if (item.value !== undefined && item.label !== undefined) {
          return {
            value: item.value,
            label: item.label,
          };
        }
        
        // Otherwise, use getOptionLabel for complex API responses (e.g., languoids, collaborators)
        let label = getOptionLabel(item);
        
        // If this is a languoid with a glottocode, append it (if not already included)
        if (item.glottocode && !label.includes(item.glottocode)) {
          label = `${label} (${item.glottocode})`;
        }
        
        return {
          value: item.id || item.value,
          label,
        };
      });

      setApiOptions(mappedOptions);
    } catch (error) {
      console.error('Error loading multiselect options:', error);
      setApiOptions([]);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, getOptionLabel]);

  // Load options when entering edit mode (if using API)
  useEffect(() => {
    if (isEditing && apiEndpoint) {
      loadOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, apiEndpoint]); // loadOptions is stable via useCallback

  // Handle autocomplete changes
  const handleAutocompleteChange = (event: any, newValue: SelectOption[]) => {
    const selectedValues = newValue.map(option => option.value);
    const jsonValue = JSON.stringify(selectedValues);
    
    if (updateEditValue) {
      updateEditValue(fieldName, jsonValue);
    }
    // Call onValueChange for any real-time validation
    if (onValueChange) {
      onValueChange(jsonValue);
    }
  };

  // Convert current values to SelectOption objects for Autocomplete
  const selectedOptions = currentValue
    .map(val => effectiveOptions.find(opt => opt.value === val))
    .filter((opt): opt is SelectOption => opt !== undefined);

  // Custom save handler to pass the array of values (not JSON string)
  const handleSave = () => {
    if (saveField) {
      // Send the array of values directly to the API
      saveField(fieldName, currentValue);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (cancelEditing) {
        cancelEditing(fieldName);
      }
    }
  };

  // Custom start editing to pass array as JSON string
  const handleStartEditing = () => {
    if (startEditing) {
      startEditing(fieldName, JSON.stringify(value));
    }
  };

  // Display value as chips - show all chips with wrapping in view mode
  const displayValue = currentValue.length > 0 ? (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {currentValue.map((val, index) => {
        // In view mode, use displayLabels if provided, otherwise look up from options
        let chipLabel: string;
        if (!isEditing && displayLabels && displayLabels[index]) {
          chipLabel = displayLabels[index];
        } else {
        const option = effectiveOptions.find(opt => opt.value === val);
          chipLabel = option?.label || String(val);
        }
        
        return (
          <Chip
            key={val}
            label={chipLabel}
            size="small"
            variant="outlined"
          />
        );
      })}
    </Box>
  ) : '(none selected)';

  return (
    <EditableField
      fieldName={fieldName}
      label={label}
      value={displayValue as any} // Type hack for display component
      isEditing={isEditing}
      isSaving={isSaving}
      editValue={editValue}
      validationState={validationState}
      startEditing={handleStartEditing}
      saveField={handleSave}
      cancelEditing={cancelEditing}
      updateEditValue={updateEditValue}
      onValueChange={onValueChange}
    >
      {isEditing && (
        <Box sx={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
          <Autocomplete
            multiple
            options={effectiveOptions}
            value={selectedOptions}
            onChange={handleAutocompleteChange}
            loading={loading}
          disabled={isSaving || loading}
            disableCloseOnSelect
            disableClearable
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, value) => option.value === value.value}
            componentsProps={{
              popper: {
                placement: 'bottom-start',
                modifiers: [
                  {
                    name: 'flip',
                    enabled: false, // Disable flipping to prevent dropdown from opening upwards
                  },
                  {
                    name: 'offset',
                    enabled: true,
                    options: {
                      offset: [0, 8], // Add 8px space below the input field
                    },
                  },
                ],
              },
            }}
            renderOption={(props, option, { selected }) => {
              const { key, ...otherProps } = props;
              return (
                <Box
                  key={key}
                  component="li"
                  {...otherProps}
          sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
          }}
        >
                  <CheckIcon
                    sx={{
                      fontSize: 18,
                      visibility: selected ? 'visible' : 'hidden',
                      color: 'primary.main',
                      opacity: 0.8,
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    {option.label}
                  </Box>
                </Box>
              );
            }}
            renderTags={(tagValue, getTagProps) =>
              tagValue.map((option, index) => (
                <Chip
                  label={option.label}
                  size="small"
                  {...getTagProps({ index })}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder="Search and select..."
            autoFocus
            onKeyDown={handleKeyDown}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            sx={{
              width: '100%',
              '& .MuiAutocomplete-inputRoot': {
                flexWrap: 'wrap',
              },
            }}
            ListboxProps={{
              style: {
                  maxHeight: '300px',
              },
            }}
          />
        </Box>
      )}
    </EditableField>
  );
};

