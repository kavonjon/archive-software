import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Autocomplete, TextField, CircularProgress, Box, Chip } from '@mui/material';
import { EditableField, EditableFieldProps } from './EditableField';

export interface RelationshipOption {
  id: number;
  display_name: string;
  [key: string]: any; // Allow additional fields for flexible display formatting
}

export interface EditableRelationshipFieldProps extends Omit<EditableFieldProps, 'children' | 'value'> {
  value: RelationshipOption | null; // Current selected object with id and display info
  relationshipEndpoint: string; // API endpoint to fetch options (e.g., '/internal/v1/languoids/')
  getOptionLabel?: (option: RelationshipOption) => string; // Custom formatting for display
  filterCurrentValue?: boolean; // Whether to exclude current value from search results
  readOnly?: boolean; // If true, hides the edit button and makes the field read-only
  filterParams?: Record<string, string>; // Additional query parameters for filtering (e.g., { level_glottolog: 'family' })
}

/**
 * EditableRelationshipField - Foreign key relationship field with autocomplete search
 * 
 * Leverages patterns from batch editor's RelationshipCell:
 * - Debounced API search (300ms)
 * - Autocomplete with keyboard navigation
 * - Loading states during API calls
 * - Display format: customizable via getOptionLabel
 * 
 * Follows established EditableField patterns:
 * - Same prop structure as other editable fields
 * - Keyboard shortcuts (Enter to save, Escape to cancel)
 * - Validation state support
 * - Consistent state management
 */
export const EditableRelationshipField: React.FC<EditableRelationshipFieldProps> = ({
  fieldName,
  label,
  value,
  relationshipEndpoint,
  getOptionLabel = (option) => option.display_name,
  filterCurrentValue = false,
  readOnly = false,
  filterParams,
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
  const [options, setOptions] = useState<RelationshipOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<RelationshipOption | null>(null);
  
  const onCellChangedRef = useRef(saveField);

  // Keep ref up to date
  useEffect(() => {
    onCellChangedRef.current = saveField;
  }, [saveField]);

  // Parse the current value from editValue (JSON string of {id, display_name}) when editing
  useEffect(() => {
    if (isEditing && editValue) {
      try {
        const parsed = JSON.parse(editValue);
        setSelectedOption(parsed);
      } catch {
        setSelectedOption(value);
      }
    } else {
      setSelectedOption(value);
    }
  }, [isEditing, editValue, value]);

  // Load options from API with debounce (leveraging RelationshipCell patterns)
  const loadOptions = useCallback(async (query: string) => {
    if (!relationshipEndpoint) {
      console.error('No relationshipEndpoint provided for EditableRelationshipField');
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
      
      // Add filter parameters if provided
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
      
      // Map API response to RelationshipOption format
      let mappedOptions: RelationshipOption[] = (data.results || data).map((item: any) => {
        // Create display name - try multiple fields
        let display_name = item.name || item.title || item.display_name || `ID: ${item.id}`;
        
        // If this is a languoid with a glottocode, append it
        if (item.glottocode) {
          display_name = `${display_name} (${item.glottocode})`;
        }
        
        return {
          id: item.id,
          display_name,
          ...item, // Include all other fields for flexible getOptionLabel usage
        };
      });

      // Optionally filter out the current value from search results
      if (filterCurrentValue && value?.id) {
        mappedOptions = mappedOptions.filter(opt => opt.id !== value.id);
      }

      setOptions(mappedOptions);
    } catch (error) {
      console.error('Error loading relationship options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [relationshipEndpoint, filterCurrentValue, filterParams, value?.id]);

  // Debounced search effect (300ms like RelationshipCell)
  useEffect(() => {
    if (!isEditing) return;

    const timeoutId = setTimeout(() => {
      loadOptions(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isEditing, loadOptions]);

  // Load initial options when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setSearchQuery('');
      loadOptions('');
    }
  }, [isEditing, loadOptions]);

  // Handle selection change
  const handleChange = (_event: any, newValue: RelationshipOption | null) => {
    setSelectedOption(newValue);
    
    // Update edit value as JSON string
    if (updateEditValue) {
      updateEditValue(fieldName, JSON.stringify(newValue));
    }
    
    // Call onValueChange for any real-time validation
    if (onValueChange) {
      onValueChange(JSON.stringify(newValue));
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

  // Custom start editing to pass current value as JSON string
  const handleStartEditing = () => {
    if (startEditing) {
      startEditing(fieldName, JSON.stringify(value));
    }
  };

  // Custom save handler to pass the selected option object (or null)
  const handleSave = () => {
    if (saveField) {
      // Send the ID to the API (or null if no selection)
      saveField(fieldName, selectedOption?.id || null);
    }
  };

  // Display value as formatted string with option to show as chip
  const displayValue = value ? getOptionLabel(value) : '(none)';

  return (
    <EditableField
      fieldName={fieldName}
      label={label}
      value={displayValue}
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
          options={options}
          value={selectedOption}
          onChange={handleChange}
          onInputChange={(_event, newInputValue) => {
            setSearchQuery(newInputValue);
          }}
          getOptionLabel={getOptionLabel}
          loading={loading}
          disabled={isSaving}
          autoHighlight
          openOnFocus
          clearOnEscape
          onKeyDown={handleKeyDown}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder="Search..."
              autoFocus
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
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              {getOptionLabel(option)}
            </li>
          )}
          isOptionEqualToValue={(option, value) => option.id === value?.id}
          sx={{
            flex: 1,
            minWidth: 0,
            maxWidth: '100%',
          }}
        />
      )}
    </EditableField>
  );
};

