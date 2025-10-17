import React from 'react';
import { FormControl, Select, MenuItem, useTheme, useMediaQuery } from '@mui/material';
import { EditableField, EditableFieldProps, createAbbreviatedLabel } from './EditableField';

export interface SelectOption {
  value: string;
  label: string;
}

export interface EditableSelectFieldProps extends Omit<EditableFieldProps, 'children'> {
  options: SelectOption[];
}

/**
 * EditableSelectField - Dropdown select field with inline editing
 * Supports responsive label abbreviation and keyboard navigation
 */
export const EditableSelectField: React.FC<EditableSelectFieldProps> = ({
  fieldName,
  label,
  value,
  options,
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
  // Responsive character limits using MUI breakpoints
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const getResponsiveMaxLength = () => {
    if (isMobile) return 20;      // Small screens: shorter text
    if (isTablet) return 30;      // Medium screens: moderate text  
    return 40;                    // Large screens: longer text
  };

  const currentValue = isEditing ? (editValue || '') : value;

  // Handle select changes
  const handleSelectChange = (e: any) => {
    const newValue = e.target.value;
    if (updateEditValue) {
      updateEditValue(fieldName, newValue);
    }
    // Call onValueChange for any real-time validation
    if (onValueChange) {
      onValueChange(newValue);
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

  // Display value with proper label lookup
  const displayValue = value ? (options.find(opt => opt.value === value)?.label || value) : '(blank)';

  return (
    <EditableField
      fieldName={fieldName}
      label={label}
      value={displayValue}
      isEditing={isEditing}
      isSaving={isSaving}
      editValue={editValue}
      validationState={validationState}
      startEditing={startEditing}
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
            minWidth: 0, // Critical: allows shrinking below content width
            maxWidth: '100%' // Prevents expansion beyond container
          }}
        >
          <Select
            value={currentValue || ''}
            onChange={handleSelectChange}
            autoFocus
            onKeyDown={handleKeyDown}
            renderValue={(selected) => {
              // Show abbreviated version of selected value using responsive character limit
              const selectedOption = options.find(opt => opt.value === selected);
              return selectedOption ? createAbbreviatedLabel(selectedOption.label, getResponsiveMaxLength()) : selected;
            }}
            sx={{
              width: '100%',
              minWidth: 0,
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  maxWidth: 'min(400px, 90vw)',
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
