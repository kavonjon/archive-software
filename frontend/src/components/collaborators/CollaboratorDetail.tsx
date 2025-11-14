import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
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
  EditableJsonArrayField,
  EditableMultiRelationshipField,
  DateFormatHelp,
  DateInterpretationFeedback,
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

  // State for date interpretation feedback - prevents cross-field re-renders
  const [dateInterpretationValues, setDateInterpretationValues] = useState<Record<string, string>>({});

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

      // Check if value contains only digits (reject strings with non-numeric characters)
      if (!/^\d+$/.test(value.trim())) {
        setCollaboratorIdValidation({
          isValidating: false,
          error: 'Collaborator ID must be a positive integer (numbers only)',
          isValid: false
        });
        return;
      }

      const numericValue = parseInt(value, 10);
      if (isNaN(numericValue) || numericValue <= 0) {
        setCollaboratorIdValidation({
          isValidating: false,
          error: 'Collaborator ID must be a positive integer',
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
        // Pass id directly - backend handles both "id-XXXX" format and numeric IDs
        const collaboratorData = await collaboratorsAPI.get(id);
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
    
    // Clear validation state for collaborator_id when starting to edit
    if (fieldName === 'collaborator_id') {
      setCollaboratorIdValidation({
        isValidating: false,
        error: null,
        isValid: true
      });
    }
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

  // Handler for date interpretation feedback
  const handleDateInterpretationChange = (fieldName: string, value: string) => {
    setDateInterpretationValues(prev => ({ ...prev, [fieldName]: value }));
  };

  // Helper function to organize languoids hierarchically for display
  const organizeLanguoidsForDisplay = (languoids: any[]) => {
    if (!languoids || languoids.length === 0) return [];

    // Separate languages and dialects
    const languages = languoids
      .filter(l => l.level_glottolog === 'language')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    const dialects = languoids.filter(l => l.level_glottolog === 'dialect');
    
    // Create organized array
    const organized: any[] = [];
    
    // Add each language followed by its dialects
    languages.forEach(lang => {
      organized.push(lang);
      
      const childDialects = dialects
        .filter(d => d.parent_languoid === lang.id)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      organized.push(...childDialects);
    });
    
    // Add orphan dialects at the end
    const orphanDialects = dialects
      .filter(d => !languages.some(l => l.id === d.parent_languoid))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    organized.push(...orphanDialects);
    
    return organized;
  };

  const saveField = async (fieldName: string, value?: any) => {
    if (!collaborator || !id) return;  // Guard against undefined id

    const finalValue = value !== undefined ? value : editValues[fieldName];
    
    setSavingFields(prev => new Set(Array.from(prev).concat(fieldName)));

    try {
      // Convert collaborator_id to number if needed
      const processedValue = fieldName === 'collaborator_id' ? parseInt(finalValue, 10) : finalValue;
      
      // Use id from URL params - backend handles both "id-XXXX" format and numeric IDs
      const updatedCollaborator = await collaboratorsAPI.patch(id, {
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
    if (!collaborator || !id || deleteConfirmText !== collaborator.collaborator_id.toString()) return;

    try {
      // Use id from URL params - backend handles both "id-XXXX" format and numeric IDs
      await collaboratorsAPI.delete(id);
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
          onValueChange={(value) => handleDateInterpretationChange(fieldName, value)}
        />
        
        {/* Date interpretation feedback - shows what will happen to input */}
        <DateInterpretationFeedback 
          value={dateInterpretationValues[fieldName] || ''}
          show={isEditing}
        />
        
        {isEditing && <DateFormatHelp />}
      </Box>
    );
  };

  // Helper functions to compute display name variations
  const computeDisplayNameVariations = () => {
    if (!collaborator) return null;

    // If anonymous, all variations show "Anonymous {ID}"
    if (collaborator.anonymous) {
      const anonymousDisplay = `Anonymous ${collaborator.collaborator_id}`;
      return {
        fullName: anonymousDisplay,
        fullNameSortedByLastName: anonymousDisplay,
        firstAndLastName: anonymousDisplay,
        lastNameFirst: anonymousDisplay,
        lastNameOnly: anonymousDisplay,
        firstNameOnly: anonymousDisplay,
      };
    }

    const { first_names, nickname, last_names, name_suffix, full_name } = collaborator;

    // Helper to build parts with proper spacing
    const buildParts = (...parts: (string | undefined)[]) => {
      return parts.filter(p => p && p.trim()).join(' ');
    };

    // Full name sorted by last name: last_names name_suffix, first_names "nickname"
    const fullNameSortedByLastName = (() => {
      const lastPart = buildParts(last_names, name_suffix);
      const firstPart = buildParts(first_names, nickname ? `"${nickname}"` : undefined);
      if (lastPart && firstPart) {
        return `${lastPart}, ${firstPart}`;
      }
      return lastPart || firstPart || '';
    })();

    // First name & last name: first_names last_names name_suffix
    const firstAndLastName = buildParts(first_names, last_names, name_suffix);

    // Last name first: last_names name_suffix, first_names
    const lastNameFirst = (() => {
      const lastPart = buildParts(last_names, name_suffix);
      if (lastPart && first_names) {
        return `${lastPart}, ${first_names}`;
      }
      return lastPart || first_names || '';
    })();

    // Last name only: last_names
    const lastNameOnly = last_names || '';

    // First name only: first_names, unless empty then last_names (for mononyms)
    const firstNameOnly = first_names || last_names || '';

    return {
      fullName: full_name || '',
      fullNameSortedByLastName,
      firstAndLastName,
      lastNameFirst,
      lastNameOnly,
      firstNameOnly,
    };
  };

  // Helper function to compute searchable terms
  const computeSearchableTerms = () => {
    if (!collaborator) return '';

    // If anonymous, no searchable name terms
    if (collaborator.anonymous) {
      return '';
    }

    const { first_names, last_names, name_suffix, nickname, other_names } = collaborator;
    
    // Collect all text from relevant fields
    const textSources: string[] = [];
    if (first_names) textSources.push(first_names);
    if (last_names) textSources.push(last_names);
    if (name_suffix) textSources.push(name_suffix);
    if (nickname) textSources.push(nickname);
    if (other_names && Array.isArray(other_names)) {
      textSources.push(...other_names);
    }

    // Split all text into words and create a unique set
    const allWords = new Set<string>();
    textSources.forEach(text => {
      // Split by whitespace and common punctuation
      const words = text.split(/[\s,;.]+/).filter(word => word.trim().length > 0);
      words.forEach(word => allWords.add(word.trim()));
    });

    // Return as sorted, comma-separated list
    return Array.from(allWords).sort().join(', ');
  };

  const displayVariations = computeDisplayNameVariations();
  const searchableTerms = computeSearchableTerms();

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
                {collaborator.full_name || 'Unnamed Collaborator'}
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
                    : collaborator.full_name || `${collaborator.first_names || ''} ${collaborator.last_names || ''}`.trim() || 'No name provided'
                  }
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Associated Items</Typography>
                <Typography variant="h6">{collaborator.associated_items.length}</Typography>
              </Box>
            </Box>

            {/* Languages */}
            {(collaborator.native_languages.length > 0 || collaborator.other_languages.length > 0) && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Languages
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {organizeLanguoidsForDisplay(collaborator.native_languages).map((lang) => (
                    <Chip 
                      key={`native-${lang.id}`} 
                      label={`${lang.name} (Native)`} 
                      size="small" 
                      color={lang.level_glottolog === 'language' ? 'primary' : 'default'}
                      variant="outlined" 
                    />
                  ))}
                  {organizeLanguoidsForDisplay(collaborator.other_languages).map((lang) => (
                    <Chip 
                      key={`other-${lang.id}`} 
                      label={lang.name} 
                      size="small" 
                      color={lang.level_glottolog === 'language' ? 'primary' : 'default'}
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
                
                {/* Validation feedback and info for collaborator ID */}
                {editingFields.has('collaborator_id') && (
                  <Box sx={{ mt: 1 }}>
                    {/* Info message about the field purpose */}
                    <Alert severity="info" sx={{ mb: 1 }}>
                      This ID is for internal software bookkeeping. You can edit it without breaking things, but there's no need to organize these IDs in any particular way.
                    </Alert>
                    
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
                
                {/* Read-only display field - computed from name components by backend signal */}
                <Box sx={{ width: '100%', mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Full Name (auto-calculated):
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {collaborator.full_name || '(none)'}
                  </Typography>
                </Box>
                
                {renderEditableField('first_names', 'First and Middle Name(s)')}
                {renderEditableField('last_names', 'Last Name(s)')}
                {renderEditableField('name_suffix', 'Name Suffix')}
                {renderEditableField('nickname', 'Nickname')}
                
                <EditableJsonArrayField
                  fieldName="other_names"
                  label="Other Names"
                  value={collaborator.other_names || []}
                  isEditing={editingFields.has('other_names')}
                  isSaving={savingFields.has('other_names')}
                  editValue={editValues.other_names}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                  placeholder="Add alternative name..."
                />
                
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

            {/* Languages and Dialects */}
            <Card sx={{ mb: 3, elevation: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                  Languages and Dialects
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <EditableMultiRelationshipField
                  fieldName="native_languages"
                  label="Native/First Languages"
                  value={collaborator.native_languages || []}
                  isEditing={editingFields.has('native_languages')}
                  isSaving={savingFields.has('native_languages')}
                  editValue={editValues.native_languages}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                  relationshipEndpoint="/internal/v1/languoids/"
                  getOptionLabel={(option) => `${option.name}${option.glottocode ? ` (${option.glottocode})` : ''}`}
                  filterParams={{ level_glottolog__in: 'language,dialect' }}
                />
                
                {/* Info message for native languages when editing */}
                {editingFields.has('native_languages') && (
                  <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                    You can add both languages and dialects directly. When you add a dialect, its parent language will be automatically added as well.
                  </Alert>
                )}
                
                <EditableMultiRelationshipField
                  fieldName="other_languages"
                  label="Other Languages"
                  value={collaborator.other_languages || []}
                  isEditing={editingFields.has('other_languages')}
                  isSaving={savingFields.has('other_languages')}
                  editValue={editValues.other_languages}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                  relationshipEndpoint="/internal/v1/languoids/"
                  getOptionLabel={(option) => `${option.name}${option.glottocode ? ` (${option.glottocode})` : ''}`}
                  filterParams={{ level_glottolog__in: 'language,dialect' }}
                />
                
                {/* Info message for other languages when editing */}
                {editingFields.has('other_languages') && (
                  <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                    You can add both languages and dialects directly. When you add a dialect, its parent language will be automatically added as well.
                  </Alert>
                )}
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
                              component={RouterLink}
                              to={`/items/${item.id}`}
                              variant="h6"
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

            {/* Display Name Variations */}
            <Card sx={{ mb: 3, elevation: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                  Display Name Variations
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                  These variations show how the name will appear in different contexts.
                </Typography>

                {displayVariations && (
                  <>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                        Full Name:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {displayVariations.fullName || '(none)'}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                        Full Name Sorted by Last Name(s):
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {displayVariations.fullNameSortedByLastName || '(none)'}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                        First and Middle Name(s) & Last Name(s):
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {displayVariations.firstAndLastName || '(none)'}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                        Last Name(s), First and Middle Name(s):
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {displayVariations.lastNameFirst || '(none)'}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                        Last Name(s) Only:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {displayVariations.lastNameOnly || '(none)'}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                        First and Middle Name(s) Only:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {displayVariations.firstNameOnly || '(none)'}
                      </Typography>
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Searchable Name Terms */}
            <Card sx={{ mb: 3, elevation: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                  Searchable Name Terms
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                  All unique words from name fields that can be used to find this collaborator.
                </Typography>

                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Terms:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {searchableTerms || '(none)'}
                  </Typography>
                </Box>
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
