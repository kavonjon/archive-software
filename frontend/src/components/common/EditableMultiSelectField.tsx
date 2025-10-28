import React, { useState, useEffect, useCallback } from 'react';
import { FormControl, Select, MenuItem, Chip, Box, CircularProgress } from '@mui/material';
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
      
      // Limit results for performance
      url.searchParams.append('page_size', '100');
      
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
        // Create label using getOptionLabel or default logic
        let label = getOptionLabel(item);
        
        // If this is a languoid with a glottocode, append it (if not already included)
        if (item.glottocode && !label.includes(item.glottocode)) {
          label = `${label} (${item.glottocode})`;
        }
        
        return {
          value: item.id,
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
  }, [isEditing, apiEndpoint, loadOptions]);

  // Handle select changes
  const handleSelectChange = (e: any) => {
    const newValue = e.target.value as (string | number)[];
    const jsonValue = JSON.stringify(newValue);
    
    if (updateEditValue) {
      updateEditValue(fieldName, jsonValue);
    }
    // Call onValueChange for any real-time validation
    if (onValueChange) {
      onValueChange(jsonValue);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (saveField) {
        saveField(fieldName, currentValue);
      }
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

  // Display value as chips
  const displayValue = currentValue.length > 0 ? (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {currentValue.slice(0, maxDisplayChips).map((val) => {
        const option = effectiveOptions.find(opt => opt.value === val);
        return (
          <Chip
            key={val}
            label={option?.label || val}
            size="small"
            variant="outlined"
          />
        );
      })}
      {currentValue.length > maxDisplayChips && (
        <Chip
          label={`+${currentValue.length - maxDisplayChips} more`}
          size="small"
          variant="outlined"
          color="primary"
        />
      )}
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
      saveField={saveField}
      cancelEditing={cancelEditing}
      updateEditValue={updateEditValue}
      onValueChange={onValueChange}
    >
      {isEditing && (
        <FormControl 
          size="small" 
          disabled={isSaving || loading}
          sx={{ 
            flex: 1,
            minWidth: 0,
            maxWidth: '100%'
          }}
        >
          <Select
            multiple
            value={currentValue}
            onChange={handleSelectChange}
            autoFocus
            onKeyDown={handleKeyDown}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as (string | number)[]).map((value) => {
                  const option = effectiveOptions.find(opt => opt.value === value);
                  return (
                    <Chip 
                      key={value} 
                      label={option?.label || value} 
                      size="small"
                    />
                  );
                })}
              </Box>
            )}
            endAdornment={loading ? <CircularProgress size={20} sx={{ mr: 2 }} /> : null}
            sx={{
              width: '100%',
              minWidth: 0,
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  maxWidth: 'min(400px, 90vw)',
                  maxHeight: '300px',
                  '& .MuiMenuItem-root': {
                    whiteSpace: 'normal',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    padding: '12px 16px',
                    lineHeight: 1.4,
                  }
                }
              }
            }}
          >
            {effectiveOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
            {loading && effectiveOptions.length === 0 && (
              <MenuItem disabled>
                Loading options...
              </MenuItem>
            )}
          </Select>
        </FormControl>
      )}
    </EditableField>
  );
};
