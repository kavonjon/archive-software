import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Chip,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { ItemTitle, Languoid } from '../../services/api';

interface EditableTitleItemProps {
  title: ItemTitle;
  languages: Languoid[];
  isOnlyTitle: boolean;
  isEditing: boolean;
  isSaving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (updatedTitle: Partial<ItemTitle>) => Promise<void>;
  onDelete: () => void;
  onSetDefault: () => void;
}

export const EditableTitleItem: React.FC<EditableTitleItemProps> = ({
  title,
  languages,
  isOnlyTitle,
  isEditing,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onSetDefault,
}) => {
  const [editValues, setEditValues] = useState({
    title: title.title,
    language: title.language,
    default: title.default,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editValues.title.trim()) {
      setError('Title cannot be empty');
      return;
    }

    try {
      setError(null);
      await onSave(editValues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save title');
    }
  };

  const handleCancel = () => {
    // Reset edit values to original
    setEditValues({
      title: title.title,
      language: title.language,
      default: title.default,
    });
    setError(null);
    onCancelEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <Box sx={{ p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 1, mb: 1 }}>
        <Stack spacing={2}>
          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}
          
          <TextField
            label="Title"
            value={editValues.title}
            onChange={(e) => setEditValues(prev => ({ ...prev, title: e.target.value }))}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            autoFocus
            fullWidth
            size="small"
          />

          <FormControl size="small" disabled={isSaving}>
            <InputLabel>Language</InputLabel>
            <Select
              value={editValues.language}
              onChange={(e) => setEditValues(prev => ({ ...prev, language: Number(e.target.value) }))}
              label="Language"
            >
              {languages.map((lang) => (
                <MenuItem key={lang.id} value={lang.id}>
                  {lang.name} ({lang.iso})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Set as Primary Title:
            </Typography>
            <RadioGroup
              row
              value={editValues.default ? 'true' : 'false'}
              onChange={(e) => setEditValues(prev => ({ ...prev, default: e.target.value === 'true' }))}
            >
              <FormControlLabel 
                value="true" 
                control={<Radio size="small" />} 
                label="Yes" 
                disabled={isSaving}
              />
              <FormControlLabel 
                value="false" 
                control={<Radio size="small" />} 
                label="No" 
                disabled={isSaving}
              />
            </RadioGroup>
          </Box>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Tooltip title="Save (Enter)">
              <span>
                <IconButton
                  size="small"
                  onClick={handleSave}
                  disabled={isSaving || !editValues.title.trim()}
                  color="primary"
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
        </Stack>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        p: 2, 
        border: '1px solid', 
        borderColor: 'divider', 
        borderRadius: 1, 
        mb: 1,
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover',
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1, mr: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Typography 
              variant="body1" 
              component="span"
              sx={{ 
                fontWeight: title.default ? 'medium' : 'normal',
                fontStyle: title.default ? 'normal' : 'italic'
              }}
            >
              {title.title}
            </Typography>
            {title.default && (
              <Chip label="Primary" size="small" color="primary" />
            )}
          </Box>
          
          <Typography variant="caption" color="text.secondary">
            Language: {title.language_name} ({title.language_iso})
          </Typography>
          
          {!title.default && (
            <Box sx={{ mt: 1 }}>
              <Typography 
                variant="caption" 
                color="primary" 
                sx={{ 
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  '&:hover': { color: 'primary.dark' }
                }}
                onClick={onSetDefault}
              >
                Set as primary
              </Typography>
            </Box>
          )}
        </Box>

        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit title">
            <IconButton
              size="small"
              onClick={onStartEdit}
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
          
          {!isOnlyTitle && (
            <Tooltip title={isOnlyTitle ? "Cannot delete the only title" : "Delete title"}>
              <span>
                <IconButton
                  size="small"
                  onClick={onDelete}
                  disabled={isOnlyTitle}
                  color="error"
                  sx={{
                    minWidth: '32px',
                    minHeight: '32px',
                    opacity: isOnlyTitle ? 0.3 : 0.7,
                    '&:hover': { opacity: isOnlyTitle ? 0.3 : 1 }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
      </Box>
    </Box>
  );
};
