import React, { useState } from 'react';
import { TextField, Chip, Box, Stack, IconButton, Tooltip } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { EditableField, EditableFieldProps } from './EditableField';

export interface EditableJsonArrayFieldProps extends Omit<EditableFieldProps, 'children' | 'value'> {
  value: string[]; // Array of strings
  placeholder?: string;
  addButtonLabel?: string;
}

/**
 * EditableJsonArrayField - JSON array field with inline editing
 * Displays values as chips in view mode, allows adding/removing items in edit mode
 * Follows the established pattern for editable fields
 */
export const EditableJsonArrayField: React.FC<EditableJsonArrayFieldProps> = ({
  fieldName,
  label,
  value = [],
  placeholder = 'Add item...',
  addButtonLabel = 'Add',
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
  const [newItemValue, setNewItemValue] = useState('');

  // Parse the current value from JSON string when editing, or use the array value when viewing
  let currentValue: string[] = [];
  
  if (isEditing) {
    try {
      const parsed = editValue ? JSON.parse(editValue) : [];
      currentValue = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error parsing alt_names JSON:', error, 'editValue:', editValue);
      currentValue = [];
    }
  } else {
    currentValue = Array.isArray(value) ? value : [];
  }

  // Handle adding a new item
  const handleAddItem = () => {
    if (newItemValue.trim()) {
      const updatedArray = [...currentValue, newItemValue.trim()];
      const jsonValue = JSON.stringify(updatedArray);
      
      if (updateEditValue) {
        updateEditValue(fieldName, jsonValue);
      }
      if (onValueChange) {
        onValueChange(jsonValue);
      }
      
      setNewItemValue('');
    }
  };

  // Handle removing an item
  const handleDeleteItem = (index: number) => {
    const updatedArray = currentValue.filter((_, i) => i !== index);
    const jsonValue = JSON.stringify(updatedArray);
    
    if (updateEditValue) {
      updateEditValue(fieldName, jsonValue);
    }
    if (onValueChange) {
      onValueChange(jsonValue);
    }
  };

  // Handle keyboard shortcuts for the input field
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
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
      // Ensure value is an array before stringifying
      const arrayValue = Array.isArray(value) ? value : [];
      startEditing(fieldName, JSON.stringify(arrayValue));
    }
  };

  // Custom save handler to parse JSON string back to array
  const handleSave = () => {
    if (saveField) {
      // Parse the JSON string back to array before saving
      saveField(fieldName, currentValue);
    }
  };

  // Display value as chips
  const displayValue = currentValue.length > 0 ? (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {currentValue.map((item, index) => (
        <Chip
          key={index}
          label={item}
          size="small"
          variant="outlined"
        />
      ))}
    </Box>
  ) : '(blank)';

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
        <Stack spacing={1} sx={{ width: '100%' }}>
          {/* Display existing items as chips with delete buttons */}
          {currentValue.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {currentValue.map((item, index) => (
                <Chip
                  key={index}
                  label={item}
                  size="small"
                  onDelete={() => handleDeleteItem(index)}
                  disabled={isSaving}
                />
              ))}
            </Box>
          )}
          
          {/* Input field for adding new items */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              fullWidth
              size="small"
              value={newItemValue}
              onChange={(e) => setNewItemValue(e.target.value)}
              placeholder={placeholder}
              disabled={isSaving}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <Tooltip title={`${addButtonLabel} (Enter)`}>
              <span>
                <IconButton
                  size="small"
                  onClick={handleAddItem}
                  disabled={!newItemValue.trim() || isSaving}
                  color="primary"
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Stack>
      )}
    </EditableField>
  );
};

