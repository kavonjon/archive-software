import React from 'react';
import { FormControl, Select, MenuItem } from '@mui/material';
import { EditableField, EditableFieldProps } from './EditableField';

export interface EditableBooleanFieldProps extends Omit<EditableFieldProps, 'children'> {
  trueLabel?: string;
  falseLabel?: string;
  nullLabel?: string;
}

/**
 * EditableBooleanField - Three-state boolean field (true/false/null) with inline editing
 * Supports custom labels for each state
 */
export const EditableBooleanField: React.FC<EditableBooleanFieldProps> = ({
  fieldName,
  label,
  value,
  trueLabel = 'Yes',
  falseLabel = 'No', 
  nullLabel = 'Not specified',
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
  // Convert string values to display labels
  const getDisplayValue = (val: string) => {
    if (val === 'true') return trueLabel;
    if (val === 'false') return falseLabel;
    return nullLabel;
  };

  // Convert display value back to boolean string for API
  const getApiValue = (val: string) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return null;
  };

  const currentValue = isEditing ? (editValue || '') : value;
  const displayValue = getDisplayValue(value || '');

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
        // Convert to boolean/null for API
        saveField(fieldName, getApiValue(currentValue));
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (cancelEditing) {
        cancelEditing(fieldName);
      }
    }
  };

  // Override saveField to convert value
  const handleSave = (fieldName: string) => {
    if (saveField) {
      saveField(fieldName, getApiValue(currentValue));
    }
  };

  const booleanOptions = [
    { value: '', label: nullLabel },
    { value: 'true', label: trueLabel },
    { value: 'false', label: falseLabel },
  ];

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
      saveField={handleSave}
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
            value={currentValue || ''}
            onChange={handleSelectChange}
            autoFocus
            onKeyDown={handleKeyDown}
            displayEmpty
            renderValue={(selected) => {
              // Ensure the closed Select displays the correct label for all values
              if (selected === 'true') return trueLabel;
              if (selected === 'false') return falseLabel;
              return nullLabel; // For empty string or any other value
            }}
            sx={{
              width: '100%',
              minWidth: 0,
            }}
          >
            {booleanOptions.map((option) => (
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
