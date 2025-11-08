import React from 'react';
import {
  Typography,
  Box,
  IconButton,
  Stack,
  Tooltip,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';

export interface EditableFieldProps {
  fieldName: string;
  label: string;
  value: string;
  multiline?: boolean;
  rows?: number;
  isEditing?: boolean;
  isSaving?: boolean;
  editValue?: string;
  validationState?: { 
    isValidating: boolean; 
    error: string | null; 
    isValid: boolean 
  };
  startEditing?: (fieldName: string, value: string) => void;
  saveField?: (fieldName: string, value?: any) => void;
  cancelEditing?: (fieldName: string) => void;
  updateEditValue?: (fieldName: string, value: string) => void;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode; // For custom input components
}

// Utility function to create abbreviated labels for display
export const createAbbreviatedLabel = (fullLabel: string, maxLength: number = 40): string => {
  if (fullLabel.length <= maxLength) {
    return fullLabel;
  }
  
  // For numbered options like "2 - Long description", keep the number and abbreviate the description
  const match = fullLabel.match(/^(\d+\s*-\s*)/);
  if (match) {
    const prefix = match[1];
    const description = fullLabel.substring(prefix.length);
    const availableLength = maxLength - prefix.length - 3; // -3 for "..."
    
    if (availableLength > 10) { // Only abbreviate if we have reasonable space
      return prefix + description.substring(0, availableLength).trim() + '...';
    }
  }
  
  // Fallback: simple truncation
  return fullLabel.substring(0, maxLength - 3).trim() + '...';
};

/**
 * Reusable EditableField component that provides inline editing functionality
 * Supports text fields, select fields, and custom input components via children
 */
export const EditableField: React.FC<EditableFieldProps> = ({
  fieldName,
  label,
  value,
  multiline = false,
  rows = 1,
  isEditing = false,
  isSaving = false,
  editValue = '',
  validationState,
  startEditing,
  saveField,
  cancelEditing,
  updateEditValue,
  onValueChange,
  children, // Custom input component
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

  // Handle save/cancel
  const handleSave = () => {
    if (saveField) {
      saveField(fieldName, currentValue);
    }
  };

  const handleCancel = () => {
    if (cancelEditing) {
      cancelEditing(fieldName);
    }
  };

  const handleStartEditing = () => {
    if (startEditing) {
      startEditing(fieldName, value);
    }
  };

  // Check if save should be disabled due to validation
  const isSaveDisabled = isSaving || (validationState && (!validationState.isValid || validationState.isValidating));

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      {/* Label - always visible */}
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
        {label}:
      </Typography>

      {/* Validation error display */}
      {validationState?.error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
          {validationState.error}
        </Typography>
      )}

      {/* Value area - either display or edit mode */}
      {isEditing ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
            {/* Custom input component or default */}
            <Box sx={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
              {children}
            </Box>
            
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Save (Enter)">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleSave}
                    disabled={isSaveDisabled}
                    sx={{ minWidth: '32px', minHeight: '32px' }}
                  >
                    {isSaving ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Cancel (Esc)">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleCancel}
                    disabled={isSaving}
                    sx={{ minWidth: '32px', minHeight: '32px' }}
                  >
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Box>
        </>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {typeof value === 'string' ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              whiteSpace: multiline ? 'pre-wrap' : 'normal',
              flex: 1,
              // Allow wrapping for long text when not editing
              wordWrap: 'break-word',
              overflowWrap: 'break-word'
            }}
          >
            {value || '(blank)'}
          </Typography>
          ) : (
            <Box
              sx={{
                flex: 1,
                color: 'text.secondary',
                fontSize: '0.875rem', // body2 size
              }}
            >
              {value}
            </Box>
          )}
          <Tooltip title={`Edit ${label}`}>
            <IconButton
              size="small"
              onClick={handleStartEditing}
              sx={{
                minWidth: '32px',
                minHeight: '32px',
                opacity: 0.7,
                '&:hover': { opacity: 1 }
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};
