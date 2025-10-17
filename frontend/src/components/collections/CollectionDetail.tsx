import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Divider,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import {
  EditableTextField,
  EditableBooleanField,
} from '../common';
import { collectionsAPI, languoidsAPI, Collection, Languoid } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasDeleteAccess } from '../../utils/permissions';

const CollectionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: authState } = useAuth();

  // Basic state
  const [collection, setCollection] = useState<Collection | null>(null);
  const [languages, setLanguages] = useState<Languoid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // EditableField state management (like ItemDetail)
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  // Collection abbreviation validation state
  const [collectionAbbrValidation, setCollectionAbbrValidation] = useState<{
    isValidating: boolean;
    error: string | null;
    isValid: boolean;
  }>({
    isValidating: false,
    error: null,
    isValid: true
  });

  // Debounced collection abbreviation validation
  const validateCollectionAbbr = useMemo(
    () => debounce(async (value: string, currentAbbr: string) => {
      if (!value.trim()) {
        setCollectionAbbrValidation({
          isValidating: false,
          error: 'Collection abbreviation is required',
          isValid: false
        });
        return;
      }

      // Basic format validation
      if (value.length > 10) {
        setCollectionAbbrValidation({
          isValidating: false,
          error: 'Collection abbreviation cannot exceed 10 characters',
          isValid: false
        });
        return;
      }

      // Skip validation if it's the same as current value
      if (value === currentAbbr) {
        setCollectionAbbrValidation({
          isValidating: false,
          error: null,
          isValid: true
        });
        return;
      }

      setCollectionAbbrValidation(prev => ({ ...prev, isValidating: true }));

      try {
        // Check uniqueness via authenticated API
        const response = await collectionsAPI.list({ 
          collection_abbr: value, 
          page_size: 1 
        });
        
        if (response.results && response.results.length > 0) {
          setCollectionAbbrValidation({
            isValidating: false,
            error: `Collection abbreviation "${value}" already exists`,
            isValid: false
          });
        } else {
          setCollectionAbbrValidation({
            isValidating: false,
            error: null,
            isValid: true
          });
        }
      } catch (error) {
        console.error('Error validating collection abbreviation:', error);
        setCollectionAbbrValidation({
          isValidating: false,
          error: 'Unable to validate uniqueness. Please try again.',
          isValid: false
        });
      }
    }, 500),
    [collection] // Depend on collection like ItemDetail depends on item
  );

  // Load collection data
  useEffect(() => {
    const loadData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const [collectionData, languagesData] = await Promise.all([
          collectionsAPI.get(parseInt(id)),
          languoidsAPI.list({ limit: 1000 }) // Load all languages for selection
        ]);
        
        setCollection(collectionData);
        setLanguages(languagesData.results);
      } catch (err) {
        console.error('Error loading collection:', err);
        setError('Failed to load collection data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  // EditableField handlers (like ItemDetail)
  const startEditing = (fieldName: string, value: string) => {
    setEditingFields(prev => new Set(prev).add(fieldName));
    setEditValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const cancelEditing = (fieldName: string) => {
    setEditingFields(prev => {
      const newSet = new Set(prev);
      newSet.delete(fieldName);
      return newSet;
    });
    setEditValues(prev => {
      const newValues = { ...prev };
      delete newValues[fieldName];
      return newValues;
    });
    
    // Reset collection abbreviation validation when cancelling edit
    if (fieldName === 'collection_abbr') {
      setCollectionAbbrValidation({
        isValidating: false,
        error: null,
        isValid: true
      });
    }
  };

  const updateEditValue = (fieldName: string, value: string) => {
    setEditValues(prev => ({ ...prev, [fieldName]: value }));
    
    // Trigger validation for collection_abbr
    if (fieldName === 'collection_abbr' && collection) {
      validateCollectionAbbr(value, collection.collection_abbr);
    }
  };

  const saveField = async (fieldName: string, value?: any) => {
    if (!collection) return;

    try {
      setSavingFields(prev => new Set(prev).add(fieldName));
      
      // Use provided value or get from editValues
      let finalValue = value;
      if (finalValue === undefined) {
        finalValue = editValues[fieldName];
        
        // Handle special conversions for different field types
        if (fieldName === 'expecting_additions') {
          if (finalValue === 'true') finalValue = true;
          else if (finalValue === 'false') finalValue = false;
          else finalValue = null;
        } else if (fieldName === 'languages') {
          // Handle languages as array of numbers
          try {
            finalValue = JSON.parse(finalValue).map((id: string) => parseInt(id));
          } catch {
            finalValue = [];
          }
        } else if (fieldName === 'access_levels' || fieldName === 'genres') {
          // Handle multi-select arrays
          try {
            finalValue = JSON.parse(finalValue);
          } catch {
            finalValue = [];
          }
        } else if (fieldName === 'date_range_min' || fieldName === 'date_range_max') {
          // Handle date fields - empty string should become null
          finalValue = finalValue || null;
        }
      }

      const updatedCollection = await collectionsAPI.updateField(collection.id, fieldName as keyof Collection, finalValue);
      setCollection(updatedCollection);

      // Clear editing state
      setEditingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
      setEditValues(prev => {
        const newValues = { ...prev };
        delete newValues[fieldName];
        return newValues;
      });
    } catch (err) {
      console.error(`Error updating ${fieldName}:`, err);
      setError(`Failed to update ${fieldName}`);
    } finally {
      setSavingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }
  };

  // Delete handlers
  const handleDelete = () => {
    setDeleteDialogOpen(true);
    setDeleteConfirmText('');
  };

  const handleBack = () => {
    navigate('/collections');
  };

  const handleDeleteConfirm = async () => {
    if (!collection || deleteConfirmText !== collection.collection_abbr) {
      return;
    }

    try {
      await collectionsAPI.delete(collection.id);
      navigate('/collections');
    } catch (err) {
      console.error('Error deleting collection:', err);
      setError('Failed to delete collection');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeleteConfirmText('');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !collection) {
    return (
      <Box p={3}>
        <Alert severity="error">{error || 'Collection not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header with navigation and actions */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              onClick={handleBack}
              aria-label="Back to Collections List"
              sx={{ minWidth: '44px', minHeight: '44px' }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography 
              variant="h4" 
              component="h1"
              sx={{ 
                fontWeight: 'bold',
                fontSize: { xs: '1.5rem', md: '2.125rem' }
              }}
            >
              {collection.name}
              <Chip 
                label={collection.collection_abbr} 
                sx={{ ml: 2, fontSize: '1rem', height: '32px' }}
                color="secondary"
              />
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Overview Card - Full Width */}
      <Card sx={{ mb: 4 }} elevation={1}>
        <CardContent>
          {/* Key Metrics Row */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 3, mb: 3 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Items</Typography>
              <Typography variant="h4">{collection.item_count || 0}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Date Range</Typography>
              <Typography variant="h6">{collection.date_range || 'Not specified'}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Access Levels</Typography>
              <Typography variant="h6">
                {(collection.access_levels || []).length > 0 
                  ? (collection.access_levels || []).join(', ')
                  : 'None'
                }
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Languages */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Languages Represented
            </Typography>
            {(collection.language_names || []).length > 0 ? (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {(collection.language_names || []).map((lang, index) => (
                  <Chip key={index} label={lang} size="small" color="info" variant="outlined" />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">None specified</Typography>
            )}
          </Box>

          {/* Genres */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Genres
            </Typography>
            {(collection.genres_display || []).length > 0 ? (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {(collection.genres_display || []).map((genre, index) => (
                  <Chip key={index} label={genre} size="small" color="secondary" variant="outlined" />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">None specified</Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
        {/* Left Column: Collection Details */}
        <Box>
          {/* Collection Details Card */}
          <Card sx={{ mb: 2 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                Descriptions
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <EditableTextField
                fieldName="abstract"
                label="Abstract"
                value={collection.abstract}
                isEditing={editingFields.has('abstract')}
                isSaving={savingFields.has('abstract')}
                editValue={editValues.abstract || ''}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
                multiline
                rows={4}
              />

              <EditableTextField
                fieldName="description"
                label="Description"
                value={collection.description}
                isEditing={editingFields.has('description')}
                isSaving={savingFields.has('description')}
                editValue={editValues.description || ''}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
                multiline
                rows={4}
              />

              <EditableTextField
                fieldName="background"
                label="Background"
                value={collection.background}
                isEditing={editingFields.has('background')}
                isSaving={savingFields.has('background')}
                editValue={editValues.background || ''}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
                multiline
                rows={4}
              />

              <EditableTextField
                fieldName="conventions"
                label="Arrangement & Conventions"
                value={collection.conventions}
                isEditing={editingFields.has('conventions')}
                isSaving={savingFields.has('conventions')}
                editValue={editValues.conventions || ''}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
                multiline
                rows={4}
              />

              <EditableTextField
                fieldName="acquisition"
                label="Acquisition Information"
                value={collection.acquisition}
                isEditing={editingFields.has('acquisition')}
                isSaving={savingFields.has('acquisition')}
                editValue={editValues.acquisition || ''}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
                multiline
                rows={3}
              />

              <EditableTextField
                fieldName="access_statement"
                label="Access & Use Statement"
                value={collection.access_statement}
                isEditing={editingFields.has('access_statement')}
                isSaving={savingFields.has('access_statement')}
                editValue={editValues.access_statement || ''}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
                multiline
                rows={3}
              />

              <EditableTextField
                fieldName="related_publications_collections"
                label="Related Publications/Collections"
                value={collection.related_publications_collections}
                isEditing={editingFields.has('related_publications_collections')}
                isSaving={savingFields.has('related_publications_collections')}
                editValue={editValues.related_publications_collections || ''}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
                multiline
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Creators Card */}
          <Card sx={{ mb: 2 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                Creators
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <EditableTextField
                fieldName="citation_authors"
                label="Creators"
                value={collection.citation_authors}
                isEditing={editingFields.has('citation_authors')}
                isSaving={savingFields.has('citation_authors')}
                editValue={editValues.citation_authors || ''}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
                multiline
                rows={2}
              />
            </CardContent>
          </Card>
        </Box>

        {/* Right Column: Classifications and Settings */}
        <Box>
          {/* Basic Information Card */}
          <Card sx={{ mb: 2 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                Identifiers
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <EditableTextField
                fieldName="collection_abbr"
                label="Collection Abbreviation"
                value={collection.collection_abbr}
                isEditing={editingFields.has('collection_abbr')}
                isSaving={savingFields.has('collection_abbr')}
                editValue={editValues.collection_abbr || ''}
                validationState={collectionAbbrValidation}
                startEditing={startEditing}
                cancelEditing={cancelEditing}
                saveField={(fieldName) => {
                  // Only allow saving if validation passes
                  if (collectionAbbrValidation.isValid && !collectionAbbrValidation.isValidating) {
                    saveField(fieldName);
                  }
                }}
                updateEditValue={updateEditValue}
              />
              
              {/* Validation feedback for collection abbreviation */}
              {editingFields.has('collection_abbr') && (
                <Box sx={{ mt: 1 }}>
                  {collectionAbbrValidation.isValidating && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="caption" color="text.secondary">
                        Checking availability...
                      </Typography>
                    </Box>
                  )}
                  
                  {collectionAbbrValidation.error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {collectionAbbrValidation.error}
                    </Alert>
                  )}
                  
                  {!collectionAbbrValidation.error && !collectionAbbrValidation.isValidating && editValues.collection_abbr && (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      Collection abbreviation is available
                    </Alert>
                  )}
                </Box>
              )}

              <EditableTextField
                fieldName="name"
                label="Name"
                value={collection.name}
                isEditing={editingFields.has('name')}
                isSaving={savingFields.has('name')}
                editValue={editValues.name || ''}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
              />
            </CardContent>
          </Card>

          {/* Extent Card */}
          <Card sx={{ mb: 2 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                Extent
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <EditableTextField
                fieldName="extent"
                label="Extent"
                value={collection.extent}
                isEditing={editingFields.has('extent')}
                isSaving={savingFields.has('extent')}
                editValue={editValues.extent || ''}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
                multiline
                rows={2}
              />

              <EditableBooleanField
                fieldName="expecting_additions"
                label="Expecting Additions"
                value={collection.expecting_additions == null ? '' : collection.expecting_additions.toString()}
                isEditing={editingFields.has('expecting_additions')}
                isSaving={savingFields.has('expecting_additions')}
                editValue={editValues.expecting_additions || (collection.expecting_additions == null ? '' : collection.expecting_additions.toString())}
                startEditing={startEditing}
                saveField={saveField}
                cancelEditing={cancelEditing}
                updateEditValue={updateEditValue}
              />
            </CardContent>
          </Card>

          {/* Metadata History Card - Moved to bottom */}
          <Card sx={{ mb: 3 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                Metadata History
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Last Updated:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(collection.updated).toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Modified By:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {collection.modified_by}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Added:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(collection.added).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Secure Delete Section - Only for Archivist/Admin */}
      {hasDeleteAccess(authState.user) && (
        <Card sx={{ 
          border: '1px solid', 
          borderColor: 'error.main',
          bgcolor: 'background.paper',
          mt: 2
        }} elevation={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="error.main">
              Danger Zone
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Permanently delete this collection. This action cannot be undone.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={handleDelete}
            >
              Delete Collection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Double Confirmation Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth="sm" fullWidth>
        <DialogTitle color="error.main">
          Confirm Collection Deletion
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            You are about to permanently delete the collection:
          </Typography>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            {collection?.collection_abbr} - {collection?.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This action cannot be undone. All data associated with this collection will be permanently removed.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            To confirm, please type the collection abbreviation: <strong>{collection?.collection_abbr}</strong>
          </Typography>
          <TextField
            fullWidth
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={`Type "${collection?.collection_abbr || ''}" to confirm`}
            error={deleteConfirmText.length > 0 && deleteConfirmText !== (collection?.collection_abbr || '')}
            helperText={
              deleteConfirmText.length > 0 && deleteConfirmText !== (collection?.collection_abbr || '')
                ? 'Text does not match'
                : ''
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteConfirmText !== (collection?.collection_abbr || '')}
          >
            Delete Collection
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CollectionDetail;
