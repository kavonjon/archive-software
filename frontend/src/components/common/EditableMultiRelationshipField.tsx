import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Autocomplete, TextField, CircularProgress, Box, Chip } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { EditableField, EditableFieldProps } from './EditableField';
import { debounce } from 'lodash';

export interface MultiRelationshipOption {
  id: number;
  display_name?: string;
  [key: string]: any; // Allow additional fields for flexible display formatting
}

export interface EditableMultiRelationshipFieldProps extends Omit<EditableFieldProps, 'children' | 'value'> {
  value: number[] | Array<{ id: number; [key: string]: any }>; // Array of IDs or objects with at least an id
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
      
      // Check if we can use the value directly (already has full objects)
      if (value.length > 0) {
        const firstItem = value[0];
        if (typeof firstItem === 'object' && 'id' in firstItem) {
          // Already full objects - use them directly (no need to fetch)
          const mappedOptions: MultiRelationshipOption[] = value.map((item: any) => ({
            id: item.id,
            display_name: getOptionLabel(item),
            ...item,
          }));
          setSelectedOptions(mappedOptions);
          
          // Also load search options (empty query = show all)
          loadOptions('');
          return;
        }
      }
      
      // Otherwise parse IDs from editValue and fetch
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
  }, [isEditing, editValue, value, loadOptions, loadSelectedOptions, getOptionLabel]);

  // EFFECT 2: Display mode - load option objects for display (separate concern)
  useEffect(() => {
    if (!isEditing && value.length > 0) {
      // Check if value is already full objects or just IDs
      const firstItem = value[0];
      if (typeof firstItem === 'object' && 'id' in firstItem) {
        // Already full objects - use them directly
        const mappedOptions: MultiRelationshipOption[] = value.map((item: any) => ({
          id: item.id,
          display_name: getOptionLabel(item),
          ...item,
        }));
        // Update selectedOptions if the value has changed
        // Compare by IDs to avoid unnecessary updates
        const currentIds = selectedOptions.map(opt => opt.id).sort().join(',');
        const newIds = mappedOptions.map(opt => opt.id).sort().join(',');
        if (currentIds !== newIds) {
          setSelectedOptions(mappedOptions);
        }
      } else {
        // Just IDs - need to fetch full objects
        // Only fetch if the IDs have changed
        const currentIds = selectedOptions.map(opt => opt.id).sort().join(',');
        const newIds = (value as number[]).sort().join(',');
        if (currentIds !== newIds) {
          loadSelectedOptions(value as number[]);
    }
      }
    } else if (!isEditing && value.length === 0 && selectedOptions.length > 0) {
      // Clear selectedOptions when value is empty
      setSelectedOptions([]);
    }
  }, [isEditing, value, selectedOptions, loadSelectedOptions, getOptionLabel]);

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
      // Extract IDs from value (handles both ID arrays and object arrays)
      let ids: number[] = [];
      if (value.length > 0) {
        const firstItem = value[0];
        if (typeof firstItem === 'object' && 'id' in firstItem) {
          // Array of objects - extract IDs
          ids = (value as Array<{ id: number; [key: string]: any }>).map(item => item.id);
        } else {
          // Already an array of IDs
          ids = value as number[];
        }
      }
      
      startEditing(fieldName, JSON.stringify(ids));
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

  // Helper function to organize languoids by language/dialect hierarchy
  const organizeLanguoidChips = (options: MultiRelationshipOption[]) => {
    // Check if these are languoid objects (have level_glottolog)
    const hasLanguoidData = options.length > 0 && 'level_glottolog' in options[0];
    if (!hasLanguoidData) {
      // Not languoids, return simple list
      return options.map(option => ({ type: 'simple' as const, option }));
    }

    // Separate languages and dialects
    const languages = options
      .filter(opt => opt.level_glottolog === 'language')
      .sort((a, b) => (a.name || a.display_name || '').localeCompare(b.name || b.display_name || ''));
    
    const dialects = options.filter(opt => opt.level_glottolog === 'dialect');
    
    // Create organized structure
    const organized: Array<{ type: 'language' | 'dialect-orphan'; option: MultiRelationshipOption; dialects?: MultiRelationshipOption[] }> = [];
    
    // Add languages with their child dialects
    languages.forEach(lang => {
      const childDialects = dialects
        .filter(dialect => dialect.parent_languoid === lang.id)
        .sort((a, b) => (a.name || a.display_name || '').localeCompare(b.name || b.display_name || ''));
      
      organized.push({
        type: 'language',
        option: lang,
        dialects: childDialects.length > 0 ? childDialects : undefined
      });
    });
    
    // Add orphan dialects (dialects whose parent is not in the list)
    const orphanDialects = dialects
      .filter(dialect => !languages.some(lang => lang.id === dialect.parent_languoid))
      .sort((a, b) => (a.name || a.display_name || '').localeCompare(b.name || b.display_name || ''));
    
    orphanDialects.forEach(dialect => {
      organized.push({
        type: 'dialect-orphan',
        option: dialect
      });
    });
    
    return organized;
  };

  // Display value as chips organized by language/dialect hierarchy
  const displayValue = selectedOptions.length > 0 ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {organizeLanguoidChips(selectedOptions).map((item, index) => {
        if (item.type === 'simple') {
          // Simple chip (non-languoid fields)
          return (
        <Chip
              key={item.option.id}
              label={item.option.display_name}
          size="small"
          variant="outlined"
        />
          );
        } else if (item.type === 'language') {
          return (
            <Box key={item.option.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
              {/* Language chip */}
        <Chip
                label={item.option.display_name}
          size="small"
          variant="outlined"
          color="primary"
        />
              {/* Dialect chips on same line */}
              {item.dialects?.map(dialect => (
                <Chip
                  key={dialect.id}
                  label={dialect.display_name}
                  size="small"
                  variant="outlined"
                  sx={{ ml: 1 }}
                />
              ))}
            </Box>
          );
        } else {
          // Orphan dialect on its own line
          return (
            <Box key={item.option.id} sx={{ display: 'flex', gap: 0.5 }}>
              <Chip
                label={item.option.display_name}
                size="small"
                variant="outlined"
              />
            </Box>
          );
        }
      })}
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
          getOptionLabel={(option) => option.display_name || `ID: ${option.id}`}
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
          renderTags={(tagValue, getTagProps) => {
            // Check if these are languoid objects for hierarchical display
            const hasLanguoidData = tagValue.length > 0 && 'level_glottolog' in tagValue[0];
            
            if (!hasLanguoidData) {
              // Simple display for non-languoid fields
              return tagValue.map((option, index) => {
                const { key, ...chipProps } = getTagProps({ index });
                return (
              <Chip
                    key={key}
                label={option.display_name}
                size="small"
                    {...chipProps}
                    disabled={isSaving}
                  />
                );
              });
            }

            // Organize languoids hierarchically
            const organized = organizeLanguoidChips(tagValue);
            
            return organized.flatMap((item) => {
              if (item.type === 'simple') {
                // Find the actual index in the original tagValue array
                const actualIndex = tagValue.findIndex(t => t.id === item.option.id);
                const { key, ...chipProps } = getTagProps({ index: actualIndex });
                return (
                  <Chip
                    key={key}
                    label={item.option.display_name}
                    size="small"
                    {...chipProps}
                    disabled={isSaving}
                  />
                );
              } else if (item.type === 'language') {
                // Find the actual index in the original tagValue array
                const actualIndex = tagValue.findIndex(t => t.id === item.option.id);
                const { key: languageKey, ...languageProps } = getTagProps({ index: actualIndex });
                const chips = [
                  <Chip
                    key={languageKey}
                    label={item.option.display_name}
                    size="small"
                    color="primary"
                    {...languageProps}
                    disabled={isSaving}
                  />
                ];
                
                // Add dialect chips after parent language
                if (item.dialects) {
                  item.dialects.forEach(dialect => {
                    // Find the actual index in the original tagValue array
                    const dialectActualIndex = tagValue.findIndex(t => t.id === dialect.id);
                    const { key: dialectKey, ...dialectProps } = getTagProps({ index: dialectActualIndex });
                    chips.push(
                      <Chip
                        key={dialectKey}
                        label={dialect.display_name}
                        size="small"
                        variant="outlined"
                        {...dialectProps}
                        disabled={isSaving}
                      />
                    );
                  });
                }
                
                return chips;
              } else {
                // Orphan dialect - Find the actual index in the original tagValue array
                const actualIndex = tagValue.findIndex(t => t.id === item.option.id);
                const { key, ...chipProps } = getTagProps({ index: actualIndex });
                return (
                  <Chip
                    key={key}
                    label={item.option.display_name}
                    size="small"
                    variant="outlined"
                    {...chipProps}
                disabled={isSaving}
              />
                );
          }
            });
          }}
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

