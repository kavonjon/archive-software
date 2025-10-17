import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Divider,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import {
  Add as AddIcon,
} from '@mui/icons-material';
import { ItemTitle, Languoid, itemTitlesAPI, languoidsAPI } from '../../services/api';
import { EditableTitleItem } from './EditableTitleItem';

interface EditableTitlesListProps {
  itemId: number;
  titles: ItemTitle[];
  onTitlesChange: (titles: ItemTitle[]) => void;
  onPrimaryTitleChange?: (newPrimaryTitle: string) => void;
}

interface NewTitleFormData {
  title: string;
  language: number | '';
  default: boolean;
}

export const EditableTitlesList: React.FC<EditableTitlesListProps> = ({
  itemId,
  titles,
  onTitlesChange,
  onPrimaryTitleChange,
}) => {
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [savingTitleId, setSavingTitleId] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [languages, setLanguages] = useState<Languoid[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newTitle, setNewTitle] = useState<NewTitleFormData>({
    title: '',
    language: '',
    default: false,
  });

  // Load languages when component mounts (needed for editing)
  useEffect(() => {
    if (languages.length === 0) {
      loadLanguages();
    }
  }, [languages.length]);

  // Load languages when add dialog opens (backup)
  useEffect(() => {
    if (showAddDialog && languages.length === 0) {
      loadLanguages();
    }
  }, [showAddDialog, languages.length]);

  const loadLanguages = async () => {
    setLoadingLanguages(true);
    try {
      const response = await languoidsAPI.list();
      setLanguages(response.results);
    } catch (err) {
      setError('Failed to load languages');
    } finally {
      setLoadingLanguages(false);
    }
  };

  const handleStartEdit = (titleId: number) => {
    setEditingTitleId(titleId);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingTitleId(null);
    setError(null);
  };

  const handleSaveTitle = async (titleId: number, updatedData: Partial<ItemTitle>) => {
    setSavingTitleId(titleId);
    try {
      const updatedTitle = await itemTitlesAPI.patch(itemId, titleId, updatedData);
      
      // Update local titles array
      const updatedTitles = titles.map(title => 
        title.id === titleId ? updatedTitle : title
      );
      
      // If this title was set as default, unset others
      if (updatedData.default) {
        updatedTitles.forEach(title => {
          if (title.id !== titleId) {
            title.default = false;
          }
        });
      }
      
      onTitlesChange(updatedTitles);
      
      // Update primary title in parent if this became the default
      if (updatedData.default && onPrimaryTitleChange) {
        onPrimaryTitleChange(updatedTitle.title);
      }
      
      setEditingTitleId(null);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save title');
    } finally {
      setSavingTitleId(null);
    }
  };

  const handleDeleteTitle = async (titleId: number) => {
    if (titles.length <= 1) {
      setError('Cannot delete the only title. Add another title first.');
      return;
    }

    const titleToDelete = titles.find(t => t.id === titleId);
    const confirmMessage = titleToDelete?.default 
      ? 'This is the primary title. Another title will automatically become primary. Continue?'
      : 'Are you sure you want to delete this title?';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setSavingTitleId(titleId);
    try {
      await itemTitlesAPI.delete(itemId, titleId);
      
      // Remove from local array
      const updatedTitles = titles.filter(title => title.id !== titleId);
      
      // If we deleted the default title and there are others, make the first one default
      if (titleToDelete?.default && updatedTitles.length > 0) {
        updatedTitles[0].default = true;
        if (onPrimaryTitleChange) {
          onPrimaryTitleChange(updatedTitles[0].title);
        }
      }
      
      onTitlesChange(updatedTitles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete title');
    } finally {
      setSavingTitleId(null);
    }
  };

  const handleSetDefault = async (titleId: number) => {
    setSavingTitleId(titleId);
    try {
      const updatedTitle = await itemTitlesAPI.setDefault(itemId, titleId);
      
      // Update all titles - unset other defaults
      const updatedTitles = titles.map(title => ({
        ...title,
        default: title.id === titleId
      }));
      
      onTitlesChange(updatedTitles);
      
      if (onPrimaryTitleChange) {
        onPrimaryTitleChange(updatedTitle.title);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default title');
    } finally {
      setSavingTitleId(null);
    }
  };

  const handleAddTitle = async () => {
    if (!newTitle.title.trim() || !newTitle.language) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const createdTitle = await itemTitlesAPI.create(itemId, {
        title: newTitle.title.trim(),
        language: Number(newTitle.language),
        default: newTitle.default,
      });
      
      // Update local titles array
      let updatedTitles = [...titles, createdTitle];
      
      // If this is set as default, unset others
      if (newTitle.default) {
        updatedTitles = updatedTitles.map(title => ({
          ...title,
          default: title.id === createdTitle.id
        }));
        
        if (onPrimaryTitleChange) {
          onPrimaryTitleChange(createdTitle.title);
        }
      }
      
      onTitlesChange(updatedTitles);
      
      // Reset form and close dialog
      setNewTitle({ title: '', language: '', default: false });
      setShowAddDialog(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add title');
    }
  };

  const handleCloseAddDialog = () => {
    setNewTitle({ title: '', language: '', default: false });
    setShowAddDialog(false);
    setError(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main' }}>
          Titles
        </Typography>
        <Button
          startIcon={<AddIcon />}
          onClick={() => setShowAddDialog(true)}
          variant="outlined"
          size="small"
        >
          Add Title
        </Button>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Box>
        {titles.map((title) => (
          <EditableTitleItem
            key={title.id}
            title={title}
            languages={languages}
            isOnlyTitle={titles.length === 1}
            isEditing={editingTitleId === title.id}
            isSaving={savingTitleId === title.id}
            onStartEdit={() => handleStartEdit(title.id!)}
            onCancelEdit={handleCancelEdit}
            onSave={(updatedData) => handleSaveTitle(title.id!, updatedData)}
            onDelete={() => handleDeleteTitle(title.id!)}
            onSetDefault={() => handleSetDefault(title.id!)}
          />
        ))}
      </Box>

      {/* Add Title Dialog */}
      <Dialog open={showAddDialog} onClose={handleCloseAddDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Title</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={newTitle.title}
              onChange={(e) => setNewTitle(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
              autoFocus
              required
            />

            <FormControl fullWidth required>
              <InputLabel>Language</InputLabel>
              <Select
                value={newTitle.language}
                onChange={(e) => setNewTitle(prev => ({ ...prev, language: e.target.value as number }))}
                label="Language"
                disabled={loadingLanguages}
              >
                {loadingLanguages ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Loading languages...
                  </MenuItem>
                ) : (
                  languages.map((lang) => (
                    <MenuItem key={lang.id} value={lang.id}>
                      {lang.name} ({lang.iso})
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Set as Primary Title:
              </Typography>
              <RadioGroup
                row
                value={newTitle.default ? 'true' : 'false'}
                onChange={(e) => setNewTitle(prev => ({ ...prev, default: e.target.value === 'true' }))}
              >
                <FormControlLabel value="true" control={<Radio />} label="Yes" />
                <FormControlLabel value="false" control={<Radio />} label="No" />
              </RadioGroup>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
          <Button 
            onClick={handleAddTitle} 
            variant="contained"
            disabled={!newTitle.title.trim() || !newTitle.language}
          >
            Add Title
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
