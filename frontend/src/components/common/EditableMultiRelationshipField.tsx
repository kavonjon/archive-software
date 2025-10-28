import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Autocomplete, TextField, CircularProgress, Box, Chip } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { EditableField, EditableFieldProps } from './EditableField';
import { debounce } from 'lodash';

export interface MultiRelationshipOption {
  id: number;
  display_name: string;
  [key: string]: any; // Allow additional fields for flexible display formatting
}

export interface EditableMultiRelationshipFieldProps extends Omit<EditableFieldProps, 'children' | 'value'> {
  value: number[]; // Array of selected IDs
  relationshipEndpoint: string; // API endpoint to fetch options (e.g., '/internal/v1/languoids/')
  getOptionLabel?: (option: MultiRelationshipOption) => string; // Custom formatting for display
  maxDisplayChips?: number; // Maximum chips to display before showing "+N more"
  readOnly?: boolean; // If true, hides the edit button and makes the field read-only
  filterParams?: Record<string, string>; // Additional query parameters for filtering (e.g., { level_nal: 'language' })
}

/**
 * EditableMultiRelationshipField - Many-to-Many relationship field with autocomplete search
 * 
 * Leverages patterns from batch editor's MultiSelectCell:
 * - Debounced API search (300ms)
 * - Autocomplete with keyboard navigation
 * - Chip display for selected items
 * - Loading states during API calls
 * - Display format: customizable via getOptionLabel
 * 
 * Follows established EditableField patterns:
 * - Same prop structure as other editable fields
 * - Keyboard shortcuts (Enter to save, Escape to cancel)
 * - Validation state support
 * - Consistent state management
 * 
 * Key difference from EditableMultiSelectField:
 * - Uses Autocomplete with search (scalable for large datasets)
 * - EditableMultiSelectField uses Select dropdown (better for limited static choices)
 */
export const EditableMultiRelationshipField: React.FC<EditableMultiRelationshipFieldProps> = ({
  fieldName,
  label,
  value = [],
  relationshipEndpoint,
  getOptionLabel = (option) => option.display_name,
  maxDisplayChips = 5,
  readOnly = false,
  filterParams = {},
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [options, setOptions] = useState<MultiRelationshipOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedOptions, setSelectedOptions] = useState<MultiRelationshipOption[]>([]);
  
  const onCellChangedRef = useRef(saveField);
  const initializedRef = useRef(false); // Track if we've loaded initial selections

  // Keep ref up to date
  useEffect(() => {
    onCellChangedRef.current = saveField;
  }, [saveField]);

  // Load options from API with debounce (leveraging MultiSelectCell patterns)
  const loadOptions = useCallback(debounce(async (query: string) => {
    if (!relationshipEndpoint) {
      console.error('No relationshipEndpoint provided for EditableMultiRelationshipField');
      return;
    }

    setLoading(true);
    try {
      // Use Django backend base URL for development, relative path for production
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
      const url = new URL(relationshipEndpoint, baseUrl || window.location.origin);
      
      if (query) {
        url.searchParams.append('search', query);
      }
      
      // Add filter parameters
      if (filterParams) {
        Object.entries(filterParams).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
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
        throw new Error(`Failed to fetch options: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Map response to MultiRelationshipOption format
      const mappedOptions: MultiRelationshipOption[] = (data.results || data).map((item: any) => ({
        id: item.id,
        display_name: getOptionLabel(item),
        ...item, // Include all fields for flexible getOptionLabel usage
      }));
      
      setOptions(mappedOptions);
    } catch (error) {
      console.error('Error loading multi-relationship options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, 300), [relationshipEndpoint, getOptionLabel, filterParams]);

  // Helper function to load full option objects for given IDs
  const loadSelectedOptions = useCallback(async (ids: number[]) => {
    if (!relationshipEndpoint || ids.length === 0) return;

    try {
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
      const url = new URL(relationshipEndpoint, baseUrl || window.location.origin);
      
      // Fetch with ID filter - note: this assumes the API supports id__in filtering
      // If not, we could fetch by page_size and filter client-side
      url.searchParams.append('page_size', '100'); // Enough to cover selected items
      
      const response = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch selected options: ${response.status}`);
      }

      const data = await response.json();
      const allOptions: MultiRelationshipOption[] = (data.results || data).map((item: any) => ({
        id: item.id,
        display_name: getOptionLabel(item),
        ...item,
      }));
      
      // Filter to only the IDs we want
      const selectedOpts = allOptions.filter(opt => ids.includes(opt.id));
      setSelectedOptions(selectedOpts);
    } catch (error) {
      console.error('Error loading selected options:', error);
    }
  }, [relationshipEndpoint, getOptionLabel]);

  // EFFECT 1: Initialize selected options when entering edit mode (ONE TIME ONLY)
  useEffect(() => {
    if (isEditing && !initializedRef.current) {
      initializedRef.current = true;
      
      // Parse IDs from editValue
      let ids: number[] = [];
      if (editValue) {
        try {
          const parsed = JSON.parse(editValue);
          ids = Array.isArray(parsed) ? parsed : [];
        } catch {
          ids = [];
        }
      }
      
      if (ids.length > 0) {
        // Load the full option objects for these IDs
        loadSelectedOptions(ids);
      } else {
        setSelectedOptions([]);
      }
      
      // Also load search options (empty query = show all)
      loadOptions('');
    }
    
    // Reset initialization flag when exiting edit mode
    if (!isEditing) {
      initializedRef.current = false;
    }
  }, [isEditing, editValue, loadOptions, loadSelectedOptions]);

  // EFFECT 2: Display mode - load option objects for display (separate concern)
  useEffect(() => {
    if (!isEditing && value.length > 0 && selectedOptions.length === 0) {
      loadSelectedOptions(value);
    }
  }, [isEditing, value, selectedOptions.length, loadSelectedOptions]);

  // Handle selection change
  const handleChange = (_event: any, newValue: MultiRelationshipOption[]) => {
    setSelectedOptions(newValue);
    
    // Update edit value as JSON string of IDs
    const ids = newValue.map(opt => opt.id);
    if (updateEditValue) {
      updateEditValue(fieldName, JSON.stringify(ids));
    }
    
    // Call onValueChange for any real-time validation
    if (onValueChange) {
      onValueChange(JSON.stringify(ids));
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (cancelEditing) {
        cancelEditing(fieldName);
      }
    }
    // Note: Enter is handled by Autocomplete's built-in behavior
  };

  // Custom start editing to pass current value as JSON string of IDs
  const handleStartEditing = () => {
    if (startEditing) {
      startEditing(fieldName, JSON.stringify(value));
    }
  };

  // Custom save handler to pass the array of IDs
  const handleSave = () => {
    if (saveField) {
      // Send the array of IDs to the API
      const ids = selectedOptions.map(opt => opt.id);
      saveField(fieldName, ids);
    }
  };

  // Display value as chips (with "+N more" if exceeds max)
  const displayValue = selectedOptions.length > 0 ? (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {selectedOptions.slice(0, maxDisplayChips).map((option) => (
        <Chip
          key={option.id}
          label={option.display_name}
          size="small"
          variant="outlined"
        />
      ))}
      {selectedOptions.length > maxDisplayChips && (
        <Chip
          label={`+${selectedOptions.length - maxDisplayChips} more`}
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
      value={displayValue as any}
      isEditing={isEditing}
      isSaving={isSaving}
      editValue={editValue}
      validationState={validationState}
      startEditing={readOnly ? undefined : handleStartEditing}
      saveField={handleSave}
      cancelEditing={cancelEditing}
      updateEditValue={updateEditValue}
      onValueChange={onValueChange}
    >
      {isEditing && (
        <Autocomplete
          multiple
          fullWidth
          size="small"
          options={options}
          getOptionLabel={(option) => option.display_name}
          isOptionEqualToValue={(option, val) => option.id === val.id}
          value={selectedOptions}
          onChange={handleChange}
          onInputChange={(_event, newInputValue) => {
            setSearchQuery(newInputValue);
            loadOptions(newInputValue);
          }}
          loading={loading}
          disabled={isSaving}
          autoHighlight
          filterOptions={(x) => x} // Disable client-side filtering (we do server-side search)
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              placeholder="Search and select..."
              onKeyDown={handleKeyDown}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => {
            const isSelected = selectedOptions.some(selected => selected.id === option.id);
            return (
              <Box
                component="li"
                {...props}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <CheckIcon
                  sx={{
                    fontSize: 18,
                    visibility: isSelected ? 'visible' : 'hidden',
                    color: 'primary.main',
                    opacity: 0.8,
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  {option.display_name}
                </Box>
              </Box>
            );
          }}
          renderTags={(tagValue, getTagProps) =>
            tagValue.map((option, index) => (
              <Chip
                label={option.display_name}
                size="small"
                {...getTagProps({ index })}
                disabled={isSaving}
              />
            ))
          }
          componentsProps={{
            popper: {
              placement: 'bottom-start',
              modifiers: [
                {
                  name: 'flip',
                  enabled: false, // Disable auto-flip to prevent upward opening
                },
              ],
              style: { zIndex: 1300 },
            },
          }}
        />
      )}
    </EditableField>
  );
};

