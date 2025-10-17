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
  Link,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  EditableTextField,
  EditableBooleanField,
  DateFormatHelp,
} from '../common';
import { collaboratorsAPI, itemsAPI, Collaborator, AssociatedItem } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasEditAccess, hasDeleteAccess } from '../../utils/permissions';

const CollaboratorDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: authState } = useAuth();

  // Basic state
  const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // EditableField state management (following ItemDetail pattern)
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  // Collaborator ID validation state (for uniqueness checking)
  const [collaboratorIdValidation, setCollaboratorIdValidation] = useState<{
    isValidating: boolean;
    error: string | null;
    isValid: boolean;
  }>({
    isValidating: false,
    error: null,
    isValid: true
  });

  // Role choices mapping for human-readable display
  const roleChoices: Record<string, string> = {
    'annotator': 'Annotator',
    'author': 'Author',
    'collector': 'Collector',
    'compiler': 'Compiler',
    'consultant': 'Consultant',
    'data_inputter': 'Data inputter',
    'editor': 'Editor',
    'filmer': 'Filmer',
    'illustrator': 'Illustrator',
    'interlocutor': 'Interlocutor',
    'interpreter': 'Interpreter',
    'interviewer': 'Interviewer',
    'performer': 'Performer',
    'photographer': 'Photographer',
    'publisher': 'Publisher',
    'recorder': 'Recorder',
    'research_participant': 'Research participant',
    'researcher': 'Researcher',
    'responder': 'Responder',
    'signer': 'Signer',
    'speaker': 'Speaker',
    'sponsor': 'Sponsor',
    'transcriber': 'Transcriber',
    'translator': 'Translator'
  };

  // Debounced collaborator ID validation
  const validateCollaboratorId = useMemo(
    () => debounce(async (value: string, currentId: number) => {
      if (!value.trim()) {
        setCollaboratorIdValidation({
          isValidating: false,
          error: 'Collaborator ID is required',
          isValid: false
        });
        return;
      }

      const numericValue = parseInt(value, 10);
      if (isNaN(numericValue) || numericValue <= 0) {
        setCollaboratorIdValidation({
          isValidating: false,
          error: 'Collaborator ID must be a positive number',
          isValid: false
        });
        return;
      }

      // Skip validation if it's the same as current value
      if (numericValue === currentId) {
        setCollaboratorIdValidation({
          isValidating: false,
          error: null,
          isValid: true
        });
        return;
      }

      setCollaboratorIdValidation(prev => ({ ...prev, isValidating: true }));

      try {
        // Check uniqueness via authenticated API
        const response = await collaboratorsAPI.list({ 
          collaborator_id: numericValue, 
          page_size: 1 
        });

        if (response.results.length > 0) {
          setCollaboratorIdValidation({
            isValidating: false,
            error: `Collaborator ID ${numericValue} is already in use`,
            isValid: false
          });
        } else {
          setCollaboratorIdValidation({
            isValidating: false,
            error: null,
            isValid: true
          });
        }
      } catch (error) {
        setCollaboratorIdValidation({
          isValidating: false,
          error: 'Unable to validate collaborator ID',
          isValid: false
        });
      }
    }, 500),
    []
  );

  // Load collaborator data
  useEffect(() => {
    const loadCollaborator = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        const collaboratorData = await collaboratorsAPI.get(parseInt(id, 10));
        setCollaborator(collaboratorData);
      } catch (err: any) {
        setError(err.message || 'Failed to load collaborator');
        console.error('Error loading collaborator:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCollaborator();
  }, [id]);

  // EditableField handlers (following ItemDetail pattern)
  const startEditing = (fieldName: string, value: string) => {
    setEditingFields(prev => new Set(Array.from(prev).concat(fieldName)));
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
    
    // Clear validation state for collaborator_id
    if (fieldName === 'collaborator_id') {
      setCollaboratorIdValidation({
        isValidating: false,
        error: null,
        isValid: true
      });
    }
  };

  const updateEditValue = (fieldName: string, value: string) => {
    setEditValues(prev => ({ ...prev, [fieldName]: value }));
    
    // Trigger validation for collaborator_id
    if (fieldName === 'collaborator_id' && collaborator) {
      validateCollaboratorId(value, collaborator.collaborator_id);
    }
  };

  const saveField = async (fieldName: string, value?: any) => {
    if (!collaborator) return;

    const finalValue = value !== undefined ? value : editValues[fieldName];
    
    setSavingFields(prev => new Set(Array.from(prev).concat(fieldName)));

    try {
      // Convert collaborator_id to number if needed
      const processedValue = fieldName === 'collaborator_id' ? parseInt(finalValue, 10) : finalValue;
      
      const updatedCollaborator = await collaboratorsAPI.patch(collaborator.id, {
        [fieldName]: processedValue
      });
      
      setCollaborator(updatedCollaborator);
      
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
      
      // Clear validation state
      if (fieldName === 'collaborator_id') {
        setCollaboratorIdValidation({
          isValidating: false,
          error: null,
          isValid: true
        });
      }
      
    } catch (err: any) {
      setError(err.message || `Failed to update ${fieldName}`);
      console.error(`Error updating ${fieldName}:`, err);
    } finally {
      setSavingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!collaborator || deleteConfirmText !== collaborator.collaborator_id.toString()) return;

    try {
      await collaboratorsAPI.delete(collaborator.id);
      navigate('/collaborators');
    } catch (err: any) {
      setError(err.message || 'Failed to delete collaborator');
    }
  };

  const handleBack = () => {
    navigate('/collaborators');
  };

  // Helper function to render field with EditableTextField
  const renderEditableField = (
    fieldName: keyof Collaborator,
    label: string,
    multiline = false,
    rows = 1
  ) => {
    if (!collaborator) return null;
    
    const value = collaborator[fieldName]?.toString() || '';
    
    return (
      <EditableTextField
        fieldName={fieldName}
        label={label}
        value={value}
        multiline={multiline}
        rows={rows}
        isEditing={editingFields.has(fieldName)}
        isSaving={savingFields.has(fieldName)}
        editValue={editValues[fieldName] || ''}
        startEditing={startEditing}
        saveField={saveField}
        cancelEditing={cancelEditing}
        updateEditValue={updateEditValue}
      />
    );
  };

  // Helper function to render date field with format help
  const renderDateField = (
    fieldName: keyof Collaborator,
    label: string
  ) => {
    if (!collaborator) return null;
    
    const value = collaborator[fieldName]?.toString() || '';
    const isEditing = editingFields.has(fieldName);
    
    return (
      <Box>
        <EditableTextField
          fieldName={fieldName}
          label={label}
          value={value}
          isEditing={isEditing}
          isSaving={savingFields.has(fieldName)}
          editValue={editValues[fieldName] || ''}
          startEditing={startEditing}
          saveField={saveField}
          cancelEditing={cancelEditing}
          updateEditValue={updateEditValue}
        />
        {isEditing && <DateFormatHelp />}
      </Box>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
          <Typography variant="body1" sx={{ ml: 2 }}>
            Loading collaborator...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (!collaborator) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">
          Collaborator not found
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                onClick={handleBack}
                aria-label="Back to Collaborators List"
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
                {collaborator.display_name}
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Privacy Notice for Anonymous Collaborators */}
        {collaborator.privacy_notice && (
          <Alert 
            severity="info" 
            icon={<InfoIcon />}
            sx={{ mb: 3 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
              Privacy Notice
            </Typography>
            <Typography variant="body2">
              {collaborator.privacy_notice.message}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              Public display: "{collaborator.privacy_notice.public_display}"
            </Typography>
          </Alert>
        )}

        {/* Overview Card - Full Width */}
        <Card sx={{ mb: 4, elevation: 1 }}>
          <CardContent>
            {/* Key Metrics Row */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 3, mb: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Display Name</Typography>
                <Typography variant="h6">
                  {collaborator.anonymous 
                    ? `Anonymous ${collaborator.collaborator_id}`
                    : collaborator.name || `${collaborator.firstname || ''} ${collaborator.lastname || ''}`.trim() || 'No name provided'
                  }
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Associated Items</Typography>
                <Typography variant="h6">{collaborator.associated_items.length}</Typography>
              </Box>
            </Box>

            {/* Languages */}
            {(collaborator.native_language_names.length > 0 || collaborator.other_language_names.length > 0) && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Languages
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {collaborator.native_language_names.map((lang, index) => (
                    <Chip 
                      key={`native-${index}`} 
                      label={`${lang} (Native)`} 
                      size="small" 
                      color="primary" 
                      variant="outlined" 
                    />
                  ))}
                  {collaborator.other_language_names.map((lang, index) => (
                    <Chip 
                      key={`other-${index}`} 
                      label={lang} 
                      size="small" 
                      variant="outlined" 
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Main Content - Two Column Layout */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
          {/* Left Column */}
          <Box>
            {/* Basic Information */}
            <Card sx={{ mb: 3, elevation: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <EditableTextField
                  fieldName="collaborator_id"
                  label="Collaborator ID"
                  value={collaborator.collaborator_id.toString()}
                  isEditing={editingFields.has('collaborator_id')}
                  isSaving={savingFields.has('collaborator_id')}
                  editValue={editValues.collaborator_id || ''}
                  startEditing={startEditing}
                  cancelEditing={cancelEditing}
                  saveField={(fieldName) => {
                    // Only allow saving if validation passes
                    if (collaboratorIdValidation.isValid && !collaboratorIdValidation.isValidating) {
                      saveField(fieldName);
                    }
                  }}
                  updateEditValue={updateEditValue}
                />
                
                {/* Validation feedback for collaborator ID */}
                {editingFields.has('collaborator_id') && (
                  <Box sx={{ mt: 1 }}>
                    {collaboratorIdValidation.isValidating && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">
                          Checking availability...
                        </Typography>
                      </Box>
                    )}
                    
                    {collaboratorIdValidation.error && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {collaboratorIdValidation.error}
                      </Alert>
                    )}
                    
                    {!collaboratorIdValidation.error && !collaboratorIdValidation.isValidating && editValues.collaborator_id && (
                      <Alert severity="success" sx={{ mt: 1 }}>
                        Collaborator ID is available
                      </Alert>
                    )}
                  </Box>
                )}
                {renderEditableField('name', 'Full Name')}
                {renderEditableField('firstname', 'First Name')}
                {renderEditableField('lastname', 'Last Name')}
                {renderEditableField('nickname', 'Nickname')}
                {renderEditableField('other_names', 'Other Names')}
                
                <EditableBooleanField
                  fieldName="anonymous"
                  label="Anonymous"
                  value={collaborator.anonymous === null ? '' : collaborator.anonymous.toString()}
                  isEditing={editingFields.has('anonymous')}
                  isSaving={savingFields.has('anonymous')}
                  editValue={editValues['anonymous']}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                />
              </CardContent>
            </Card>

            {/* Demographic Information */}
            <Card sx={{ mb: 3, elevation: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                  Demographic Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {renderEditableField('tribal_affiliations', 'Tribal Affiliations')}
                {renderEditableField('clan_society', 'Clan or Society')}
                {renderEditableField('origin', 'Place of Origin')}
                {renderEditableField('gender', 'Gender')}
              </CardContent>
            </Card>

            {/* Additional Information */}
            <Card sx={{ mb: 3, elevation: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                  Additional Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {renderEditableField('other_info', 'Other Information', true, 4)}
              </CardContent>
            </Card>

            {/* Associated Items */}
            <Card sx={{ mb: 3, elevation: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                  Associated Items ({collaborator.associated_items.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {collaborator.associated_items.length > 0 ? (
                  <Stack spacing={2}>
                    {collaborator.associated_items.map((item) => (
                      <Box 
                        key={item.id}
                        sx={{ 
                          p: 2, 
                          border: 1, 
                          borderColor: 'divider', 
                          borderRadius: 1,
                          '&:hover': { backgroundColor: 'action.hover' }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <Box sx={{ flex: 1 }}>
                            <Link
                              component="button"
                              variant="h6"
                              onClick={() => navigate(`/items/${item.id}`)}
                              sx={{ 
                                textAlign: 'left',
                                textDecoration: 'none',
                                '&:hover': { textDecoration: 'underline' }
                              }}
                            >
                              {item.primary_title}
                            </Link>
                            <Typography variant="body2" color="text.secondary">
                              {item.collection_abbr && `${item.collection_abbr} • `}
                              Catalog: {item.catalog_number}
                            </Typography>
                            {item.roles.length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                  {item.roles.map((role, index) => (
                                    <Chip 
                                      key={index} 
                                      label={roleChoices[role] || role} 
                                      size="small" 
                                      variant="outlined" 
                                      color="secondary"
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No associated items found.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>

          {/* Right Column */}
          <Box>
            {/* Dates */}
            <Card sx={{ mb: 3, elevation: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                  Dates
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {renderDateField('birthdate', 'Date of Birth')}
                {renderDateField('deathdate', 'Date of Death')}
              </CardContent>
            </Card>

            {/* System Metadata */}
            <Card sx={{ mb: 3, elevation: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                  System Metadata
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    UUID:
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {collaborator.uuid}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Slug:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {collaborator.slug}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Added:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(collaborator.added).toLocaleString()}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Last Updated:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(collaborator.updated).toLocaleString()}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Modified By:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {collaborator.modified_by || 'Unknown'}
                  </Typography>
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
                Permanently delete this collaborator. This action cannot be undone.
              </Typography>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setDeleteDialogOpen(true)}
              >
                Delete Collaborator
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Collaborator</DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to delete this collaborator? This action cannot be undone.
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Type the collaborator ID <strong>{collaborator.collaborator_id}</strong> to confirm:
            </Typography>
            <TextField
              fullWidth
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`Type ${collaborator.collaborator_id} to confirm`}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleDelete}
              color="error"
              disabled={deleteConfirmText !== collaborator.collaborator_id.toString()}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default CollaboratorDetail;
