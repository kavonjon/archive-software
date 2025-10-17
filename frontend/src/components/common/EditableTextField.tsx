import React from 'react';
import { TextField } from '@mui/material';
import { EditableField, EditableFieldProps } from './EditableField';

export interface EditableTextFieldProps extends Omit<EditableFieldProps, 'children'> {
  placeholder?: string;
}

/**
 * EditableTextField - Text input field with inline editing
 * Supports both single-line and multiline text editing
 */
export const EditableTextField: React.FC<EditableTextFieldProps> = ({
  fieldName,
  label,
  value,
  multiline = false,
  rows = 1,
  placeholder,
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
  const currentValue = isEditing ? (editValue || '') : value;

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (updateEditValue) {
      updateEditValue(fieldName, newValue);
    }
    // Call onValueChange for date interpretation feedback or other real-time validation
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
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

  return (
    <EditableField
      fieldName={fieldName}
      label={label}
      value={value}
      multiline={multiline}
      rows={rows}
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
        <TextField
          fullWidth
          multiline={multiline}
          rows={multiline ? rows : 1}
          value={currentValue}
          onChange={handleInputChange}
          variant="outlined"
          size="small"
          autoFocus
          disabled={isSaving}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
        />
      )}
    </EditableField>
  );
};
