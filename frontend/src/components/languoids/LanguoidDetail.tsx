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
  Container,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import {
  EditableTextField,
  EditableSelectField,
} from '../common';
import { languoidsAPI, Languoid, LANGUOID_LEVEL_CHOICES } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasDeleteAccess } from '../../utils/permissions';

const LanguoidDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: authState } = useAuth();

  // Basic state
  const [languoid, setLanguoid] = useState<Languoid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // EditableField state management (following established patterns)
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  // Glottocode validation state (for uniqueness checking)
  const [glottocodeValidation, setGlottocodeValidation] = useState<{
    isValidating: boolean;
    error: string | null;
    isValid: boolean;
  }>({
    isValidating: false,
    error: null,
    isValid: true
  });

  // Debounced glottocode validation
  const validateGlottocode = useMemo(
    () => debounce(async (value: string, currentGlottocode: string) => {
      if (!value.trim()) {
        setGlottocodeValidation({
          isValidating: false,
          error: null,
          isValid: true
        });
        return;
      }

      // Format validation first
      if (value.length !== 8 || !value.slice(-4).match(/^\d{4}$/)) {
        setGlottocodeValidation({
          isValidating: false,
          error: 'Glottocode must be 8 characters with the last 4 being numeric',
          isValid: false
        });
        return;
      }

      // Skip validation if it's the same as current value
      if (value === currentGlottocode) {
        setGlottocodeValidation({
          isValidating: false,
          error: null,
          isValid: true
        });
        return;
      }

      setGlottocodeValidation(prev => ({ ...prev, isValidating: true }));

      try {
        // Check uniqueness via authenticated API
        const response = await languoidsAPI.list({ 
          glottocode: value, 
          page_size: 1 
        });

        if (response.results.length > 0) {
          setGlottocodeValidation({
            isValidating: false,
            error: 'This glottocode is already in use',
            isValid: false
          });
        } else {
          setGlottocodeValidation({
            isValidating: false,
            error: null,
            isValid: true
          });
        }
      } catch (error) {
        console.error('Error validating glottocode:', error);
        setGlottocodeValidation({
          isValidating: false,
          error: 'Error checking glottocode uniqueness',
          isValid: false
        });
      }
    }, 500),
    []
  );

  // Load languoid data
  useEffect(() => {
    const loadLanguoid = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        const data = await languoidsAPI.get(parseInt(id));
        setLanguoid(data);
      } catch (err) {
        console.error('Error loading languoid:', err);
        setError('Failed to load languoid. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadLanguoid();
  }, [id]);

  // EditableField handlers (following established patterns)
  const startEditing = (fieldName: string, value: string) => {
    setEditingFields(prev => new Set(prev).add(fieldName));
    setEditValues(prev => ({ ...prev, [fieldName]: value || '' }));
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
  };

  const updateEditValue = (fieldName: string, value: string) => {
    setEditValues(prev => ({ ...prev, [fieldName]: value }));
    
    // Trigger validation for glottocode field
    if (fieldName === 'glottocode' && languoid) {
      validateGlottocode(value, languoid.glottocode || '');
    }
  };

  const saveField = async (fieldName: string, value?: any) => {
    if (!languoid) return;

    const finalValue = value !== undefined ? value : editValues[fieldName];

    // Check validation for glottocode
    if (fieldName === 'glottocode' && (!glottocodeValidation.isValid || glottocodeValidation.isValidating)) {
      return;
    }

    setSavingFields(prev => new Set(prev).add(fieldName));

    try {
      const updateData = { [fieldName]: finalValue };
      const updatedLanguoid = await languoidsAPI.patch(languoid.id, updateData);
      setLanguoid(updatedLanguoid);
      
      // Clear editing state
      cancelEditing(fieldName);
    } catch (error) {
      console.error(`Error updating ${fieldName}:`, error);
      setError(`Failed to update ${fieldName}. Please try again.`);
    } finally {
      setSavingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }
  };

  // Delete handlers
  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!languoid || deleteConfirmText !== languoid.name) return;

    try {
      await languoidsAPI.delete(languoid.id);
      navigate('/languoids');
    } catch (error) {
      console.error('Error deleting languoid:', error);
      setError('Failed to delete languoid. Please try again.');
    }
  };

  const handleBack = () => {
    navigate('/languoids');
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error && !languoid) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!languoid) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Languoid not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
          {languoid.name}
        </Typography>
        <Chip
          label={languoid.level_display}
          color={
            languoid.level === 'family' ? 'primary' :
            languoid.level === 'language' ? 'success' : 'warning'
          }
          sx={{ ml: 2 }}
        />
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Overview Card */}
      <Card sx={{ mb: 3, elevation: 1 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
            Overview
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Stack direction="row" spacing={4} flexWrap="wrap">
            {languoid.glottocode && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Glottocode</Typography>
                <Typography variant="body1">{languoid.glottocode}</Typography>
              </Box>
            )}
            {languoid.iso && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">ISO Code</Typography>
                <Typography variant="body1">{languoid.iso}</Typography>
              </Box>
            )}
            {languoid.child_count > 0 && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Children</Typography>
                <Typography variant="body1">{languoid.child_count}</Typography>
              </Box>
            )}
            {languoid.dialect_count > 0 && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Dialects</Typography>
                <Typography variant="body1">{languoid.dialect_count}</Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
        
        {/* Left Column */}
        <Stack spacing={3}>
          
          {/* Basic Information */}
          <Card sx={{ elevation: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                Basic Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={3}>
                <EditableTextField
                  fieldName="name"
                  label="Name"
                  value={languoid.name || ''}
                  isEditing={editingFields.has('name')}
                  isSaving={savingFields.has('name')}
                  editValue={editValues.name}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="iso"
                  label="ISO Code"
                  value={languoid.iso || ''}
                  isEditing={editingFields.has('iso')}
                  isSaving={savingFields.has('iso')}
                  editValue={editValues.iso}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="glottocode"
                  label="Glottocode"
                  value={languoid.glottocode || ''}
                  isEditing={editingFields.has('glottocode')}
                  isSaving={savingFields.has('glottocode')}
                  editValue={editValues.glottocode}
                  startEditing={startEditing}
                  saveField={(fieldName) => {
                    // Only allow saving if validation passes
                    if (glottocodeValidation.isValid && !glottocodeValidation.isValidating) {
                      saveField(fieldName);
                    }
                  }}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />
                
                {/* Validation feedback for glottocode */}
                {editingFields.has('glottocode') && (
                  <Box sx={{ mt: 1 }}>
                    {glottocodeValidation.isValidating && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">
                          Checking uniqueness...
                        </Typography>
                      </Box>
                    )}
                    
                    {glottocodeValidation.error && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {glottocodeValidation.error}
                      </Alert>
                    )}
                    
                    {!glottocodeValidation.error && !glottocodeValidation.isValidating && editValues.glottocode && glottocodeValidation.isValid && (
                      <Alert severity="success" sx={{ mt: 1 }}>
                        Glottocode is valid and available
                      </Alert>
                    )}
                  </Box>
                )}

                <EditableSelectField
                  fieldName="level"
                  label="Level"
                  value={languoid.level || ''}
                  options={LANGUOID_LEVEL_CHOICES}
                  isEditing={editingFields.has('level')}
                  isSaving={savingFields.has('level')}
                  editValue={editValues.level}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="alt_name"
                  label="Alternate Name"
                  value={languoid.alt_name || ''}
                  isEditing={editingFields.has('alt_name')}
                  isSaving={savingFields.has('alt_name')}
                  editValue={editValues.alt_name}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="alt_names"
                  label="Alternate Names"
                  value={languoid.alt_names || ''}
                  multiline
                  rows={2}
                  isEditing={editingFields.has('alt_names')}
                  isSaving={savingFields.has('alt_names')}
                  editValue={editValues.alt_names}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Hierarchy Information */}
          <Card sx={{ elevation: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                Hierarchy
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={3}>
                <EditableTextField
                  fieldName="family"
                  label="Family"
                  value={languoid.family || ''}
                  isEditing={editingFields.has('family')}
                  isSaving={savingFields.has('family')}
                  editValue={editValues.family}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="family_id"
                  label="Family Glottocode"
                  value={languoid.family_id || ''}
                  isEditing={editingFields.has('family_id')}
                  isSaving={savingFields.has('family_id')}
                  editValue={editValues.family_id}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="pri_subgroup"
                  label="Primary Subgroup"
                  value={languoid.pri_subgroup || ''}
                  isEditing={editingFields.has('pri_subgroup')}
                  isSaving={savingFields.has('pri_subgroup')}
                  editValue={editValues.pri_subgroup}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="pri_subgroup_id"
                  label="Primary Subgroup Glottocode"
                  value={languoid.pri_subgroup_id || ''}
                  isEditing={editingFields.has('pri_subgroup_id')}
                  isSaving={savingFields.has('pri_subgroup_id')}
                  editValue={editValues.pri_subgroup_id}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="sec_subgroup"
                  label="Secondary Subgroup"
                  value={languoid.sec_subgroup || ''}
                  isEditing={editingFields.has('sec_subgroup')}
                  isSaving={savingFields.has('sec_subgroup')}
                  editValue={editValues.sec_subgroup}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="sec_subgroup_id"
                  label="Secondary Subgroup Glottocode"
                  value={languoid.sec_subgroup_id || ''}
                  isEditing={editingFields.has('sec_subgroup_id')}
                  isSaving={savingFields.has('sec_subgroup_id')}
                  editValue={editValues.sec_subgroup_id}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card sx={{ elevation: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                Additional Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={3}>
                <EditableTextField
                  fieldName="region"
                  label="Region"
                  value={languoid.region || ''}
                  isEditing={editingFields.has('region')}
                  isSaving={savingFields.has('region')}
                  editValue={editValues.region}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="tribes"
                  label="Tribes"
                  value={languoid.tribes || ''}
                  isEditing={editingFields.has('tribes')}
                  isSaving={savingFields.has('tribes')}
                  editValue={editValues.tribes}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="dialects"
                  label="Dialects"
                  value={languoid.dialects || ''}
                  multiline
                  rows={2}
                  isEditing={editingFields.has('dialects')}
                  isSaving={savingFields.has('dialects')}
                  editValue={editValues.dialects}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="notes"
                  label="Notes"
                  value={languoid.notes || ''}
                  multiline
                  rows={3}
                  isEditing={editingFields.has('notes')}
                  isSaving={savingFields.has('notes')}
                  editValue={editValues.notes}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        {/* Right Column */}
        <Stack spacing={3}>
          
          {/* Geographic Information */}
          <Card sx={{ elevation: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                Geographic Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={3}>
                <EditableTextField
                  fieldName="latitude"
                  label="Latitude"
                  value={languoid.latitude?.toString() || ''}
                  isEditing={editingFields.has('latitude')}
                  isSaving={savingFields.has('latitude')}
                  editValue={editValues.latitude}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />

                <EditableTextField
                  fieldName="longitude"
                  label="Longitude"
                  value={languoid.longitude?.toString() || ''}
                  isEditing={editingFields.has('longitude')}
                  isSaving={savingFields.has('longitude')}
                  editValue={editValues.longitude}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Relationships (Read-only for now) */}
          {(languoid.family_name || languoid.parent_name || languoid.language_name) && (
            <Card sx={{ elevation: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                  Relationships
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Stack spacing={2}>
                  {languoid.family_name && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Family</Typography>
                      <Typography variant="body1">{languoid.family_name}</Typography>
                    </Box>
                  )}
                  {languoid.parent_name && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Parent</Typography>
                      <Typography variant="body1">{languoid.parent_name}</Typography>
                    </Box>
                  )}
                  {languoid.language_name && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Language</Typography>
                      <Typography variant="body1">{languoid.language_name}</Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* System Metadata */}
          <Card sx={{ elevation: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                System Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Added</Typography>
                  <Typography variant="body2">
                    {new Date(languoid.added).toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Last Updated</Typography>
                  <Typography variant="body2">
                    {new Date(languoid.updated).toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Modified By</Typography>
                  <Typography variant="body2">{languoid.modified_by}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {/* Delete Section (at bottom, following established patterns) */}
      {hasDeleteAccess(authState.user) && (
        <Card sx={{ mt: 4, elevation: 1, border: '1px solid', borderColor: 'error.main' }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'error.main', mb: 2 }}>
              Danger Zone
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Deleting this languoid will permanently remove it from the system. This action cannot be undone.
            </Typography>
            
            <Button
              variant="outlined"
              color="error"
              onClick={handleDeleteClick}
            >
              Delete Languoid
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to delete this languoid? This action cannot be undone.
          </Typography>
          <Typography sx={{ mb: 2 }}>
            Type the languoid name <strong>{languoid.name}</strong> to confirm:
          </Typography>
          <TextField
            fullWidth
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Enter languoid name"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            disabled={deleteConfirmText !== languoid.name}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LanguoidDetail;
