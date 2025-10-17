import React from 'react';
import { FormControl, Select, MenuItem, Chip, Box, useTheme, useMediaQuery } from '@mui/material';
import { EditableField, EditableFieldProps } from './EditableField';

export interface SelectOption {
  value: string;
  label: string;
}

export interface EditableMultiSelectFieldProps extends Omit<EditableFieldProps, 'children' | 'value'> {
  value: string[]; // Array of selected values
  options: SelectOption[];
  maxDisplayChips?: number; // Maximum chips to display before showing "+N more"
}

/**
 * EditableMultiSelectField - Multi-select dropdown field with inline editing
 * Displays selected values as chips and supports multiple selection
 */
export const EditableMultiSelectField: React.FC<EditableMultiSelectFieldProps> = ({
  fieldName,
  label,
  value = [],
  options,
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
  // For multi-select, we need to handle the value differently
  // editValue should be a JSON string of the array when editing
  let currentValue: string[] = [];
  
  if (isEditing) {
    try {
      currentValue = editValue ? JSON.parse(editValue) : [];
    } catch {
      currentValue = [];
    }
  } else {
    currentValue = Array.isArray(value) ? value : [];
  }

  // Handle select changes
  const handleSelectChange = (e: any) => {
    const newValue = e.target.value as string[];
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
        const option = options.find(opt => opt.value === val);
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
          disabled={isSaving}
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
                {(selected as string[]).map((value) => {
                  const option = options.find(opt => opt.value === value);
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
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </EditableField>
  );
};
